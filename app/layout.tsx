import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tabelog 百名店查詢器",
  description:
    "全日本 Tabelog 百名店探索工具，收錄約 7,000 間精選名店，支援地區、類別、價格與評分等多維度篩選，輕鬆發掘在地美食。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant" data-theme="winter">
      <head>
        <script
          async
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        ></script>
      </head>
      <body className="bg-base-200 text-base-content min-h-screen">
        {children}
      </body>
    </html>
  );
}
