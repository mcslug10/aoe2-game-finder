import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AOE2 Game Finder — Find your next match",
  description: "Find Age of Empires II: Definitive Edition players, create rooms and organize your next match.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
