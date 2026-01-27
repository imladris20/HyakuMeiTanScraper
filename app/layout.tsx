import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tabelog 百名店查詢器 UI",
  description: "選擇都道府縣並執行爬蟲，查看與下載結果",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="bg-base-200 text-base-content min-h-screen">
        {children}
      </body>
    </html>
  );
}
