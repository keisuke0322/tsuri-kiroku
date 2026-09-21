import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "釣果ノート",
  description: "釣行日・場所・魚種を記録して振り返る釣果管理サイト。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
