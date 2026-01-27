"use client";

import { useEffect, useRef, useState } from "react";
import type { IShop } from "../types";
import { PREF_OPTIONS } from "./constants";

interface ScrapeResponse {
  shops: IShop[];
  pref: string;
}

export default function HomePage() {
  const [pref, setPref] = useState<string>("nagano");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<IShop[]>([]);
  const [currentPref, setCurrentPref] = useState<string | null>(null);
   const [consoleLines, setConsoleLines] = useState<string[]>([]);
   const consoleRef = useRef<HTMLDivElement | null>(null);

  const appendLog = (message: string) => {
    const now = new Date();
    const ts = now.toTimeString().slice(0, 8); // HH:MM:SS
    setConsoleLines((prev) => [...prev, `[${ts}] ${message}`]);
  };

  useEffect(() => {
    const el = consoleRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [consoleLines]);

  const handleRun = async () => {
    appendLog(`開始查詢（pref=${pref}）`);
    setError(null);
    setLoading(true);
    setShops([]);

    try {
      appendLog("已送出 API 請求到 /api/scrape");
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pref }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        appendLog(`伺服端回傳錯誤狀態碼：${res.status}`);
        throw new Error(data.message || "查詢失敗");
      }

      const data: ScrapeResponse = await res.json();
      setShops(data.shops);
      setCurrentPref(data.pref);
      appendLog(`查詢完成，共取得 ${data.shops.length} 間店家`);
    } catch (e: any) {
      appendLog(`發生錯誤：${e?.message ?? String(e)}`);
      setError(e.message || "未知錯誤");
    } finally {
      appendLog("執行結束");
      setLoading(false);
    }
  };

  const handleClear = () => {
    setShops([]);
    setCurrentPref(null);
    setError(null);
    setConsoleLines([]);
    appendLog("已清除畫面與結果");
  };

  const downloadUrl =
    currentPref != null
      ? `/api/download?pref=${encodeURIComponent(currentPref)}`
      : null;

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Tabelog 百名店查詢器</h1>

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
          <h2 className="card-title mb-2">Console 狀態</h2>
          <div className="mockup-window border border-base-300 bg-base-300/40">
            <div
              ref={consoleRef}
              className="bg-base-900 text-base-100 px-4 py-3 h-64 overflow-y-auto font-mono text-xs"
            >
              {consoleLines.length === 0 ? (
                <span className="text-base-content/60">
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
          <h2 className="card-title mb-4">
            查詢結果
            {currentPref && (
              <span className="badge badge-outline ml-2">
                Pref: {currentPref}
              </span>
            )}
          </h2>

          {shops.length === 0 ? (
            <p className="text-base-content/70 text-sm">
              目前尚無結果，請先選擇都道府縣並查詢。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-zebra table-sm table">
                <thead>
                  <tr>
                    <th>店名</th>
                    <th>地址</th>
                    <th>類別</th>
                    <th>URL</th>
                    <th>評分</th>
                    <th>價格</th>
                    <th>公休日</th>
                    <th>營業時間</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop, idx) => (
                    <tr key={shop.url || idx}>
                      <td>{shop.name}</td>
                      <td>{shop.address}</td>
                      <td>{shop.category}</td>
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
                      <td>{shop.price ?? "-"}</td>
                      <td>{shop.closedDay ?? "-"}</td>
                      <td>{shop.businessHour ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
