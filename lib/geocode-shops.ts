import fs from "fs";
import path from "path";

import { IShop } from "./types";

// Helper for delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to fetch coordinates
async function getCoordinates(query: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    query
  )}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].geometry.location;
    }
  } catch (e) {
    console.error(`   ❌ Network Error (${query}):`, e);
  }
  return null;
}

async function main() {
  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_RUN_SCRIPT_KEY;

  if (!API_KEY) {
    console.error(
      "❌ Link Error: NEXT_PUBLIC_GOOGLE_MAPS_API_RUN_SCRIPT_KEY is missing in environment variables."
    );
    process.exit(1);
  }

  const dataPath = path.join(process.cwd(), "data", "shops.json");
  if (!fs.existsSync(dataPath)) {
    console.error("❌ File not found: data/shops.json");
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataPath, "utf-8");
  const shops: IShop[] = JSON.parse(rawData);

  console.log(`📍 Starting Geocoding for ${shops.length} shops...`);

  let updatedCount = 0;
  const skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < shops.length; i++) {
    const shop = shops[i];

    // Force run: verify all data
    // if (shop.lat && shop.lng) { ... } removed

    const address = `${shop.prefecture}${shop.city}${shop.address}`;
    console.log(`[${i + 1}/${shops.length}] Geocoding: ${shop.name} ...`);

    // 1. Try Shop Name + Prefecture/City first (More accurate than name alone)
    const nameQuery = `${shop.name} ${shop.prefecture}${shop.city}`;
    let location = await getCoordinates(nameQuery, API_KEY);
    let method = "Name+Region";

    // 2. Fallback to Address
    if (!location) {
      console.log(
        `   ⚠️ Name search failed, retrying with address: ${address}`
      );
      location = await getCoordinates(address, API_KEY);
      method = "Address";
    }

    if (location) {
      shop.lat = location.lat;
      shop.lng = location.lng;
      updatedCount++;
      console.log(
        `   ✅ Found via ${method}: ${location.lat}, ${location.lng}`
      );
    } else {
      console.error(`   ❌ Failed to geocode both Name and Address`);
      errorCount++;
    }

    // Save every 20 items to prevent data loss on crash
    if (updatedCount % 20 === 0 && updatedCount > 0) {
      console.log("💾 Saving progress...");
      fs.writeFileSync(dataPath, JSON.stringify(shops, null, 2));
    }

    // Rate limiting: 50ms delay
    await delay(100);
  }

  // Final Save
  fs.writeFileSync(dataPath, JSON.stringify(shops, null, 2));

  console.log("\n✨ Geocoding Complete!");
  console.log(`   ✅ Updated: ${updatedCount}`);
  console.log(`   ⏭  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors:  ${errorCount}`);
}

main().catch(console.error);
