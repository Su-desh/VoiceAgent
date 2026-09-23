export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  price: number;
  original_price: number;
  rating: number;
  reviews: number;
  image: string;
  badge: string;
  description: string;
  festive_note: string;
  in_stock: boolean;
  stock_count: number;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  image: string;
}

export interface CartSummary {
  items: CartItem[];
  total_items_count: number;
  subtotal: number;
  discount_amount: number;
  coupon_code: string | null;
  free_diya_gift: boolean;
  total: number;
  pincode: string | null;
  delivery_info: any | null;
}

export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  toolCall?: string;
}

export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';
