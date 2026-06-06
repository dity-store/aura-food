export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  icon: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  totalAmount: number;
  paymentMethod: 'Cash' | 'E-Wallet' | 'Debit Card';
  timestamp: string; // ISO string
  status: 'pending_sync' | 'synced';
  syncMessage?: string;
  cabang?: string;
}

export interface SyncQueueItem {
  id: string;
  action: 'POST_TRANSACTION';
  payload: Transaction;
  timestamp: number;
  retries: number;
}

export interface GASConfig {
  webAppUrl: string;
  sheetName: string;
}
