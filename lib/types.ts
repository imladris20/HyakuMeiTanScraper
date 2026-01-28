export interface ICategory {
  name: string;
  traditionalChineseName: string;
  japaneseName: string;
}

export interface IShop {
  category: string;
  name: string;
  url: string;
  address: string;
  rating: string;
  price?: string;
  closedDay?: string;
  businessHour?: string;
}

export interface IShopExtended extends Omit<IShop, "rating"> {
  prefecture: string;
  city: string;
  thumbnailUrl?: string;
  googleMapUrl?: string;
  googleMapRating?: number;
  rating: number;
}
