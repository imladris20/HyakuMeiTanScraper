import * as fs from "fs";
import * as path from "path";
import { type Browser, chromium } from "playwright";

import { CATEGORY_TRANSLATION_MAP } from "../legacy/map";
import type { ICategory } from "../legacy/types";
import type { IShopExtended } from "./types";

const BASE_URL = "https://award.tabelog.com";
const CONCURRENCY_LIMIT = 5;
const DATA_DIR = path.join(process.cwd(), "data");
const OUTPUT_FILE = path.join(DATA_DIR, "shops.json");

async function createBrowser(): Promise<Browser> {
  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: true,
  };
  return chromium.launch(launchOptions);
}

function parseAddress(fullAddress: string): { pref: string; city: string } {
  // e.g. 東京都新宿区... -> pref: 東京都, city: 新宿区
  // e.g. 北海道札幌市... -> pref: 北海道, city: 札幌市
  // Note: Japanese address parsing is complex, this is a best-effort heuristic for splitting
  const prefMatch = fullAddress.match(/^(.{2,3}?[都道府県])(.+)/);
  if (!prefMatch || !prefMatch[1] || !prefMatch[2]) {
    return { pref: "", city: "" };
  }
  const pref = prefMatch[1];
  const rest = prefMatch[2];

  // Try to grab the next chunk as city (City, Ward, District)
  // Usually ends with 市, 区, 町, 村
  // Heuristic: Take characters until the first occurrence of these
  const cityMatch = rest.match(/^(.+?[市区町村])/);
  const city = cityMatch && cityMatch[1] ? cityMatch[1] : rest;

  return { pref, city };
}

export async function scrapeAllShops() {
  console.log("🚀 Starting Global Hyakumeiten Batch Scrape...");

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check if we really need to run (User mentioned logic: Run if missing or 1st of month)
  // Logic will be handled by the caller or we force run here.
  // For this script, we assume we ARE running it.

  const browser = await createBrowser();
  const page = await browser.newPage();

  // 1. Get Categories
  console.log("1. Fetching Categories...");
  await page.goto(`${BASE_URL}/hyakumeiten`, { waitUntil: "domcontentloaded" });

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

  const categoryList: ICategory[] = rawSlugs
    .filter((slug) => !["top", "history", "msg"].includes(slug))
    .map((fullSlug) => {
      const lookupKey = fullSlug;
      const baseSlug = fullSlug.replace(/_east$|_west$|_tokyo$/, "");
      const finalKey = CATEGORY_TRANSLATION_MAP[lookupKey]
        ? lookupKey
        : baseSlug;
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
        traditionalChineseName: data.zh
          .replace(/\s*[\(（].*?[\)）]/g, "")
          .trim(),
        japaneseName: data.jp,
      };
    });

  console.log(`✅ Found ${categoryList.length} Categories.`);

  const allShopsMap = new Map<string, IShopExtended>();

  // 2. Iterate Categories
  for (const cat of categoryList) {
    console.log(
      `\n📂 Processing Category: ${cat.traditionalChineseName} (${cat.name})...`
    );
    // NOTE: Removed `?pref=xxx`. We want the whole list.
    const url = `${BASE_URL}/hyakumeiten/${cat.name}`;

    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      try {
        await Promise.race([
          page.waitForSelector(".hyakumeiten-shop__item", { timeout: 3000 }),
          page.getByText("該当する店舗はありません").waitFor({ timeout: 3000 }),
        ]);
      } catch {}

      // Scrape List Page
      const shops = await page.evaluate((categoryName) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: any[] = [];
        const items = document.querySelectorAll(".hyakumeiten-shop__item");

        items.forEach((item) => {
          const nameEl = item.querySelector(".hyakumeiten-shop__name");
          const anchorEl = item.querySelector("a.hyakumeiten-shop__target");
          const areaEl = item.querySelector(".hyakumeiten-shop__area");
          // Extract Thumbnail
          // User suggestion: check hyakumeiten-shop__img div
          // Fix: Check data-original first to avoid placeholder GIFs
          const imgEl = item.querySelector(".hyakumeiten-shop__img img");
          let thumbUrl =
            imgEl?.getAttribute("src") ||
            "//play-lh.googleusercontent.com/j7DSy_97R-L-uOlNnRbkioAMzLCEE9BIFsG_25-t97Kxifk3B1K9uo6fpbT9VVnQ5w=w240-h480-rw";

          if (thumbUrl.startsWith("//")) {
            thumbUrl = `https:${thumbUrl}`;
          }

          if (nameEl && anchorEl) {
            results.push({
              category: categoryName,
              name: nameEl.textContent?.trim(),
              url: (anchorEl as HTMLAnchorElement).href,
              address: areaEl?.textContent?.trim() || "",
              rating: 0, // Placeholder, fetch in detail
              thumbnailUrl: thumbUrl,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any); // Use any for internal evaluate result, cast later
          }
        });
        return results;
      }, cat.traditionalChineseName);

      for (const s of shops) {
        // Normalize URL
        const normalizedUrl = s.url.replace(/\/$/, "");
        if (!allShopsMap.has(normalizedUrl)) {
          allShopsMap.set(normalizedUrl, {
            name: s.name,
            category: s.category, // First category found
            url: s.url,
            rating: 0,
            address: s.address, // Placeholder, will update
            thumbnailUrl: s.thumbnailUrl,
            price: "",
            closedDay: "",
            businessHour: "",
            prefecture: "", // To be filled
            city: "", // To be filled
            googleMapUrl: "",
            googleMapRating: 0,
          });
        }
      }
      console.log(
        `   Found ${shops.length} shops in this category. Total unique: ${allShopsMap.size}`
      );
    } catch (e) {
      console.error(`   Error processing category ${cat.name}:`, e);
    }
  }

  // 3. Detail Scraping
  const uniqueShops = Array.from(allShopsMap.values());
  console.log(
    `\n📋 Starting Detail Scraping for ${uniqueShops.length} shops...`
  );

  let completedCount = 0;

  async function processShop(shop: IShopExtended, browserInstance: Browser) {
    const p = await browserInstance.newPage();
    try {
      await p.goto(shop.url, { waitUntil: "domcontentloaded", timeout: 30000 });

      const details = await p.evaluate(() => {
        // Full Address
        let fullAddress = "";
        const addrEl = document.querySelector(".rstinfo-table__address");
        if (addrEl) {
          fullAddress = addrEl.textContent?.trim().replace(/\s+/g, " ") || "";
        }

        let price = "";
        let closedDay = "";
        let businessHour = "";

        const rows = Array.from(document.querySelectorAll(".rstinfo-table tr"));
        rows.forEach((row) => {
          const header = row.querySelector("th")?.textContent?.trim() || "";
          const cell = row.querySelector("td");
          const txt = cell?.textContent?.trim() || "";

          if (header.includes("予算")) {
            const priceEl = cell?.querySelector(
              ".rstinfo-table__budget-item em"
            );
            price = priceEl
              ? priceEl.textContent?.trim() || ""
              : txt.split("\n")[0]?.trim() || "";
          }
          if (header.includes("営業時間")) businessHour = txt;
          if (header.includes("定休日")) closedDay = txt;
        });

        // Format Price
        if (price) {
          if (price.includes("～"))
            price = price.replace(/～/g, "-").replace(/￥/g, "¥");
          else if (price.includes("￥")) price = price.replace(/￥/g, "¥");
        }

        // Extract Rating (Detail Page)
        const ratingEl = document.querySelector(
          ".rdheader-rating__score-val-dtl"
        );
        const ratingVal = ratingEl?.textContent?.trim() || "0";

        // Fallback for Closed Day from Business Hour
        if (!closedDay && businessHour.includes("定休日")) {
          const match = businessHour.match(/定休日[:：]?\s*([^\n]+)/);
          if (match) closedDay = match[1] || "";
        }

        // Flatten business hour
        if (businessHour)
          businessHour = businessHour.replace(/\s+/g, " ").trim();

        return { fullAddress, price, closedDay, businessHour, ratingVal };
      });

      shop.address = details.fullAddress || shop.address;
      shop.price = details.price;
      shop.closedDay = details.closedDay;
      shop.businessHour = details.businessHour;

      const r = parseFloat(details.ratingVal);
      shop.rating = isNaN(r) ? 0 : r;

      // Parse City/Pref
      const location = parseAddress(shop.address);
      shop.prefecture = location.pref;
      shop.city = location.city;
    } catch (e) {
      console.error(`Error processing ${shop.name}: ${e}`);
    } finally {
      await p.close();
    }
  }

  // Queue system
  const queue = [...uniqueShops];
  async function worker() {
    while (queue.length > 0) {
      const s = queue.shift();
      if (!s) break;
      await processShop(s, browser);
      completedCount++;
      if (completedCount % 20 === 0)
        console.log(`   Progress: ${completedCount}/${uniqueShops.length}`);
    }
  }

  const workers = Array.from({ length: CONCURRENCY_LIMIT }, () => worker());
  await Promise.all(workers);

  await browser.close();

  // Save JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueShops, null, 2));
  console.log(`\n💾 Saved ${uniqueShops.length} shops to ${OUTPUT_FILE}`);
}

// Allow direct execution
if (require.main === module) {
  scrapeAllShops().catch(console.error);
}
