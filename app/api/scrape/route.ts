import { NextResponse } from "next/server";

import { scrapeHyakumeiten } from "../../../lib/scraper";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const pref: string | undefined = body?.pref;

    if (!pref || typeof pref !== "string") {
      return NextResponse.json({ message: "缺少 pref 參數" }, { status: 400 });
    }

    const { shops, logs } = await scrapeHyakumeiten(pref);

    return NextResponse.json({
      pref,
      shops,
      logs,
    });
  } catch (e: any) {
    console.error("[api/scrape] error:", e);
    return NextResponse.json(
      { message: e?.message || "伺服端爬蟲發生錯誤" },
      { status: 500 }
    );
  }
}
