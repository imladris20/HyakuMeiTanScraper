"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { IShop } from "../lib/types";
import icon from "./assets/icon.png";

export default function HomePage() {
  const [allShops, setAllShops] = useState<IShop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -- UI Input States --
  const [inputPref, setInputPref] = useState("");
  const [inputCity, setInputCity] = useState("");
  const [inputCategory, setInputCategory] = useState("");
  const [inputPrice, setInputPrice] = useState("");
  const [inputSearchTerm, setInputSearchTerm] = useState("");
  const [inputMinRating, setInputMinRating] = useState("");

  const [activeSearch, setActiveSearch] = useState({
    pref: "",
    city: "",
    category: "",
    price: "",
    term: "",
    minRating: "",
  });

  const [isDefaultView, setIsDefaultView] = useState(true);

  // Pagination & Sort
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof IShop>("rating");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Load Data
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/shops");
        if (!res.ok) {
          if (res.status === 404)
            throw new Error("尚未產生資料，請執行 npm run scrape:all");
          throw new Error("無法讀取資料");
        }
        const data = await res.json();
        setAllShops(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "載入失敗");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // -- Options (Derived from all data) --
  const { uniquePrefs, uniqueCities, uniqueCategories, uniquePrices } =
    useMemo(() => {
      const prefs = new Set<string>();
      const cities = new Set<string>();
      const cats = new Set<string>();
      const prices = new Set<string>();

      allShops.forEach((s) => {
        if (s.prefecture) prefs.add(s.prefecture);
        if (s.city) cities.add(s.city);
        if (s.category) cats.add(s.category);
        if (s.price) prices.add(s.price);
      });

      const parsePrice = (p: string) => {
        if (!p) return -1;
        if (p.startsWith("～")) return 0;
        const clean = p.replace(/[￥,]/g, "");
        const match = clean.match(/(\d+)/);
        return match ? parseInt(match[0], 10) : -1;
      };

      return {
        uniquePrefs: Array.from(prefs).sort(),
        uniqueCities: Array.from(cities).sort(),
        uniqueCategories: Array.from(cats).sort(),
        uniquePrices: Array.from(prices).sort(
          (a, b) => parsePrice(a) - parsePrice(b)
        ),
      };
    }, [allShops]);

  // -- Filtering Logic (Using activeSearch) --
  const filteredShops = useMemo(() => {
    return allShops.filter((shop) => {
      if (activeSearch.pref && shop.prefecture !== activeSearch.pref)
        return false;
      if (activeSearch.city && shop.city !== activeSearch.city) return false;
      if (activeSearch.category && shop.category !== activeSearch.category)
        return false;
      if (activeSearch.price && !shop.price?.includes(activeSearch.price))
        return false;
      if (activeSearch.term && !shop.name.includes(activeSearch.term))
        return false;

      if (activeSearch.minRating) {
        const r = shop.rating;
        if (r < parseFloat(activeSearch.minRating)) return false;
      }
      return true;
    });
  }, [allShops, activeSearch]);

  // -- Sorting & Slicing Logic --
  const displayShops = useMemo(() => {
    const final = [...filteredShops];

    const parsePrice = (p: string | undefined) => {
      if (!p || p === "-") return -1;
      if (p.startsWith("～")) return 0;
      const clean = p.replace(/[￥,]/g, "");
      const match = clean.match(/(\d+)/);
      return match ? parseInt(match[0], 10) : -1;
    };

    // Sort
    final.sort((a, b) => {
      const key = sortKey;

      // Price Sort
      if (sortKey === "price") {
        const valA = parsePrice(a.price);
        const valB = parsePrice(b.price);
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      }

      // Normal Sort
      let valA: string | number | undefined = a[key as keyof IShop];
      let valB: string | number | undefined = b[key as keyof IShop];

      if (sortKey === "rating") {
        valA = a.rating;
        valB = b.rating;
      }
      if (valA === undefined) valA = "";
      if (valB === undefined) valB = "";

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    // Special Rule: Default View -> Top 50 Only
    if (isDefaultView) {
      return final.slice(0, 50);
    }

    return final;
  }, [filteredShops, sortKey, sortOrder, isDefaultView]);

  // Pagination
  const totalPages = Math.ceil(displayShops.length / pageSize);
  const currentShops = displayShops.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // -- Handlers --
  const handleSort = (key: keyof IShop) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const executeSearch = () => {
    // 1. Commit inputs to active state
    setActiveSearch({
      pref: inputPref,
      city: inputCity,
      category: inputCategory,
      price: inputPrice,
      term: inputSearchTerm,
      minRating: inputMinRating,
    });
    // 2. Disable default view (user explicitly searched)
    setIsDefaultView(false);
    // 3. Reset pagination
    setCurrentPage(1);
    // 4. Rule 5: Always sort by Rating when searching
    setSortKey("rating");
    setSortOrder("desc");
  };

  const handleClear = () => {
    // 1. Clear UI inputs
    setInputPref("");
    setInputCity("");
    setInputCategory("");
    setInputPrice("");
    setInputSearchTerm("");
    setInputMinRating("");

    // 2. Clear Active Search
    setActiveSearch({
      pref: "",
      city: "",
      category: "",
      price: "",
      term: "",
      minRating: "",
    });

    // 3. Return to Default View (Top 50)
    setIsDefaultView(true);
    setSortKey("rating");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col items-center gap-4 md:flex-row">
        <Image
          src={icon}
          alt="Tabelog 百名店"
          width={128}
          height={80}
          className="rounded-lg shadow-sm"
        />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Tabelog 百名店資料庫</h1>
          <p className="text-base-content/70 text-sm">
            以日本知名食記網站
            <a
              href="https://award.tabelog.com/hyakumeiten"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              「食べログ 百名店」
            </a>
            為資料基礎，一次收錄全日本約 7,000
            間百名店，並提供完整資料查詢與篩選功能。
          </p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="card bg-base-100 mb-8 shadow-md">
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="form-control col-span-1 md:col-span-2 lg:col-span-4">
              <label className="label">
                <span className="label-text text-base font-semibold">店名</span>
              </label>
              <input
                type="text"
                className="input input-bordered input-primary mt-2 w-full focus:outline-offset-2"
                value={inputSearchTerm}
                onChange={(e) => setInputSearchTerm(e.target.value)}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base font-semibold">
                  都道府県
                </span>
              </label>
              <select
                className="select select-bordered select-primary mt-2 w-full"
                value={inputPref}
                onChange={(e) => setInputPref(e.target.value)}
              >
                <option value="">全部</option>
                {uniquePrefs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base font-semibold">
                  市町村区
                </span>
              </label>
              <select
                className="select select-bordered select-primary mt-2 w-full"
                value={inputCity}
                onChange={(e) => setInputCity(e.target.value)}
                disabled={!inputPref}
              >
                <option value="">全部</option>
                {uniqueCities
                  .filter(
                    (c) =>
                      !inputPref ||
                      allShops.some(
                        (s) => s.prefecture === inputPref && s.city === c
                      )
                  )
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base font-semibold">類別</span>
              </label>
              <select
                className="select select-bordered select-primary mt-2 w-full"
                value={inputCategory}
                onChange={(e) => setInputCategory(e.target.value)}
              >
                <option value="">全部</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base font-semibold">
                  價格區間
                </span>
              </label>
              <select
                className="select select-bordered select-primary mt-2 w-full"
                value={inputPrice}
                onChange={(e) => setInputPrice(e.target.value)}
              >
                <option value="">全部</option>
                {uniquePrices.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base font-semibold">
                  最低評分
                </span>
              </label>
              <select
                className="select select-bordered select-primary mt-2 w-full"
                value={inputMinRating}
                onChange={(e) => setInputMinRating(e.target.value)}
              >
                <option value="">不限</option>
                <option value="3.0">3.0+</option>
                <option value="3.5">3.5+</option>
                <option value="3.8">3.8+</option>
                <option value="4.0">4.0+</option>
              </select>
            </div>

            <div className="border-base-200 col-span-1 mt-6 flex justify-end gap-3 border-t pt-4 md:col-span-2 lg:col-span-4">
              {!isDefaultView && (
                <button
                  className="btn btn-ghost text-error"
                  onClick={handleClear}
                >
                  清除搜尋結果
                </button>
              )}
              <button className="btn btn-info px-8" onClick={executeSearch}>
                搜尋
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="py-20 text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content/70 mt-4">讀取資料中...</p>
        </div>
      ) : error ? (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              {isDefaultView ? (
                <span className="badge badge-lg badge-outline border-amber-400 font-normal text-amber-400">
                  精選 Top 50
                </span>
              ) : (
                <>搜尋結果: {displayShops.length} 筆</>
              )}
            </h2>

            <div className="flex items-center gap-4">
              {/* Top Pagination Control */}
              {totalPages > 1 && (
                <div className="join join-horizontal">
                  <button
                    className="join-item btn btn-xs btn-outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    «
                  </button>
                  <button className="join-item btn btn-xs btn-disabled border-base-300 text-base-content bg-transparent">
                    {currentPage} / {totalPages}
                  </button>
                  <button
                    className="join-item btn btn-xs btn-outline"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    »
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium whitespace-nowrap">
                  每頁顯示:
                </span>
                <select
                  className="select select-sm select-bordered"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-base-100 border-base-200 overflow-x-auto rounded-lg border shadow">
            <table className="table-zebra table w-full">
              <thead className="bg-base-200/50">
                <tr>
                  <th className="w-16">圖片</th>
                  <th
                    className="hover:bg-base-300 min-w-50 cursor-pointer"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      店名
                      {sortKey === "name" && (
                        <span className="text-xs">
                          {sortOrder === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="hover:bg-base-300 cursor-pointer whitespace-nowrap"
                    onClick={() => handleSort("category")}
                  >
                    <div className="flex items-center gap-1">
                      類別
                      {sortKey === "category" && (
                        <span className="text-xs">
                          {sortOrder === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="hover:bg-base-300 cursor-pointer whitespace-nowrap"
                    onClick={() => handleSort("prefecture")}
                  >
                    <div className="flex items-center gap-1">
                      都道府県
                      {sortKey === "prefecture" && (
                        <span className="text-xs">
                          {sortOrder === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="hover:bg-base-300 cursor-pointer whitespace-nowrap"
                    onClick={() => handleSort("city")}
                  >
                    <div className="flex items-center gap-1">
                      市町村区
                      {sortKey === "city" && (
                        <span className="text-xs">
                          {sortOrder === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="hover:bg-base-300 cursor-pointer whitespace-nowrap"
                    onClick={() => handleSort("rating")}
                  >
                    <div className="flex items-center gap-1">
                      評分
                      {sortKey === "rating" && (
                        <span className="text-xs">
                          {sortOrder === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="hover:bg-base-300 cursor-pointer whitespace-nowrap"
                    onClick={() => handleSort("price")}
                  >
                    <div className="flex items-center gap-1">
                      價格區間
                      {sortKey === "price" && (
                        <span className="text-xs">
                          {sortOrder === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="whitespace-nowrap">公休日</th>
                  <th>詳細資訊</th>
                </tr>
              </thead>
              <tbody>
                {currentShops.map((shop, idx) => (
                  <tr key={shop.url + idx} className="hover">
                    <td>
                      {shop.thumbnailUrl ? (
                        <div className="avatar">
                          <div className="ring-base-300 relative h-12 w-12 rounded ring-1 ring-offset-1">
                            <Image
                              src={shop.thumbnailUrl}
                              alt={shop.name}
                              fill
                              className="rounded object-cover"
                              unoptimized
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-base-200 text-base-content/30 flex h-12 w-12 items-center justify-center rounded text-xs">
                          無圖片
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-base font-bold">{shop.name}</div>
                      <div className="text-base-content/60 mt-0.5 text-xs">
                        {shop.address}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-ghost badge-sm whitespace-nowrap">
                        {shop.category}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{shop.prefecture}</td>
                    <td className="whitespace-nowrap">{shop.city}</td>
                    <td>
                      <div className="flex items-baseline gap-1">
                        <span className="text-amber-500">★</span>
                        <span className="font-mono">{shop.rating}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">
                      {shop.price || "-"}
                    </td>
                    <td
                      className="max-w-xs truncate text-xs"
                      title={shop.closedDay}
                    >
                      {shop.closedDay || "-"}
                    </td>
                    <td>
                      <a
                        href={shop.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-xs btn-outline btn-secondary"
                      >
                        Tabelog
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {displayShops.length === 0 && (
              <div className="text-base-content/50 p-8 text-center">
                沒有符合條件的店家
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 mb-8 flex justify-center">
              <div className="join shadow-sm">
                <button
                  className="join-item btn btn-sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  «
                </button>
                <div className="join-item btn btn-sm no-animation bg-base-100 cursor-default">
                  第 {currentPage} / {totalPages} 頁
                </div>
                <button
                  className="join-item btn btn-sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
