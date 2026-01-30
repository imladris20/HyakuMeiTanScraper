"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { IoLocationSharp } from "react-icons/io5";
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

  // Location Input State
  const [inputLocation, setInputLocation] = useState("");
  const locationInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);

  const [activeSearch, setActiveSearch] = useState({
    pref: "",
    city: "",
    category: "",
    price: "",
    term: "",
    minRating: "",
    // Location Search State
    location: null as { lat: number; lng: number; address: string } | null,
  });

  // Pending Location for Autocomplete/My Location before search execution
  const [pendingLocation, setPendingLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);

  const [isDefaultView, setIsDefaultView] = useState(true);

  // Pagination & Sort
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof IShop | "distance">("rating");
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

  // Initialize Google Autocomplete
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!locationInputRef.current || !(window as any).google) return;

    if (!autocompleteRef.current) {
      autocompleteRef.current =
        new // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).google.maps.places.Autocomplete(
          locationInputRef.current,
          {
            types: ["geocode", "establishment"],
            componentRestrictions: { country: "jp" }, // Restrict prediction to Japan
            fields: ["geometry", "formatted_address"],
          }
        );

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        if (place && place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || place.name || "";

          setInputLocation(address);
          setPendingLocation({ lat, lng, address });
        }
      });
    }
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

  // -- Distance Calculation Support --
  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ) => {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // -- Filtering Logic (Using activeSearch) --
  const filteredShops = useMemo(() => {
    return allShops.filter((shop) => {
      // 1. Location Logic: If location is active, strictly filter by distance availability?
      // Actually, we just need to ensure we can calc distance.
      // But the requirement says "Disable Pref/City/Name" if location is active.
      // So we IGNORE Pref/City/Name filters if activeSearch.location is present.

      if (activeSearch.location) {
        // Only apply Category (if set), Price (if set), Term is disabled logic-wise per requirement,
        // but technically "Name" input is disabled in UI.
        // Also Rating.

        if (activeSearch.category && shop.category !== activeSearch.category)
          return false;
        if (activeSearch.price && !shop.price?.includes(activeSearch.price))
          return false;
        if (activeSearch.minRating) {
          const r = shop.rating;
          if (r < parseFloat(activeSearch.minRating)) return false;
        }

        // We do NOT filter by Pref/City/Term when Location is active.
        return true;
      }

      // Normal Logic
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
    // If Location is active, calculate distances and attach to objects for sorting
    // We create a shallow copy with distance if needed
    let final: (IShop & { distance?: number })[] = [...filteredShops];

    const parsePrice = (p: string | undefined) => {
      if (!p || p === "-") return -1;
      if (p.startsWith("～")) return 0;
      const clean = p.replace(/[￥,]/g, "");
      const match = clean.match(/(\d+)/);
      return match ? parseInt(match[0], 10) : -1;
    };

    if (activeSearch.location) {
      // Calculate all distances
      final = final.map((shop) => {
        let dist = 99999;
        if (shop.lat && shop.lng && activeSearch.location) {
          dist = calculateDistance(
            activeSearch.location.lat,
            activeSearch.location.lng,
            shop.lat,
            shop.lng
          );
        }
        return { ...shop, distance: dist };
      });

      // Always sort by distance ASC if Location is active
      // Requirement: "Give closest 50"
      final.sort((a, b) => (a.distance || 99999) - (b.distance || 99999));

      // Only top 50
      return final.slice(0, 50);
    }

    // Normal Sort
    final.sort((a, b) => {
      const key = sortKey;

      if (key === "distance") {
        // Should not happen in normal mode, but fallback
        return 0;
      }

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
  }, [filteredShops, sortKey, sortOrder, isDefaultView, activeSearch.location]);

  // Pagination
  const totalPages = Math.ceil(displayShops.length / pageSize);
  const currentShops = displayShops.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // -- Handlers --
  const handleSort = (key: keyof IShop | "distance") => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder(key === "distance" ? "asc" : "desc");
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("瀏覽器不支援地理位置功能");
      return;
    }
    setIsLoading(true); // temporary visual cue?
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        // Check if inside Japan (Rough binding box)
        // Lat: 20 ~ 46, Lng: 122 ~ 154
        const isInJapan =
          latitude >= 20 &&
          latitude <= 46 &&
          longitude >= 122 &&
          longitude <= 154;

        if (!isInJapan) {
          const proceed = confirm(
            "您的位置似乎不在日本，搜尋結果可能不準確。\n是否仍要繼續？"
          );
          if (!proceed) {
            setIsLoading(false);
            return;
          }
        }
        // Check if google is available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (!google) return;

        // Reverse Geocode to get address string (optional, but good for UI)
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
          { location: { lat: latitude, lng: longitude } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (results: any[], status: any) => {
            setIsLoading(false);
            let locData = null;

            if (status === "OK" && results && results[0]) {
              const address = results[0].formatted_address;
              setInputLocation(address);
              locData = { lat: latitude, lng: longitude, address };
              setPendingLocation(locData);
            } else {
              // Fallback
              const fallbackAddr = `目前位置 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
              setInputLocation(fallbackAddr);
              locData = {
                lat: latitude,
                lng: longitude,
                address: "Current Location",
              };
              setPendingLocation(locData);
            }

            // Auto Search Execution
            if (locData) {
              setActiveSearch({
                pref: inputPref,
                city: inputCity,
                category: inputCategory,
                price: inputPrice,
                term: inputSearchTerm,
                minRating: inputMinRating,
                location: locData,
              });
              setIsDefaultView(false);
              setCurrentPage(1);
              setSortKey("distance");
              setSortOrder("asc");
            }
          }
        );
      },
      (err) => {
        setIsLoading(false);
        alert("無法取得位置: " + err.message);
      }
    );
  };

  const handleExecuteSearch = async () => {
    setIsLoading(true);
    // 1. Commit inputs to active state

    // If inputLocation is cleared, we assume no location search
    let loc = null;

    if (inputLocation.trim()) {
      if (pendingLocation && pendingLocation.address === inputLocation) {
        // User selected from list or didn't change text after selection
        loc = pendingLocation;
      } else {
        // User typed manually and didn't select, or changed text. Try strict geocoding.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (google) {
          const geocoder = new google.maps.Geocoder();
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await new Promise<any>((resolve, reject) => {
              geocoder.geocode(
                { address: inputLocation },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (results: any[], status: any) => {
                  if (status === "OK" && results && results[0]) {
                    resolve(results[0]);
                  } else {
                    reject(status);
                  }
                }
              );
            });

            if (result) {
              const lat = result.geometry.location.lat();
              const lng = result.geometry.location.lng();
              loc = { lat, lng, address: result.formatted_address };
              // Update UI with full formatted address? Maybe optional.
              setInputLocation(result.formatted_address);
              setPendingLocation(loc);
            }
          } catch (e) {
            console.error("Geocoding failed", e);
            // If failed, maybe we alert user? Or just search without location (but that ignores the input)
            alert("找不到該地點，請嘗試更明確的地址");
            setIsLoading(false);
            return;
          }
        }
      }
    }

    setActiveSearch({
      pref: inputPref,
      city: inputCity,
      category: inputCategory,
      price: inputPrice,
      term: inputSearchTerm,
      minRating: inputMinRating,
      location: loc, // Commit location
    });

    // 2. Disable default view
    setIsDefaultView(false);
    // 3. Reset pagination
    setCurrentPage(1);
    setIsLoading(false);

    // 4. Sort rule
    // If loc is present, default sort is distance equivalent (handled in useMemo), but let's set key to 'distance' for UI feedback
    if (loc) {
      setSortKey("distance"); // custom key for UI
      setSortOrder("asc");
    } else {
      setSortKey("rating");
      setSortOrder("desc");
    }
  };

  const handleClear = () => {
    setInputPref("");
    setInputCity("");
    setInputCategory("");
    setInputPrice("");
    setInputSearchTerm("");
    setInputMinRating("");
    setInputLocation("");
    setPendingLocation(null);

    setActiveSearch({
      pref: "",
      city: "",
      category: "",
      price: "",
      term: "",
      minRating: "",
      location: null,
    });

    setIsDefaultView(true);
    setSortKey("rating");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Disable logic
  const isLocationActive = !!inputLocation; // UI state controls disabled inputs

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
          <div className="flex flex-col gap-1 md:flex-row">
            <h1 className="text-2xl font-bold min-[360px]:text-3xl">
              HyakuMeiTenHub
            </h1>
            <h1 className="text-2xl font-bold min-[360px]:text-3xl">
              食べログ 百名店查詢器
            </h1>
          </div>
          <p className="text-base-content/70 text-base">
            搜尋餐廳從未如此輕鬆！
          </p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="card bg-base-100 mb-8 shadow-md">
        <div className="card-body">
          {/* Location Search Row */}
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="form-control md:col-span-9">
              <div className="label">
                <p className="label-text text-sm font-semibold text-wrap md:text-base">
                  輸入地點以查看附近或按按鈕帶入目前位置
                </p>
                <button
                  className="btn btn-square btn-outline btn-sm btn-primary shrink-0 items-center justify-center"
                  onClick={handleUseMyLocation}
                  title="使用目前位置"
                >
                  <IoLocationSharp />
                </button>
              </div>
              <div className="mt-1 flex gap-2">
                <input
                  ref={locationInputRef}
                  type="text"
                  className="input input-bordered input-primary w-full"
                  placeholder="輸入地址或地標 (例如: 東京駅、淺草寺)"
                  value={inputLocation}
                  onChange={(e) => {
                    setInputLocation(e.target.value);
                    // Reset pending location on any manual change to force re-geocode on search
                    setPendingLocation(null);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="form-control col-span-1 md:col-span-2 lg:col-span-4">
              <label className="label">
                <span className="label-text text-sm font-semibold md:text-base">
                  店名
                </span>
              </label>
              <input
                type="text"
                className="input input-bordered input-primary mt-2 w-full focus:outline-offset-2"
                value={inputSearchTerm}
                onChange={(e) => setInputSearchTerm(e.target.value)}
                disabled={isLocationActive} // Disabled when location is active
                placeholder={
                  isLocationActive ? "地點搜尋模式下無法搜尋店名" : ""
                }
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm font-semibold md:text-base">
                  都道府県
                </span>
              </label>
              <select
                className="select select-bordered select-primary mt-2 w-full"
                value={inputPref}
                onChange={(e) => setInputPref(e.target.value)}
                disabled={isLocationActive} // Disabled
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
                <span className="label-text text-sm font-semibold md:text-base">
                  市町村区
                </span>
              </label>
              <select
                className="select select-bordered select-primary mt-2 w-full"
                value={inputCity}
                onChange={(e) => setInputCity(e.target.value)}
                disabled={!inputPref || isLocationActive} // Disabled
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
                <span className="label-text text-sm font-semibold md:text-base">
                  類別
                </span>
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
                <span className="label-text text-sm font-semibold md:text-base">
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
                <span className="label-text text-sm font-semibold md:text-base">
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

            <div className="col-span-1 mt-2 md:col-span-2 lg:col-span-4">
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
                為資料基礎，提供位置搜尋與完整篩選功能。
              </p>
            </div>

            <div className="border-base-200 col-span-1 flex justify-end gap-3 border-t pt-4 md:col-span-2 lg:col-span-4">
              {!isDefaultView && (
                <button
                  className="btn btn-ghost text-error"
                  onClick={handleClear}
                >
                  清除搜尋結果
                </button>
              )}
              <button
                className="btn btn-info px-8"
                onClick={handleExecuteSearch}
              >
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
                <>
                  {activeSearch.location
                    ? "📍 附近搜尋結果 (依距離排序)"
                    : `搜尋結果: ${displayShops.length} 筆`}
                </>
              )}
            </h2>

            <div className="flex items-center gap-4">
              {/* Pagination */}
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
                  <th
                    className="hover:bg-base-300 min-w-50 cursor-pointer"
                    onClick={() => handleSort("name")}
                    colSpan={2}
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
                  {activeSearch.location && (
                    <th className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        距離設定位置
                      </div>
                    </th>
                  )}
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
                </tr>
              </thead>
              <tbody>
                {currentShops.map(
                  (shop: IShop & { distance?: number }, idx) => (
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
                        <div className="max-w-48 truncate text-base font-bold">
                          <a
                            href={shop.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary hover:underline"
                          >
                            {shop.name}
                          </a>
                        </div>
                        <div className="text-base-content/60 mt-0.5 max-w-48 text-xs">
                          {shop.address}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-ghost badge-sm whitespace-nowrap">
                          {shop.category}
                        </span>
                      </td>

                      {/* Distance Column */}
                      {activeSearch.location && (
                        <td className="font-mono text-sm whitespace-nowrap">
                          {shop.distance !== undefined
                            ? shop.distance < 1
                              ? `${(shop.distance * 1000).toFixed(0)}m`
                              : `${shop.distance.toFixed(1)}km`
                            : "-"}
                        </td>
                      )}

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
                        className="max-w-60 truncate text-xs"
                        title={shop.closedDay}
                      >
                        {shop.closedDay || "-"}
                      </td>
                    </tr>
                  )
                )}
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
