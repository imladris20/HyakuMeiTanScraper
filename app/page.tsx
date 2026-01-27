"use client";

import { useState } from "react";
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

  const handleRun = async () => {
    setError(null);
    setLoading(true);
    setShops([]);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pref }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "爬蟲執行失敗");
      }

      const data: ScrapeResponse = await res.json();
      setShops(data.shops);
      setCurrentPref(data.pref);
    } catch (e: any) {
      setError(e.message || "未知錯誤");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setShops([]);
    setCurrentPref(null);
    setError(null);
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
            選好都道府縣後按下「執行爬蟲」，會呼叫 Playwright 在伺服端跑一次，
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
              {loading ? "執行中..." : "執行爬蟲"}
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

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title mb-4">
            爬蟲結果
            {currentPref && (
              <span className="badge badge-outline ml-2">
                Pref: {currentPref}
              </span>
            )}
          </h2>

          {shops.length === 0 ? (
            <p className="text-base-content/70 text-sm">
              目前尚無結果，請先選擇都道府縣並執行爬蟲。
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
