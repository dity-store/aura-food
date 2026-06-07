export interface Cabang {
  ID_CABANG: string;
  NAMA_CABANG: string;
  PASSWORD?: string;
  LOKASI?: string;
}

export interface Kategori {
  ID_KATEGORI: string;
  NAMA_KATEGORI: string;
}

export interface Menu {
  ID_MENU: string;
  ID_KATEGORI: string;
  NAMA_MENU: string;
}

export interface Varian {
  ID_VARIAN: string;
  ID_KATEGORI: string;
  ID_MENU: string;
  NAMA_VARIAN: string;
  HARGA: number;
  STATUS: 'AKTIF' | 'KOSONG';
}

export interface NestedVarian {
  ID_VARIAN: string;
  ID_KATEGORI: string;
  ID_MENU: string;
  NAMA_VARIAN: string;
  HARGA: number;
  STATUS: 'AKTIF' | 'KOSONG' | 'TIDAK AKTIF';
}

export interface NestedMenu {
  ID_MENU: string;
  ID_KATEGORI: string;
  NAMA_MENU: string;
  varians: NestedVarian[];
}

export interface NestedKategori {
  ID_KATEGORI: string;
  NAMA_KATEGORI: string;
  menus: NestedMenu[];
}

export interface MasterData {
  cabang: Cabang[];
  kategori: Kategori[];
  menu: Menu[];
  varian: Varian[];
  katalogLengkap?: NestedKategori[];
}

export interface Pesanan {
  ID_PESANAN: string;
  TANGGAL_WAKTU: string;
  ID_CABANG: string;
  TOTAL_TAGIHAN: number;
  METODE_BAYAR: string;
}

export interface DetailPesanan {
  ID_DETAIL: string;
  ID_PESANAN: string;
  NAMA_MENU: string;
  VARIAN: string;
  HARGA_SATUAN: number;
  QTY: number;
  SUBTOTAL: number;
}

export interface CartItem {
  id_detail: string;
  menu: Menu;
  varian: Varian;
  quantity: number;
}

export interface Transaction {
  id: string; // the ID_PESANAN
  pesanan: Pesanan;
  detail: DetailPesanan[];
  status: 'pending_sync' | 'synced';
  timestamp: string;
  paymentMethod: string;
  totalAmount: number;
  cabang: string;
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

