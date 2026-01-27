import { createObjectCsvWriter } from "csv-writer";
import * as fs from "fs";
import { chromium, type Browser } from "playwright";
import { CATEGORY_TRANSLATION_MAP } from "./map";
import type { ICategory, IShop } from "./types";

const BASE_URL = "https://award.tabelog.com";
const CONCURRENCY_LIMIT = 5;

console.log("🚀 [Node/npm] 開始執行 Tabelog 百名店爬蟲 (優化版)...");

// 1. 初始化瀏覽器
const launchOptions: Parameters<typeof chromium.launch>[0] = {
  headless: true,
};
if (process.platform === "win32") {
  launchOptions.channel = "chrome";
}
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage();

console.log("0. 準備前往網址...");
await page.goto(`${BASE_URL}/hyakumeiten`, { waitUntil: "domcontentloaded" });

// 2. 抓取所有類別 Slug
console.log("1. 抓取所有類別 Slug");
const rawSlugs = await page.evaluate(() => {
  const anchors = Array.from(
    document.querySelectorAll('a[href*="/hyakumeiten/"]'),
  );

  return anchors
    .map((a) => {
      const href = a.getAttribute("href") || "";
      const match = href.match(/\/hyakumeiten\/([a-z0-9_]+)/);
      if (!match) return null;
      return match[1];
    })
    .filter((v): v is string => v !== null)
    .filter((v, i, a) => a.indexOf(v) === i); // 去重
});

console.log("2. 處理 Slug 並對應到 Master Dictionary");
const categoryList: ICategory[] = rawSlugs
  .filter((slug) => !["top", "history", "msg"].includes(slug))
  .map((fullSlug) => {
    let lookupKey = fullSlug;
    let baseSlug = fullSlug.replace(/_east$|_west$|_tokyo$/, "");

    let finalKey = CATEGORY_TRANSLATION_MAP[lookupKey] ? lookupKey : baseSlug;
    const data = CATEGORY_TRANSLATION_MAP[finalKey];

    if (!data) {
      return {
        name: fullSlug,
        traditionalChineseName: baseSlug.toUpperCase(),
        japaneseName: baseSlug,
      };
    }

    // 移除括號及其內容，例如 "拉麵 (北海道)" -> "拉麵"
    const cleanedZhName = data.zh.replace(/\s*[\(（].*?[\)）]/g, "").trim();

    return {
      name: fullSlug,
      traditionalChineseName: cleanedZhName,
      japaneseName: data.jp,
    };
  });

console.log(`✅ 偵測到 ${categoryList.length} 個有效食物類別，準備開始爬取...`);

// --- 生成 categories-output.ts ---
const tsContent = `export const HYAKUMEITAN_CATEGORY_OUTPUT = ${JSON.stringify(
  categoryList,
  null,
  2,
)};`;

fs.writeFileSync("categories-output.ts", tsContent);
console.log("📝 已生成類別檔案: categories-output.ts");

const allNaganoShops: IShop[] = [];
const visitedFinalUrls = new Set<string>();

console.log("3. 遍歷每個類別抓取長野店家");
for (const cat of categoryList) {
  console.log(`\n🔍 搜尋類別：${cat.traditionalChineseName} (${cat.name})...`);

  const url = `${BASE_URL}/hyakumeiten/${cat.name}?pref=nagano`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // 智慧等待：等待列表或「無結果」出現
    try {
      await Promise.race([
        page.waitForSelector(
          ".hyakumeiten-shop__item, .hyakumeiten-shop-item",
          { timeout: 3000 },
        ),
        page.getByText("該当する店舗はありません").waitFor({ timeout: 3000 }),
        page
          .locator('a[href*="tabelog.com/nagano/A"]')
          .first()
          .waitFor({ timeout: 3000 }),
      ]);
    } catch (e) {
      // Timeout 可能是因為真的沒有結果，或頁面結構不同，繼續往下嘗試
    }

    const currentUrl = page.url();
    if (!currentUrl) continue;

    // 去除 query string 並去重
    const finalUrl = currentUrl.split("?")[0] || currentUrl;
    if (visitedFinalUrls.has(finalUrl)) {
      console.log(`   ⏭️  已訪問過此頁面，跳過`);
      continue;
    }

    if (
      currentUrl.includes("award.tabelog.com/hyakumeiten/msg") ||
      currentUrl === `${BASE_URL}/hyakumeiten`
    ) {
      continue;
    }
    visitedFinalUrls.add(finalUrl);

    const noResult = await page.getByText("該当する店舗はありません").count();
    if (noResult > 0) continue;

    const shopUrlPattern =
      /^https:\/\/tabelog\.com\/nagano\/A\d+\/A\d+\/\d+\/?$/;

    const shops = await page.evaluate(
      (args) => {
        const { categoryName, shopUrlPatternStr } = args;
        const shopUrlRe = new RegExp(shopUrlPatternStr);
        const results: any[] = [];

        // 1. 卡片選擇器
        const items = document.querySelectorAll(
          ".hyakumeiten-shop__item, .hyakumeiten-shop-item",
        );
        items.forEach((item) => {
          const nameEl = item.querySelector(
            ".hyakumeiten-shop__name a, .hyakumeiten-shop-item__name a",
          );
          const areaEl = item.querySelector(
            ".hyakumeiten-shop__area, .hyakumeiten-shop-item__area",
          );
          const ratingEl = item.querySelector(
            ".hyakumeiten-shop__rating, .hyakumeiten-shop-item__rating",
          );
          if (nameEl) {
            results.push({
              category: categoryName,
              name: nameEl.textContent?.trim(),
              url: (nameEl as HTMLAnchorElement).href,
              address: areaEl?.textContent?.trim() || "",
              rating: ratingEl?.textContent?.trim() || "",
            });
          }
        });

        // 2. 連結備援
        if (results.length === 0) {
          const seen = new Set<string>();
          const links = document.querySelectorAll<HTMLAnchorElement>(
            'a[href*="tabelog.com/"]',
          );
          links.forEach((a) => {
            const href = a.href.replace(/#.*$/, "").replace(/\/$/, "");
            if (!shopUrlRe.test(href) || seen.has(href)) return;
            seen.add(href);
            const text = a.textContent?.trim() || "";
            const naganoIdx = text.indexOf("長野");
            const name = naganoIdx > 0 ? text.slice(0, naganoIdx).trim() : text;
            const address = naganoIdx >= 0 ? text.slice(naganoIdx).trim() : "";
            results.push({
              category: categoryName,
              name: name || href,
              url: a.href,
              address,
              rating: "",
            });
          });
        }
        return results;
      },
      {
        categoryName: cat.traditionalChineseName,
        shopUrlPatternStr: shopUrlPattern.source,
      },
    );

    if (shops.length > 0) {
      console.log(`   🎉 找到 ${shops.length} 間`);
      allNaganoShops.push(...shops);
    }
  } catch (e) {
    console.error(`   ❌ Error visiting ${url}:`, e);
  }
}

// 關閉列表頁用的主要 Context/Page（其實不需要，只要最後用 browser.close 即可，但為了省資源可先關）
// await context.close(); // 單一 page 下無法僅 close context

console.log("\n4. (並行) 訪問每個店舗詳情頁取得資訊...");
console.log(
  `📋 共 ${allNaganoShops.length} 間店舗，並行數: ${CONCURRENCY_LIMIT}\n`,
);

// --- 並行處理邏輯 ---

// 定義單一店家的處理函式
async function processShop(shop: IShop, browserInstance: Browser) {
  const page = await browserInstance.newPage();
  // 設定較短的預設 timeout 以免卡死
  page.setDefaultTimeout(15000);

  try {
    await page.goto(shop.url, { waitUntil: "domcontentloaded" });

    // 智慧等待表格出現
    try {
      await page.waitForSelector(".rstinfo-table", { timeout: 5000 });
    } catch {
      // 若 5秒內沒出現表格，可能是沒載入或結構不同，但仍嘗試 evaluate
    }

    const detailInfo = await page.evaluate(() => {
      // 提取店名
      const nameEl =
        document.querySelector("h1.display-name") ||
        document.querySelector(".display-name") ||
        document.querySelector("h1");
      let name = nameEl?.textContent?.trim() || "";
      if (name) {
        const lines = name.split("\n");
        if (lines.length > 0 && lines[0]) name = lines[0].trim();
      }

      // 提取評分
      const ratingEl =
        document.querySelector(".rdheader-rating__score-val-dtl") ||
        document.querySelector(".rdheader-rating__score-val") ||
        document.querySelector(".rating-score");
      const rating = ratingEl?.textContent?.trim() || "";

      // 提取地址
      let address = "";
      const addressEl =
        document.querySelector(".rstinfo-table__address") ||
        document.querySelector(".rstinfo-table__address-note");
      if (addressEl) {
        address = addressEl.textContent?.trim().replace(/\s+/g, " ") || "";
      } else {
        // 備用：從表格找
        const rows = Array.from(document.querySelectorAll(".rstinfo-table tr"));
        const addressRow = rows.find((r) =>
          r.querySelector("th")?.textContent?.includes("住所"),
        );
        if (addressRow)
          address =
            addressRow
              .querySelector("td")
              ?.textContent?.trim()
              .replace(/\s+/g, " ") || "";
      }

      // --- 新版提取邏輯 (使用 th 文字搜尋) ---
      let price = "";
      let closedDay = "";
      let businessHour = "";

      const rows = Array.from(document.querySelectorAll(".rstinfo-table tr"));

      rows.forEach((row) => {
        const headerText = row.querySelector("th")?.textContent?.trim() || "";
        const dataEl = row.querySelector("td");
        const dataText = dataEl?.textContent?.trim() || "";

        if (headerText.includes("予算")) {
          // 特別處理：有時候預算在 inner element
          const priceEl =
            dataEl?.querySelector(
              ".rstinfo-table__budget-val, .c-rating__val",
            ) || dataEl?.querySelector("em");
          if (priceEl) {
            price = priceEl.textContent?.trim() || "";
          } else {
            // 簡單 fallback
            price = dataText.split("\n")[0]?.trim() || "";
          }
        }

        if (headerText.includes("営業時間")) {
          businessHour = dataText;
        }

        if (headerText.includes("定休日")) {
          closedDay = dataText;
        }
      });

      // 格式化 Price
      if (price) {
        if (price.includes("～"))
          price = price.replace(/～/g, "-").replace(/￥/g, "JPY ");
        else if (price.includes("￥")) price = price.replace(/￥/g, "JPY ");
      }

      // 若沒抓到定休日，嘗試從營業時間欄位找 (有時合併在一起)
      if (!closedDay && businessHour.includes("定休日")) {
        // 嘗試簡單提取，例如 "定休日：日曜日"
        const match = businessHour.match(/定休日[:：]?\s*([^\n]+)/);
        if (match) {
          closedDay = match[1] || "";
        } else {
          // 或是檢查有沒有日曜日等字眼
          const days = ["月", "火", "水", "木", "金", "土", "日"];
          const closedDays = days.filter((d) =>
            businessHour.includes(`定休日`),
          );
          if (closedDays.length > 0) closedDay = "參見營業時間";
        }
      }

      // 格式化定休日 (如果抓到的是長文字)
      if (closedDay) {
        const dayMatches = closedDay.match(/([月火水木金土日])曜日/g);
        if (dayMatches) {
          closedDay = dayMatches.map((m) => m.charAt(0)).join("・");
        }
      }

      // 格式化營業時間 (簡單清理多餘空白)
      if (businessHour) {
        businessHour = businessHour.replace(/\s+/g, " ").trim();
      }

      return { name, rating, address, price, closedDay, businessHour };
    });

    // 更新物件
    shop.name = detailInfo.name || shop.name;
    shop.rating = detailInfo.rating || shop.rating;
    shop.address = detailInfo.address || shop.address;
    shop.price = detailInfo.price || undefined;
    shop.closedDay = detailInfo.closedDay || undefined;
    shop.businessHour = detailInfo.businessHour || undefined;

    console.log(`✅ [完成] ${shop.name}`);
  } catch (e) {
    console.error(`❌ [失敗] ${shop.url} - ${e}`);
  } finally {
    await page.close();
  }
}

// 建立工作隊列
const queue = [...allNaganoShops];
let completedCount = 0;

// Worker 函式
async function worker(id: number) {
  while (queue.length > 0) {
    const shop = queue.shift();
    if (!shop) break;

    await processShop(shop, browser);
    completedCount++;
    // 顯示進度
    if (completedCount % 5 === 0 || queue.length === 0) {
      console.log(`⏳ 進度: ${completedCount}/${allNaganoShops.length}`);
    }
  }
}

// 啟動 Workers
const workers = Array.from({ length: CONCURRENCY_LIMIT }, (_, i) =>
  worker(i + 1),
);
await Promise.all(workers);

await browser.close();

console.log("\n5. 輸出 CSV");
console.log(`\n📊 總結：共找到 ${allNaganoShops.length} 間位於長野的百名店。`);

if (allNaganoShops.length > 0) {
  const outputPath = "output/nagano_hyakumeiten.csv";

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: "name", title: "店名" },
      { id: "address", title: "地址" },
      { id: "category", title: "類別" },
      { id: "url", title: "URL" },
      { id: "rating", title: "評分" },
      { id: "price", title: "價格" },
      { id: "closedDay", title: "公休日" },
      { id: "businessHour", title: "營業時間" },
    ],
  });

  await csvWriter.writeRecords(allNaganoShops);

  // 讀取檔案並補上 BOM
  const content = fs.readFileSync(outputPath, "utf8");
  fs.writeFileSync(outputPath, "\uFEFF" + content);

  console.log("💾 6. 檔案已儲存 (含 BOM): nagano_hyakumeiten.csv");
} else {
  console.log("⚠️ 6. 未找到任何店家。");
}
