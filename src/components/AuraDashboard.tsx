import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Transaction } from '../types';
import { getTransactions, getSyncQueue, getTransactionsFromGAS, getAdminDashboardMetrics, triggerGASSyncRekapHarian } from '../utils/db';
import { TrendingUp, ShoppingBag, Landmark, Clock, Database, ChevronRight, ChevronDown, Activity, AlertCircle, Sparkles, Filter, X, Search, ArrowLeft, Utensils, Trash2, ReceiptText, RefreshCw, LayoutDashboard, Calendar } from 'lucide-react';
import { getSessionCache, setSessionDashboard, setSessionFilters } from '../utils/sessionCache';

const getTodayLocalDateStr = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
};

const formatIndonesianDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dayName = days[d.getDay()];
    const dateNum = d.getDate();
    const monthName = months[d.getMonth()];
    const yearNum = d.getFullYear();
    return `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
  } catch {
    return dateStr;
  }
};

interface AuraDashboardProps {
  onNavigateToPOS: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToHistory: (branch?: string) => void;
  activeBranch: string;
  onSelectTransaction?: (tx: Transaction) => void;
  cabangList: any[];
}

export default function AuraDashboard({ onNavigateToPOS, onNavigateToAdmin, onNavigateToHistory, activeBranch, onSelectTransaction, cabangList }: AuraDashboardProps) {
  const session = getSessionCache();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allQueue, setAllQueue] = useState<any[]>([]);
  
  // Initialize filter from session cache or localStorage or default
  const [selectedAdminBranch, setSelectedAdminBranch] = useState<string>(() => {
    return session.filters.dashboard?.selectedAdminBranch || localStorage.getItem('AURA_DASHBOARD_FILTER_BRANCH') || 'Semua';
  });

  const [selectedAdminDate, setSelectedAdminDate] = useState<string>(() => {
    return session.filters.dashboard?.selectedAdminDate || localStorage.getItem('AURA_DASHBOARD_FILTER_DATE') || getTodayLocalDateStr();
  });
  
  // Ref to prevent redundant fetches if params are identical
  const lastFetchParamsRef = useRef<string>(session.dashboard.lastParams);
  
  // Setup cache key helper
  const getCacheKey = (branch: string, date: string) => `cached_dashboard_metrics_${branch}_${date}`;

  // States for server-side admin metrics loaded from cache immediately
  const [adminMetrics, setAdminMetrics] = useState<{
    totalRevenue: number;
    totalTransactions: number;
    averageTransactionValue: number;
    categorySales: { Makanan: number; Minuman: number; Pasta: number; Special: number };
    recentTransactions: Transaction[];
  } | null>(() => {
    // Priority: 1. Session Memory, 2. Persistent Storage
    if (session.dashboard.data) return session.dashboard.data;

    try {
      const initialBranch = activeBranch === 'ADMIN' ? selectedAdminBranch : activeBranch;
      const initialDate = session.filters.dashboard?.selectedAdminDate || localStorage.getItem('AURA_DASHBOARD_FILTER_DATE') || getTodayLocalDateStr();
      const cached = localStorage.getItem(`cached_dashboard_metrics_${initialBranch}_${initialDate}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isTriggeringRekap, setIsTriggeringRekap] = useState(false);
  const [showConfirmRekap, setShowConfirmRekap] = useState(false);

  const performTriggerRekap = async () => {
    setShowConfirmRekap(false);
    setIsTriggeringRekap(true);
    try {
      await triggerGASSyncRekapHarian();
      alert("Rekap Harian berhasil dipicu!");
      loadStats(true); // reload stats
    } catch (e: any) {
      alert("Gagal memicu Rekap: " + (e.message || "Kesalahan jaringan"));
    } finally {
      setIsTriggeringRekap(false);
    }
  };

  // Pull to refresh states
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY !== null) {
      const pull = e.touches[0].clientY - startY;
      if (pull > 0) {
        setPullDistance(Math.min(pull / 2, 100));
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 70) {
      await loadStats(true); // force remote refresh
    }
    setPullDistance(0);
    setStartY(null);
  };

  const loadStats = async (forceRemote = false) => {
    const currentBranch = activeBranch === 'ADMIN' ? selectedAdminBranch : activeBranch;
    const cacheKey = getCacheKey(currentBranch, selectedAdminDate);
    const currentParamsKey = JSON.stringify({ activeBranch, currentBranch, selectedAdminDate });

    // Guard: don't fetch if no force and same as last
    if (!forceRemote && lastFetchParamsRef.current === currentParamsKey) {
      return; 
    }

    if (!forceRemote) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          setAdminMetrics(JSON.parse(cached));
        } catch (e) {
          console.error(e);
        }
      }
    }

    setLoadingMetrics(true);
    setMetricsError(null);

    if (activeBranch === 'ADMIN') {
      try {
        const apiBranchId = selectedAdminBranch === 'Semua' ? 'All' : selectedAdminBranch;
        const metrics = await getAdminDashboardMetrics(apiBranchId, selectedAdminDate);
        setAdminMetrics(metrics);
        localStorage.setItem(cacheKey, JSON.stringify(metrics));
        lastFetchParamsRef.current = currentParamsKey;
        setSessionDashboard(currentParamsKey, metrics);
      } catch (err: any) {
        console.error("Gagal memuat metrik dashboard admin dari GAS:", err);
        setMetricsError(err.message || "Gagal menghubungi server Web App.");
      } finally {
        setLoadingMetrics(false);
      }
    } else {
      // Mode Cabang biasa - gunakan perhitungan lokal & remote hybrid
      try {
        const txsLocal = await getTransactions();
        let txsRemote: Transaction[] = [];
        if (activeBranch) {
          try {
            txsRemote = await getTransactionsFromGAS(activeBranch);
          } catch (e) {
            console.error("Error loading remote transactions:", e);
          }
        }
        
        // Merge and remove duplicates by ID
        const all = [...txsLocal, ...txsRemote];
        let unique = Array.from(new Map(all.map(item => [item.id, item])).values());
        unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setAllTransactions(unique);

        const currentTransactions = currentBranch === 'Semua' 
          ? unique 
          : unique.filter(tx => String(tx.cabang) === String(currentBranch));

        const revenue = currentTransactions.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);
        const transCount = currentTransactions.length;
        const avg = transCount > 0 ? Math.round(revenue / transCount) : 0;
        
        let makSales = 0, minSales = 0, pasSales = 0, speSales = 0;
        currentTransactions.forEach(tx => {
          tx.detail?.forEach(item => {
            const nm = item.NAMA_MENU.toLowerCase();
            if (nm.includes('pasta') || nm.includes('spaghetti') || nm.includes('macaroni')) {
              pasSales += item.QTY;
            } else if (nm.includes('special') || nm.includes("aura's") || nm.includes('auras')) {
              speSales += item.QTY;
            } else if (nm.includes('es ') || nm.includes('kopi') || nm.includes('mojito') || nm.includes('air') || nm.includes('teh')) {
              minSales += item.QTY;
            } else {
              makSales += item.QTY;
            }
          });
        });

        const localMetricsObj = {
          totalRevenue: revenue,
          totalTransactions: transCount,
          averageTransactionValue: avg,
          categorySales: { Makanan: makSales, Minuman: minSales, Pasta: pasSales, Special: speSales },
          recentTransactions: currentTransactions.slice(0, 10)
        };

        setAdminMetrics(localMetricsObj);
        localStorage.setItem(cacheKey, JSON.stringify(localMetricsObj));
        lastFetchParamsRef.current = currentParamsKey;
        setSessionDashboard(currentParamsKey, localMetricsObj);
      } catch (err) {
        console.error("Error loading dashboard statistics:", err);
      } finally {
        setLoadingMetrics(false);
      }
    }

    // Selalu update antrean sinkronisasi lokal
    try {
      const queue = await getSyncQueue();
      setAllQueue(queue);
    } catch (queueErr) {
      console.error("Gagal memuat sync queue:", queueErr);
    }
  };

  useEffect(() => {
    const currentBranch = activeBranch === 'ADMIN' ? selectedAdminBranch : activeBranch;
    const cacheKey = getCacheKey(currentBranch, selectedAdminDate);
    const cached = localStorage.getItem(cacheKey);
    
    // Save filter state to persist
    if (activeBranch === 'ADMIN') {
      localStorage.setItem('AURA_DASHBOARD_FILTER_BRANCH', selectedAdminBranch);
      localStorage.setItem('AURA_DASHBOARD_FILTER_DATE', selectedAdminDate);
      setSessionFilters('dashboard', { selectedAdminBranch, selectedAdminDate });
    }

    // First, set from cache for instantaneous UI response (Optimistic load)
    if (cached) {
      try {
        setAdminMetrics(JSON.parse(cached));
      } catch (e) {
        console.error(e);
      }
    }
    
    // Then ALWAYS fetch fresh stats in the background silently, but honor identical filters to prevent loading spinner
    loadStats(false);
    
  }, [activeBranch, selectedAdminBranch, selectedAdminDate]);

  const currentBranchFilter = activeBranch === 'ADMIN' ? selectedAdminBranch : activeBranch;
  
  // Local logic configurations
  const transactions = currentBranchFilter === 'Semua'
    ? allTransactions
    : allTransactions.filter(tx => String(tx.cabang) === String(currentBranchFilter));

  const queueCount = currentBranchFilter === 'Semua'
    ? allQueue.length
    : allQueue.filter(item => item.payload?.cabang === currentBranchFilter).length;

  // Decide source of metric values (whether to read from server-side adminMetrics or local calculated variables)
  const isServerAdmin = activeBranch === 'ADMIN' && adminMetrics !== null;

  const totalRevenue = isServerAdmin 
    ? adminMetrics!.totalRevenue 
    : transactions.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);

  const totalTransactionsCount = isServerAdmin
    ? adminMetrics!.totalTransactions
    : transactions.length;

  const avgTx = isServerAdmin
    ? adminMetrics!.averageTransactionValue
    : (transactions.length > 0 ? Math.round(totalRevenue / transactions.length) : 0);

  // Recalculate categories
  let mak = 0;
  let min = 0;
  let pas = 0;
  let spe = 0;

  if (isServerAdmin) {
    mak = adminMetrics!.categorySales.Makanan;
    min = adminMetrics!.categorySales.Minuman;
    pas = adminMetrics!.categorySales.Pasta;
    spe = adminMetrics!.categorySales.Special;
  } else {
    transactions.forEach(tx => {
      tx.detail?.forEach(item => {
        const nm = item.NAMA_MENU.toLowerCase();
        if (nm.includes('pasta') || nm.includes('spaghetti') || nm.includes('macaroni')) {
          pas += item.QTY;
        } else if (nm.includes('special') || nm.includes("aura's") || nm.includes('auras')) {
          spe += item.QTY;
        } else if (nm.includes('es ') || nm.includes('kopi') || nm.includes('mojito') || nm.includes('air') || nm.includes('teh')) {
          min += item.QTY;
        } else {
          mak += item.QTY;
        }
      });
    });
  }

  const tSales = mak + min + pas + spe;
  const foodRatio = tSales > 0 ? (mak / tSales) * 100 : 0;
  const minRatio = tSales > 0 ? (min / tSales) * 100 : 0;
  const pasRatio = tSales > 0 ? (pas / tSales) * 100 : 0;
  const speRatio = tSales > 0 ? (spe / tSales) * 100 : 0;

  // Recent transactions to list
  const recentTxList = isServerAdmin 
    ? adminMetrics!.recentTransactions 
    : transactions;

  // Recount total menu items sold
  let totalItemsSold = 0;
  if (isServerAdmin) {
    totalItemsSold = mak + min + pas + spe;
  } else {
    totalItemsSold = transactions.reduce((sum, tx) => sum + (tx.detail?.reduce((s, item) => s + item.QTY, 0) || 0), 0);
  }

  return (
    <div 
      className="space-y-6 animate-fade-in pb-24 relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div className="fixed top-20 left-0 right-0 flex justify-center items-center h-12 z-[1000] pointer-events-none">
          <RefreshCw className="h-6 w-6 text-red-650 animate-spin" style={{ opacity: pullDistance / 100 }} />
        </div>
      )}
      <div style={{ marginTop: `${pullDistance / 2}px`, transition: pullDistance === 0 ? 'margin-top 0.2s ease-out' : 'none' }} className="space-y-6">

      {activeBranch === 'ADMIN' && (
        <div className="bg-white border border-zinc-200/80 px-4 py-3 sm:p-5 rounded-[24px] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm text-left relative overflow-hidden">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <div className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center justify-center">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <h4 className="text-[10px] sm:text-xs font-bold text-zinc-900 uppercase tracking-widest">Pemantau Multi-Cabang</h4>
                <button
                  onClick={() => setShowConfirmRekap(true)}
                  disabled={isTriggeringRekap}
                  className="flex-none uppercase text-[8px] sm:text-[9px] font-extrabold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg transition cursor-pointer active:scale-95 whitespace-nowrap flex items-center justify-center gap-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
                >
                  <Database className={`h-3 w-3 ${isTriggeringRekap ? 'animate-spin' : ''}`} />
                  {isTriggeringRekap ? 'Memproses...' : 'Rekap Harian'}
                </button>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-1">
                <div className="relative flex items-center gap-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-350 hover:bg-zinc-100 transition-all rounded-xl px-3 py-1.5 cursor-pointer active:scale-97 overflow-hidden">
                  <Calendar className="h-3.5 w-3.5 text-red-650 shrink-0" />
                  <span className="font-extrabold text-zinc-805 tracking-tight group-hover:text-red-750 transition-colors">
                    {formatIndonesianDate(selectedAdminDate)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-450 shrink-0 ml-0.5" />
                  <input 
                    type="date"
                    value={selectedAdminDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedAdminDate(e.target.value);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 self-stretch sm:self-auto shrink-0 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide w-full sm:w-auto">
            <button
              onClick={() => setSelectedAdminBranch('Semua')}
              className={`flex-none uppercase text-[9px] font-extrabold px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg transition cursor-pointer active:scale-95 ${
                selectedAdminBranch === 'Semua'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
              }`}
            >
              Semua
            </button>
            {cabangList.map((c) => (
              <button
                key={c.ID_CABANG}
                onClick={() => setSelectedAdminBranch(String(c.ID_CABANG))}
                className={`flex-none uppercase text-[9px] font-extrabold px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg transition cursor-pointer active:scale-95 whitespace-nowrap ${
                  selectedAdminBranch === String(c.ID_CABANG)
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                {c.NAMA_CABANG}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* METRICS BENTO GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* REVENUE CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
              <Landmark className="h-5 w-5" />
            </span>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 font-bold px-1.5 py-0.5 rounded-md">
              +100%
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold">Total Omset</p>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
              {loadingMetrics ? (
                <span className="text-zinc-300 animate-pulse">Loading...</span>
              ) : (
                `Rp${totalRevenue.toLocaleString('id-ID')}`
              )}
            </h3>
          </div>
        </div>

        {/* TRANSACTIONS COUNT CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-1.5 py-0.5 rounded-md">
              Sinkron
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold">Total Pesanan</p>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
              {loadingMetrics ? (
                <span className="text-zinc-300 animate-pulse">Loading...</span>
              ) : (
                `${totalTransactionsCount} Transaksi`
              )}
            </h3>
          </div>
        </div>

        {/* TOTAL ITEMS CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Utensils className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold">Total Menu Terjual</p>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
              {loadingMetrics ? (
                <span className="text-zinc-300 animate-pulse">Loading...</span>
              ) : (
                `${totalItemsSold} Menu`
              )}
            </h3>
          </div>
        </div>

        {/* AVG TRANSACTION CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
              <Activity className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold">Rata-rata Transaksi</p>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
              {loadingMetrics ? (
                <span className="text-zinc-300 animate-pulse">Loading...</span>
              ) : (
                `Rp${avgTx.toLocaleString('id-ID')}`
              )}
            </h3>
          </div>
        </div>

      </div>

      {/* ERROR HANDLER */}
      {metricsError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-bold">Gagal Menyinkronkan Statistik Admin:</p>
            <p className="font-normal mt-0.5">{metricsError}</p>
          </div>
          <button 
            onClick={() => setSelectedAdminBranch(b => b)} 
            className="bg-white border border-red-300 text-red-950 text-[9px] px-3 py-1.5 rounded-lg font-bold hover:bg-zinc-50 active:scale-95 transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* DETAILED STATS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* STATS VISUAL SPLIT */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center justify-between">
            <span>Rasio Menu Aura Food</span>
            <TrendingUp className="h-4 w-4 text-zinc-400" />
          </h4>

          {/* Graphical Split Slider */}
          <div className="space-y-4 pt-2">
            <div className="flex justify-between text-xs text-zinc-550 flex-wrap gap-2">
              <span className="flex items-center gap-1.5 font-semibold text-red-900">
                <span className="h-2 w-2 rounded-full bg-red-650"></span>
                Makanan
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                Minuman
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Pasta
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-sky-600">
                <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                Aura's Special
              </span>
            </div>

            <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden flex">
              <div className="bg-red-650" style={{ width: `${foodRatio}%` }}></div>
              <div className="bg-amber-500" style={{ width: `${minRatio}%` }}></div>
              <div className="bg-emerald-500" style={{ width: `${pasRatio}%` }}></div>
              <div className="bg-sky-500" style={{ width: `${speRatio}%` }}></div>
            </div>

            <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl space-y-1.5 text-[11px] text-zinc-500">
              <p className="font-bold text-zinc-800">Analisis Favorit:</p>
              {tSales === 0 ? (
                <p>Belum ada rekaman preferensi menu pelanggan.</p>
              ) : Math.max(mak, min, pas, spe) === mak ? (
                <p>Pelanggan paling gemar membeli jenis <strong>Makanan</strong> harian.</p>
              ) : Math.max(mak, min, pas, spe) === min ? (
                <p>Pelanggan paling suka menikmati pesanan <strong>Minuman</strong> dingin menyegarkan.</p>
              ) : Math.max(mak, min, pas, spe) === pas ? (
                <p>Menu <strong>Pasta</strong> ala itali sedang menjadi primadona saat ini.</p>
              ) : (
                <p>Wow, menu <strong>Aura's Special</strong> menjadi hidangan yang paling sering dipesan!</p>
              )}
            </div>
          </div>
        </div>

        {/* RECENT LOCAL HISTORY LIST */}
        <div className="lg:col-span-2 bg-white border border-zinc-200/80 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-400" />
              Aktivitas Transaksi Terkini
            </h4>
            <button 
              onClick={() => onNavigateToHistory(currentBranchFilter)}
              className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-wide flex items-center justify-center px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>

          <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
            {loadingMetrics ? (
              <div className="py-6 flex flex-col items-center justify-center text-center bg-zinc-50 border border-zinc-200/50 rounded-2xl h-[160px]">
                <RefreshCw className="h-6 w-6 text-red-600 animate-spin mb-3" />
                <p className="text-zinc-500 font-medium text-xs">Memuat data terbaru...</p>
              </div>
            ) : recentTxList.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center bg-zinc-50 border border-zinc-200/50 border-dashed rounded-3xl h-[160px]">
                <ReceiptText className="h-10 w-10 text-zinc-300 mb-2 drop-shadow-sm" />
                <p className="text-zinc-500 font-black text-xs uppercase tracking-widest">Belum Ada Transaksi</p>
                <p className="text-[10px] text-zinc-400 font-medium px-6 mt-1">Data penjualan akan muncul di sini setelah transaksi dilakukan.</p>
              </div>
            ) : (
              recentTxList.slice(0, 3).map((tx) => (
                <div 
                  key={tx.id}
                  onClick={() => {
                    if (onSelectTransaction) {
                       onSelectTransaction(tx);
                    }
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 transition group hover:bg-zinc-50 cursor-pointer active:scale-95"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="h-2 w-2 rounded-full bg-zinc-400 shrink-0 group-hover:bg-red-500 transition"></div>
                    <div className="truncate text-left">
                      <p className="text-xs font-bold text-zinc-950 truncate group-hover:text-red-800 transition">{tx.id}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {tx.timestamp ? (
                          isNaN(new Date(tx.timestamp).getTime())
                            ? String(tx.timestamp)
                            : new Date(tx.timestamp).toLocaleString('id-ID')
                        ) : 'Beberapa saat yang lalu'} &bull; {tx.paymentMethod}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <p className="text-xs font-extrabold text-zinc-900">
                      Rp{tx.totalAmount.toLocaleString('id-ID')}
                    </p>
                    <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded mt-1 ${
                      tx.status === 'synced' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {tx.status === 'synced' ? 'SYNCED' : 'PENDING'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* MODAL KONFIRMASI REKAP HARIAN */}
      {showConfirmRekap && typeof document !== 'undefined' && createPortal(
        <div style={{ zIndex: 999999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center">
                <Database className="h-8 w-8" />
              </div>
            </div>
            <h3 className="text-center font-black text-lg text-zinc-900 mb-2">Proses Rekap Harian?</h3>
            <p className="text-center text-sm text-zinc-500 mb-6 leading-relaxed">
              Anda akan menghitung total pendapatan dari semua transaksi hari ini dan menyimpannya secara otomatis ke dalam Buku Kas. Pastikan aktivitas penjualan hari ini sudah selesai atau sepi sebelum melakukan rekap.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmRekap(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition"
              >
                Batal
              </button>
              <button 
                onClick={performTriggerRekap}
                className="flex-1 py-3 px-4 rounded-xl font-bold border border-sky-600 text-white bg-sky-600 hover:bg-sky-700 shadow-md hover:shadow-lg transition"
              >
                Tutup Buku Hari Ini
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      </div>
    </div>
  );
}
