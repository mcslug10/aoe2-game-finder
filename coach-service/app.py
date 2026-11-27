import hashlib
import hmac
import io
import json
import math
import os
import time
import zipfile
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
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
            # Read in bounded chunks: protects against malformed ZIP metadata and
            # decompression bombs whose actual output exceeds the declared size.
            chunks: list[bytes] = []
            total = 0
            with archive.open(candidate, "r") as source:
                while True:
                    chunk = source.read(min(1024 * 1024, MAX_UPLOAD_BYTES + 1 - total))
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MAX_UPLOAD_BYTES:
                        raise HTTPException(status_code=413, detail="O replay extraído excede 100 MB.")
                    chunks.append(chunk)
            return b"".join(chunks)
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Arquivo inválido. Envie um .aoe2record ou ZIP contendo o replay.")
    except (RuntimeError, OSError, zipfile.LargeZipFile):
        raise HTTPException(status_code=400, detail="Não foi possível extrair o replay do ZIP. Verifique se o arquivo não está protegido ou corrompido.")


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
    text = str(name if name is not None else value)
    return text[:240]


def player_profile_id(player: Any) -> int | None:
    value = getattr(player, "profile_id", None)
    try:
        return int(value) if value else None
    except Exception:
        return None


def event_category(kind: str) -> str:
    """Map normalized replay input names to conservative action categories."""
    name = kind.strip().lower()
    if name in {"build", "reseed"}:
        return "building"
    if name in {"queue", "de queue", "make"}:
        return "production"
    if name == "research":
        return "research"
    if name in {"attack move", "attack-move"}:
        return "attack_move"
    if name in {"order", "target", "patrol", "follow", "guard", "stop", "garrison", "formation", "stance"}:
        return "unit_order"
    if name in {"gather point", "spawn"}:
        return "rally"
    if name in {"resign"}:
        return "match"
    return "other"


def input_data(event: Any, target_number: int | None = None) -> dict[str, Any] | None:
    player = getattr(event, "player", None)
    if player is None:
        return None
    player_number = getattr(player, "number", None)
    if target_number is not None and player_number != target_number:
        return None
    at = seconds(getattr(event, "timestamp", None))
    kind = safe_str(getattr(event, "type", None)) or "Ação"
    detail = safe_str(getattr(event, "param", None))
    if detail is not None and detail.lower() in {"nan", "inf", "-inf"}:
        detail = None
    payload = getattr(event, "payload", None) or {}
    position = getattr(event, "position", None)
    x = getattr(position, "x", None)
    y = getattr(position, "y", None)
    object_ids = payload.get("object_ids", []) if isinstance(payload, dict) else []
    group_key = hashlib.sha256(",".join(str(value) for value in sorted(str(value) for value in object_ids)).encode()).hexdigest()[:12] if isinstance(object_ids, (list, tuple)) and object_ids else None
    return {
        "timeSeconds": round(at, 2) if at is not None else None,
        "time": clock(at),
        "playerNumber": player_number,
        "playerName": safe_str(getattr(player, "name", None)),
        "type": kind,
        "category": event_category(kind),
        "detail": detail,
        "position": {"x": round(float(x), 2), "y": round(float(y), 2)} if isinstance(x, (int, float)) and isinstance(y, (int, float)) and math.isfinite(float(x)) and math.isfinite(float(y)) else None,
        "selectedUnitCount": len(object_ids) if isinstance(object_ids, (list, tuple)) else None,
        "selectionGroupKey": group_key,
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


def economy_series(player: Any, max_points: int = 90) -> dict[str, Any]:
    """Return a bounded sample of the replay's total-stockpile/object-count statistics."""
    max_points = max(2, int(max_points))
    rows = getattr(player, "timeseries", []) or []
    normalized = []
    for row in rows:
        at = seconds(getattr(row, "timestamp", None))
        resources = getattr(row, "total_resources", None)
        objects = getattr(row, "total_objects", None)
        if at is None or not isinstance(resources, (int, float)):
            continue
        normalized.append({
            "timeSeconds": round(at, 1),
            "totalResources": int(resources),
            "totalObjects": int(objects) if isinstance(objects, (int, float)) and math.isfinite(float(objects)) else None,
        })
    if len(normalized) > max_points:
        # Evenly spaced indices include both endpoints and never exceed max_points.
        last_index = len(normalized) - 1
        indexes = sorted({round(index * last_index / (max_points - 1)) for index in range(max_points)})
        normalized = [normalized[index] for index in indexes]
    values = [point["totalResources"] for point in normalized]
    object_values = [point["totalObjects"] for point in normalized if point["totalObjects"] is not None]
    return {
        "points": normalized,
        "sampleCount": len(rows),
        "resourceStart": values[0] if values else None,
        "resourceEnd": values[-1] if values else None,
        "resourcePeak": max(values) if values else None,
        "resourceDelta": values[-1] - values[0] if len(values) >= 2 else None,
        "objectsStart": normalized[0]["totalObjects"] if normalized else None,
        "objectsEnd": normalized[-1]["totalObjects"] if normalized else None,
        "objectsPeak": max(object_values) if object_values else None,
        "note": "Soma de recursos registrada pelo parser (não separa comida, madeira, ouro e pedra). A série pode ser amostrada; não mede por si só aldeões ociosos nem eficiência econômica.",
    }


def movement_analysis(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize recorded orders without claiming they represent executed paths."""
    orders = [event for event in events if event.get("category") in {"attack_move", "unit_order"}]
    positioned = [event for event in orders if isinstance(event.get("position"), dict)]
    selected_counts = [
        event["selectedUnitCount"] for event in orders
        if isinstance(event.get("selectedUnitCount"), int) and event["selectedUnitCount"] > 0
    ]
    # Coarse 8-tile cells are descriptive command clusters, not path reconstruction.
    cells: dict[tuple[int, int], int] = {}
    for event in positioned:
        pos = event["position"]
        cell = (int(float(pos["x"]) // 8) * 8, int(float(pos["y"]) // 8) * 8)
        cells[cell] = cells.get(cell, 0) + 1
    top_areas = [
        {"x": x, "y": y, "commands": count}
        for (x, y), count in sorted(cells.items(), key=lambda item: (-item[1], item[0]))[:5]
    ]
    by_group: dict[str, list[dict[str, Any]]] = {}
    for event in positioned:
        key = event.get("selectionGroupKey")
        if key:
            by_group.setdefault(key, []).append(event)
    target_segments = []
    for group_events in by_group.values():
        group_events.sort(key=lambda event: event.get("timeSeconds") if event.get("timeSeconds") is not None else -1)
        for previous, current in zip(group_events, group_events[1:]):
            previous_time, current_time = previous.get("timeSeconds"), current.get("timeSeconds")
            if previous_time is None or current_time is None or current_time < previous_time or current_time - previous_time > 120:
                continue
            p1, p2 = previous["position"], current["position"]
            distance = ((float(p2["x"]) - float(p1["x"])) ** 2 + (float(p2["y"]) - float(p1["y"])) ** 2) ** 0.5
            target_segments.append(distance)
    return {
        "orderCount": len(orders),
        "attackMoveCount": sum(1 for event in orders if event.get("category") == "attack_move"),
        "ordersWithCoordinates": len(positioned),
        "averageSelectedUnits": round(sum(selected_counts) / len(selected_counts), 1) if selected_counts else None,
        "sameSelectionTargetChanges": len(target_segments),
        "averageTargetDistance": round(sum(target_segments) / len(target_segments), 1) if target_segments else None,
        "maxTargetDistance": round(max(target_segments), 1) if target_segments else None,
        "topCommandAreas": top_areas,
        "interpretation": "Áreas agrupam coordenadas de ordens registradas em células aproximadas de 8 unidades do mapa. Distância de alvo compara ordens consecutivas do mesmo grupo de seleção em até 120 s; não é distância realmente percorrida, presença contínua ou prova de combate.",
    }


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

    if metrics.get("movementCommands", 0) > 0:
        positives.append({
            "title": "Ordens de unidades identificadas",
            "detail": f"Foram registrados {metrics['movementCommands']} comandos de ordem/posicionamento, incluindo {metrics.get('attackMoveCommands', 0)} Attack Move. {metrics.get('ordersWithMapPosition', 0)} ordens trazem coordenadas no mapa; isso é uma base para reconstruir movimentos, mas ainda não prova a trajetória executada nem o resultado do combate.",
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

    all_events = []
    raw_events = []
    for event in getattr(match, "inputs", []):
        item = input_data(event)
        if item:
            all_events.append(item)
            if item["playerNumber"] == selected.number:
                raw_events.append(item)

    event_sort = lambda item: (item["timeSeconds"] if item["timeSeconds"] is not None else -1, item["playerNumber"] if item["playerNumber"] is not None else -1, item["type"] or "", item["detail"] or "")
    all_events.sort(key=event_sort)
    raw_events.sort(key=event_sort)
    opponent_events = [
        event for event in all_events
        if event["playerNumber"] != selected.number
        and event["category"] in {"building", "production", "research", "attack_move", "unit_order"}
    ]
    relevant_events = [
        event for event in raw_events
        if event["category"] in {"building", "production", "research", "attack_move", "unit_order", "rally", "match"}
    ]
    order_events = [event for event in relevant_events if event["category"] in {"attack_move", "unit_order"}]
    positioned_orders = [event for event in order_events if event["position"] is not None]
    attack_move_events = [event for event in relevant_events if event["category"] == "attack_move"]

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
        "movementCommands": len(order_events),
        "attackMoveCommands": len(attack_move_events),
        "ordersWithMapPosition": len(positioned_orders),
        "ordersWithoutMapPosition": len(order_events) - len(positioned_orders),
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
        "movementAnalysis": movement_analysis(relevant_events),
        "economySeries": economy_series(selected),
        "opponentTimeline": opponent_events[:150],
        "ageUps": age_ups,
        "timeline": relevant_events[:250],
        "timelineTotal": len(relevant_events),
        "timelineDisplayed": min(len(relevant_events), 250),
        "timelineTruncated": len(relevant_events) > 250,
        "timelineLimit": 250,
        "opponentTimelineTotal": len(opponent_events),
        "opponentTimelineDisplayed": min(len(opponent_events), 150),
        "opponentTimelineTruncated": len(opponent_events) > 150,
        "opponentTimelineLimit": 150,
        "insights": make_insights(selected_report, metrics, age_ups),
        "limitations": [
            "eAPM mede atividade de comandos, não qualidade de decisão ou multitarefa.",
            "A timeline é limitada a 250 eventos do jogador e 150 eventos adversários para manter a resposta leve; os totais e indicadores de truncamento informam quando houve corte.",
            "O parser não reconstrói sozinho a curva exata de recursos, aldeões ociosos ou unidades vivas ao longo da partida.",
            "As contagens de fila representam comandos detectados, não necessariamente a quantidade final de unidades produzidas.",
            "A nota global de habilidade só será calculada quando houver comparação com uma build order e um plano de jogo escolhidos.",
        ],
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "aoe2-coach-parser"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), profile_id: int | None = Form(default=None), authorization: str | None = Header(default=None)):
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
    return analyze_record(record, profile_id, filename)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
