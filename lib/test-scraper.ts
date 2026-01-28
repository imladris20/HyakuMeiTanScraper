import { chromium } from "playwright";

import type { IShopExtended } from "./types";

// Test URL: Sushi Tokyo (First shop usually)
const TEST_CATEGORY_URL = "https://award.tabelog.com/hyakumeiten/sushi_tokyo";

async function testScraper() {
  console.log("🧪 Starting Test Scraper...");
  const browser = await chromium.launch({ headless: true }); // Set to false to see browser
  const page = await browser.newPage();

  console.log(`1. Visiting Category Page: ${TEST_CATEGORY_URL}`);
  await page.goto(TEST_CATEGORY_URL, { waitUntil: "domcontentloaded" });

  // 1. Scrape List Item (Thumbnail Check)
  console.log("2. Extracting first shop from list...");
  const shopData = await page.evaluate(() => {
    const item = document.querySelector(
      ".hyakumeiten-shop__item, .hyakumeiten-shop-item"
    );
    if (!item) return null;

    const nameEl = item.querySelector(
      ".hyakumeiten-shop__name, .hyakumeiten-shop-item__name"
    );
    const anchorEl = item.querySelector(
      "a.hyakumeiten-shop__target, a.hyakumeiten-shop-item__target"
    );
    const areaEl = item.querySelector(
      ".hyakumeiten-shop__area, .hyakumeiten-shop-item__area"
    );

    // Thumbnail Selector Check
    const imgEl = item.querySelector(
      ".hyakumeiten-shop__img img, .hyakumeiten-shop-item__img img"
    );
    const thumbUrl =
      imgEl?.getAttribute("src") || imgEl?.getAttribute("data-original") || "";

    if (nameEl && anchorEl) {
      return {
        name: nameEl.textContent?.trim(),
        url: (anchorEl as HTMLAnchorElement).href,
        address: areaEl?.textContent?.trim() || "",
        thumbnailUrl: `https:${thumbUrl}`,
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
  const finalShop: Partial<IShopExtended> = {
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
