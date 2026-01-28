"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PREF_OPTIONS } from "@/legacy/constants";
import type { IShop } from "@/legacy/types";

import icon from "./assets/icon.png";
type StreamEvent =
  | { type: "log"; message: string }
  | { type: "result"; pref: string; shops: IShop[] }
  | { type: "error"; message: string };

export default function HomePage() {
  const [pref, setPref] = useState<string>("nagano");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<IShop[]>([]);
  const [currentPref, setCurrentPref] = useState<string | null>(null);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  const PAGE_SIZE = 20;

  const totalPages = Math.max(1, Math.ceil(shops.length / PAGE_SIZE));
  const paginatedShops = shops.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const appendLog = (message: string) => {
    setConsoleLines((prev) => [...prev, message]);
  };

  useEffect(() => {
    const el = consoleRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [consoleLines]);

  const handleRun = async () => {
    setError(null);
    setLoading(true);
    setShops([]);
    setCurrentPref(null);
    setCurrentPage(1);
    setConsoleLines([]);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pref }),
      });

      if (!res.body) {
        throw new Error("瀏覽器不支援串流回應");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          let event: StreamEvent | null = null;
          try {
            event = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }

          if (event.type === "log") {
            appendLog(event.message);
          } else if (event.type === "result") {
            setShops(event.shops);
            setCurrentPref(event.pref);
          } else if (event.type === "error") {
            setError(event.message);
            appendLog(`❌ [server] ${event.message}`);
          }
        }
      }
    } catch (e: any) {
      appendLog(`❌ [client] ${e?.message ?? String(e)}`);
      setError(e.message || "未知錯誤");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setShops([]);
    setCurrentPref(null);
    setError(null);
    setConsoleLines([]);
    setCurrentPage(1);
  };

  const downloadUrl =
    currentPref != null
      ? `/api/download?pref=${encodeURIComponent(currentPref)}`
      : null;

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Image src={icon} alt="Tabelog 百名店查詢器" width={128} height={80} />
        <h1 className="text-3xl font-bold">Tabelog 百名店查詢器</h1>
      </div>

      <div className="card bg-base-100 mb-8 shadow">
        <div className="card-body space-y-4">
          <h2 className="card-title">選擇都道府縣並執行</h2>
          <p className="text-base-content/70 text-sm">
            選好都道府縣後按下「查詢」，會呼叫 Playwright 在伺服端跑一次，
            並同時產生 CSV 與下方表格結果。
          </p>

          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <label className="form-control w-full md:max-w-xs">
              <div className="label">
                <span className="label-text">都道府縣</span>
              </div>
              <select
                className="select select-bordered w-full"
                value={pref}
                onChange={(e) => setPref(e.target.value)}
                disabled={loading}
                suppressHydrationWarning={true}
              >
                {PREF_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="btn btn-primary md:ml-4"
              onClick={handleRun}
              disabled={loading}
            >
              {loading ? "執行中..." : "查詢"}
            </button>

            <button
              className="btn md:ml-2"
              onClick={handleClear}
              disabled={loading && shops.length === 0}
            >
              清除結果
            </button>

            {downloadUrl && (
              <a href={downloadUrl} className="btn btn-outline md:ml-auto">
                下載 CSV
              </a>
            )}
          </div>

          {error && (
            <div className="alert alert-error mt-4">
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 mb-8 shadow">
        <div className="card-body space-y-4">
          <h2 className="card-title mb-0">執行進度</h2>
          <p className="text-base-content/70 mb-2 text-sm">
            根據店家數量多寡與硬體設備、網路速度等因素，執行時間可能會有所不同，約會在
            3-8 分鐘之間完成，請耐心等候。
          </p>
          <div className="mockup-window border-base-300 bg-base-300/40 border">
            <div
              ref={consoleRef}
              className="bg-neutral text-neutral-content h-64 overflow-y-auto px-4 py-3 font-mono text-xs"
            >
              {consoleLines.length === 0 ? (
                <span className="text-neutral-content/60">
                  尚未開始執行，請先點擊上方「查詢」。
                </span>
              ) : (
                consoleLines.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          {currentPref && (
            <h2 className="card-title mb-4">
              查詢結果：
              {PREF_OPTIONS.find((p) => p.value === currentPref)?.label ||
                currentPref}
              共有 {shops.length} 間百名店
            </h2>
          )}

          {shops.length === 0 ? (
            <p className="text-base-content/70 text-sm">
              目前尚無結果，請先選擇都道府縣並查詢。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-zebra table-sm table min-w-max">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">店名</th>
                    <th className="whitespace-nowrap">地址</th>
                    <th className="whitespace-nowrap">類別</th>
                    <th>URL</th>
                    <th>評分</th>
                    <th className="whitespace-nowrap">價格</th>
                    <th>公休日</th>
                    <th>營業時間</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedShops.map((shop, idx) => (
                    <tr key={shop.url || idx}>
                      <td className="whitespace-nowrap">{shop.name}</td>
                      <td className="whitespace-nowrap">{shop.address}</td>
                      <td className="whitespace-nowrap">{shop.category}</td>
                      <td>
                        <a
                          href={shop.url}
                          target="_blank"
                          rel="noreferrer"
                          className="link link-primary"
                        >
                          開啟
                        </a>
                      </td>
                      <td>{shop.rating}</td>
                      <td className="whitespace-nowrap">{shop.price ?? "-"}</td>
                      <td>{shop.closedDay ?? "-"}</td>
                      <td>{shop.businessHour ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="text-base-content/70 text-sm">
                  顯示第 {(currentPage - 1) * PAGE_SIZE + 1} -{" "}
                  {Math.min(currentPage * PAGE_SIZE, shops.length)} 筆，共{" "}
                  {shops.length} 筆
                </div>

                <div className="join">
                  <button
                    className="btn btn-sm join-item"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    上一頁
                  </button>
                  <span className="btn btn-sm join-item pointer-events-none">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    className="btn btn-sm join-item"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    下一頁
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
