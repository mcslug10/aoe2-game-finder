import hashlib
import hmac
import io
import json
import os
import time
import zipfile
from typing import Any

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from mgz.summary import Summary

MAX_UPLOAD_BYTES = 100 * 1024 * 1024
TOKEN_SECRET = os.environ.get("COACH_SERVICE_TOKEN", "")

app = FastAPI(title="AOE2 Game Finder Coach Parser", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def verify_token(authorization: str | None) -> str:
    if not TOKEN_SECRET:
        raise HTTPException(status_code=503, detail="O serviço de análise não foi configurado.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de análise ausente.")
    token = authorization[7:].strip()
    try:
        payload_part, signature_part = token.split(".", 1)
        expected = hmac.new(TOKEN_SECRET.encode(), payload_part.encode(), hashlib.sha256).digest()
        import base64
        supplied = base64.urlsafe_b64decode(signature_part + "=" * (-len(signature_part) % 4))
        if not hmac.compare_digest(expected, supplied):
            raise ValueError("invalid signature")
        payload = json.loads(base64.urlsafe_b64decode(payload_part + "=" * (-len(payload_part) % 4)))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("expired")
        if payload.get("scope") != "replay:analyze" or not payload.get("sub"):
            raise ValueError("invalid scope")
        return str(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")


def extract_record(raw: bytes, filename: str) -> bytes:
    if filename.lower().endswith(".aoe2record"):
        return raw
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            candidates = [
                info for info in archive.infolist()
                if info.filename.lower().endswith(".aoe2record") and not info.is_dir()
            ]
            if not candidates:
                raise HTTPException(status_code=400, detail="O ZIP não contém um arquivo .aoe2record.")
            candidate = max(candidates, key=lambda info: info.file_size)
            if candidate.file_size > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="O replay extraído excede 100 MB.")
            return archive.read(candidate)
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Arquivo inválido. Envie um .aoe2record ou ZIP contendo o replay.")


def seconds(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value.total_seconds())
    except Exception:
        try:
            return float(value)
        except Exception:
            return None


def clock(value: float | None) -> str | None:
    if value is None:
        return None
    total = max(0, int(value))
    return f"{total // 60:02d}:{total % 60:02d}"


def safe_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    name = getattr(value, "name", None)
    return str(name if name is not None else value)


def player_profile_id(player: Any) -> int | None:
    value = getattr(player, "profile_id", None)
    try:
        return int(value) if value else None
    except Exception:
        return None


def input_data(event: Any, target_number: int) -> dict[str, Any] | None:
    player = getattr(event, "player", None)
    if player is None or getattr(player, "number", None) != target_number:
        return None
    at = seconds(getattr(event, "timestamp", None))
    kind = safe_str(getattr(event, "type", None)) or "Ação"
    detail = safe_str(getattr(event, "param", None))
    return {
        "timeSeconds": round(at, 2) if at is not None else None,
        "time": clock(at),
        "type": kind,
        "detail": detail,
    }


def age_name(value: Any) -> str:
    raw = (getattr(value, "name", None) or str(value)).upper()
    if "FEUDAL" in raw:
        return "Feudal"
    if "CASTLE" in raw:
        return "Castelos"
    if "IMPERIAL" in raw:
        return "Imperial"
    return raw.replace("_", " ").title()


def make_insights(player: dict[str, Any], metrics: dict[str, Any], age_ups: list[dict[str, Any]]) -> dict[str, list[dict[str, str]]]:
    positives: list[dict[str, str]] = []
    review: list[dict[str, str]] = []

    for age in age_ups:
        positives.append({
            "title": f"Chegada à Era {age['age']}",
            "detail": f"O replay registrou essa transição em {age['time']}. Use esse tempo para comparar com a abertura que você pretendia executar.",
        })

    if metrics.get("villagerQueueCommands", 0) > 0:
        positives.append({
            "title": "Produção de aldeões registrada",
            "detail": f"Foram detectados {metrics['villagerQueueCommands']} comandos de fila de aldeões. Isso confirma atividade de produção, mas não mede sozinho a continuidade da fila.",
        })

    if metrics.get("militaryQueueCommands", 0) > 0:
        positives.append({
            "title": "Produção militar registrada",
            "detail": f"Foram detectados {metrics['militaryQueueCommands']} comandos de fila de unidades que não foram identificadas como aldeões.",
        })

    eapm = player.get("eapm")
    if isinstance(eapm, (int, float)):
        positives.append({
            "title": "eAPM medido",
            "detail": f"O parser registrou {int(eapm)} ações efetivas por minuto. eAPM é um indicador de atividade, não uma nota isolada de habilidade.",
        })
    else:
        review.append({
            "title": "eAPM indisponível",
            "detail": "Esta versão do replay não forneceu eAPM confiável. Não foi estimado um valor artificial.",
        })

    if not age_ups:
        review.append({
            "title": "Transições de idade não identificadas",
            "detail": "O parser não encontrou eventos de avanço de idade para este jogador. Isso pode depender da versão/estrutura do replay; não significa necessariamente que a evolução não aconteceu.",
        })

    if metrics.get("villagerQueueCommands", 0) == 0:
        review.append({
            "title": "Fila de aldeões não identificada",
            "detail": "Não foram detectados comandos de fila de aldeões para este jogador. Confira a linha do tempo e a compatibilidade do replay.",
        })

    review.append({
        "title": "Compare a abertura com seu objetivo",
        "detail": "A linha do tempo mostra construções, filas e pesquisas. A próxima versão poderá comparar esses eventos com uma build order escolhida (Scout Rush, Archers, Fast Castle etc.).",
    })

    return {"positives": positives, "review": review}


def analyze_record(record: bytes, target_profile_id: int | None, filename: str) -> dict[str, Any]:
    digest = hashlib.sha256(record).hexdigest()
    try:
        summary = Summary(io.BytesIO(record))
        players = summary.get_players()
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Não foi possível interpretar este replay: {exc}")

    match = getattr(summary, "match", None)
    if match is None:
        raise HTTPException(
            status_code=422,
            detail="O replay foi lido, mas esta versão do parser não expôs a sequência detalhada de comandos. Atualize o analisador e tente novamente.",
        )

    selected = None
    if target_profile_id is not None:
        for player in match.players:
            parsed_id = player_profile_id(player)
            if parsed_id == target_profile_id:
                selected = player
                break
        if selected is None:
            raise HTTPException(
                status_code=409,
                detail="O replay não contém o perfil selecionado. Envie o replay da perspectiva desse jogador ou selecione o participante correto.",
            )
    else:
        owner_number = summary.get_owner()
        selected = next((player for player in match.players if player.number == owner_number), None)
        if selected is None and match.players:
            selected = match.players[0]

    if selected is None:
        raise HTTPException(status_code=422, detail="Nenhum jogador foi encontrado no replay.")

    player_rows = []
    selected_row = None
    for row in players:
        row_data = {
            "number": row.get("number"),
            "name": row.get("name"),
            "civilization": safe_str(row.get("civilization")),
            "winner": row.get("winner"),
            "eapm": row.get("eapm"),
            "profileId": row.get("user_id"),
            "teamId": row.get("team_id"),
        }
        player_rows.append(row_data)
        if row.get("number") == selected.number:
            selected_row = row_data

    raw_events = []
    for event in getattr(match, "inputs", []):
        item = input_data(event, selected.number)
        if item:
            raw_events.append(item)

    raw_events.sort(key=lambda item: item["timeSeconds"] if item["timeSeconds"] is not None else -1)
    relevant_events = [
        event for event in raw_events
        if event["type"].lower() in {"build", "queue", "de queue", "research", "resign", "make"}
    ]

    age_ups = []
    for uptime in getattr(match, "uptimes", []):
        if getattr(getattr(uptime, "player", None), "number", None) != selected.number:
            continue
        at = seconds(getattr(uptime, "timestamp", None))
        age_ups.append({"age": age_name(getattr(uptime, "age", None)), "timeSeconds": round(at, 2) if at is not None else None, "time": clock(at)})
    age_ups.sort(key=lambda item: item["timeSeconds"] if item["timeSeconds"] is not None else -1)

    unit_events = [event for event in relevant_events if event["type"].lower() in {"queue", "de queue"}]
    villager_events = [event for event in unit_events if "villager" in (event["detail"] or "").lower()]
    military_events = [event for event in unit_events if "villager" not in (event["detail"] or "").lower()]
    building_events = [event for event in relevant_events if event["type"].lower() == "build"]
    research_events = [event for event in relevant_events if event["type"].lower() == "research"]

    duration_ms = seconds(summary.get_duration())
    duration_seconds = duration_ms / 1000 if duration_ms is not None and duration_ms > 1000 else duration_ms
    duration_seconds = duration_seconds or seconds(getattr(match, "duration", None)) or 0
    action_count = sum(
        1 for action in getattr(match, "actions", [])
        if getattr(getattr(action, "player", None), "number", None) == selected.number
    )
    eapm = selected_row.get("eapm") if selected_row else None
    apm = round(action_count / (duration_seconds / 60), 1) if duration_seconds > 0 else None

    map_info = summary.get_map() or {}
    settings = summary.get_settings() or {}
    game_type = settings.get("type")
    game_type_name = game_type[1] if isinstance(game_type, (list, tuple)) and len(game_type) > 1 else safe_str(game_type)

    metrics = {
        "durationSeconds": round(duration_seconds, 1),
        "actionCount": action_count,
        "apm": apm,
        "eapm": eapm,
        "villagerQueueCommands": len(villager_events),
        "militaryQueueCommands": len(military_events),
        "buildingCommands": len(building_events),
        "researchCommands": len(research_events),
    }

    selected_report = {
        **(selected_row or {}),
        "name": getattr(selected, "name", None),
        "civilization": safe_str(getattr(selected, "civilization", None)),
        "winner": getattr(selected, "winner", None),
        "eapm": getattr(selected, "eapm", None),
        "profileId": player_profile_id(selected),
    }

    return {
        "fileName": filename[:180],
        "fileSha256": digest,
        "replayBytes": len(record),
        "parser": "aoc-mgz",
        "parserVersion": "1.8.51",
        "gameVersion": safe_str(getattr(match, "game_version", None)),
        "map": safe_str(map_info.get("name") if isinstance(map_info, dict) else map_info),
        "gameType": game_type_name,
        "completed": bool(summary.get_completed()),
        "rated": bool(summary.get_platform().get("rated")) if summary.get_platform() else None,
        "durationSeconds": round(duration_seconds, 1),
        "players": player_rows,
        "selectedPlayer": selected_report,
        "metrics": metrics,
        "ageUps": age_ups,
        "timeline": relevant_events[:100],
        "insights": make_insights(selected_report, metrics, age_ups),
        "limitations": [
            "eAPM mede atividade de comandos, não qualidade de decisão ou multitarefa.",
            "O parser não reconstrói sozinho a curva exata de recursos, aldeões ociosos ou unidades vivas ao longo da partida.",
            "As contagens de fila representam comandos detectados, não necessariamente a quantidade final de unidades produzidas.",
            "A nota global de habilidade só será calculada quando houver comparação com uma build order e um plano de jogo escolhidos.",
        ],
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "aoe2-coach-parser"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), authorization: str | None = Header(default=None)):
    verify_token(authorization)
    filename = file.filename or "replay.aoe2record"
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=400, detail="O arquivo enviado está vazio.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="O replay excede o limite de 100 MB.")
    record = extract_record(raw, filename)
    if len(record) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="O replay extraído excede 100 MB.")
    return analyze_record(record, None, filename)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
