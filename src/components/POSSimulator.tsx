import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product, CartItem, Transaction, SyncQueueItem } from '../types';
import ReceiptThermal from './ReceiptThermal';
import { 
  getProducts, 
  seedProductsIfEmpty, 
  getTransactions, 
  saveTransaction, 
  addToSyncQueue, 
  getSyncQueue, 
  removeFromSyncQueue,
  updateTransactionStatus,
  decreaseProductStock 
} from '../utils/db';
import { 
  Coffee, 
  Cookie, 
  CupSoda, 
  IceCream, 
  GlassWater, 
  Search, 
  ShoppingCart, 
  Clock, 
  Plus, 
  Minus,
  Filter,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
  Menu,
  X,
  CreditCard,
  Banknote,
  Wallet,
  UtensilsCrossed,
  AlertCircle,
  ListOrdered,
  ReceiptText
} from 'lucide-react';

interface POSSimulatorProps {
  onSelectTransaction: (tx: Transaction | null) => void;
  selectedTransaction: Transaction | null;
  refreshTrigger?: number;
  activeBranch: string;
  onCreatingStatusChange?: (isActive: boolean) => void;
}

type SortOrder = 'newest' | 'oldest';
interface HistoryFilterState {
  status: 'All' | 'Online' | 'Offline';
  sortOrder: SortOrder;
  paymentMethod: 'All' | 'Cash' | 'E-Wallet' | 'Debit Card';
}

const defaultFilterState: HistoryFilterState = {
  status: 'All',
  sortOrder: 'newest',
  paymentMethod: 'All',
};

export default function POSSimulator({ 
  onSelectTransaction, 
  selectedTransaction, 
  refreshTrigger, 
  activeBranch,
  onCreatingStatusChange 
}: POSSimulatorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Transaction queue and status
  const [history, setHistory] = useState<Transaction[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingQueue, setPendingQueue] = useState<SyncQueueItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isCreatingTx, setIsCreatingTx] = useState<boolean>(false);

  // Layout states for Create Tx mode
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [addedItemMessage, setAddedItemMessage] = useState<string | null>(null);

  // Custom Modals
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDiscardCart, setConfirmDiscardCart] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState<boolean>(false);
  const [historyModalTx, setHistoryModalTx] = useState<Transaction | null>(null);

  const [isSearchHistoryActive, setIsSearchHistoryActive] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  
  const [showHistoryFilter, setShowHistoryFilter] = useState<boolean>(false);
  const [appliedHistoryFilter, setAppliedHistoryFilter] = useState<HistoryFilterState>(defaultFilterState);
  const [tempHistoryFilter, setTempHistoryFilter] = useState<HistoryFilterState>(defaultFilterState);

  // Default payment
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'E-Wallet' | 'Debit Card'>('Cash');

  useEffect(() => {
    onCreatingStatusChange?.(isCreatingTx);
  }, [isCreatingTx, onCreatingStatusChange]);

  const loadDataFromDB = async () => {
    try {
      const dbProducts = await seedProductsIfEmpty();
      setProducts(dbProducts);

      const dbHistory = await getTransactions();
      const branchHistory = activeBranch === 'ADMIN' ? dbHistory : dbHistory.filter(tx => tx.cabang === activeBranch);
      setHistory(branchHistory.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

      const dbQueue = await getSyncQueue();
      const branchQueue = activeBranch === 'ADMIN' ? dbQueue : dbQueue.filter(item => item.payload?.cabang === activeBranch);
      setPendingQueue(branchQueue);
    } catch (err) {
      console.error("IndexedDB error:", err);
    }
  };

  useEffect(() => {
    loadDataFromDB();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadDataFromDB();
  }, [refreshTrigger, activeBranch]);

  useEffect(() => {
    if (addedItemMessage) {
      const timer = setTimeout(() => setAddedItemMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [addedItemMessage]);

  useEffect(() => {
    let barcodeString = '';
    let barcodeTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (barcodeString.length > 5) {
          setIsCreatingTx(false);
          setShowCheckoutModal(false);
          setShowCatalogModal(false);
          setHistoryModalTx(null);
          
          setShowFullHistory(true);
          setIsSearchHistoryActive(true);
          setHistorySearchQuery(barcodeString);
        }
        barcodeString = '';
      } else if (e.key.length === 1) {
        barcodeString += e.key;
        clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => {
          barcodeString = '';
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(barcodeTimeout);
    };
  }, []);

  const getProductIcon = (name: string) => {
    return <UtensilsCrossed className="h-5 w-5 text-red-750" />;
  };

  const addToCart = (product: Product) => {
    if (activeBranch === 'ADMIN') {
      setAlertMessage("Cabang ADMIN bertindak hanya sebagai pemantau dan tidak dapat menambahkan pesanan baru.");
      return;
    }
    if (product.stock <= 0) return;

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        if (prev[existingIndex].quantity >= product.stock) return prev;
        const nextCart = [...prev];
        nextCart[existingIndex].quantity += 1;
        return nextCart;
      }
      return [...prev, { product, quantity: 1 }];
    });
    
    setAddedItemMessage(`${product.name} berhasil ditambahkan`);
  };

  const updateCartQty = (id: string, delta: number) => {
    const item = cart.find(i => i.product.id === id);
    if (!item) return;

    if (item.quantity === 1 && delta === -1) {
      setConfirmDeleteId(id);
      return;
    }

    setCart(prev => prev.map(i => {
      if (i.product.id === id) {
        const newQty = Math.max(1, i.quantity + delta);
        const cappedQty = Math.min(newQty, i.product.stock);
        return { ...i, quantity: cappedQty };
      }
      return i;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const checkoutTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (activeBranch === 'ADMIN') return;
    if (cart.length === 0) return;

    const transactionId = `TX-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newTx: Transaction = {
      id: transactionId,
      timestamp: new Date().toISOString(),
      cabang: activeBranch,
      items: cart,
      totalAmount: checkoutTotal,
      paymentMethod,
      status: 'pending_sync'
    };

    try {
      await saveTransaction(newTx);
      
      for (const item of cart) {
        await decreaseProductStock(item.product.id, item.quantity);
      }

      await addToSyncQueue({
        id: transactionId,
        action: 'POST_TRANSACTION',
        payload: newTx,
        timestamp: Date.now(),
        retries: 0
      });

      setCart([]);
      setShowCheckoutModal(false);
      setIsCreatingTx(false);
      
      await loadDataFromDB();
      onSelectTransaction(newTx);

    } catch (err) {
      console.error("Gagal memproses checkout", err);
      setAlertMessage("Terjadi kesalahan saat menyimpan transaksi (IndexedDB).");
    }
  };

  const filteredProducts = products.filter(p => {
    const matchCat = category === 'Semua' || p.category === category;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  if (showFullHistory) {
    let filteredHistory = [...history];

    if (isSearchHistoryActive && historySearchQuery) {
      filteredHistory = filteredHistory.filter(tx => tx.id.toLowerCase().includes(historySearchQuery.toLowerCase()));
    }

    if (appliedHistoryFilter.status !== 'All') {
      const isOnline = appliedHistoryFilter.status === 'Online';
      filteredHistory = filteredHistory.filter(tx => (tx.status === 'synced') === isOnline);
    }

    if (appliedHistoryFilter.paymentMethod !== 'All') {
      filteredHistory = filteredHistory.filter(tx => tx.paymentMethod === appliedHistoryFilter.paymentMethod);
    }

    if (appliedHistoryFilter.sortOrder === 'oldest') {
      filteredHistory.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } else {
      filteredHistory.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    const activeFilterCount = (appliedHistoryFilter.status !== 'All' ? 1 : 0) + 
                              (appliedHistoryFilter.paymentMethod !== 'All' ? 1 : 0) +
                              (appliedHistoryFilter.sortOrder !== 'newest' ? 1 : 0);

    const isFilterOrSearchActive = activeFilterCount > 0 || (isSearchHistoryActive && historySearchQuery);

    return createPortal(
      <div className="fixed inset-0 z-[99999] bg-neutral-50 flex flex-col w-full h-full animate-fade-in text-left">
        <header className="bg-white border-b border-zinc-200/80 sticky top-0 z-50 pt-safe shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            {isSearchHistoryActive ? (
              <div className="flex items-center gap-3 w-full animate-in fade-in duration-200">
                <button
                  onClick={() => { setIsSearchHistoryActive(false); setHistorySearchQuery(''); }}
                  className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-700 transition cursor-pointer active:scale-95 shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
                <input 
                  autoFocus
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Cari ID Transaksi..."
                  className="w-full bg-transparent border-none outline-none text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 placeholder:font-normal"
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFullHistory(false)}
                    className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-700 transition cursor-pointer active:scale-95"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                      Semua Riwayat Transaksi
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSearchHistoryActive(true)}
                    className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-700 transition cursor-pointer active:scale-95"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setTempHistoryFilter(appliedHistoryFilter); setShowHistoryFilter(true); }}
                    className="relative p-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-700 transition cursor-pointer active:scale-95"
                  >
                    <Filter className="h-4 w-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-700 text-white flex items-center justify-center rounded-full text-[9px] font-black pointer-events-none">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full pb-safe bg-neutral-50 relative">
          <div className="max-w-2xl mx-auto p-4 space-y-3">
            {history.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center bg-zinc-50 border border-zinc-200/50 rounded-2xl">
                  <ReceiptText className="h-8 w-8 text-zinc-300 mb-3" />
                  <p className="text-zinc-500 font-medium text-xs mb-3">Belum ada transaksi dibuat.</p>
                  <button 
                    onClick={() => { setShowFullHistory(false); setIsCreatingTx(true); }}
                    className="bg-red-50 text-red-700 hover:bg-red-100 font-bold text-[10px] px-4 py-2 rounded-xl transition flex items-center gap-2 active:scale-95 uppercase tracking-wider"
                  >
                    <Plus className="h-3 w-3" /> Buat Transaksi
                  </button>
                </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center bg-zinc-50 border border-zinc-200/50 rounded-2xl animate-in fade-in duration-200">
                <Search className="h-8 w-8 text-zinc-300 mb-3" />
                <p className="text-zinc-500 font-medium text-xs mb-4">Tidak ada hasil untuk pencarian/filter ini.<br/>Coba kata kunci lain.</p>
                <button 
                  onClick={() => {
                    setIsSearchHistoryActive(false);
                    setHistorySearchQuery('');
                    setAppliedHistoryFilter(defaultFilterState);
                  }}
                  className="bg-red-50 text-red-700 hover:bg-red-100 font-bold text-[10px] px-4 py-2 rounded-xl transition flex items-center gap-2 active:scale-95 uppercase tracking-wider"
                >
                  <Trash2 className="h-3 w-3" /> Hapus Filter
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredHistory.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => { 
                      setHistoryModalTx(tx);
                    }}
                    className={`p-4 border rounded-2xl cursor-pointer transition flex flex-col justify-between text-left group hover:border-zinc-400 bg-white shadow-sm ${
                      historyModalTx?.id === tx.id ? 'bg-red-50 border-red-700 ring-1 ring-red-700/10' : 'border-zinc-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className={`text-xs font-extrabold truncate ${historyModalTx?.id === tx.id ? 'text-red-800' : 'text-zinc-900'}`}>{tx.id}</p>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black shrink-0 uppercase tracking-wider ${
                        tx.status === 'synced' 
                          ? 'bg-emerald-100/70 text-emerald-800 border border-emerald-200/30' 
                          : 'bg-amber-100/70 text-amber-800 border border-amber-200/30'
                      }`}>
                        {tx.status === 'synced' ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <div className="leading-tight">
                        <p className="text-[10px] text-zinc-500 font-medium whitespace-nowrap mb-1">
                          {new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} &bull; {tx.paymentMethod}
                        </p>
                        <span className="text-[10px] text-red-750 font-bold hover:underline inline-flex items-center gap-0.5 transition">
                          Lihat Struk
                        </span>
                      </div>
                      <p className="text-sm font-black text-zinc-950 whitespace-nowrap">
                        Rp {tx.totalAmount.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showHistoryFilter && (
          <div className="fixed inset-0 z-[100000] bg-zinc-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200" onClick={() => setShowHistoryFilter(false)}>
            <div className="bg-white w-full max-w-sm h-[100dvh] shadow-2xl flex flex-col animate-in slide-in-from-right-1/2" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 pt-safe">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight flex items-center gap-2">
                  <Filter className="h-4 w-4 text-red-750" /> Filter Riwayat
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setTempHistoryFilter(defaultFilterState)}
                    className="p-1.5 bg-white hover:bg-red-50 text-red-700 hover:text-red-900 rounded-lg transition shadow-sm border border-zinc-200"
                    title="Hapus Filter"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setShowHistoryFilter(false)}
                    className="p-1.5 bg-white hover:bg-zinc-100 rounded-lg text-zinc-700 transition shadow-sm border border-zinc-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-y-auto space-y-6">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Urutkan</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setTempHistoryFilter({...tempHistoryFilter, sortOrder: 'newest'})}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${tempHistoryFilter.sortOrder === 'newest' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Terbaru</button>
                      <button 
                        onClick={() => setTempHistoryFilter({...tempHistoryFilter, sortOrder: 'oldest'})}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${tempHistoryFilter.sortOrder === 'oldest' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Terlama</button>
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Status Sync</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => setTempHistoryFilter({...tempHistoryFilter, status: 'All'})}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${tempHistoryFilter.status === 'All' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Semua</button>
                      <button 
                        onClick={() => setTempHistoryFilter({...tempHistoryFilter, status: 'Online'})}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${tempHistoryFilter.status === 'Online' ? 'bg-emerald-50 border-emerald-600 text-emerald-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Online</button>
                      <button 
                        onClick={() => setTempHistoryFilter({...tempHistoryFilter, status: 'Offline'})}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${tempHistoryFilter.status === 'Offline' ? 'bg-amber-50 border-amber-600 text-amber-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Offline</button>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Metode Pembayaran</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'All'})}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${tempHistoryFilter.paymentMethod === 'All' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Semua</button>
                      <button 
                        onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'Cash'})}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${tempHistoryFilter.paymentMethod === 'Cash' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Cash</button>
                      <button 
                        onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'E-Wallet'})}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${tempHistoryFilter.paymentMethod === 'E-Wallet' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>E-Wallet</button>
                     <button 
                        onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'Debit Card'})}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 ${tempHistoryFilter.paymentMethod === 'Debit Card' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Debit Card</button>
                    </div>
                 </div>
              </div>
              <div className="p-4 border-t border-zinc-200 bg-zinc-50 pb-safe">
                <button 
                  disabled={JSON.stringify(tempHistoryFilter) === JSON.stringify(defaultFilterState)}
                  onClick={() => { setAppliedHistoryFilter(tempHistoryFilter); setShowHistoryFilter(false); }}
                  className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs py-3.5 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider cursor-pointer"
                >
                  Terapkan Filter
                </button>
              </div>
            </div>
          </div>
        )}

        {historyModalTx && (
          <div className="fixed inset-0 z-[100000] bg-zinc-950/60 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={() => setHistoryModalTx(null)}>
            <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                  Pratinjau Struk
                </h3>
                <button 
                  onClick={() => setHistoryModalTx(null)}
                  className="p-1.5 bg-white hover:bg-zinc-100 rounded-lg text-zinc-700 transition shadow-sm border border-zinc-200 cursor-pointer active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 max-h-[60vh] overflow-y-auto bg-neutral-100">
                 <ReceiptThermal transaction={historyModalTx} />
              </div>
              <div className="p-4 border-t border-zinc-200 bg-zinc-50">
                <button className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 uppercase tracking-wider cursor-pointer" onClick={() => { setTimeout(() => window.print(), 100); }}>
                  Cetak Struk Sekarang
                </button>
              </div>
            </div>
          </div>
        )}
      </div>,
      document.body
    );
  }

  if (!isCreatingTx) {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const displayDateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const todayTxs = history.filter(tx => {
      return tx.timestamp.startsWith(todayStr) || new Date(tx.timestamp).toLocaleDateString('en-CA') === todayStr;
    });
    const todayRevenue = todayTxs.reduce((sum, tx) => sum + tx.totalAmount, 0);

    return (
      <>
        <div className="space-y-6 animate-fade-in text-left">
        <div className="max-w-xl mx-auto flex flex-col gap-5 pt-2">
          
            {/* Omset Hari Ini Panel for Non-Admin */}
            {activeBranch !== 'ADMIN' && (
              <div className="space-y-3 mb-2 shrink-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-zinc-200/85 p-4 rounded-[24px] shadow-sm flex flex-col justify-center relative overflow-hidden h-[100px]">
                    <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 text-emerald-50"><Banknote className="h-16 w-16" /></div>
                    <div className="relative z-10 flex flex-col justify-center h-full pt-1">
                       <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block mb-0.5">Omset Hari Ini</span>
                       <p className="text-lg font-black text-emerald-950 tracking-tight leading-none pt-0.5">Rp {todayRevenue.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                  <div className="bg-white border border-zinc-200/85 p-4 rounded-[24px] shadow-sm flex flex-col justify-center relative overflow-hidden h-[100px]">
                    <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 text-amber-50"><ListOrdered className="h-16 w-16" /></div>
                    <div className="relative z-10 flex flex-col justify-center h-full pt-1">
                       <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block mb-0.5">Total Transaksi</span>
                       <p className="text-lg font-black text-amber-950 tracking-tight flex items-baseline gap-1 leading-none pt-0.5">{todayTxs.length} <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Selesai</span></p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          <div className="bg-white border border-zinc-200/85 shadow-sm rounded-3xl p-5 sm:p-6 space-y-4 flex flex-col shrink-0 min-h-[300px]">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 shrink-0">
              <div>
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-750" />
                  Riwayat Transaksi
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowFullHistory(true)} 
                  className="text-[10px] font-black text-red-750 uppercase tracking-widest hover:text-red-900 cursor-pointer bg-transparent border-none"
                >
                  Lihat Semua
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-2.5 pr-1">
              {history.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center bg-zinc-50 border border-zinc-200/50 rounded-2xl">
                  <ReceiptText className="h-8 w-8 text-zinc-300 mb-3" />
                  <p className="text-zinc-500 font-medium text-xs mb-3">Belum ada transaksi dibuat.</p>
                  <button 
                    onClick={() => setIsCreatingTx(true)}
                    className="bg-red-50 text-red-700 hover:bg-red-100 font-bold text-[10px] px-4 py-2 rounded-xl transition flex items-center gap-2 active:scale-95 uppercase tracking-wider"
                  >
                    <Plus className="h-3 w-3" /> Buat Transaksi
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {history.slice(0, 3).map((tx) => (
                    <div
                      key={tx.id}
                      onClick={(e) => { e.stopPropagation(); onSelectTransaction(tx); setTimeout(() => document.getElementById('thermal-section')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                      className={`p-4 border rounded-2xl cursor-pointer transition flex flex-col justify-between text-left group ${
                        selectedTransaction?.id === tx.id 
                          ? 'bg-red-50 border-red-700 ring-1 ring-red-700/10' 
                          : 'border-zinc-200/80 hover:border-zinc-400 bg-white hover:bg-zinc-50/20'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <p className={`text-xs font-extrabold truncate ${selectedTransaction?.id === tx.id ? 'text-red-800' : 'text-zinc-900'}`}>{tx.id}</p>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black shrink-0 uppercase tracking-wider ${
                          tx.status === 'synced' 
                            ? 'bg-emerald-100/70 text-emerald-800 border border-emerald-200/30' 
                            : 'bg-amber-100/70 text-amber-800 border border-amber-200/30'
                        }`}>
                          {tx.status === 'synced' ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="flex justify-between items-end mt-2">
                        <div className="leading-tight">
                          <p className="text-[10px] text-zinc-500 font-medium">
                            {new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} &bull; {tx.paymentMethod}
                          </p>
                          <span className="text-[10px] text-red-750 font-bold hover:underline inline-flex items-center gap-0.5 mt-1 transition">
                            Lihat Struk
                          </span>
                        </div>
                        <p className="text-sm font-black text-zinc-950">
                          Rp {tx.totalAmount.toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>

        {activeBranch !== 'ADMIN' && createPortal(
          <button
            onClick={() => {
              setCart([]);
              setIsCreatingTx(true);
              onSelectTransaction(null);
            }}
            className="fixed bottom-6 right-4 md:bottom-8 md:right-8 h-14 w-14 md:h-16 md:w-16 bg-red-700 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-red-800 transition active:scale-95 z-40 cursor-pointer"
          >
            <div className="relative">
              <ShoppingCart className="h-6 w-6 md:h-7 md:w-7 text-white" />
              <div className="absolute -top-1 -right-2 md:-top-1.5 md:-right-2.5 h-4 w-4 md:h-5 md:w-5 bg-white text-red-700 rounded-full flex items-center justify-center border-2 border-red-700 shadow-sm">
                 <Plus className="h-2.5 w-2.5 md:h-3 md:w-3 font-bold stroke-[3]" />
              </div>
            </div>
          </button>,
          document.body
        )}


      </>
    );
  }

  const renderCatalogGrid = () => (
    <div className="space-y-4">
      <div className="bg-white p-4 border border-zinc-200/80 shadow-sm rounded-3xl space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari menu (Espresso, Dimsum...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 pl-10 pr-4 py-3 rounded-xl border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-650 transition outline-none"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {['Semua', 'Minuman Kopi', 'Minuman Non-Kopi', 'Makanan'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 uppercase tracking-wider ${
                category === cat 
                  ? 'bg-zinc-900 text-white shadow-md' 
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-24 md:pb-6 overflow-y-auto max-h-[80vh] scrollbar-thin rounded-2xl px-1" id="products-grid">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            onClick={() => {
              addToCart(p);
              if (window.innerWidth < 768) {
                setShowCatalogModal(false);
              }
            }}
            className="bg-white border border-zinc-200/85 hover:border-red-650/40 p-4 rounded-3xl cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between group active:scale-95 select-none relative overflow-hidden text-left"
          >
            {p.stock === 0 && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center text-center p-2 z-10 rounded-3xl">
                <span className="bg-red-50 text-red-850 border border-red-150 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">
                  Stok Habis
                </span>
              </div>
            )}

            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="text-xl group-hover:scale-110 transition origin-left bg-zinc-50 rounded-xl p-2.5 border border-zinc-100">
                  {getProductIcon(p.icon)}
                </div>
                <span className="text-[9px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-bold">
                  Stok: {p.stock}
                </span>
              </div>
              <h4 className="text-xs font-bold text-zinc-950 truncate group-hover:text-red-800 transition">{p.name}</h4>
              <p className="text-[9px] text-zinc-400 mt-0.5 uppercase tracking-wider font-extrabold">{p.category}</p>
            </div>

            <div className="flex justify-between items-center mt-3 pt-2 border-t border-zinc-100/80">
              <span className="text-xs font-black text-zinc-900">
                Rp {p.price.toLocaleString('id-ID')}
              </span>
              <span className="p-1.5 bg-zinc-50 group-hover:bg-red-750 group-hover:text-white rounded-lg transition text-zinc-650">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-50 flex flex-col overflow-hidden w-full h-full animate-fade-in text-left">
      
      <header className="bg-white border-b border-zinc-200 shadow-sm shrink-0">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (cart.length > 0) {
                  setConfirmDiscardCart(true);
                } else {
                  setIsCreatingTx(false);
                }
              }}
              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-700 transition cursor-pointer active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                AURA FOOD {activeBranch}
              </h1>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Mencatat Pesanan</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCheckoutModal(true)}
              disabled={cart.length === 0}
              className="hidden md:flex bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-extrabold text-[10px] px-4 py-2.5 rounded-xl transition items-center gap-2 shadow-sm active:scale-95 uppercase tracking-wider"
            >
              Proses &amp; Cetak
            </button>

            <button
              onClick={() => setShowCatalogModal(true)}
              className="md:hidden p-2 bg-red-50 text-red-750 rounded-lg hover:bg-red-100 transition active:scale-95 flex items-center gap-1.5 border border-red-100"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider pr-1">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {addedItemMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4">
          <Check className="h-4 w-4 text-emerald-400" />
          {addedItemMessage}
        </div>
      )}

      <div className="flex-1 overflow-hidden flex relative">
        <div className="flex-1 overflow-y-auto bg-neutral-50 p-4 pb-36 md:pb-6 scrollbar-thin flex justify-center">
          <div className="w-full max-w-3xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2 uppercase tracking-wide">
                <ShoppingCart className="h-5 w-5 text-red-700" />
                Daftar Pesanan Saat Ini
              </h3>
              <span className="text-[10px] bg-red-100 text-red-800 font-extrabold px-2.5 py-1 rounded-md">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} Porsi
              </span>
            </div>

            <div className="space-y-3 pb-8 pl-1 pr-1">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-white border border-dashed border-zinc-300 rounded-3xl h-full">
                  <div className="h-16 w-16 bg-zinc-50 rounded-full flex items-center justify-center mb-3 border border-zinc-100">
                    <ShoppingCart className="h-8 w-8 text-zinc-300 stroke-[1.5]" />
                  </div>
                  <p className="text-sm font-black text-zinc-700 mb-1">Daftar Pesanan Kosong</p>
                  <p className="text-[10px] text-zinc-500 max-w-[200px] leading-relaxed mx-auto">
                    Pilih menu dari {window.innerWidth >= 768 ? 'panel kanan' : 'tombol menu di pojok kanan atas'} untuk ditambahkan ke daftar ini.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm text-left gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-zinc-950 truncate leading-tight mb-1" title={item.product.name}>{item.product.name}</h4>
                      <p className="text-[11px] text-zinc-500 font-medium">
                        @ Rp {item.product.price.toLocaleString('id-ID')}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2.5 shrink-0">
                      <span className="text-xs font-black text-zinc-950">
                        Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}
                      </span>
                      <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden h-8 shadow-sm">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.product.id, -1)}
                          className="px-3 hover:bg-zinc-200 text-zinc-700 h-full flex items-center transition active:bg-zinc-300"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-2 font-mono text-sm font-extrabold text-zinc-900 min-w-[28px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.product.id, 1)}
                          className="px-3 hover:bg-zinc-200 hover:text-red-700 text-zinc-700 h-full flex items-center transition active:bg-zinc-300"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:block w-[380px] xl:w-[480px] border-l border-zinc-200 bg-white p-5 overflow-y-auto shrink-0 shadow-[-10px_0_20px_rgba(0,0,0,0.02)] z-10">
          <div className="mb-4">
             <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
                Katalog Menu
              </h3>
          </div>
          {renderCatalogGrid()}
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-5 shadow-[0_-15px_30px_rgba(0,0,0,0.08)] z-40 pb-safe">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Harga</span>
          <span className="text-xl font-black text-red-750">Rp {checkoutTotal.toLocaleString('id-ID')}</span>
        </div>
        <button
          onClick={() => setShowCheckoutModal(true)}
          disabled={cart.length === 0}
          className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-extrabold text-sm py-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 active:scale-95 uppercase tracking-wider cursor-pointer"
        >
          Proses Struk &amp; Checkout
        </button>
      </div>

      {showCatalogModal && (
        <div style={{ zIndex: 99999 }} className="md:hidden fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
          <div className="bg-white w-full h-full shadow-2xl flex flex-col animate-in slide-in-from-bottom-12">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center shrink-0 pt-safe">
              <h3 className="text-base font-black text-zinc-900 uppercase tracking-tight pl-2">Katalog Menu</h3>
              <button 
                onClick={() => setShowCatalogModal(false)}
                className="p-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-full text-zinc-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-hidden pb-16">
              {renderCatalogGrid()}
            </div>
          </div>
        </div>
      )}

      {showCheckoutModal && (
        <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md xl:max-w-lg rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            <div className="p-5 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 shrink-0">
              <div>
                <h2 className="text-base font-black text-zinc-900 uppercase tracking-tight">Konfirmasi Transaksi</h2>
                <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Selesaikan pembayaran saat ini juga</p>
              </div>
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="p-2 bg-zinc-200 hover:bg-zinc-300 rounded-full text-zinc-700 transition active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <div className="mb-6">
                <label className="text-[10px] font-black text-zinc-500 block mb-3 uppercase tracking-wider">
                  Cek Ulang Pesanan
                </label>
                <div className="space-y-3 mb-4 max-h-[160px] overflow-y-auto pr-1">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex justify-between text-xs items-center">
                      <span className="text-zinc-800 font-semibold leading-tight pr-4">
                        <span className="font-extrabold text-zinc-950 inline-block w-6">{item.quantity}x</span> 
                        {item.product.name}
                      </span>
                      <span className="text-zinc-900 font-bold shrink-0">{(item.product.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-zinc-300">
                  <span className="text-sm font-black text-zinc-900 uppercase">Total Tagihan</span>
                  <span className="text-xl font-black text-red-750">Rp {checkoutTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="mb-2">
                <label className="text-[10px] font-black text-zinc-500 block mb-3 uppercase tracking-wider">
                  Pilih Cara Bayar Pembeli
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentMethod('Cash')}
                    className={`py-3.5 border rounded-2xl flex flex-col items-center gap-2 transition active:scale-95 ${
                      paymentMethod === 'Cash' 
                        ? 'bg-zinc-950 border-zinc-950 text-white shadow-md' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    <Banknote className={`h-5 w-5 ${paymentMethod === 'Cash' ? 'text-emerald-400' : 'text-zinc-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Tunai</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('E-Wallet')}
                    className={`py-3.5 border rounded-2xl flex flex-col items-center gap-2 transition active:scale-95 ${
                      paymentMethod === 'E-Wallet' 
                        ? 'bg-zinc-950 border-zinc-950 text-white shadow-md' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    <Wallet className={`h-5 w-5 ${paymentMethod === 'E-Wallet' ? 'text-sky-400' : 'text-zinc-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">E-Wallet</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('Debit Card')}
                    className={`py-3.5 border rounded-2xl flex flex-col items-center gap-2 transition active:scale-95 ${
                      paymentMethod === 'Debit Card' 
                        ? 'bg-zinc-950 border-zinc-950 text-white shadow-md' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                    }`}
                  >
                    <CreditCard className={`h-5 w-5 ${paymentMethod === 'Debit Card' ? 'text-indigo-400' : 'text-zinc-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Debit</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-zinc-100 bg-white flex gap-3 shrink-0">
               <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-6 py-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-extrabold text-xs rounded-xl transition active:scale-95 uppercase tracking-wider"
                >
                  Kembali
                </button>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="flex-1 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-extrabold text-xs py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer uppercase tracking-wider"
              >
                Cetak Struk Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {confirmDeleteId && (
        <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-zinc-200 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4 border border-red-200">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">Hapus Item Pesanan</h3>
            <p className="text-xs text-zinc-600 mb-6 leading-relaxed">Apakah Anda yakin ingin menghapus {cart.find(i => i.product.id === confirmDeleteId)?.product.name} dari daftar pesanan?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)} 
                className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase cursor-pointer transition"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  removeFromCart(confirmDeleteId);
                  setConfirmDeleteId(null);
                }} 
                className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase cursor-pointer transition"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDiscardCart && (
        <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmDiscardCart(false)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-zinc-200 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4 border border-red-200">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">Batalkan Transaksi?</h3>
            <p className="text-xs text-zinc-600 mb-6 leading-relaxed">Pesanan aktif belum diproses. Semua item dalam daftar pesanan Anda akan dibuang, apakah Anda setuju?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDiscardCart(false)} 
                className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase cursor-pointer transition"
              >
                Kembali
              </button>
              <button 
                onClick={() => {
                  setIsCreatingTx(false);
                  setCart([]);
                  setConfirmDiscardCart(false);
                }} 
                className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase cursor-pointer transition"
              >
                Ya, Buang
              </button>
            </div>
          </div>
        </div>
      )}

      {alertMessage && (
        <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-zinc-200 animate-in zoom-in-95">
             <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">Pemberitahuan</h3>
            <p className="text-xs text-zinc-600 mb-6 leading-relaxed">{alertMessage}</p>
            <button 
              onClick={() => setAlertMessage(null)} 
              className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase cursor-pointer transition"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
