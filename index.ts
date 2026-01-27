import { createObjectCsvWriter } from "csv-writer";
import * as fs from "fs";
import { chromium } from "playwright";
import { CATEGORY_TRANSLATION_MAP } from "./map";
import type { ICategory, IShop } from "./types";

const BASE_URL = "https://award.tabelog.com";

console.log("🚀 [Node/npm] 開始執行 Tabelog 百名店爬蟲...");

// 使用 Playwright 內建 Chromium（macOS 下 channel: 'chrome' 容易啟動後即關閉）
const launchOptions: Parameters<typeof chromium.launch>[0] = {
  headless: false,
};
if (process.platform === "win32") {
  launchOptions.channel = "chrome";
}
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage();

console.log("0. 準備前往網址...");
await page.goto(`${BASE_URL}/hyakumeiten`, { waitUntil: "domcontentloaded" });

// 1. 抓取所有類別 Slug
console.log("1. 抓取所有類別 Slug");
const rawSlugs = await page.evaluate(() => {
  const anchors = Array.from(
    document.querySelectorAll('a[href*="/hyakumeiten/"]')
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
    return {
      name: fullSlug,
      traditionalChineseName: data.zh,
      japaneseName: data.jp,
    };
  });

console.log(`✅ 偵測到 ${categoryList.length} 個有效食物類別，準備開始爬取...`);

// --- 生成 categories-output.ts ---
const tsContent = `export const HYAKUMEITAN_CATEGORY_OUTPUT = ${JSON.stringify(
  categoryList,
  null,
  2
)};`;

fs.writeFileSync("categories-output.ts", tsContent);
console.log("📝 已生成類別檔案: categories-output.ts");

const allNaganoShops: IShop[] = [];
const visitedFinalUrls = new Set<string>(); // 追蹤已訪問的最終 URL（去除 query string）

console.log("3. 遍歷每個類別抓取長野店家");
for (const cat of categoryList) {
  console.log(`\n🔍 搜尋類別：${cat.traditionalChineseName} (${cat.name})...`);

  const url = `${BASE_URL}/hyakumeiten/${cat.name}?pref=nagano`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000); // 稍微等待渲染

    // 取得最終 URL（去除 query string）用於去重
    const currentUrl = page.url();
    if (!currentUrl) {
      continue;
    }
    const finalUrl: string = currentUrl.split("?")[0] || currentUrl;

    // 檢查是否重定向到已訪問的 URL
    if (visitedFinalUrls.has(finalUrl)) {
      console.log(`   ⏭️  已訪問過此頁面（重定向到 ${finalUrl}），跳過`);
      continue;
    }

    if (
      currentUrl.includes("award.tabelog.com/hyakumeiten/msg") ||
      currentUrl === `${BASE_URL}/hyakumeiten`
    ) {
      continue;
    }

    // 記錄此最終 URL 已訪問
    visitedFinalUrls.add(finalUrl);

    // 等待列表或「無結果」出現（含 2025 版用連結列出的結構）
    try {
      await Promise.race([
        page.waitForSelector(
          ".hyakumeiten-shop__item, .hyakumeiten-shop-item",
          { timeout: 5000 }
        ),
        page
          .getByText("該当する店舗はありません")
          .waitFor({ timeout: 5000 }),
        page
          .locator('a[href*="tabelog.com/nagano/A"]')
          .first()
          .waitFor({ timeout: 5000 }),
      ]);
    } catch (e) {}

    const noResult = await page.getByText("該当する店舗はありません").count();
    if (noResult > 0) {
      continue;
    }

    // 店家詳情頁 URL 格式: https://tabelog.com/nagano/A2001/A200101/20017737/
    const shopUrlPattern =
      /^https:\/\/tabelog\.com\/nagano\/A\d+\/A\d+\/\d+\/?$/;

    const shops = await page.evaluate(
      (args: { categoryName: string; shopUrlPatternStr: string }) => {
        const { categoryName } = args;
        const shopUrlRe = new RegExp(args.shopUrlPatternStr);
        const results: any[] = [];

        // 1. 先試原本的卡片選擇器（舊版／部分頁面）
        const items = document.querySelectorAll(
          ".hyakumeiten-shop__item, .hyakumeiten-shop-item"
        );
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
            results.push({
              category: categoryName,
              name: nameEl.textContent?.trim(),
              url: (nameEl as HTMLAnchorElement).href,
              address: areaEl?.textContent?.trim() || "",
              rating: ratingEl?.textContent?.trim() || "",
            });
          }
        });

        // 2. 若沒找到，用「連結到 Tabelog 店舗詳情頁」的 a 作為備援（2025 版結構可能不同）
        if (results.length === 0) {
          const seen = new Set<string>();
          const links = document.querySelectorAll<HTMLAnchorElement>(
            'a[href*="tabelog.com/"]'
          );
          links.forEach((a) => {
            const href = a.href.replace(/#.*$/, "").replace(/\/$/, "");
            if (!shopUrlRe.test(href) || seen.has(href)) return;
            seen.add(href);
            const text = a.textContent?.trim() || "";
            // 文字常為「店名＋都道府県＋地域＋定休」等，取到「長野」為止當店名，其餘當 address
            const naganoIdx = text.indexOf("長野");
            const name =
              naganoIdx > 0 ? text.slice(0, naganoIdx).trim() : text;
            const address =
              naganoIdx >= 0 ? text.slice(naganoIdx).trim() : "";
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
      }
    );

    if (shops.length > 0) {
      console.log(`   🎉 找到 ${shops.length} 間！`);
      allNaganoShops.push(...shops);
    }
  } catch (e) {
    console.error(`   ❌ Error visiting ${url}:`, e);
  }
}

console.log("\n4. 訪問每個店舗詳情頁取得更準確的資訊...");
console.log(`📋 共 ${allNaganoShops.length} 間店舗需要處理\n`);

// 遍歷每個店舗，訪問詳情頁取得更準確的資訊
for (let i = 0; i < allNaganoShops.length; i++) {
  const shop = allNaganoShops[i];
  if (!shop) continue;

  console.log(`[${i + 1}/${allNaganoShops.length}] 處理: ${shop.name}...`);

  try {
    await page.goto(shop.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000); // 等待頁面渲染

    const detailInfo = await page.evaluate(() => {
      // 提取店名（更準確）
      const nameEl =
        document.querySelector("h1.display-name") ||
        document.querySelector(".display-name") ||
        document.querySelector("h1");
      let name = nameEl?.textContent?.trim() || "";
      // 移除可能的標籤文字（如 "初選出"）
      if (name) {
        const lines = name.split("\n");
        if (lines.length > 0 && lines[0]) {
          name = lines[0].trim();
        }
      }

      // 提取評分
      const ratingEl =
        document.querySelector(".rdheader-rating__score-val-dtl") ||
        document.querySelector(".rdheader-rating__score-val") ||
        document.querySelector(".rating-score");
      const rating = ratingEl?.textContent?.trim() || "";

      // 提取地址（完整地址）
      let address = "";
      const addressEl =
        document.querySelector(".rstinfo-table__address") ||
        document.querySelector(".rstinfo-table__address-note");
      if (addressEl) {
        address = addressEl.textContent?.trim() || "";
        // 移除多餘的空白和換行，保留完整地址
        address = address.replace(/\s+/g, " ").trim();
      }

      // 提取預算/價格
      let price = "";
      // 先找預算區域
      const budgetRow = Array.from(
        document.querySelectorAll(".rstinfo-table__data")
      ).find((el) => {
        const label = el.querySelector(".rstinfo-table__subject");
        return label?.textContent?.includes("予算");
      });
      if (budgetRow) {
        const priceEl = budgetRow.querySelector(
          ".rstinfo-table__budget-val, .c-rating__val"
        );
        price = priceEl?.textContent?.trim() || "";
      }
      // 格式化價格（例如 "～￥999" -> "- JPY 999"）
      if (price) {
        if (price.includes("～")) {
          price = price.replace(/～/g, "-").replace(/￥/g, "JPY ");
        } else if (price.includes("￥")) {
          price = price.replace(/￥/g, "JPY ");
        }
      }

      // 提取定休日
      let closedDay = "";
      const closedDayRow = Array.from(
        document.querySelectorAll(".rstinfo-table__data")
      ).find((el) => {
        const label = el.querySelector(".rstinfo-table__subject");
        return label?.textContent?.includes("定休日");
      });
      if (closedDayRow) {
        const closedDayText = closedDayRow.textContent || "";
        // 提取星期幾（例如 "月曜日、火曜日" -> "月・火"）
        const dayMatches = closedDayText.match(/([月火水木金土日])曜日/g);
        if (dayMatches) {
          closedDay = dayMatches.map((m) => m.charAt(0)).join("・");
        }
      }

      // 提取營業時間
      let businessHour = "";
      const businessHourRow = Array.from(
        document.querySelectorAll(".rstinfo-table__data")
      ).find((el) => {
        const label = el.querySelector(".rstinfo-table__subject");
        return label?.textContent?.includes("営業時間");
      });
      if (businessHourRow) {
        const timeText = businessHourRow.textContent || "";
        // 提取時間範圍（例如 "11:00 - 14:00" 或 "11:00〜14:00"）
        const timeMatch = timeText.match(/(\d{1,2}:\d{2})\s*[-～〜]\s*(\d{1,2}:\d{2})/);
        if (timeMatch) {
          businessHour = `${timeMatch[1]} - ${timeMatch[2]}`;
        }
      }

      return {
        name: name || "",
        rating: rating || "",
        address: address || "",
        price: price || "",
        closedDay: closedDay || "",
        businessHour: businessHour || "",
      };
    });

    // 更新店舗資訊（保留原有 category 和 url）
    const updatedShop: IShop = {
      category: shop.category,
      url: shop.url,
      name: detailInfo.name || shop.name,
      rating: detailInfo.rating || shop.rating,
      address: detailInfo.address || shop.address,
      price: detailInfo.price || undefined,
      closedDay: detailInfo.closedDay || undefined,
      businessHour: detailInfo.businessHour || undefined,
    };
    allNaganoShops[i] = updatedShop;

    console.log(`   ✅ 完成: ${updatedShop.name}`);
  } catch (e) {
    console.error(`   ❌ 錯誤: ${shop.url}`, e);
    // 保留原有資料，不更新
  }
}

await browser.close();

console.log("\n5. 輸出 CSV");
console.log(`\n📊 總結：共找到 ${allNaganoShops.length} 間位於長野的百名店。`);

if (allNaganoShops.length > 0) {
  const csvWriter = createObjectCsvWriter({
    path: "nagano_hyakumeiten.csv",
    header: [
      { id: "name", title: "Name" },
      { id: "address", title: "Address" },
      { id: "category", title: "Category" },
      { id: "url", title: "URL" },
      { id: "rating", title: "Rating" },
      { id: "price", title: "Price" },
      { id: "closedDay", title: "Closed Day" },
      { id: "businessHour", title: "Business Hour" },
    ],
  });

  await csvWriter.writeRecords(allNaganoShops);
  console.log("💾 6. 檔案已儲存: nagano_hyakumeiten.csv");
} else {
  console.log("⚠️ 6. 未找到任何店家。");
}
