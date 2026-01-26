import { createObjectCsvWriter } from "csv-writer";
import { chromium } from "playwright";

// 定義店家的資料結構
interface Shop {
  category: string;
  name: string;
  url: string;
  address: string;
  rating: string;
}

const BASE_URL = "https://award.tabelog.com";

console.log("🚀 [Bun] 開始執行 Tabelog 百名店爬蟲...");

// 啟動瀏覽器
const browser = await chromium.launch({ headless: false }); // 設為 false 方便觀察
const page = await browser.newPage();

// 1. 獲取所有側邊欄的類別
await page.goto(`${BASE_URL}/hyakumeiten`, { waitUntil: "domcontentloaded" });

console.log("...正在分析側邊欄類別");

const navLinks = await page.evaluate(() => {
  const anchors = Array.from(
    document.querySelectorAll('a[href*="/hyakumeiten/"]')
  );

  const categories = anchors
    .map((a) => {
      const href = a.getAttribute("href") || "";
      // 提取 slug，例如 /hyakumeiten/yakiniku_east -> yakiniku
      const match = href.match(/\/hyakumeiten\/([a-z0-9_]+)/);
      if (!match) return null;

      const fullSlug = match[1];
      // 移除地區後綴以獲得通用類別名
      const baseSlug = fullSlug.replace(/_east$|_west$|_tokyo$/, "");
      return { name: a.textContent?.trim() || baseSlug, baseSlug };
    })
    // 去除 null 和重複的 baseSlug
    .filter((v): v is { name: string; baseSlug: string } => v !== null)
    .filter((v, i, a) => a.findIndex((t) => t.baseSlug === v.baseSlug) === i);

  return categories;
});

console.log(
  `✅ 偵測到 ${navLinks.length} 個類別:`,
  navLinks.map((c) => c.baseSlug).join(", ")
);

const allNaganoShops: Shop[] = [];

// 2. 遍歷每個類別
for (const cat of navLinks) {
  // 略過非食物類別
  if (["top", "history"].includes(cat.baseSlug)) continue;

  console.log(`\n🔍 搜尋類別：${cat.name} (${cat.baseSlug})...`);

  // 嘗試的網址清單 (優先嘗試 East，因為長野在東邊)
  const tryUrls = [
    `${BASE_URL}/hyakumeiten/${cat.baseSlug}_east?pref=nagano`,
    `${BASE_URL}/hyakumeiten/${cat.baseSlug}?pref=nagano`,
  ];

  let foundShopsInCat = false;

  for (const url of tryUrls) {
    if (foundShopsInCat) break;

    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });

      // 檢查是否 404 或被轉址回首頁 (代表該分類網址結構錯誤)
      if (
        page.url().includes("award.tabelog.com/hyakumeiten/msg") ||
        response?.status() === 404
      ) {
        continue;
      }

      // 檢查是否顯示「無符合店鋪」
      const noResult = await page.getByText("該当する店舗はありません").count();
      if (noResult > 0) {
        console.log(`   - ${url}: 無店家`);
        break; // 確定此類別無店家，跳出
      }

      // 抓取店家資料
      const shops = await page.evaluate((categoryName) => {
        // 抓取卡片 (selector 涵蓋新舊版型)
        const items = document.querySelectorAll(
          ".hyakumeiten-shop__item, .hyakumeiten-shop-item"
        );
        const results: any[] = [];

        items.forEach((item) => {
          const nameEl = item.querySelector(
            ".hyakumeiten-shop__name a, .hyakumeiten-shop-item__name a"
          );
          const areaEl = item.querySelector(
            ".hyakumeiten-shop__area, .hyakumeiten-shop-item__area"
          );
          const ratingEl = item.querySelector(
            ".hyakumeiten-shop__rating, .hyakumeiten-shop-item__rating"
          );

          if (nameEl) {
            const addressText = areaEl?.textContent?.trim() || "";
            // 二次確認地址包含長野
            if (addressText.includes("長野")) {
              results.push({
                category: categoryName,
                name: nameEl.textContent?.trim(),
                url: (nameEl as HTMLAnchorElement).href,
                address: addressText,
                rating: ratingEl?.textContent?.trim() || "",
              });
            }
          }
        });
        return results;
      }, cat.name);

      if (shops.length > 0) {
        console.log(`   🎉 找到 ${shops.length} 間！ (${url})`);
        allNaganoShops.push(...shops);
        foundShopsInCat = true;
      }
    } catch (e) {
      console.error(`   ❌ Error visiting ${url}`);
    }
  }
}

await browser.close();

// 3. 輸出 CSV
console.log(`\n📊 總結：共找到 ${allNaganoShops.length} 間位於長野的百名店。`);

if (allNaganoShops.length > 0) {
  const csvWriter = createObjectCsvWriter({
    path: "nagano_hyakumeiten.csv",
    header: [
      { id: "name", title: "Name" },
      { id: "address", title: "Address" },
      { id: "category", title: "Description" },
      { id: "url", title: "URL" },
      { id: "rating", title: "Rating" },
    ],
  });

  await csvWriter.writeRecords(allNaganoShops);
  console.log("💾 檔案已儲存: nagano_hyakumeiten.csv");
} else {
  console.log("⚠️ 未找到任何店家，請檢查網頁結構是否變更。");
}
