import type { IShop } from "../legacy/types";

// Extended Interface for the new requirements
export interface IShopExtended extends Omit<IShop, "rating"> {
  prefecture: string;
  city: string;
  thumbnailUrl?: string;
  googleMapUrl?: string;
  googleMapRating?: number;
  rating: number; // Override as number
}
