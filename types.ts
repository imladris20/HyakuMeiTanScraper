// 定義輸出 category 的結構
export interface ICategory {
  name: string; // slug
  traditionalChineseName: string;
  japaneseName: string;
}

// 定義店家的資料結構
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
