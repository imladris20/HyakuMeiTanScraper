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
  rating: number;
  price: string;
  closedDay: string;
  businessHour: string;
  prefecture: string;
  city: string;
  thumbnailUrl: string;
  googleMapUrl?: string;
  googleMapRating?: number;
}
