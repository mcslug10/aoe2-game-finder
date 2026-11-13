import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AOE2 Game Finder — Encontre sua próxima partida",
  description: "Encontre jogadores de Age of Empires II: Definitive Edition, crie salas e organize sua próxima partida.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
