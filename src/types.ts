export interface Cabang {
  ID_CABANG: string;
  NAMA_CABANG: string;
  PASSWORD?: string;
  LOKASI?: string;
  KONTAK?: string;
  STATUS?: string;
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
  promo?: Promo[];
  katalogLengkap?: NestedKategori[];
  pegawai?: Pegawai[];
}

export interface Pegawai {
  ID_PEGAWAI: string;
  ID_CABANG: string;
  NAMA_PEGAWAI: string;
  KONTAK?: string;
}

export interface Pesanan {
  ID_PESANAN: string;
  TANGGAL_WAKTU: string;
  ID_CABANG: string;
  TOTAL_TAGIHAN: number;
  METODE_BAYAR: string;
  JENIS_PESANAN?: string;
  CATATAN?: string;
  ADDITIONAL_CHARGES?: { name: string; price: number; qty: number }[];
  PROMOS?: any[];
}

export interface DetailPesanan {
  ID_DETAIL: string;
  ID_PESANAN: string;
  NAMA_MENU: string;
  VARIAN: string;
  ID_MENU?: string;
  ID_VARIAN?: string;
  HARGA_SATUAN: number;
  QTY: number;
  SUBTOTAL: number;
  PROMO_ID?: string;
  ORIGINAL_PRICE?: number;
  isCompliment?: boolean;
}

export interface Promo {
  ID_PROMO: string;
  NAMA_PROMO: string;
  TIPE: 'DISKON_PERSEN' | 'DISKON_NOMINAL' | 'HARGA_FIX';
  PERIODE: string; // Will store the date range string
  TARGET_ITEM: string; // Pipe separated variant IDs
  SYARAT_QTY: number;
  NILAI_PROMO: number;
  ID_CABANG: string; // Pipe separated branch IDs or 'ALL'
  JENIS_PROMO: 'PER_PESANAN' | 'PER_MENU';
  JENIS_PERIODE: 'JAM' | 'HARIAN' | 'TANGGAL' | 'RENTANG';
}

export interface CartItem {
  id_detail: string;
  menu: Menu;
  varian: Varian;
  quantity: number;
  discountedPrice?: number;
  promoId?: string;
  isCompliment?: boolean;
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
  isCompliment?: boolean;
  isPrinting?: boolean;
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

