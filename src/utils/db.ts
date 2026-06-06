import { Transaction, Product, SyncQueueItem } from '../types';

const DB_NAME = 'POS_OFFLINE_DB';
const DB_VERSION = 1;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // Object store for products catalog
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }

      // Object store for local transactions history
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }

      // Object store for sync queue (queue-buffer)
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }
    };
  });
}

// Transaction operations
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

export async function getTransactions(): Promise<Transaction[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort: Newest first
      const items = request.result as Transaction[];
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateTransactionStatus(id: string, status: 'pending_sync' | 'synced', message?: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const transaction = getReq.result as Transaction;
      if (transaction) {
        transaction.status = status;
        if (message !== undefined) {
          transaction.syncMessage = message;
        }
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

// Sync queue operations
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
      // Sort oldest first for queue (FIFO)
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

// Initial products helper
export async function seedProductsIfEmpty(): Promise<Product[]> {
  const defaultProducts: Product[] = [
    { id: 'af1', name: 'Dimsum Grill Mentai (4 pcs)', price: 12000, category: 'Makanan', stock: 45, icon: 'Cookie' },
    { id: 'af2', name: 'Dimsum Grill Mentai (6 pcs)', price: 18000, category: 'Makanan', stock: 35, icon: 'Cookie' },
    { id: 'af3', name: 'Quesadillas Chiken', price: 25000, category: 'Makanan', stock: 30, icon: 'Cookie' },
    { id: 'af4', name: 'Quesadillas Beef', price: 35000, category: 'Makanan', stock: 25, icon: 'Cookie' },
    { id: 'af5', name: 'Quesadillas Egg', price: 20000, category: 'Makanan', stock: 40, icon: 'Cookie' },
    { id: 'af6', name: 'Sushi Roll Start Extra Keju', price: 15000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af7', name: 'Sushi Roll Start Abon', price: 15000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af8', name: 'Sushi Roll Start Katsuobushi', price: 15000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af9', name: 'Tortilla Pizza Chiken', price: 35000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af10', name: 'Tortilla Pizza Beef', price: 50000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af11', name: 'Tortilla Pizza Mushroom', price: 30000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af12', name: 'Burger Single Chiken (S)', price: 17000, category: 'Makanan', stock: 25, icon: 'Cookie' },
    { id: 'af13', name: 'Burger Double Chiken (D)', price: 34000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af14', name: 'Burger Single Beef (S)', price: 25500, category: 'Makanan', stock: 25, icon: 'Cookie' },
    { id: 'af15', name: 'Burger Double Beef (D)', price: 50000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af16', name: 'Aura\'s Pokki Cheese', price: 30000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af17', name: 'Shella Nachos', price: 35000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af18', name: 'Hotdog Aura', price: 20000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af19', name: 'Mac and Cheese', price: 18000, category: 'Makanan', stock: 22, icon: 'Cookie' },
    { id: 'af20', name: 'Penne Carbonara', price: 25000, category: 'Makanan', stock: 18, icon: 'Cookie' },
    { id: 'af21', name: 'Beef Lasagna', price: 40000, category: 'Makanan', stock: 12, icon: 'Cookie' },
    { id: 'af22', name: 'Es Lemonade Refreshing', price: 10000, category: 'Minuman', stock: 50, icon: 'CupSoda' },
    { id: 'af23', name: 'Virgin Mojito Lime', price: 10000, category: 'Minuman', stock: 50, icon: 'CupSoda' },
    { id: 'af24', name: 'Es Lemontea Brew', price: 8000, category: 'Minuman', stock: 60, icon: 'CupSoda' },
    { id: 'af25', name: 'Es Jeruk Peras', price: 8000, category: 'Minuman', stock: 60, icon: 'CupSoda' },
    { id: 'af26', name: 'Es Kopi Aura', price: 8000, category: 'Minuman', stock: 45, icon: 'Coffee' },
    { id: 'af27', name: 'Es Teh Manis', price: 5000, category: 'Minuman', stock: 80, icon: 'GlassWater' },
    { id: 'af28', name: 'Kopi Panas Tubruk', price: 5000, category: 'Minuman', stock: 40, icon: 'Coffee' },
    { id: 'af29', name: 'Air Mineral Dingin', price: 5000, category: 'Minuman', stock: 100, icon: 'GlassWater' },
  ];

  const db = await initDB();
  
  // Get existing products
  const existing: Product[] = await new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // If empty or containing the old p1 (Kopi Susu Gula Aren) seed/reseeds
  const containsOld = existing.some(p => p.id === 'p1');

  if (existing.length === 0 || containsOld) {
    // Clear and Reseed
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    store.clear();
    for (const p of defaultProducts) {
      store.put(p);
    }
    return defaultProducts;
  }
  
  return existing;
}

export async function resetProductsToDefault(): Promise<Product[]> {
  const defaultProducts: Product[] = [
    { id: 'af1', name: 'Dimsum Grill Mentai (4 pcs)', price: 12000, category: 'Makanan', stock: 45, icon: 'Cookie' },
    { id: 'af2', name: 'Dimsum Grill Mentai (6 pcs)', price: 18000, category: 'Makanan', stock: 35, icon: 'Cookie' },
    { id: 'af3', name: 'Quesadillas Chiken', price: 25000, category: 'Makanan', stock: 30, icon: 'Cookie' },
    { id: 'af4', name: 'Quesadillas Beef', price: 35000, category: 'Makanan', stock: 25, icon: 'Cookie' },
    { id: 'af5', name: 'Quesadillas Egg', price: 20000, category: 'Makanan', stock: 40, icon: 'Cookie' },
    { id: 'af6', name: 'Sushi Roll Start Extra Keju', price: 15000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af7', name: 'Sushi Roll Start Abon', price: 15000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af8', name: 'Sushi Roll Start Katsuobushi', price: 15000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af9', name: 'Tortilla Pizza Chiken', price: 35000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af10', name: 'Tortilla Pizza Beef', price: 50000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af11', name: 'Tortilla Pizza Mushroom', price: 30000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af12', name: 'Burger Single Chiken (S)', price: 17000, category: 'Makanan', stock: 25, icon: 'Cookie' },
    { id: 'af13', name: 'Burger Double Chiken (D)', price: 34000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af14', name: 'Burger Single Beef (S)', price: 25500, category: 'Makanan', stock: 25, icon: 'Cookie' },
    { id: 'af15', name: 'Burger Double Beef (D)', price: 50000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af16', name: 'Aura\'s Pokki Cheese', price: 30000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af17', name: 'Shella Nachos', price: 35000, category: 'Makanan', stock: 15, icon: 'Cookie' },
    { id: 'af18', name: 'Hotdog Aura', price: 20000, category: 'Makanan', stock: 20, icon: 'Cookie' },
    { id: 'af19', name: 'Mac and Cheese', price: 18000, category: 'Makanan', stock: 22, icon: 'Cookie' },
    { id: 'af20', name: 'Penne Carbonara', price: 25000, category: 'Makanan', stock: 18, icon: 'Cookie' },
    { id: 'af21', name: 'Beef Lasagna', price: 40000, category: 'Makanan', stock: 12, icon: 'Cookie' },
    { id: 'af22', name: 'Es Lemonade Refreshing', price: 10000, category: 'Minuman', stock: 50, icon: 'CupSoda' },
    { id: 'af23', name: 'Virgin Mojito Lime', price: 10000, category: 'Minuman', stock: 50, icon: 'CupSoda' },
    { id: 'af24', name: 'Es Lemontea Brew', price: 8000, category: 'Minuman', stock: 60, icon: 'CupSoda' },
    { id: 'af25', name: 'Es Jeruk Peras', price: 8000, category: 'Minuman', stock: 60, icon: 'CupSoda' },
    { id: 'af26', name: 'Es Kopi Aura', price: 8000, category: 'Minuman', stock: 45, icon: 'Coffee' },
    { id: 'af27', name: 'Es Teh Manis', price: 5000, category: 'Minuman', stock: 80, icon: 'GlassWater' },
    { id: 'af28', name: 'Kopi Panas Tubruk', price: 5000, category: 'Minuman', stock: 40, icon: 'Coffee' },
    { id: 'af29', name: 'Air Mineral Dingin', price: 5000, category: 'Minuman', stock: 100, icon: 'GlassWater' },
  ];

  const db = await initDB();
  const tx = db.transaction('products', 'readwrite');
  const store = tx.objectStore('products');
  await store.clear();
  for (const p of defaultProducts) {
    await store.put(p);
  }
  return defaultProducts;
}

export async function getProducts(): Promise<Product[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function decreaseProductStock(id: string, qty: number): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const product = getReq.result as Product;
      if (product) {
        product.stock = Math.max(0, product.stock - qty);
        store.put(product);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
