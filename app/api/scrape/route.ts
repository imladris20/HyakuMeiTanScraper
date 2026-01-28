
import { scrapeHyakumeiten } from "@/lib/scraper";
import type { IShop } from "../../../legacy/types";

export const runtime = "nodejs";

type StreamEvent =
  | { type: "log"; message: string }
  | { type: "result"; pref: string; shops: IShop[] }
  | { type: "error"; message: string };

interface RequestBody {
  pref?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const pref: string | undefined = body?.pref;

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
      } catch (e) {
        console.error("[api/scrape] error:", e);
        const errorMessage =
          e instanceof Error ? e.message : "伺服端爬蟲發生錯誤";
        send({
          type: "error",
          message: errorMessage,
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
