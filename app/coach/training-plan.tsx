"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Download, Flame, Target, CheckCircle2 } from "lucide-react";
import styles from "./training-plan.module.css";

type TrainingTip = {
  severity: "high" | "medium" | "positive";
  time: string | null;
  title: string;
  detail: string;
  action: string;
};

type Props = {
  tips: TrainingTip[];
  strengths: string[];
  player: string;
  map: string;
  score: number | null;
};

export default function CoachTrainingPlan({ tips, strengths, player, map, score }: Props) {
  const priorities = useMemo(() => tips
    .filter((tip) => tip.severity !== "positive")
    .sort((a, b) => (a.severity === "high" ? 0 : 1) - (b.severity === "high" ? 0 : 1))
    .slice(0, 3), [tips]);
  const [checked, setChecked] = useState<string[]>([]);
  const tasks = useMemo(() => [
    { id: "warmup", title: "Aquecimento (5 min)", text: "Entre no jogo, faça uma abertura simples e mantenha a produção de aldeões sem interrupção." },
    { id: "focus1", title: "Treino principal (10 min)", text: priorities[0]?.action || "Pratique uma abertura conhecida e revise os tempos de avanço de idade." },
    { id: "focus2", title: "Aplicação (10 min)", text: priorities[1]?.action || "Treine controle de grupos: separar exército, explorar e evitar deslocamentos sem objetivo." },
    { id: "review", title: "Revisão (5 min)", text: "Após a partida, confira se o foco foi aplicado e escolha apenas um ajuste para a próxima sessão." },
  ], [priorities]);
  const completed = tasks.filter((task) => checked.includes(task.id)).length;

  function downloadPlan() {
    const content = [
      "AOE2 COACH — PLANO DE TREINO",
      `Jogador: ${player}`,
      `Mapa: ${map}`,
      `Pontuação experimental: ${score ?? "não disponível"}`,
      "",
      "PRIORIDADES DO REPLAY",
      ...priorities.map((tip, index) => `${index + 1}. ${tip.title}${tip.time ? " (" + tip.time + ")" : ""}\n   Evidência: ${tip.detail}\n   Treino: ${tip.action}`),
      "",
      "SESSÃO DE 30 MINUTOS",
      ...tasks.map((task) => `[ ${checked.includes(task.id) ? "x" : " "}] ${task.title}\n   ${task.text}`),
      "",
      "PONTOS FORTES",
      ...(strengths.length ? strengths.map((item) => "- " + item) : ["- Revise os pontos positivos indicados no relatório."]),
      "",
      "Nota: recomendações automáticas são baseadas nos eventos detectados; valide no replay."
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aoe2-coach-plano-treino.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <section className={styles.card} aria-labelledby="coach-training-title">
    <div className={styles.header}>
      <div className={styles.icon}><ClipboardList size={21}/></div>
      <div className={styles.heading}>
        <span className={styles.kicker}>DA ANÁLISE PARA A PRÁTICA</span>
        <h3 id="coach-training-title">Plano de treino personalizado</h3>
        <p>Transforme os pontos do replay em uma sessão objetiva de 30 minutos.</p>
      </div>
      <button type="button" className={styles.download} onClick={downloadPlan}><Download size={15}/> Exportar plano</button>
    </div>
    <div className={styles.priorityList}>
      {priorities.length ? priorities.map((tip, index) => <article className={styles.priority} key={index}>
        <span className={tip.severity === "high" ? styles.high : styles.medium}>{index + 1}</span>
        <div><b>{tip.title}</b><small>{tip.time || "Ponto geral do replay"}</small><p>{tip.action}</p></div>
      </article>) : <p className={styles.empty}>Não há alertas suficientes para criar prioridades. Use os pontos fortes e revise a linha do tempo.</p>}
    </div>
    <div className={styles.sessionHeading}><div><Flame size={17}/><b>Sua próxima sessão</b></div><span>{completed}/{tasks.length} concluídas</span></div>
    <div className={styles.progress}><span style={{ width: (completed / tasks.length * 100) + "%" }}/></div>
    <div className={styles.tasks}>
      {tasks.map((task) => <label className={checked.includes(task.id) ? styles.taskDone : styles.task} key={task.id}>
        <input type="checkbox" checked={checked.includes(task.id)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))}/>
        <span><b>{task.title}</b><small>{task.text}</small></span>
      </label>)}
    </div>
    {strengths.length > 0 && <div className={styles.strength}><CheckCircle2 size={16}/><span><b>Continue mantendo:</b> {strengths[0]}</span></div>}
    <p className={styles.note}><Target size={14}/> Plano sugerido por heurísticas do replay, não por uma simulação completa do estado do jogo.</p>
  </section>;
}
