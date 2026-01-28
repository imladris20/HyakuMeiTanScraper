import type { IShop } from "../legacy/types";

// Extended Interface for the new requirements
export interface IShopExtended extends IShop {
  prefecture: string;
  city: string;
  thumbnailUrl?: string; // New field
  tabelogUrl: string; // Renamed for clarity, map to url of IShop
}
