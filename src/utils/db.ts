import { Transaction, SyncQueueItem, Cabang, Kategori, Menu, Varian, MasterData, GASConfig } from '../types';

const DB_NAME = 'Sistem Keuangan Aura Food'; // Update db name to start fresh
const DB_VERSION = 3;

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
      if (!db.objectStoreNames.contains('promo')) db.createObjectStore('promo', { keyPath: 'ID_PROMO' });
      if (!db.objectStoreNames.contains('pegawai')) db.createObjectStore('pegawai', { keyPath: 'ID_PEGAWAI' });

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
    const tx = db.transaction(['cabang', 'kategori', 'menu', 'varian', 'promo', 'pegawai'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const storeNames: (keyof MasterData)[] = ['cabang', 'kategori', 'menu', 'varian', 'promo', 'pegawai'];
    for (const name of storeNames) {
      if (!data[name]) continue;
      const store = tx.objectStore(name as string);
      store.clear();
      data[name]?.forEach((item: any) => store.put(item));
    }
  });
}

export async function getMasterData(): Promise<MasterData> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cabang', 'kategori', 'menu', 'varian', 'promo', 'pegawai'], 'readonly');
    const data: MasterData = { cabang: [], kategori: [], menu: [], varian: [], promo: [], pegawai: [] };
    let completed = 0;

    const storeNames: (keyof MasterData)[] = ['cabang', 'kategori', 'menu', 'varian', 'promo', 'pegawai'];
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
    const tx = db.transaction('cabang', 'readonly');
    const req = tx.objectStore('cabang').count();
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
    varian: [],
    promo: []
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
  const savedUrl = localStorage.getItem('AURA_FOOD_GAS_URL') || 'https://script.google.com/macros/s/AKfycbyQbjH6133fuppW7ercx1bAJwX4P1J37VBaV-JY6Z3gDnWLsqzxrYuEmCngS-zIXGjW/exec';
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
      if (data && (data.cabang || data.kategori || data.menu || data.varian || data.promo || data.pegawai)) {
        const dbData: MasterData = {
          cabang: data.cabang || [],
          kategori: data.kategori || [],
          menu: data.menu || [],
          varian: data.varian || [],
          promo: data.promo || [],
          pegawai: data.pegawai || []
        };
        await saveMasterData(dbData);
        console.log("Master data lengkap berhasil disinkronisasi.");
        return;
      }
    }
  } catch (errFull) {
    // console.warn("Gagal mengambil getMasterData, mencoba fallback ke get_katalog_lengkap:", errFull);
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
    let errMsg = err.message;
    if (errMsg.includes('Failed to fetch')) {
        errMsg = "Koneksi ke Web App gagal (Failed to fetch). Pastikan saat deploy di Apps Script Anda memilih:\n1. Execute as: Me\n2. Who has access: Anyone\ndan URL diakhiri dengan /exec";
    }
    throw new Error(`Gagal sync Master Data: ${errMsg}`);
  }
}

export async function getTransactionsFromGAS(idCabang: string, tanggal?: string): Promise<Transaction[]> {
  try {
    const config = getGASConfig();
    if (!config || !config.webAppUrl) throw new Error('Konfigurasi endpoint GAS belum diatur.');
    
    const url = new URL(config.webAppUrl);
    url.searchParams.append('action', 'get_all_transactions');
    if (idCabang && idCabang !== 'All' && idCabang !== 'Semua' && idCabang !== 'ADMIN') {
      url.searchParams.append('id_cabang', idCabang);
    }
    if (tanggal) {
      url.searchParams.append('tanggal', tanggal);
    }
    
    console.log("Fetching transactions from URL:", url.toString());
    
    const res = await fetch(url.toString(), { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    const result = await res.json();
    if (result.status !== 'success') {
      if (result.message && String(result.message).toLowerCase().includes('tidak ditemukan')) {
        return [];
      }
      throw new Error(result.message || 'Gagal mengambil data.');
    }
    
    // Map raw data from GAS to Transaction type
    return (result.data || []).map((item: any) => ({
      id: item.ID_PESANAN,
      pesanan: {
        ID_PESANAN: item.ID_PESANAN,
        TANGGAL_WAKTU: item.TANGGAL_WAKTU,
        ID_CABANG: item.ID_CABANG,
        TOTAL_TAGIHAN: item.TOTAL_TAGIHAN,
        METODE_BAYAR: item.METODE_BAYAR,
        JENIS_PESANAN: item.JENIS_PESANAN || '',
        CATATAN: item.CATATAN || ''
      },
      detail: item.detail || [], // Use detail from response
      status: 'synced',
      timestamp: item.TANGGAL_WAKTU,
      paymentMethod: item.METODE_BAYAR,
      totalAmount: Number(item.TOTAL_TAGIHAN),
      cabang: item.ID_CABANG
    }));
  } catch (err) {
    console.warn("getTransactionsFromGAS error:", err);
    return [];
  }
}

export async function getAdminDashboardMetrics(idCabang: string, selectedDateStr?: string): Promise<{
  totalRevenue: number;
  totalTransactions: number;
  totalCash: number;
  totalTransfer: number;
  averageTransactionValue: number;
  categorySales: { Makanan: number; Minuman: number; Pasta: number; Special: number };
  recentTransactions: Transaction[];
  yesterdayRevenue: number;
}> {
  const config = getGASConfig();
  if (config && config.webAppUrl) {
    try {
      let paramTanggal: string | undefined = undefined;
      let yesterdayStr: string | undefined = undefined;
      
      if (selectedDateStr) {
        const [y, m, d] = selectedDateStr.split('-');
        paramTanggal = `${d}/${m}/${y}`;
        
        const dObj = new Date(Number(y), Number(m) - 1, Number(d));
        dObj.setDate(dObj.getDate() - 1);
        const yy = dObj.getFullYear();
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dObj.getDate()).padStart(2, '0');
        yesterdayStr = `${dd}/${mm}/${yy}`;
      }

      const urlFull = new URL(config.webAppUrl);
      urlFull.searchParams.append('action', 'get_admin_dashboard');
      if (idCabang && idCabang !== 'All' && idCabang !== 'Semua' && idCabang !== 'ADMIN') {
        urlFull.searchParams.append('id_cabang', idCabang);
      }
      if (paramTanggal) {
        urlFull.searchParams.append('tanggal', paramTanggal); // Send tanggal!
      }
      urlFull.searchParams.append('_ts', Date.now().toString());

      const res = await fetch(urlFull.toString(), { redirect: 'follow' });

      if (res.ok) {
        const result = await res.json();
        if (result.status === 'success') {
          const data = result.data;
          console.log("DASHBOARD DATA FROM GAS:", data);
          
          let yesterdayRevenue = 0;
          try {
            if (yesterdayStr) {
              const yUrl = new URL(config.webAppUrl);
              yUrl.searchParams.append('action', 'get_admin_dashboard');
              if (idCabang && idCabang !== 'All' && idCabang !== 'Semua' && idCabang !== 'ADMIN') {
                yUrl.searchParams.append('id_cabang', idCabang);
              }
              yUrl.searchParams.append('tanggal', yesterdayStr);
              yUrl.searchParams.append('_ts', Date.now().toString());
              const yRes = await fetch(yUrl.toString(), { redirect: 'follow' });
              if (yRes.ok) {
                const yResult = await yRes.json();
                if (yResult.status === 'success') {
                  yesterdayRevenue = Number(yResult.data.totalRevenue || 0);
                }
              }
            }
          } catch (e) {
             console.warn("Failed fetching yesterday revenue", e);
          }

          let computedTotalCash = 0;
          let computedTotalTransfer = 0;
          try {
             const txUrl = new URL(config.webAppUrl);
             txUrl.searchParams.append('action', 'get_all_transactions');
             if (idCabang && idCabang !== 'All' && idCabang !== 'Semua' && idCabang !== 'ADMIN') {
               txUrl.searchParams.append('id_cabang', idCabang);
             }
             if (paramTanggal) {
               txUrl.searchParams.append('tanggal', paramTanggal);
             }
             const txRes = await fetch(txUrl.toString(), { redirect: 'follow' });
             if (txRes.ok) {
                const txResult = await txRes.json();
                if (txResult.status === 'success') {
                   txResult.data.forEach((p: any) => {
                      const metode = String(p.METODE_BAYAR || "").toUpperCase();
                      const jenis = String(p.JENIS_PESANAN || "").toUpperCase();
                      if (jenis !== 'COMPLIMENT' && jenis !== 'ENDORSE') {
                         const tagihan = Number(p.TOTAL_TAGIHAN || 0);
                         if (metode === 'CASH' || metode === 'TUNAI') {
                             computedTotalCash += tagihan;
                         } else {
                             computedTotalTransfer += tagihan;
                         }
                      }
                   });
                }
             }
          } catch (e) {
             console.warn("Failed fetching all transactions for cash/transfer", e);
          }

          return {
            totalRevenue: Number(data.totalRevenue || 0),
            totalTransactions: Number(data.totalTransactions || 0),
            totalCash: Number(data.totalCash || computedTotalCash),
            totalTransfer: Number(data.totalTransfer || computedTotalTransfer),
            averageTransactionValue: Number(data.averageTransactionValue || (data.totalTransactions ? data.totalRevenue / data.totalTransactions : 0)),
            categorySales: data.categorySales || { Makanan: 0, Minuman: 0, Pasta: 0, Special: 0 },
            recentTransactions: (data.recentTransactions || []).map((p: any) => ({
              id: String(p.ID_PESANAN || p[0] || ''),
              pesanan: p,
              detail: p.detail || [],
              status: 'synced' as 'synced',
              timestamp: p.TANGGAL_WAKTU || p.TANGGAL || p[1],
              paymentMethod: p.METODE_BAYAR || p[4],
              totalAmount: Number(p.TOTAL_TAGIHAN || p.Total || p[3] || 0),
              cabang: p.ID_CABANG || p[2]
            })),
            yesterdayRevenue: yesterdayRevenue
          };
        }
      }
    } catch (err) {
      console.warn("Server-side dashboard metrics failed", err);
      throw err;
    }
  }
  
  throw new Error("Gagal mengambil dashboard dari server");
}

export async function getAdminReportsData(
  idCabang: string,
  periode: string,
  jenisData: string,
  tanggal: string,
  bulan: number,
  tahun: number,
  kuartal: string,
  semester: string
): Promise<{
  pemasukan: number;
  pengeluaran: number;
  saldoBersih: number;
  saldoAwal: number;
  totalSaldoAkhir: number;
  totalCash: number;
  totalTransfer: number;
  transaksi: any[];
  textLaporan: string;
  namaCabang: string;
}> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl) throw new Error('Konfigurasi endpoint GAS belum diatur.');
  
  try {
    const urlFull = new URL(config.webAppUrl);
    urlFull.searchParams.append('action', 'get_admin_reports');
    urlFull.searchParams.append('id_cabang', idCabang);
    urlFull.searchParams.append('periode', periode);
    urlFull.searchParams.append('jenis_data', jenisData);
    urlFull.searchParams.append('tanggal', tanggal);
    urlFull.searchParams.append('bulan', String(bulan));
    urlFull.searchParams.append('tahun', String(tahun));
    urlFull.searchParams.append('kuartal', kuartal);
    urlFull.searchParams.append('semester', semester);
    urlFull.searchParams.append('_ts', Date.now().toString());

    const res = await fetch(urlFull.toString(), { redirect: 'follow' });
    
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message || 'Gagal mengambil data laporan.');
    
    const fetchedData = result.data || {};
    return {
      pemasukan: Number(fetchedData.pemasukan || 0),
      pengeluaran: Number(fetchedData.pengeluaran || 0),
      saldoBersih: Number(fetchedData.saldoBersih || 0),
      saldoAwal: Number(fetchedData.saldoAwal || 0),
      totalSaldoAkhir: Number(fetchedData.totalSaldoAkhir || 0),
      totalCash: Number(fetchedData.totalCash || 0),
      totalTransfer: Number(fetchedData.totalTransfer || 0),
      transaksi: fetchedData.transaksi || [],
      textLaporan: fetchedData.textLaporan || '',
      namaCabang: fetchedData.namaCabang || ''
    };
  } catch (err: any) {
    console.error("Fetch error in getAdminReportsData:", err);
    throw new Error("Gagal terhubung ke Sistem Pusat (Google Apps Script). Pastikan koneksi internet stabil dan URL Apps Script di pengaturan benar.");
  }
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

export async function clearSyncedTransactions(branchId?: string, dateStr?: string): Promise<void> {
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
           let matchBranch = !branchId || String(txData.cabang) === String(branchId);
           let matchDate = true;
           if (dateStr) {
               // Use local date formatting to safely match dateStr (which is YYYY-MM-DD from todayDate)
               const d = new Date(txData.timestamp);
               const y = d.getFullYear();
               const m = String(d.getMonth() + 1).padStart(2, '0');
               const day = String(d.getDate()).padStart(2, '0');
               const dStr = `${y}-${m}-${day}`;
               matchDate = dStr === dateStr;
           }
           if (matchBranch && matchDate) {
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

export async function triggerGASSyncRekapHarian(selectedDateRaw?: string): Promise<boolean> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl) throw new Error('Konfigurasi endpoint GAS belum diatur.');
  
  let formattedDate: string | undefined;
  if (selectedDateRaw) {
    const parts = selectedDateRaw.split('-');
    if (parts.length === 3) {
      formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else {
      formattedDate = selectedDateRaw;
    }
  }

  const res = await fetch(config.webAppUrl, {
    method: 'POST',
    body: JSON.stringify({
      mode: 'TRIGGER_REKAP',
      tanggal: formattedDate
    }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });

  if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
  
  const result = await res.json();
  if (result.status !== 'success') throw new Error(result.message || 'Gagal trigger rekap harian.');
  
  return true;
}

export async function postBukuKasToGAS(payload: any): Promise<void> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl) throw new Error('Konfigurasi GAS belum diatur.');
  
  const res = await fetch(config.webAppUrl, {
    method: 'POST',
    body: JSON.stringify({ mode: 'POST_BUKU_KAS', payload }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  
  const result = await res.json();
  if (result.status !== 'success') throw new Error(result.message || 'Gagal menyimpan transaksi kas');
}

export async function postMasterDataToGAS(type: string, item: any): Promise<void> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl) throw new Error('Konfigurasi GAS belum diatur.');
  
  const res = await fetch(config.webAppUrl, {
    method: 'POST',
    body: JSON.stringify({ mode: 'POST_MASTER_DATA', type, item }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });

  const result = await res.json();
  if (result.status !== 'success') throw new Error(result.message || `Gagal menyimpan master data ${type}`);
}

export async function postUniversalDataToGAS(mode: string, sheetName: string, idColumn: string | null, idValue: string | null, data: any): Promise<void> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl) throw new Error('Konfigurasi GAS belum diatur.');
  const payload: any = { mode, sheetName, data };
  if (idColumn) payload.idColumn = idColumn;
  if (idValue) payload.idValue = idValue;
  if (data && data.idValues) payload.idValues = data.idValues;
  if (data && data.matchData) payload.matchData = data.matchData;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds timeout for post operations

  try {
    const res = await fetch(config.webAppUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message || `Gagal operasi ${mode} untuk ${sheetName}`);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error("Operasi timeout (45 detik). Coba lagi.");
    throw err;
  }
}

export async function fetchUniversalDataFromGAS(sheetName: string): Promise<any[]> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl) return [];
  
  try {
    const urlFull = new URL(config.webAppUrl);
    urlFull.searchParams.append('action', 'get_data_sheet');
    urlFull.searchParams.append('sheet_name', sheetName);
    urlFull.searchParams.append('_timestamp', Date.now().toString());

    const res = await fetch(urlFull.toString(), { redirect: 'follow' });
    if (res.ok) {
       const json = await res.json();
       if (json.status === 'success') {
         return Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
       }
       return Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
    }
    return [];
  } catch(e: any) {
    console.warn(`Sinkronisasi modul ${sheetName} tertunda: Koneksi gagal atau offline.`);
    return [];
  }
}

export function getPrintedTransactionIds(): string[] {
  try {
    const val = localStorage.getItem('printed_transactions_kv');
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

export function markTransactionAsPrinted(id: string): void {
  try {
    const ids = getPrintedTransactionIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem('printed_transactions_kv', JSON.stringify(ids));
      // Dispatch a storage event so other tabs/components hear it
      window.dispatchEvent(new Event('printed-transactions-updated'));
    }
  } catch (e) {
    console.error(e);
  }
}

export async function uploadBukuKasFotoToGAS(base64Data: string, filename: string, mimeType: string): Promise<string> {
  const config = getGASConfig();
  if (!config || !config.webAppUrl) throw new Error('Konfigurasi GAS belum diatur.');
  
  // Clean base64Data: remove data:image/...;base64, prefix if exists
  let cleanedBase64Data = base64Data;
  if (cleanedBase64Data.includes(',')) {
    cleanedBase64Data = cleanedBase64Data.split(',')[1];
  }
  cleanedBase64Data = cleanedBase64Data.replace(/\s/g, '');
  
  // Limit check (Google Apps Script POST body limit is around 10MB, but let's be safe at 5MB)
  const sizeInMB = (cleanedBase64Data.length * (3/4)) / (1024 * 1024);
  if (sizeInMB > 8) {
    throw new Error(`File terlalu besar (${sizeInMB.toFixed(2)}MB). Maksimal 8MB.`);
  }

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  console.log("Uploading photo:", sanitizedFilename, "Mime:", mimeType, "Size:", sizeInMB.toFixed(2) + "MB");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

    const res = await fetch(config.webAppUrl, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'UPLOAD_BUKTI_KAS',
        base64Data: cleanedBase64Data,
        filename: sanitizedFilename,
        mimeType
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const textRes = await res.text();
    let result;
    try {
      result = JSON.parse(textRes);
    } catch (e) {
      console.warn("Server response not JSON:", textRes);
      throw new Error("Respon server tidak valid atau script GAS belum dideploy sebagai 'Anyone'.");
    }

    if (result.status !== 'success') {
      throw new Error(result.message || 'Gagal upload ke server.');
    }

    return result.downloadUrl || result.url || '';
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error("Upload timeout (60 detik). Coba file lebih kecil.");
    console.warn("Upload Error (using local/external fallback):", err);
    throw err;
  }
}

