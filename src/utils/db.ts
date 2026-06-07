import { Transaction, SyncQueueItem, Cabang, Kategori, Menu, Varian, MasterData, GASConfig } from '../types';

const DB_NAME = 'Sistem Keuangan Aura Food'; // Update db name to start fresh
const DB_VERSION = 1;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // Master data stores
      if (!db.objectStoreNames.contains('cabang')) db.createObjectStore('cabang', { keyPath: 'ID_CABANG' });
      if (!db.objectStoreNames.contains('kategori')) db.createObjectStore('kategori', { keyPath: 'ID_KATEGORI' });
      if (!db.objectStoreNames.contains('menu')) db.createObjectStore('menu', { keyPath: 'ID_MENU' });
      if (!db.objectStoreNames.contains('varian')) db.createObjectStore('varian', { keyPath: 'ID_VARIAN' });

      // Transactions & sync
      if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue', { keyPath: 'id' });
    };
  });
}

// ---- Master Data Access ----

export async function saveMasterData(data: MasterData): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cabang', 'kategori', 'menu', 'varian'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const storeNames: (keyof MasterData)[] = ['cabang', 'kategori', 'menu', 'varian'];
    for (const name of storeNames) {
      const store = tx.objectStore(name as string);
      store.clear();
      data[name].forEach((item: any) => store.put(item));
    }
  });
}

export async function getMasterData(): Promise<MasterData> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cabang', 'kategori', 'menu', 'varian'], 'readonly');
    const data: MasterData = { cabang: [], kategori: [], menu: [], varian: [] };
    let completed = 0;

    const storeNames: (keyof MasterData)[] = ['cabang', 'kategori', 'menu', 'varian'];
    for (const name of storeNames) {
      const req = tx.objectStore(name as string).getAll();
      req.onsuccess = () => {
        data[name] = req.result as any;
        completed++;
        if (completed === storeNames.length) resolve(data);
      };
      req.onerror = () => reject(req.error);
    }
  });
}

export async function isMasterDataEmpty(): Promise<boolean> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kategori', 'readonly');
    const req = tx.objectStore('kategori').count();
    req.onsuccess = () => resolve(req.result === 0);
    req.onerror = () => reject(req.error);
  });
}

// Fallback initial data in case there's no backend connection yet
export async function seedMasterDataIfEmpty(): Promise<MasterData> {
  const isEmpty = await isMasterDataEmpty();
  if (!isEmpty) {
    return getMasterData();
  }

  const defaultData: MasterData = {
    cabang: [],
    kategori: [],
    menu: [],
    varian: []
  };

  await saveMasterData(defaultData);
  return defaultData;
}

// ---- GAS Config & Sync ----

export function getGASConfig(): GASConfig | null {
  const cfg = localStorage.getItem('AURA_FOOD_GAS_CONFIG');
  if (cfg) {
    try {
      return JSON.parse(cfg);
    } catch (e) {
      console.warn("Parsing AURA_FOOD_GAS_CONFIG failed", e);
    }
  }
  const savedUrl = localStorage.getItem('AURA_FOOD_GAS_URL') || 'https://script.google.com/macros/s/AKfycbzlVeWkqH3aj1JNc0XHIywMtXOG75arHK4gFn-_VKD6iXciBZAaQBiIsB4tTGI_lzLi/exec';
  const defaultConfig: GASConfig = {
    webAppUrl: savedUrl,
    sheetName: 'Data'
  };
  localStorage.setItem('AURA_FOOD_GAS_CONFIG', JSON.stringify(defaultConfig));
  return defaultConfig;
}

export function saveGASConfig(config: GASConfig) {
  localStorage.setItem('AURA_FOOD_GAS_CONFIG', JSON.stringify(config));
}

export async function syncMasterDataFromGAS(): Promise<void> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl || !config.sheetName) {
    throw new Error('Konfigurasi endpoint GAS atau Sheet Name belum diatur.');
  }

  try {
    // 1. Coba sinkronisasi data master lengkap (termasuk daftar cabang)
    const urlFull = new URL(config.webAppUrl);
    urlFull.searchParams.append('action', 'getMasterData');
    urlFull.searchParams.append('sheetName', config.sheetName);
    urlFull.searchParams.append('_timestamp', Date.now().toString());

    const resFull = await fetch(urlFull.toString(), { redirect: 'follow' });
    if (resFull.ok) {
      const fullResult = await resFull.json();
      const data = fullResult.data || fullResult;
      if (data && (data.cabang || data.kategori || data.menu || data.varian)) {
        const dbData: MasterData = {
          cabang: data.cabang || [],
          kategori: data.kategori || [],
          menu: data.menu || [],
          varian: data.varian || []
        };
        await saveMasterData(dbData);
        console.log("Master data lengkap berhasil disinkronisasi.");
        return;
      }
    }
  } catch (errFull) {
    console.warn("Gagal mengambil getMasterData, mencoba fallback ke get_katalog_lengkap:", errFull);
  }

  // 2. Fallback ke get_katalog_lengkap jika gagal
  try {
    const urlCatalog = new URL(config.webAppUrl);
    urlCatalog.searchParams.append('action', 'get_katalog_lengkap');
    const resCat = await fetch(urlCatalog.toString(), { redirect: 'follow' });
    
    if (!resCat.ok) throw new Error(`HTTP Error: ${resCat.status}`);
    const catResult = await resCat.json();
    
    if (catResult.status === 'success' && catResult.data) {
      const existingData = await getMasterData(); // pertahankan cabang yang sudah ada
      
      const categories: any[] = [];
      const menus: any[] = [];
      const varians: any[] = [];
      
      catResult.data.forEach((cat: any) => {
          categories.push({ ID_KATEGORI: cat.ID_KATEGORI, NAMA_KATEGORI: cat.NAMA_KATEGORI });
          const catMenus = cat.menus || cat.menu || cat.Menu || [];
          catMenus.forEach((m: any) => {
              menus.push({ ID_MENU: m.ID_MENU, ID_KATEGORI: cat.ID_KATEGORI, NAMA_MENU: m.NAMA_MENU });
              const mVarians = m.varians || m.varian || m.Varian || [];
              mVarians.forEach((v: any) => {
                  varians.push({ 
                    ID_VARIAN: v.ID_VARIAN || v.VARIAN, 
                    ID_KATEGORI: cat.ID_KATEGORI, 
                    ID_MENU: m.ID_MENU, 
                    NAMA_VARIAN: v.NAMA_VARIAN || v.VARIAN, 
                    HARGA: v.HARGA, 
                    STATUS: v.STATUS 
                  });
              });
          });
      });

      const dbData: MasterData = {
        cabang: existingData.cabang || [],
        kategori: categories,
        menu: menus,
        varian: varians,
        katalogLengkap: catResult.data
      };
      await saveMasterData(dbData);
    } else {
      throw new Error(catResult.message || 'Gagal fetch get_katalog_lengkap dari backend.');
    }

  } catch (err: any) {
    throw new Error(`Gagal sync Master Data dari Web App: ${err.message}`);
  }
}

export async function getTransactionsFromGAS(idCabang: string): Promise<Transaction[]> {
    const config = getGASConfig();
    if (!config || !config.webAppUrl) throw new Error('Konfigurasi endpoint GAS belum diatur.');
    
    const url = new URL(config.webAppUrl);
    url.searchParams.append('action', 'get_all_transactions');
    url.searchParams.append('id_cabang', idCabang);
    
    console.log("Fetching transactions from URL:", url.toString());
    
    const res = await fetch(url.toString(), { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message || 'Gagal mengambil data.');
    
    // Map raw data from GAS to Transaction type
    return (result.data as any[]).map(item => ({
      id: item.ID_PESANAN,
      pesanan: {
        ID_PESANAN: item.ID_PESANAN,
        TANGGAL_WAKTU: item.TANGGAL_WAKTU,
        ID_CABANG: item.ID_CABANG,
        TOTAL_TAGIHAN: item.TOTAL_TAGIHAN,
        METODE_BAYAR: item.METODE_BAYAR
      },
      detail: item.detail || [], // Use detail from response
      status: 'synced',
      timestamp: item.TANGGAL_WAKTU,
      paymentMethod: item.METODE_BAYAR,
      totalAmount: Number(item.TOTAL_TAGIHAN),
      cabang: item.ID_CABANG
    }));
}

export async function getAdminDashboardMetrics(idCabang: string): Promise<{
  totalRevenue: number;
  totalTransactions: number;
  averageTransactionValue: number;
  categorySales: { Makanan: number; Minuman: number; Pasta: number; Special: number };
  recentTransactions: Transaction[];
}> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl) throw new Error('Konfigurasi endpoint GAS belum diatur.');
  
  const url = new URL(config.webAppUrl);
  url.searchParams.append('action', 'get_admin_dashboard');
  url.searchParams.append('id_cabang', idCabang);
  url.searchParams.append('_timestamp', Date.now().toString());
  
  const res = await fetch(url.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
  
  const result = await res.json();
  if (result.status !== 'success') throw new Error(result.message || 'Gagal mengambil data.');
  
  const fetchedData = result.data || {};
  
  // Map recent transactions safely to Transaction model format
  const recentTransactionsMapped = (fetchedData.recentTransactions || []).map((item: any) => ({
    id: item.ID_PESANAN,
    pesanan: {
      ID_PESANAN: item.ID_PESANAN,
      TANGGAL_WAKTU: item.TANGGAL_WAKTU,
      ID_CABANG: item.ID_CABANG,
      TOTAL_TAGIHAN: item.TOTAL_TAGIHAN,
      METODE_BAYAR: item.METODE_BAYAR
    },
    detail: item.detail || [],
    status: 'synced',
    timestamp: item.TANGGAL_WAKTU,
    paymentMethod: item.METODE_BAYAR,
    totalAmount: Number(item.TOTAL_TAGIHAN),
    cabang: item.ID_CABANG
  }));

  return {
    totalRevenue: Number(fetchedData.totalRevenue || 0),
    totalTransactions: Number(fetchedData.totalTransactions || 0),
    averageTransactionValue: Number(fetchedData.averageTransactionValue || 0),
    categorySales: {
      Makanan: Number(fetchedData.categorySales?.Makanan || 0),
      Minuman: Number(fetchedData.categorySales?.Minuman || 0),
      Pasta: Number(fetchedData.categorySales?.Pasta || 0),
      Special: Number(fetchedData.categorySales?.Special || 0),
    },
    recentTransactions: recentTransactionsMapped
  };
}

export async function getAdminReportsData(idCabang: string): Promise<{
  pemasukan: number;
  pengeluaran: number;
  saldoBersih: number;
  transaksi: any[];
}> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl) throw new Error('Konfigurasi endpoint GAS belum diatur.');
  
  const url = new URL(config.webAppUrl);
  url.searchParams.append('action', 'get_admin_reports');
  url.searchParams.append('id_cabang', idCabang);
  url.searchParams.append('_timestamp', Date.now().toString());
  
  const res = await fetch(url.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
  
  const result = await res.json();
  if (result.status !== 'success') throw new Error(result.message || 'Gagal mengambil data laporan.');
  
  const fetchedData = result.data || {};
  return {
    pemasukan: Number(fetchedData.pemasukan || 0),
    pengeluaran: Number(fetchedData.pengeluaran || 0),
    saldoBersih: Number(fetchedData.saldoBersih || 0),
    transaksi: fetchedData.transaksi || []
  };
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const request = store.put(transaction);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearSyncedTransactions(branchId?: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions'], 'readwrite');
    const store = tx.objectStore('transactions');
    const req = store.openCursor();
    
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const txData = cursor.value as Transaction;
        if (txData.status === 'synced') {
           if (!branchId || txData.cabang === branchId) {
             cursor.delete();
           }
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getTransactions(): Promise<Transaction[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result as Transaction[];
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateTransactionStatus(id: string, status: 'pending_sync' | 'synced'): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const transaction = getReq.result as Transaction;
      if (transaction) {
        transaction.status = status;
        const putReq = store.put(transaction);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function processSyncQueue(): Promise<void> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return;

  const config = getGASConfig();
  if (!config || !config.webAppUrl) return; // Cannot sync without URL

  for (const item of queue) {
    if (item.action === 'POST_TRANSACTION' && item.payload) {
      try {
        const response = await fetch(config.webAppUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify({
             mode: 'POST_TRANSACTION',
             payload: item.payload
          })
        });

        if (response.ok) {
           const result = await response.json();
           if (result.status === 'success') {
             await updateTransactionStatus(item.id, 'synced');
             await removeFromSyncQueue(item.id);
           } else {
             console.error(`GAS error syncing transaction ${item.id}:`, result.message);
             // Optionally increment retries or mark as error
           }
        }
      } catch (err) {
        console.error(`Failed to sync transaction ${item.id}`, err);
        // Stop processing further items if network fails
        break;
      }
    } else {
       // if it's not a POST_TRANSACTION or payload missing, just remove it
       await removeFromSyncQueue(item.id);
    }
  }
}


export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result as SyncQueueItem[];
      items.sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

