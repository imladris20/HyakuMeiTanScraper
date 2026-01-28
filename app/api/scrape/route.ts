import { scrapeHyakumeiten } from "@/lib/scraper";

export const runtime = "nodejs";

type StreamEvent =
  | { type: "log"; message: string }
  | { type: "result"; pref: string; shops: any[] }
  | { type: "error"; message: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const pref: string | undefined = (body as any)?.pref;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        const line = JSON.stringify(event) + "\n";
        controller.enqueue(encoder.encode(line));
      };

      if (!pref || typeof pref !== "string") {
        send({ type: "error", message: "缺少 pref 參數" });
        controller.close();
        return;
      }

      try {
        const { shops } = await scrapeHyakumeiten(pref, (msg) => {
          send({ type: "log", message: msg });
        });

        send({ type: "result", pref, shops });
      } catch (e: any) {
        console.error("[api/scrape] error:", e);
        send({
          type: "error",
          message: e?.message || "伺服端爬蟲發生錯誤",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
