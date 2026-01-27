import { createObjectCsvWriter } from "csv-writer";
import * as fs from "fs";
import * as path from "path";
import { type Browser, chromium } from "playwright";

import { CATEGORY_TRANSLATION_MAP } from "../legacy/map";
import type { ICategory, IShop } from "../legacy/types";

const BASE_URL = "https://award.tabelog.com";
const CONCURRENCY_LIMIT = 5;

interface ScrapeResult {
  shops: IShop[];
  csvPath: string;
  logs: string[];
}

type LogCallback = (message: string) => void;

async function createBrowser(): Promise<Browser> {
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
  };
  if (process.platform === "win32") {
    launchOptions.channel = "chrome";
  }
  return chromium.launch(launchOptions);
}

export async function scrapeHyakumeiten(
  pref: string,
  onLog?: LogCallback
): Promise<ScrapeResult> {
  const browser = await createBrowser();
  const page = await browser.newPage();
  const logs: string[] = [];

  const log = (message: string) => {
    logs.push(message);
    console.log(message);
    if (onLog) {
      onLog(message);
    }
  };

  const logError = (message: string) => {
    logs.push(message);
    console.error(message);
    if (onLog) {
      onLog(message);
    }
  };

  log(`🚀 開始執行 Tabelog 百名店查詢器 (pref=${pref})...`);

  log("0. 準備前往網址...");
  await page.goto(`${BASE_URL}/hyakumeiten`, { waitUntil: "domcontentloaded" });

  // 1. 抓取所有類別 Slug
  log("1. 抓取所有類別 Slug");
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
      .filter((v, i, a) => a.indexOf(v) === i);
  });

  log("2. 處理 Slug 並對應到 Master Dictionary");
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

      const cleanedZhName = data.zh.replace(/\s*[\(（].*?[\)）]/g, "").trim();

      return {
        name: fullSlug,
        traditionalChineseName: cleanedZhName,
        japaneseName: data.jp,
      };
    });

  log(
    `✅ 偵測到 ${categoryList.length} 個有效食物類別，準備開始爬取 (pref=${pref})...`
  );

  const allShops: IShop[] = [];
  const visitedFinalUrls = new Set<string>();

  log("3. 遍歷每個類別抓取店家");
  for (const cat of categoryList) {
    log(`\n🔍 搜尋類別：${cat.traditionalChineseName} (${cat.name})...`);

    const url = `${BASE_URL}/hyakumeiten/${cat.name}?pref=${pref}`;

    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      try {
        await Promise.race([
          page.waitForSelector(
            ".hyakumeiten-shop__item, .hyakumeiten-shop-item",
            { timeout: 3000 }
          ),
          page.getByText("該当する店舗はありません").waitFor({ timeout: 3000 }),
          page
            .locator(`a[href*="tabelog.com/${pref}/A"]`)
            .first()
            .waitFor({ timeout: 3000 }),
        ]);
      } catch {
        // ignore timeout
      }

      const currentUrl = page.url();
      if (!currentUrl) continue;

      const finalUrl = currentUrl.split("?")[0] || currentUrl;
      if (visitedFinalUrls.has(finalUrl)) {
        log(`   ⏭️  已訪問過此頁面，跳過`);
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

      const shopUrlPattern = new RegExp(
        `^https://tabelog\\.com/${pref}/A\\d+/A\\d+/\\d+/?$`
      );

      const shops = await page.evaluate(
        (args) => {
          const { categoryName, shopUrlPatternStr, prefCode } = args;
          const shopUrlRe = new RegExp(shopUrlPatternStr);
          const results: any[] = [];

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
              const prefIdx = text.indexOf("長野"); // 原本針對長野，這裡僅作為保守備援
              const name = prefIdx > 0 ? text.slice(0, prefIdx).trim() : text;
              const address = prefIdx >= 0 ? text.slice(prefIdx).trim() : "";
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
          prefCode: pref,
        }
      );

      if (shops.length > 0) {
        log(`   🎉 找到 ${shops.length} 間`);
        allShops.push(...shops);
      }
    } catch (e) {
      logError(`   ❌ Error visiting ${url}: ${e}`);
    }
  }

  log("\n4. 去除重複店家...");
  const uniqueShopsMap = new Map<string, IShop>();
  for (const shop of allShops) {
    const normalizedUrl = shop.url.replace(/\/$/, "");
    if (!uniqueShopsMap.has(normalizedUrl)) {
      uniqueShopsMap.set(normalizedUrl, shop);
    }
  }
  const uniqueShops = Array.from(uniqueShopsMap.values());
  log(`   原始: ${allShops.length} 間，去重後: ${uniqueShops.length} 間\n`);

  log("5. (並行) 訪問每個店舗詳情頁取得資訊...");
  log(`📋 共 ${uniqueShops.length} 間店舗，並行數: ${CONCURRENCY_LIMIT}\n`);

  async function processShop(shop: IShop, browserInstance: Browser) {
    const page = await browserInstance.newPage();
    page.setDefaultTimeout(15000);

    try {
      await page.goto(shop.url, { waitUntil: "domcontentloaded" });

      try {
        await page.waitForSelector(".rstinfo-table", { timeout: 5000 });
      } catch {
        // ignore
      }

      const detailInfo = await page.evaluate(() => {
        const nameEl =
          document.querySelector("h1.display-name") ||
          document.querySelector(".display-name") ||
          document.querySelector("h1");
        let name = nameEl?.textContent?.trim() || "";
        if (name) {
          const lines = name.split("\n");
          if (lines.length > 0 && lines[0]) name = lines[0].trim();
        }

        const ratingEl =
          document.querySelector(".rdheader-rating__score-val-dtl") ||
          document.querySelector(".rdheader-rating__score-val") ||
          document.querySelector(".rating-score");
        const rating = ratingEl?.textContent?.trim() || "";

        let address = "";
        const addressEl =
          document.querySelector(".rstinfo-table__address") ||
          document.querySelector(".rstinfo-table__address-note");
        if (addressEl) {
          address = addressEl.textContent?.trim().replace(/\s+/g, " ") || "";
        } else {
          const rows = Array.from(
            document.querySelectorAll(".rstinfo-table tr")
          );
          const addressRow = rows.find((r) =>
            r.querySelector("th")?.textContent?.includes("住所")
          );
          if (addressRow)
            address =
              addressRow
                .querySelector("td")
                ?.textContent?.trim()
                .replace(/\s+/g, " ") || "";
        }

        let price = "";
        let closedDay = "";
        let businessHour = "";

        const rows = Array.from(document.querySelectorAll(".rstinfo-table tr"));

        rows.forEach((row) => {
          const headerText = row.querySelector("th")?.textContent?.trim() || "";
          const dataEl = row.querySelector("td");
          const dataText = dataEl?.textContent?.trim() || "";

          if (headerText.includes("予算")) {
            const priceEl =
              dataEl?.querySelector(
                ".rstinfo-table__budget-val, .c-rating__val"
              ) || dataEl?.querySelector("em");
            if (priceEl) {
              price = priceEl.textContent?.trim() || "";
            } else {
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

        if (price) {
          if (price.includes("～"))
            price = price.replace(/～/g, "-").replace(/￥/g, "JPY ");
          else if (price.includes("￥")) price = price.replace(/￥/g, "JPY ");
        }

        if (!closedDay && businessHour.includes("定休日")) {
          const match = businessHour.match(/定休日[:：]?\s*([^\n]+)/);
          if (match) {
            closedDay = match[1] || "";
          } else {
            const days = ["月", "火", "水", "木", "金", "土", "日"];
            const closedDays = days.filter((d) =>
              businessHour.includes(`定休日`)
            );
            if (closedDays.length > 0) closedDay = "參見營業時間";
          }
        }

        if (closedDay) {
          const dayMatches = closedDay.match(/([月火水木金土日])曜日/g);
          if (dayMatches) {
            closedDay = dayMatches.map((m) => m.charAt(0)).join("・");
          }
        }

        if (businessHour) {
          businessHour = businessHour.replace(/\s+/g, " ").trim();
        }

        return { name, rating, address, price, closedDay, businessHour };
      });

      shop.name = detailInfo.name || shop.name;
      shop.rating = detailInfo.rating || shop.rating;
      shop.address = detailInfo.address || shop.address;
      shop.price = detailInfo.price || undefined;
      shop.closedDay = detailInfo.closedDay || undefined;
      shop.businessHour = detailInfo.businessHour || undefined;

      log(`✅ [完成] ${shop.name}`);
    } catch (e) {
      logError(`❌ [失敗] ${shop.url} - ${e}`);
    } finally {
      await page.close();
    }
  }

  const queue = [...uniqueShops];
  let completedCount = 0;

  async function worker(id: number) {
    while (queue.length > 0) {
      const shop = queue.shift();
      if (!shop) break;

      await processShop(shop, browser);
      completedCount++;
      if (completedCount % 5 === 0 || queue.length === 0) {
        log(`⏳ 進度: ${completedCount}/${uniqueShops.length}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY_LIMIT }, (_, i) =>
    worker(i + 1)
  );
  await Promise.all(workers);

  await browser.close();

  log("\n6. 輸出 CSV");
  log(`\n📊 總結：共找到 ${uniqueShops.length} 間位於 ${pref} 的百名店。`);

  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `${pref}_hyakumeiten.csv`;
  const outputPath = path.join(outputDir, fileName);

  if (uniqueShops.length > 0) {
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

    await csvWriter.writeRecords(uniqueShops);

    const content = fs.readFileSync(outputPath, "utf8");
    fs.writeFileSync(outputPath, "\uFEFF" + content);

    log(`💾 檔案已儲存 (含 BOM): ${path.relative(process.cwd(), outputPath)}`);
  } else {
    log("⚠️ 未找到任何店家。");
  }

  return {
    shops: uniqueShops,
    csvPath: outputPath,
    logs,
  };
}
