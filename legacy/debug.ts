import { chromium } from "playwright";

const TARGET_URL =
  "https://award.tabelog.com/hyakumeiten/soba_east?pref=nagano";

(async () => {
  console.log("🕵️‍♀️ 開始執行診斷模式...");
  console.log(`👉 目標網址: ${TARGET_URL}`);

  // 使用 channel: 'chrome' 確保所見即所得
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const page = await browser.newPage();

  try {
    // 1. 前往網頁
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });

    // 2. 強制等待 10 秒，確保畫面完全渲染
    console.log("⏳ 等待網頁渲染 (10秒)...");
    await page.waitForTimeout(10000);

    // 3. 拍一張截圖 (這會儲存在您的資料夾下)
    await page.screenshot({ path: "debug_screenshot.png", fullPage: true });
    console.log(
      "📸 已儲存截圖: debug_screenshot.png (請打開檢查看看是否真的有店家)"
    );

    // 4. 診斷 HTML 結構
    console.log("🔍 正在分析 HTML 結構...");

    const debugInfo = await page.evaluate(() => {
      // 嘗試抓取各種可能的店家卡片 Class Name
      const selectors = [
        ".hyakumeiten-shop__item", // 標準版 (雙底線)
        ".hyakumeiten-shop-item", // 舊版/變體 (單橫線)
        ".rst-list__rst-item", // 一般搜尋結果列表
        ".list-rst", // 舊版搜尋列表
        ".rstlist-info-table__item", // 表格列表
      ];

      interface SelectorReport {
        count: number;
        firstItemHTML: string;
      }

      const report: Record<string, SelectorReport> = {};

      selectors.forEach((sel) => {
        const elements = document.querySelectorAll(sel);
        report[sel] = {
          count: elements.length,
          firstItemHTML:
            elements.length > 0 && elements[0]
              ? elements[0].outerHTML.slice(0, 300) + "..."
              : "N/A",
        };
      });

      // 如果上面都找不到，抓取頁面上任意前 3 個連結的文字，看看我們到底在哪
      const links = Array.from(document.querySelectorAll("a"))
        .slice(0, 5)
        .map((a) => a.innerText);

      return {
        url: document.location.href,
        selectorReport: report,
        sampleLinks: links,
      };
    });

    console.log("\n-------- 診斷報告 --------");
    console.log("📍 當前網址:", debugInfo.url);
    console.log("📊 各種選擇器的抓取數量:");
    console.table(debugInfo.selectorReport);
    console.log("🔗 頁面上前 5 個連結文字:", debugInfo.sampleLinks);
    console.log("--------------------------\n");

    if (Object.values(debugInfo.selectorReport).some((r) => r.count > 0)) {
      console.log("✅ 測試成功：有抓到某些元素，我們可以修正 index.ts 了。");
    } else {
      console.log("❌ 測試失敗：所有已知的選擇器都抓不到東西。");
    }
  } catch (e) {
    console.error("❌ 發生錯誤:", e);
  } finally {
    // 暫時不關閉瀏覽器，讓您可以看一下畫面
    console.log("👀 瀏覽器將保持開啟，您可以檢查畫面。按 Ctrl+C 結束程式。");
    // await browser.close();
  }
})();
