# Tabelog 百名店爬蟲 (Hyakumeiten Scraper)

這是一個用來自動抓取 [Tabelog 百名店](https://award.tabelog.com/hyakumeiten) 資訊的爬蟲工具。目前設定為抓取 **長野縣 (Nagano)** 的所有百名店資料。

## ✨ 特色

- **自動化抓取**：自動遍歷所有百名店類別（如拉麵、壽司、麵包等）。
- **平行處理**：支援多執行緒並行抓取，大幅提升爬取速度。
- **Excel 友善**：輸出的 CSV 檔案包含 BOM (Byte Order Mark)，可直接用 Excel 開啟而不會有亂碼問題。
- **詳細資訊**：包含店家名稱、地址、評分、價格範圍、營業時間與定休日。

## 🛠️ 安裝與設定

本專案使用 TypeScript 與 Playwright。請確保您已安裝 Node.js。

1. **安裝相依套件**

   ```bash
   npm install
   ```

2. **安裝 Playwright 瀏覽器** (若是初次使用)

   ```bash
   npx playwright install chromium
   ```

## 🚀 使用方式

執行以下指令即可開始爬取：

```bash
npm run dev
```

爬蟲執行過程中會顯示進度，完成後會自動關閉。

## 📂 輸出檔案

執行完成後，資料將儲存於：

`output/nagano_hyakumeiten.csv`

### 欄位說明

- **Name**: 店家名稱
- **Address**: 地址
- **Category**: 百名店類別
- **URL**: Tabelog 頁面連結
- **Rating**: 評分
- **Price**: 預算範圍
- **Closed Day**: 定休日
- **Business Hour**: 營業時間

## ⚙️ 技術堆疊

- [Playwright](https://playwright.dev/): 網頁自動化與爬蟲
- [csv-writer](https://www.npmjs.com/package/csv-writer): 產生 CSV 檔案
- TypeScript: 開發語言

## 📝 注意事項

- 目前程式碼硬寫為抓取 `pref=nagano` (長野縣)。如需抓取其他地區，請修改 `index.ts` 中的 `url` 參數。
- 此工具僅供學習與研究使用，請遵守網站的使用條款。
