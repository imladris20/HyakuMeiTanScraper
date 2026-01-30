# Tabelog 百名店查詢器 (HyakuMeiTenHub)

一個基於 **Next.js 16 + React 19 + Tailwind CSS v4 + daisyUI** 建置的現代化 Web 應用程式，旨在幫助使用者探索、搜尋與篩選日本 Tabelog（食べログ）「百名店」的精選餐廳資料。

本專案包含一個強大的 Playwright 爬蟲引擎，可自動抓取全日本約 7,000 間名店資訊，並提供直覺的介面進行多維度過濾。

---

## 🌟 核心功能

- **自動化爬蟲**：利用 Playwright 模擬真實瀏覽行為，抓取店名、評分、地址、價格區間、公休日與營業時間。
- **全文搜尋與篩選**：
  - **店名關鍵字**搜尋。
  - **都道府縣**與**詳細市區**級別篩選（支援連動功能）。
  - **店家類別**（拉麵、壽司、燒肉等）過濾。
  - **價格預算**與**最低評分**篩選。
- **現代化介面**：使用 Tailwind CSS v4 與 daisyUI 打造，支援快速分頁、評分排序與圖片預覽。
- **資料持久化**：抓取的資料儲存在本機 `data/shops.json`，確保離線也能快速檢索。

---

## 🛠️ 技術棧

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, daisyUI v5
- **Backend/Scraper**: Playwright (Headless Chromium), tsx, csv-writer
- **Runtime**: Bun (建議) / Node.js 24+
- **Data**: JSON-based flat file database

---

## 🚀 快速開始

### 1. 安裝環境

推薦使用 **Bun** 以獲得最佳效能。

#### 安裝 Bun

如果您尚未安裝 Bun，請根據您的作業系統執行以下指令：

- **macOS / Linux**:

  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **Windows (PowerShell)**:

  ```powershell
  powershell -c "irm bun.sh/install.ps1 | iEx"
  ```

#### 安裝專案所需套件

在專案根目錄執行：

```bash
# 安裝套件
bun install

# 安裝 Playwright 瀏覽器執行檔
bunx playwright install chromium
```

### 2. 資料抓取 (Scraping)

在啟動網頁介面之前，建議先執行完整的爬蟲以初始化資料庫（此過程約需數分鐘，取決於網路速度與同時執行限制）：

```bash
bun run scrape:all
```

> **注意**：爬蟲會將結果儲存在 `data/shops.json`。

### 3. 啟動開發伺服器

```bash
bun run dev
```

開啟瀏覽器前往 [http://localhost:2950](http://localhost:2950) 即可開始使用。

---

## 📂 專案結構

- `app/`：Next.js 頁面與 API 路由。
  - `page.tsx`：主搜尋介面。
  - `api/shops/`：回傳 JSON 資料的 API。
- `lib/`：核心邏輯與爬蟲。
  - `batch-scraper.ts`：Playwright 全域抓取腳本。
  - `constants.ts`：分類翻譯與定義檔。
- `data/`：存放產生的資料檔。

---

## 💡 使用提示

- **同時執行控制**：在 `lib/batch-scraper.ts` 中可調整 `CONCURRENCY_LIMIT`（預設為 5），雖可加速抓取但請注意避免觸發 Tabelog 的頻率限制。
- **地址解析**：系統會自動嘗試將日本地址拆分為「都道府縣」與「市區町村」，方便前端篩選。

---

## ⚖️ 免責聲明

本專案僅供學術研究與個人資料存檔用途。請在遵守 [Tabelog 使用條款](https://tabelog.com/help/rules/) 的前提下使用，避免對目標網站造成過重負荷。