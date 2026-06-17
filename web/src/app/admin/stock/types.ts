export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  variantId: string;
  available: boolean;
  images: string[];
}

export interface ProductColor {
  id: string;
  catalog_id: string;
  color_name: string;
  image_url: string | null;
  stock: number;
  product_name?: string;
}
