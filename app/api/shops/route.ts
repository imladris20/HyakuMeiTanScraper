import { NextResponse } from "next/server";

import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  const dataPath = path.join(process.cwd(), "data", "shops.json");

  try {
    const fileContent = await fs.readFile(dataPath, "utf-8");
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const e = error as { code?: string };
    if (e.code === "ENOENT") {
      return NextResponse.json(
        { error: "Data not found. Please run 'npm run scrape:all'" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
