import { scrapeHyakumeiten } from './lib/scraper';

// 保留 CLI 用途：預設仍抓取長野
async function main() {
  const pref = process.argv[2] || 'nagano';
  console.log(`CLI 模式執行爬蟲，pref=${pref}`);
  await scrapeHyakumeiten(pref);
}

void main();
