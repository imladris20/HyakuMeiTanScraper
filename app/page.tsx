\"use client\";

import { useState } from \"react\";
import type { IShop } from \"../types\";

const PREF_OPTIONS: { value: string; label: string }[] = [
  { value: \"hokkaido\", label: \"北海道\" },
  { value: \"aomori\", label: \"青森\" },
  { value: \"akita\", label: \"秋田\" },
  { value: \"yamagata\", label: \"山形\" },
  { value: \"iwate\", label: \"岩手\" },
  { value: \"miyagi\", label: \"宮城\" },
  { value: \"fukushima\", label: \"福島\" },
  { value: \"tokyo\", label: \"東京\" },
  { value: \"kanagawa\", label: \"神奈川\" },
  { value: \"saitama\", label: \"埼玉\" },
  { value: \"chiba\", label: \"千葉\" },
  { value: \"tochigi\", label: \"栃木\" },
  { value: \"ibaraki\", label: \"茨城\" },
  { value: \"gunma\", label: \"群馬\" },
  { value: \"aichi\", label: \"愛知\" },
  { value: \"gifu\", label: \"岐阜\" },
  { value: \"shizuoka\", label: \"静岡\" },
  { value: \"mie\", label: \"三重\" },
  { value: \"niigata\", label: \"新潟\" },
  { value: \"yamanashi\", label: \"山梨\" },
  { value: \"nagano\", label: \"長野\" },
  { value: \"ishikawa\", label: \"石川\" },
  { value: \"toyama\", label: \"富山\" },
  { value: \"fukui\", label: \"福井\" },
  { value: \"osaka\", label: \"大阪\" },
  { value: \"hyogo\", label: \"兵庫\" },
  { value: \"kyoto\", label: \"京都\" },
  { value: \"shiga\", label: \"滋賀\" },
  { value: \"nara\", label: \"奈良\" },
  { value: \"wakayama\", label: \"和歌山\" },
  { value: \"okayama\", label: \"岡山\" },
  { value: \"hiroshima\", label: \"広島\" },
  { value: \"tottori\", label: \"鳥取\" },
  { value: \"shimane\", label: \"島根\" },
  { value: \"yamaguchi\", label: \"山口\" },
  { value: \"kagawa\", label: \"香川\" },
  { value: \"tokushima\", label: \"徳島\" },
  { value: \"ehime\", label: \"愛媛\" },
  { value: \"kochi\", label: \"高知\" },
  { value: \"fukuoka\", label: \"福岡\" },
  { value: \"saga\", label: \"佐賀\" },
  { value: \"nagasaki\", label: \"長崎\" },
  { value: \"kumamoto\", label: \"熊本\" },
  { value: \"oita\", label: \"大分\" },
  { value: \"miyazaki\", label: \"宮崎\" },
  { value: \"kagoshima\", label: \"鹿児島\" },
  { value: \"okinawa\", label: \"沖縄\" },
];

interface ScrapeResponse {
  shops: IShop[];
  pref: string;
}

export default function HomePage() {
  const [pref, setPref] = useState<string>(\"nagano\");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<IShop[]>([]);
  const [currentPref, setCurrentPref] = useState<string | null>(null);

  const handleRun = async () => {
    setError(null);
    setLoading(true);
    setShops([]);

    try {
      const res = await fetch(\"/api/scrape\", {
        method: \"POST\",
        headers: { \"Content-Type\": \"application/json\" },
        body: JSON.stringify({ pref }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || \"爬蟲執行失敗\");
      }

      const data: ScrapeResponse = await res.json();
      setShops(data.shops);
      setCurrentPref(data.pref);
    } catch (e: any) {
      setError(e.message || \"未知錯誤\");
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
    currentPref != null ? `/api/download?pref=${encodeURIComponent(currentPref)}` : null;

  return (
    <main className=\"container mx-auto max-w-6xl px-4 py-8\">
      <h1 className=\"text-3xl font-bold mb-6\">Tabelog 百名店爬蟲</h1>

      <div className=\"card bg-base-100 shadow mb-8\">
        <div className=\"card-body space-y-4\">
          <h2 className=\"card-title\">選擇都道府縣並執行</h2>
          <p className=\"text-sm text-base-content/70\">
            選好都道府縣後按下「執行爬蟲」，會呼叫 Playwright 在伺服端跑一次，
            並同時產生 CSV 與下方表格結果。
          </p>

          <div className=\"flex flex-col gap-4 md:flex-row md:items-end\">
            <label className=\"form-control w-full md:max-w-xs\">
              <div className=\"label\">
                <span className=\"label-text\">都道府縣</span>
              </div>
              <select
                className=\"select select-bordered w-full\"
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
              className=\"btn btn-primary md:ml-4\"
              onClick={handleRun}
              disabled={loading}
            >
              {loading ? \"執行中...\" : \"執行爬蟲\"}
            </button>

            <button
              className=\"btn md:ml-2\"
              onClick={handleClear}
              disabled={loading && shops.length === 0}
            >
              清除結果
            </button>

            {downloadUrl && (
              <a
                href={downloadUrl}
                className=\"btn btn-outline md:ml-auto\"
              >
                下載 CSV
              </a>
            )}
          </div>

          {error && (
            <div className=\"alert alert-error mt-4\">
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <div className=\"card bg-base-100 shadow\">
        <div className=\"card-body\">
          <h2 className=\"card-title mb-4\">
            爬蟲結果
            {currentPref && (
              <span className=\"badge badge-outline ml-2\">
                Pref: {currentPref}
              </span>
            )}
          </h2>

          {shops.length === 0 ? (
            <p className=\"text-sm text-base-content/70\">
              目前尚無結果，請先選擇都道府縣並執行爬蟲。
            </p>
          ) : (
            <div className=\"overflow-x-auto\">
              <table className=\"table table-zebra table-sm\">
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
                          target=\"_blank\"
                          rel=\"noreferrer\"
                          className=\"link link-primary\"
                        >
                          開啟
                        </a>
                      </td>
                      <td>{shop.rating}</td>
                      <td>{shop.price ?? \"-\"}</td>
                      <td>{shop.closedDay ?? \"-\"}</td>
                      <td>{shop.businessHour ?? \"-\"}</td>
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

