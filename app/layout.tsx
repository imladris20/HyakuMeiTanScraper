import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tabelog 百名店查詢器",
  description: "選擇都道府縣後即可查詢，等待完成後就可以下載 CSV 檔",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant" data-theme="dark">
      <body className="bg-base-200 text-base-content min-h-screen">
        {children}
      </body>
    </html>
  );
}
