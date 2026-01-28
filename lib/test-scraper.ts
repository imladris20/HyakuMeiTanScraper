import { chromium } from "playwright";

import { BASE_URL, SHOP_IMAGE_PLACEHOLDER } from "./batch-scraper";
import type { IShop } from "./types";

// Test URL: Sushi Tokyo (First shop usually)
const TEST_CATEGORY_URL = `${BASE_URL}/hyakumeiten/ramen_hokkaido`;

async function testScraper() {
  console.log("🧪 Starting Test Scraper...");
  const browser = await chromium.launch({ headless: true }); // Set to false to see browser
  const page = await browser.newPage();

  console.log(`1. Visiting Category Page: ${TEST_CATEGORY_URL}`);
  await page.goto(TEST_CATEGORY_URL, { waitUntil: "domcontentloaded" });

  // 1. Scrape List Item (Thumbnail Check)
  console.log("2. Extracting first shop from list...");
  const shopData = await page.evaluate(() => {
    const item = document.querySelector(".hyakumeiten-shop__item");
    if (!item) return null;

    const nameEl = item.querySelector(".hyakumeiten-shop__name");
    const anchorEl = item.querySelector("a.hyakumeiten-shop__target");
    const areaEl = item.querySelector(".hyakumeiten-shop__area");

    // Thumbnail Selector Check
    const imgEl = item.querySelector(".hyakumeiten-shop__img img");
    let thumbUrl = imgEl?.getAttribute("data-src");

    if (thumbUrl && thumbUrl.endsWith(".gif")) {
      console.log("抓到官方暫時用的 placeholder");
      thumbUrl = SHOP_IMAGE_PLACEHOLDER;
    }

    if (thumbUrl && thumbUrl.startsWith("//")) {
      thumbUrl = `https:${thumbUrl}`;
    }

    if (nameEl && anchorEl) {
      return {
        name: nameEl.textContent?.trim(),
        url: (anchorEl as HTMLAnchorElement).href,
        address: areaEl?.textContent?.trim() || "",
        thumbnailUrl: thumbUrl ?? SHOP_IMAGE_PLACEHOLDER,
      };
    }
    return null;
  });

  if (!shopData) {
    console.error("❌ Failed to find any shop on the list page.");
    await browser.close();
    return;
  }

  console.log("✅ List Data Extracted:");
  console.log(shopData);

  // 2. Scrape Detail Page (Rating Check)
  console.log(`\n3. Visiting Detail Page: ${shopData.url}`);
  await page.goto(shopData.url, { waitUntil: "domcontentloaded" });

  const detailData = await page.evaluate(() => {
    // Rating Selector Check
    const ratingEl = document.querySelector(".rdheader-rating__score-val-dtl");
    const ratingVal = ratingEl?.textContent?.trim() || "0";

    return {
      ratingRaw: ratingVal,
    };
  });

  console.log("✅ Detail Data Extracted:");
  console.log(detailData);

  // Final Result Object
  const finalShop: Partial<IShop> = {
    ...shopData,
    rating: parseFloat(detailData.ratingRaw),
    prefecture: "TEST_PREF",
    city: "TEST_CITY",
  };

  console.log("\n🎉 Final Combined Object (Preview):");
  console.dir(finalShop, { depth: null });

  await browser.close();
}

testScraper().catch(console.error);
