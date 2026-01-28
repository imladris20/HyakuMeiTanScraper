import { scrapeHyakumeiten } from "@/lib/scraper";

async function main() {
  const pref = process.argv[2] || "nagano";
  console.log(`CLI 模式執行爬蟲，pref=${pref}`);
  await scrapeHyakumeiten(pref);
}

void main();
