import { createObjectCsvWriter } from "csv-writer";
import * as fs from "fs";
import { chromium } from "playwright";

// 定義店家的資料結構
interface Shop {
  category: string;
  name: string;
  url: string;
  address: string;
  rating: string;
}

// 定義輸出 category 的結構
interface CategoryOutput {
  name: string; // slug
  traditionalChineseName: string;
  japaneseName: string;
}

const BASE_URL = "https://award.tabelog.com";

// --- 🔥 完整的翻譯與日文對照表 (Master Dictionary) ---
// 修正：補上 tempura, oden, shaved_ice 等遺漏項目
const MASTER_CATEGORY_MAP: Record<
  string,
  { zh: string; jp: string; isRegionSpecific?: boolean }
> = {
  // --- 麵類 ---
  ramen: { zh: "拉麵", jp: "ラーメン" },
  ramen_tokyo: { zh: "拉麵 (東京)", jp: "ラーメン TOKYO" },
  ramen_east: { zh: "拉麵 (東日本)", jp: "ラーメン EAST" },
  ramen_west: { zh: "拉麵 (西日本)", jp: "ラーメン WEST" },
  ramen_hokkaido: { zh: "拉麵 (北海道)", jp: "ラーメン 北海道" },
  ramen_kanagawa: { zh: "拉麵 (神奈川)", jp: "ラーメン 神奈川" },
  ramen_aichi: { zh: "拉麵 (愛知)", jp: "ラーメン 愛知" },
  ramen_osaka: { zh: "拉麵 (大阪)", jp: "ラーメン 大阪" },
  soba: { zh: "蕎麥麵", jp: "そば" },
  udon: { zh: "烏龍麵", jp: "うどん" },
  udon_kagawa: { zh: "烏龍麵 (香川)", jp: "うどん 香川" },
  yakisoba: { zh: "炒麵", jp: "焼きそば" },
  pasta: { zh: "義大利麵", jp: "パスタ" },

  // --- 日本料理 / 海鮮 / 鍋物 ---
  japanese: { zh: "日本料理", jp: "日本料理" },
  sushi: { zh: "壽司", jp: "寿司" },
  tempura: { zh: "天婦羅", jp: "天ぷら" }, // ✅ 補上這裡
  unagi: { zh: "鰻魚", jp: "うなぎ" },
  fugu: { zh: "河豚", jp: "ふぐ" },
  crab: { zh: "螃蟹", jp: "かに" },
  oden: { zh: "關東煮", jp: "おでん" }, // ✅ 補上這裡
  sukiyaki_shabushabu: { zh: "壽喜燒・涮涮鍋", jp: "すき焼き・しゃぶしゃぶ" },
  motsunabe: { zh: "牛雜鍋", jp: "もつ鍋" },

  // --- 肉類 ---
  yakiniku: { zh: "燒肉", jp: "焼肉" },
  steak: { zh: "牛排・鐵板燒", jp: "ステーキ・鉄板焼き" },
  tonkatsu: { zh: "炸豬排", jp: "とんかつ" },
  burger: { zh: "漢堡", jp: "ハンバーガー" },
  hamburger: { zh: "漢堡排", jp: "ハンバーグ" },
  jingisukan: { zh: "成吉思汗烤肉", jp: "ジンギスカン" },

  // --- 雞肉 ---
  yakitori: { zh: "燒鳥 (串燒)", jp: "焼き鳥" },
  toriryori: { zh: "雞肉料理", jp: "鳥料理" },

  // --- 西式 / 各國料理 ---
  french: { zh: "法式料理", jp: "フレンチ" },
  italian: { zh: "義大利料理", jp: "イタリアン" },
  chinese: { zh: "中華料理", jp: "中国料理" },
  spanish: { zh: "西班牙料理", jp: "スペイン料理" },
  thai: { zh: "泰式料理", jp: "タイ料理" },
  indian: { zh: "印度料理", jp: "インド料理" },
  korean: { zh: "韓國料理", jp: "韓国料理" },
  asia_ethnic: { zh: "亞洲・異國料理", jp: "アジア・エスニック" },
  vietnam: { zh: "越南料理", jp: "ベトナム料理" },
  pizza: { zh: "披薩", jp: "ピザ" },
  bistro: { zh: "小酒館・洋食", jp: "ビストロ" },
  yoshoku: { zh: "日式洋食", jp: "洋食" },
  curry: { zh: "咖哩", jp: "カレー" },
  gyoza: { zh: "餃子", jp: "餃子" },
  creative_innovative: { zh: "創新料理", jp: "イノベーティブ" },

  // --- 居酒屋 / 酒 / 輕食 ---
  izakaya: { zh: "居酒屋", jp: "居酒屋" },
  bar: { zh: "酒吧", jp: "バー" },
  tachinomi: { zh: "立吞 (站著喝)", jp: "立ち飲み" },
  cafe: { zh: "咖啡廳", jp: "カフェ" },
  kissaten: { zh: "純喫茶 (老派咖啡店)", jp: "喫茶店" },
  tea: { zh: "紅茶・專門茶", jp: "紅茶" },
  bread: { zh: "麵包", jp: "パン" },
  sweets: { zh: "甜點", jp: "スイーツ" },
  wagashi: { zh: "和菓子 (日式甜點)", jp: "和菓子・甘味処" },
  shaved_ice: { zh: "刨冰", jp: "かき氷" }, // ✅ 補上這裡
  ice_gelato: { zh: "冰淇淋", jp: "アイス・ジェラート" },
  shochu: { zh: "燒酒", jp: "焼酎" },
  beer: { zh: "啤酒", jp: "ビアバー" },

  // --- 粉物 ---
  okonomiyaki: { zh: "大阪燒", jp: "お好み焼き" },
  shokudo: { zh: "定食・食堂", jp: "食堂" },
};

console.log("🚀 [Node/npm] 開始執行 Tabelog 百名店爬蟲...");

// 使用 channel: 'chrome' 確保 Windows 下能順利執行
const browser = await chromium.launch({ headless: false, channel: "chrome" });
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
      // 提取 slug
      const match = href.match(/\/hyakumeiten\/([a-z0-9_]+)/);
      if (!match) return null;
      return match[1];
    })
    .filter((v): v is string => v !== null)
    .filter((v, i, a) => a.indexOf(v) === i); // 去重
});

console.log("2. 處理 Slug 並對應到 Master Dictionary");
// 2. 處理 Slug 並對應到 Master Dictionary
const categoryList: CategoryOutput[] = rawSlugs
  .filter((slug) => !["top", "history", "msg"].includes(slug)) // 過濾掉非類別頁面
  .map((fullSlug) => {
    let lookupKey = fullSlug;
    let baseSlug = fullSlug.replace(/_east$|_west$|_tokyo$/, "");

    // 優先查 fullSlug (例如 ramen_hokkaido)，查不到再查 baseSlug (例如 ramen)
    let finalKey = MASTER_CATEGORY_MAP[lookupKey] ? lookupKey : baseSlug;

    const data = MASTER_CATEGORY_MAP[finalKey];

    if (!data) {
      console.warn(
        `⚠️ 警告：字典裡找不到 [${fullSlug}] 或 [${baseSlug}]，請手動補充。`
      );
      return {
        name: baseSlug,
        traditionalChineseName: baseSlug.toUpperCase(),
        japaneseName: baseSlug,
      };
    }

    return {
      name: baseSlug,
      traditionalChineseName: data.zh,
      japaneseName: data.jp,
    };
  })
  // 再次去重 (根據中文名稱)
  .filter(
    (v, i, a) =>
      a.findIndex(
        (t) => t.traditionalChineseName === v.traditionalChineseName
      ) === i
  );

console.log(
  `✅ 偵測到 ${categoryList.length} 個有效食物類別:`,
  categoryList.map((c) => c.traditionalChineseName).join(", ")
);

// --- 生成 categories.ts ---
const tsContent = `export const HYAKUMEITAN_CATEGORY = ${JSON.stringify(
  categoryList,
  null,
  2
)};`;

fs.writeFileSync("categories.ts", tsContent);
console.log("📝 已生成類別檔案: categories.ts");

const allNaganoShops: Shop[] = [];

console.log("3. 遍歷每個類別抓取長野店家");
// 3. 遍歷每個類別抓取長野店家
for (const cat of categoryList) {
  console.log(`\n🔍 搜尋類別：${cat.traditionalChineseName} (${cat.name})...`);

  const tryUrls: string[] = [];

  // 判斷是否為地區限定的特殊類別
  const isRegionalSpecial =
    cat.name.includes("_") &&
    !cat.name.endsWith("_east") &&
    !cat.name.endsWith("_west") &&
    !cat.name.endsWith("_tokyo");

  if (isRegionalSpecial) {
    tryUrls.push(`${BASE_URL}/hyakumeiten/${cat.name}?pref=nagano`);
  } else {
    tryUrls.push(`${BASE_URL}/hyakumeiten/${cat.name}_east?pref=nagano`);
    tryUrls.push(`${BASE_URL}/hyakumeiten/${cat.name}?pref=nagano`);
  }

  let foundShopsInCat = false;

  for (const url of tryUrls) {
    if (foundShopsInCat) break;

    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });

      if (
        page.url().includes("award.tabelog.com/hyakumeiten/msg") ||
        response?.status() === 404
      ) {
        continue;
      }

      const noResult = await page.getByText("該当する店舗はありません").count();
      if (noResult > 0) {
        break;
      }

      const shops = await page.evaluate((categoryName) => {
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
      }, cat.traditionalChineseName);

      if (shops.length > 0) {
        console.log(`   🎉 找到 ${shops.length} 間！`);
        allNaganoShops.push(...shops);
        foundShopsInCat = true;
      }
    } catch (e) {
      console.error(`   ❌ Error visiting ${url}`);
    }
  }
}

await browser.close();

console.log("4. 輸出 CSV");
// 4. 輸出 CSV
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
    ],
  });

  await csvWriter.writeRecords(allNaganoShops);
  console.log("💾 5. 檔案已儲存: nagano_hyakumeiten.csv");
} else {
  console.log("⚠️ 5. 未找到任何店家。");
}
