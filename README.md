# Tabelog 百名店查詢器

一個使用 **Next.js 16 + React 19 + Tailwind CSS v4 + daisyUI** 建置的前後端整合專案，用來從 Tabelog「百名店」活動頁面中，批次爬取指定都道府縣的店家資料，並輸出成 CSV，同時在網頁上以表格與終端機風格的 Console 介面顯示執行過程與結果。

## 功能總覽

- **前端查詢介面**
  - 下拉選單選擇都道府縣（依照 Tabelog `?pref=xxx` 選項，顯示文字與實際值對應）。
  - 「查詢」按鈕：向後端觸發一次完整的 Playwright 爬蟲流程。
  - 「Console 狀態」區塊：以終端機風格呈現伺服端實際執行的 log（與本機終端機輸出內容一致或極為接近）。
  - 「查詢結果」表格：列出所有取得的店家資訊（店名、地址、類別、URL、評分、價格、公休日、營業時間）。
  - 「下載 CSV」按鈕：下載本次查詢產生的 CSV 檔。
  - 「清除結果」按鈕：清空目前畫面上的 Console 與查詢結果，回到初始狀態。

- **後端爬蟲（Playwright + Node.js）**
  - 透過 Playwright 的 Chromium 引擎，自動瀏覽 Tabelog 百名店頁面。
  - 先抓取所有「食物類別」的 slug，透過 `CATEGORY_TRANSLATION_MAP` 對應成中／日文分類名稱。
  - 針對每個類別與使用者選定的都道府縣 `pref=xxx`, 取得所有符合條件的店家列表。
  - 自動追蹤重導向後的最終 URL，避免重複爬取相同店家。
  - 進一步逐一打開店家頁面，解析店名、評分、完整地址、價格、定休日、營業時間等詳細資訊。
  - 支援多執行緒（`CONCURRENCY_LIMIT`）並行抓取，提高執行效率。
  - 最後將所有結果寫入 `output/<pref>_hyakumeiten.csv`，並於檔案開頭自動加入 UTF-8 BOM，方便在 Excel / Numbers 中正常顯示中文。

- **CLI 示範腳本**
  - `index.ts` 仍保留一個以「長野縣 (`pref=nagano`)」為例的獨立腳本，可直接在終端機執行，不透過網頁介面。

---

## 系統需求

- **Node.js**：建議使用 **Node.js 24 以上版本**（Next.js 16 及 Playwright 官方建議版本）。
- **bun / npm / pnpm / yarn**：範例指令以下皆以 `bun` 演示。
- **作業系統**：macOS / Linux / Windows 皆可。
- **網路連線**：需能連線至 `https://award.tabelog.com` 以及 Tabelog 主站。

> 如果你尚未安裝 Playwright 的瀏覽器執行檔，第一次安裝完套件後，建議先執行一次：
>
> ```bash
> bunx playwright install chromium
> ```
>
> 這會下載 Chromium 執行檔，之後後端爬蟲才能正常啟動瀏覽器。

---

## 專案結構簡介（重點）

- `app/`
  - `page.tsx`：前端單頁式查詢介面（Select + Console 狀態 + 結果表格 + 下載/清除按鈕）。
  - `layout.tsx`：全域版面與 `<html> / <body>` 結構。
  - `assets/icon.png`：頁面標題左側顯示用的圖示（非瀏覽器標籤列 favicon）。
  - `globals.css`：Tailwind CSS v4 + daisyUI 的全域樣式。
  - `api/scrape/route.ts`：處理 `/api/scrape` POST 請求，呼叫後端爬蟲並回傳查詢結果與執行 log。
  - `api/download/route.ts`：處理 `/api/download` GET 請求，將指定都道府縣的 CSV 檔回傳給前端下載。
- `lib/scraper.ts`：主要的 Playwright 爬蟲邏輯與 CSV 匯出實作。
-$index.ts`：原始 CLI 腳本版本（以長野縣為例），可獨立於網頁介面之外執行。
 - `output/`：儲存各都道府縣的輸出 CSV 檔（例如 `output/nagano_hyakumeiten.csv`）。

---

## 安裝與本機執行步驟

以下假設你已經將專案原始碼下載到本機，例如目錄為 `HyakuMeiTanScraper/`。

### 0. 安裝 bun 到你的 node 環境中

bash, linux, macOs 請執行：
```bash
curl -fsSL https://bun.sh/install | bash
```

windows 系統請執行：
```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 1. 安裝相依套件

在專案根目錄執行：

```bash
cd HyakuMeiTanScraper
bun install
```

安裝完成後，建議先安裝 Playwright 的瀏覽器執行檔（只需跑一次）：

```bash
bunx playwright install chromium
```

### 2. 啟動開發伺服器（Next.js）

在專案根目錄執行：

```bash
bun run dev
```

預設會啟動在 **`http://localhost:2950`**，終端機會顯示類似：

```text
Next.js 16.1.5 (Turbopack)
- Local:   http://localhost:2950
...
```

打開瀏覽器，前往 `http://localhost:2950`，即可看到：

- 上方為「Tabelog 百名店查詢器」標題與專案 icon。
- 中間是「選擇都道府縣並執行」卡片，包含都道府縣下拉選單、查詢按鈕、清除結果、下載 CSV。
- 下方是「Console 狀態」（終端機風格 log 視窗）與「查詢結果」表格。

### 3. 正式版建置與啟動（選用）

如果要在本機模擬正式環境（或部署前測試），可以：

```bash
bun run build
bun start
```

預設是使用 `PORT=2950` 或你自行設定的 `PORT`（若要沿用 2950，可手動設定環境變數）。

---

## 使用流程說明（透過網頁介面）

1. **啟動開發伺服器**
   - 在專案根目錄執行 `bun run dev`。
   - 確認終端機顯示 `Local: http://localhost:2950`。

2. **打開瀏覽器進入查詢頁**
   - 造訪 `http://localhost:2950`。

3. **選擇都道府縣**
   - 在「都道府縣」下拉選單中選擇想要查詢的區域，例如：
     - `長野`（值為 `nagano`）
     - `東京`（值為 `tokyo`）
     - `北海道`（值為 `hokkaido`）
     - …等，實際值對應到 Tabelog 的 `?pref=xxx`。

4. **開始查詢**
   - 按下「**查詢**」按鈕。
   - 前端會呼叫 `/api/scrape`，將目前選擇的 `pref` 傳給後端。
   - 後端啟動 Playwright，依下列步驟執行：
     - 造訪 `https://award.tabelog.com/hyakumeiten`。
     - 抓取所有百名店類別 slug，對應到 `CATEGORY_TRANSLATION_MAP` 取得中／日文名稱。
     - 針對每個類別造訪 `...?pref=你選的都道府縣`，收集屬於該縣市的所有店家。
     - 過濾重覆店家，接著並行打開每一間店家頁面，讀取詳細資訊。
     - 寫入 `output/<pref>_hyakumeiten.csv`。

5. **觀察 Console 狀態**
   - 中間的「Console 狀態」區塊會即時顯示伺服端 log，例如：
     - `0. 準備前往網址...`
     - `1. 抓取所有類別 Slug`
     - `3. 遍歷每個類別抓取店家：準備開始爬取 (pref=nagano)...`
     - `✅ [完成] 某某名店`
     - `⏳ 進度: 40/76`
     - `📊 總結：共找到 76 間位於 nagano 的百名店。`
   - 這個視窗會自動捲動到底部，讓你隨時看到最新進度。

6. **查看查詢結果表格**
   - 查詢完成後，下方的「查詢結果」表格會顯示所有抓到的店家。
   - 每筆資料包含：
     - 店名（可搭配日文顯示）
     - 地址（完整地址，已整理多餘空白）
     - 類別（中文分類名稱）
     - URL（可點擊「開啟」在新分頁打開 Tabelog 頁面）
     - 評分、價格、公休日、營業時間等。

7. **下載 CSV 檔**
   - 查詢完成後，右側會出現「**下載 CSV**」按鈕。
   - 點擊後即下載 `output/<pref>_hyakumeiten.csv`，內文為 UTF-8 with BOM，可直接用 Excel / Numbers 開啟。

8. **清除結果並重新查詢**
   - 點擊「**清除結果**」按鈕：
     - 會清空畫面上的 Console log 與查詢結果表格。
     - 不會刪除既有的 CSV 檔（檔案仍保留在 `output/` 資料夾）。
   - 之後即可重新選擇其他都道府縣，再按一次「查詢」重跑。

---

## 使用流程說明（透過 CLI 腳本，選用）

如果你想在終端機直接執行原始的 Node.js 腳本（目前寫死查詢長野 `pref=nagano`），可以使用 `bun` 腳本：

```bash
bun run scrape:nagano
```

這會執行 `tsx index.ts`，流程與網頁版後端邏輯類似，但：

- 不會透過 `/api/scrape` 與前端互動，而是單純在終端機顯示 log。
- 同樣會在 `output/nagano_hyakumeiten.csv` 寫出結果。

> 建議一般使用者以「網頁介面」為主，CLI 腳本主要做為開發或除錯時的備用工具。

---

## 常見問題（FAQ）

### Q1. 為什麼第一次執行會比較久？

第一次執行時，Playwright 可能需要下載 Chromium 執行檔，或是 Tabelog 頁面快取尚未建立。之後在同一台機器上再次執行，速度通常會明顯加快。

### Q2. 執行過程中出現錯誤訊息怎麼辦？

- 先看「Console 狀態」區塊與終端機的 log，通常會標示是連線失敗、版面結構變更、或是個別店家頁面錯誤。
- 大多數情況下，某些店家失敗不會影響整體流程，只是略過該店家並在 log 中標示 `[失敗]`。
- 若整個流程提前結束且沒有輸出 CSV，請檢查：
  - 是否可以在瀏覽器中正常打開 `https://award.tabelog.com/hyakumeiten`。
  - Playwright 是否已成功安裝瀏覽器（可嘗試 `npx playwright install chromium`）。

### Q3. 要改查詢的並行數量怎麼辦？

在 `lib/scraper.ts` 檔案最上方有 `const CONCURRENCY_LIMIT = 5;`，可以依照你機器的效能與網路狀況調整，但請注意：

- 值太大可能造成 Tabelog 阻擋或暫時封鎖，或導致本機 CPU / 記憶體負載過高。
- 建議從 3～8 之間慢慢嘗試。

---

## 授權與貢獻

目前此專案主要用於個人研究與資料蒐集用途，請在遵守 Tabelog 官方使用條款及機器人存取規範的前提下使用。若你有興趣共同行銷、優化爬蟲策略或新增更多視覺化功能，歡迎提出 Issue 或 Pull Request。