import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "つりめぐり | TSURIMEGURI",
  applicationName: "つりめぐり",
  description: "つりめぐりで、釣った魚・出かけた場所・あの瞬間を記録。釣りの思い出を振り返り、共有しよう。",
  openGraph: {
    title: "つりめぐり | TSURIMEGURI",
    description: "釣った魚・出かけた場所・あの瞬間を記録して共有しよう。",
    siteName: "つりめぐり",
    locale: "ja_JP",
    type: "website",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/brand/apple-touch-icon.png",
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
