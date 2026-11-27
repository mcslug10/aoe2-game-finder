"use client";

import { Download, Printer } from "lucide-react";
import styles from "./report-actions.module.css";

export default function CoachReportActions({ report, player }: { report: unknown; player: string }) {
  function download() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aoe2-coach-${player.trim().replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "replay"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return <div className={styles.actions}>
    <button type="button" onClick={download}><Download size={14}/> Baixar dados JSON</button>
    <button type="button" onClick={() => window.print()}><Printer size={14}/> Imprimir / PDF</button>
  </div>;
}