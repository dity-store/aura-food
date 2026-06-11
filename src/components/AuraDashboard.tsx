import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Transaction } from '../types';
import { getTransactions, getSyncQueue, getTransactionsFromGAS, getAdminDashboardMetrics, triggerGASSyncRekapHarian } from '../utils/db';
import { TrendingUp, ShoppingBag, Landmark, Clock, Database, ChevronRight, ChevronDown, Activity, AlertCircle, Sparkles, Filter, X, Search, ArrowLeft, Utensils, Trash2, ReceiptText, RefreshCw, LayoutDashboard, Calendar, Check, Share2, Copy, FileDown, Banknote, CreditCard } from 'lucide-react';
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
    totalCash: number;
    totalTransfer: number;
    averageTransactionValue: number;
    categorySales: { Makanan: number; Minuman: number; Pasta: number; Special: number };
    recentTransactions: Transaction[];
    yesterdayRevenue?: number;
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

  // States for in-app toast & custom Lapor modal
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showLaporModal, setShowLaporModal] = useState<boolean>(false);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
         // Auto dismiss after 5s unless it's a success report toast to keep it long enough
         setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    const handleAndroidBack = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (showLaporModal) {
        setShowLaporModal(false);
        customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showConfirmRekap) {
        setShowConfirmRekap(false);
        customEvt.detail.handled = true;
        customEvt.preventDefault();
      }
    };
    window.addEventListener('aura-backpress', handleAndroidBack);
    return () => window.removeEventListener('aura-backpress', handleAndroidBack);
  }, [showLaporModal, showConfirmRekap]);

  const performTriggerRekap = async () => {
    setShowConfirmRekap(false);
    setIsTriggeringRekap(true);
    try {
      await triggerGASSyncRekapHarian(selectedAdminDate);
      setToastType('success');
      setToastMessage("Rekap Harian berhasil direkap!");
      loadStats(true); // reload stats
    } catch (e: any) {
      setToastType('error');
      setToastMessage("Gagal merekap data: " + (e.message || "Kesalahan jaringan"));
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
            const [y, m, d] = selectedAdminDate.split('-');
            const paramTanggal = `${d}/${m}/${y}`;
            txsRemote = await getTransactionsFromGAS(activeBranch, paramTanggal);
          } catch (e) {
            console.error("Error loading remote transactions:", e);
          }
        }
        
        // Merge and remove duplicates by ID
        const all = [...txsLocal, ...txsRemote];
        let unique = Array.from(new Map(all.map(item => [item.id, item])).values());
        unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setAllTransactions(unique);

        const currentDateStr = selectedAdminDate;
        const currentTransactions = unique.filter(tx => {
          if (currentBranch !== 'Semua' && String(tx.cabang) !== String(currentBranch)) {
            return false;
          }
          try {
            if (typeof tx.timestamp === 'string' && tx.timestamp.length >= 10 && tx.timestamp.includes('T')) {
              return tx.timestamp.substring(0, 10) === currentDateStr;
            }
            const d = new Date(tx.timestamp);
            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return dStr === currentDateStr;
          } catch {
            return false;
          }
        });

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

        let yesterdayRevenueObj = 0;
        try {
          const currentDate = new Date(selectedAdminDate);
          currentDate.setDate(currentDate.getDate() - 1);
          const yr = currentDate.getFullYear();
          const mo = String(currentDate.getMonth() + 1).padStart(2, '0');
          const dy = String(currentDate.getDate()).padStart(2, '0');
          const yesterdayDateStr = `${yr}-${mo}-${dy}`;
          
          const yesterdayTransactions = currentBranch === 'Semua'
            ? unique.filter(tx => {
                try {
                  const d = new Date(tx.timestamp);
                  const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  return dStr === yesterdayDateStr;
                } catch { return false; }
              })
            : unique.filter(tx => String(tx.cabang) === String(currentBranch) && (() => {
                try {
                  const d = new Date(tx.timestamp);
                  const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  return dStr === yesterdayDateStr;
                } catch { return false; }
              })());
          yesterdayRevenueObj = yesterdayTransactions.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);
        } catch (e) {
          console.error("Error calculating local yesterday revenue:", e);
        }

        let localTotalCash = 0;
        let localTotalTransfer = 0;
        currentTransactions.forEach(tx => {
          const method = String(tx.paymentMethod || '').toUpperCase();
          if (method === 'CASH' || method === 'TUNAI') {
            localTotalCash += tx.totalAmount || 0;
          } else {
            localTotalTransfer += tx.totalAmount || 0;
          }
        });

        const localMetricsObj = {
          totalRevenue: revenue,
          totalTransactions: transCount,
          totalCash: localTotalCash,
          totalTransfer: localTotalTransfer,
          averageTransactionValue: avg,
          categorySales: { Makanan: makSales, Minuman: minSales, Pasta: pasSales, Special: speSales },
          recentTransactions: currentTransactions.slice(0, 10),
          yesterdayRevenue: yesterdayRevenueObj
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
  
  const getBranchBreakdown = () => {
    if (!adminMetrics || !adminMetrics.recentTransactions) return [];
    
    // Group transactions by branch ID
    const grouped: { [key: string]: Transaction[] } = {};
    cabangList.forEach(c => {
      grouped[String(c.ID_CABANG)] = [];
    });
    
    adminMetrics.recentTransactions.forEach(tx => {
      const cbId = String(tx.cabang);
      if (!grouped[cbId]) {
        grouped[cbId] = [];
      }
      grouped[cbId].push(tx);
    });

    const breakdown = Object.keys(grouped).map(cbId => {
      const c = cabangList.find(cab => String(cab.ID_CABANG) === cbId);
      const txs = grouped[cbId];
      const revenue = txs.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);
      return {
        id: cbId,
        name: c ? c.NAMA_CABANG : `Cabang ${cbId}`,
        revenue,
        txsCount: txs.length,
        txs
      };
    }).filter(b => b.revenue > 0 || b.txsCount > 0);

    return breakdown;
  };

  const getRevenueGrowthStyles = () => {
    if (!adminMetrics) return { text: "0%", classes: "text-zinc-500 bg-zinc-50" };
    // totalRevenue can be local or remote, today is totalRevenue
    const yesterday = adminMetrics.yesterdayRevenue || 0;
    const today = totalRevenue;
    
    if (yesterday === 0) {
      return today > 0 
        ? { text: "+100%", classes: "text-emerald-600 bg-emerald-50" } 
        : { text: "0%", classes: "text-zinc-500 bg-zinc-50" };
    }
    
    const diffPct = Math.round(((today - yesterday) / yesterday) * 100);
    const text = diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`;
    const classes = diffPct >= 0 ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50";
    return { text, classes };
  };
  
  // Local logic configurations
  const currentDateStr = selectedAdminDate;
  const transactions = allTransactions.filter(tx => {
    if (currentBranchFilter !== 'Semua' && String(tx.cabang) !== String(currentBranchFilter)) {
      return false;
    }
    try {
      if (typeof tx.timestamp === 'string' && tx.timestamp.length >= 10 && tx.timestamp.includes('T')) {
        return tx.timestamp.substring(0, 10) === currentDateStr;
      }
      const d = new Date(tx.timestamp);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return dStr === currentDateStr;
    } catch {
      return false;
    }
  });

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

  const totalCashVal = isServerAdmin
    ? (adminMetrics!.totalCash || 0)
    : transactions.reduce((sum, tx) => {
        const method = String(tx.paymentMethod || '').toUpperCase();
        return (method === 'CASH' || method === 'TUNAI') ? sum + (tx.totalAmount || 0) : sum;
      }, 0);

  const totalTransferVal = isServerAdmin
    ? (adminMetrics!.totalTransfer || 0)
    : transactions.reduce((sum, tx) => {
        const method = String(tx.paymentMethod || '').toUpperCase();
        return (method !== 'CASH' && method !== 'TUNAI') ? sum + (tx.totalAmount || 0) : sum;
      }, 0);

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
                    max={getTodayLocalDateStr()}
                    onChange={(e) => {
                      if (e.target.value) {
                        const todayStr = getTodayLocalDateStr();
                        if (e.target.value > todayStr) {
                          alert("Pemberitahuan: Pemantau tidak dapat memilih tanggal di masa depan.");
                          setSelectedAdminDate(todayStr);
                        } else {
                          setSelectedAdminDate(e.target.value);
                        }
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
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${getRevenueGrowthStyles().classes}`}>
              {getRevenueGrowthStyles().text}
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
            {!loadingMetrics && (
              <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-1.5 py-0.5 rounded-md">
                Sinkron
              </span>
            )}
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

        {/* TOTAL CASH CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Banknote className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold">Total Cash</p>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
              {loadingMetrics ? (
                <span className="text-zinc-300 animate-pulse">Loading...</span>
              ) : (
                `Rp${totalCashVal.toLocaleString('id-ID')}`
              )}
            </h3>
          </div>
        </div>

        {/* TOTAL TRANSFER CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
              <CreditCard className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold">Total Transfer</p>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
              {loadingMetrics ? (
                <span className="text-zinc-300 animate-pulse">Loading...</span>
              ) : (
                `Rp${totalTransferVal.toLocaleString('id-ID')}`
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

      {/* FLOAT NOTIFICATION TOAST */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000000] animate-in slide-in-from-top-8 duration-500 w-full max-w-sm px-4">
          <div className="px-4 py-3 rounded-[24px] bg-zinc-950 text-white flex items-center justify-between gap-3 shadow-2xl border border-zinc-800/80 font-sans">
            <div className="flex items-center gap-3">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${toastType === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                {toastType === 'error' ? <X className="h-3.5 w-3.5 text-white" /> : <Check className="h-3.5 w-3.5 text-white" />}
              </div>
              <span className="text-[11px] font-bold text-zinc-100">{toastMessage}</span>
            </div>
            {toastType === 'success' && toastMessage === "Rekap Harian berhasil direkap!" && (
              <button 
                onClick={() => {
                  setToastMessage(null);
                  setShowLaporModal(true);
                }}
                className="bg-red-650 hover:bg-red-700 text-white text-[10px] uppercase tracking-wider font-extrabold px-3.5 py-1.5 rounded-full transition-all cursor-pointer select-none border border-red-500 active:scale-95"
              >
                Lapor
              </button>
            )}
          </div>
        </div>
      )}

      {/* CUSTOM LAPOR MODAL FOR ALL BRANCHES GABUNGAN */}
      {showLaporModal && typeof document !== 'undefined' && createPortal(
        <div style={{ zIndex: 999999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={() => setShowLaporModal(false)}>
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 font-sans">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                Laporan Semua Cabang
              </h3>
              <button 
                onClick={() => setShowLaporModal(false)}
                className="p-1.5 bg-white hover:bg-zinc-100 rounded-lg text-zinc-700 transition shadow-sm border border-zinc-200 cursor-pointer active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto bg-neutral-100 text-left space-y-4">
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-4 font-sans relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10"><Landmark className="w-20 h-20 text-emerald-500" /></div>
                <div className="relative z-10 space-y-4">
                  <p className="text-xs text-zinc-800 leading-relaxed font-black uppercase tracking-wider">
                    Laporan Omset Semua Cabang
                  </p>
                  
                  <div className="space-y-2 mt-2 bg-white/80 p-3 rounded-xl border border-emerald-150 backdrop-blur-sm text-left">
                    <p className="text-xs text-zinc-700 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-zinc-500" /> 
                      <span><b className="text-zinc-900 font-extrabold">Tanggal:</b> {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(selectedAdminDate))}</span>
                    </p>
                    <p className="text-xs text-zinc-700 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> 
                      <span><b className="text-zinc-900 font-extrabold">Total Omset Gabungan:</b> Rp{(adminMetrics?.totalRevenue || 0).toLocaleString('id-ID')}</span>
                    </p>
                    <p className="text-xs text-zinc-700 flex items-center gap-2 pl-[22px]">
                      <span><b className="text-zinc-900 font-bold">Total Cash:</b> Rp{(adminMetrics?.totalCash || 0).toLocaleString('id-ID')}</span>
                    </p>
                    <p className="text-xs text-zinc-700 flex items-center gap-2 pl-[22px]">
                      <span><b className="text-zinc-900 font-bold">Total Transfer:</b> Rp{(adminMetrics?.totalTransfer || 0).toLocaleString('id-ID')}</span>
                    </p>
                    <p className="text-xs text-zinc-700 flex items-center gap-2">
                      <ShoppingBag className="h-3.5 w-3.5 text-zinc-500" /> 
                      <span><b className="text-zinc-900 font-extrabold">Total Pesanan:</b> {adminMetrics?.totalTransactions || 0} Selesai</span>
                    </p>
                  </div>

                  {/* Per Branch Breakdown */}
                  <div className="space-y-2 bg-white p-3 rounded-xl border border-emerald-150 text-left">
                    <p className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Rincian Omset per Cabang</p>
                    <div className="space-y-1.5 pt-1">
                      {getBranchBreakdown().map(b => (
                        <div key={b.id} className="text-xs text-zinc-750 flex justify-between items-center border-b border-zinc-100 pb-1 last:border-0 last:pb-0">
                          <span className="font-semibold text-zinc-900">{b.name}</span>
                          <span className="font-black text-emerald-600">
                            Rp{b.revenue.toLocaleString('id-ID')}{' '}
                            <span className="text-[10px] text-zinc-400 font-normal">({b.txsCount} tx)</span>
                          </span>
                        </div>
                      ))}
                      {getBranchBreakdown().length === 0 && (
                        <p className="text-xs text-zinc-400 italic">Tidak ada rincian omset cabang</p>
                      )}
                    </div>
                  </div>

                  {/* Detailed Orders Grouped by Branch */}
                  <div className="space-y-3">
                    {getBranchBreakdown().map(b => (
                      <div key={b.id} className="bg-white p-3 rounded-xl border border-zinc-200 text-left space-y-2">
                        <p className="text-[11px] font-black text-zinc-850 uppercase tracking-tight">
                          Rincian Cabang {b.name}:
                        </p>
                        <div className="space-y-1.5 text-[10px] font-mono text-zinc-650">
                          {b.txs.map((tx, idx) => {
                            let formattedDate = "";
                            try {
                              const d = new Date(tx.timestamp);
                              formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                            } catch {
                              formattedDate = selectedAdminDate;
                            }
                            return (
                              <div key={tx.id} className="flex justify-between items-center pb-0.5 border-b border-dashed border-zinc-100 last:border-0 last:pb-0">
                                <span>{idx + 1}. [{formattedDate}] {tx.id}</span>
                                <span className="font-bold text-zinc-900 shrink-0">Rp{tx.totalAmount.toLocaleString('id-ID')}</span>
                              </div>
                            );
                          })}
                          {b.txs.length === 0 && (
                            <p className="text-zinc-400 italic">Tidak ada pesanan</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  const dNow = new Date(selectedAdminDate);
                  const hari = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(dNow);
                  const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
                  const tglText = `${dNow.getDate().toString().padStart(2, '0')} ${mN[dNow.getMonth()]} ${dNow.getFullYear()}`;
                  
                  const breakdown = getBranchBreakdown();
                  let breakdownText = "";
                  let rincianPesananText = "";

                  breakdown.forEach(b => {
                    breakdownText += `- *${b.name}:* Rp${b.revenue.toLocaleString('id-ID')} (${b.txsCount} transaksi)\n`;
                    rincianPesananText += `\n*Rincian Cabang ${b.name}:*\n`;
                    b.txs.forEach((tx, idx) => {
                      let formattedDate = "";
                      try {
                        const d = new Date(tx.timestamp);
                        formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                      } catch {
                        formattedDate = selectedAdminDate;
                      }
                      rincianPesananText += `${idx + 1}. [${formattedDate}] ${tx.id}: Rp${tx.totalAmount.toLocaleString('id-ID')}\n`;
                    });
                  });
                  
                  const txt = `Halo, berikut adalah *Laporan Omset Semua Cabang (Gabungan)*:\n\n` +
                    `*Tanggal:* ${hari}, ${tglText}\n` +
                    `*Total Omset Gabungan:* Rp${(adminMetrics?.totalRevenue || 0).toLocaleString('id-ID')}\n` +
                    `*Total Cash:* Rp${(adminMetrics?.totalCash || 0).toLocaleString('id-ID')}\n` +
                    `*Total Transfer:* Rp${(adminMetrics?.totalTransfer || 0).toLocaleString('id-ID')}\n` +
                    `*Total Pesanan Gabungan:* ${(adminMetrics?.totalTransactions || 0)} Selesai\n` +
                    `*Rerata Penjualan:* Rp${(adminMetrics?.averageTransactionValue || 0).toLocaleString('id-ID')}\n\n` +
                    `*Rincian Omset per Cabang:*\n` +
                    breakdownText +
                    rincianPesananText + `\n` +
                    `Terima kasih!`;

                  navigator.clipboard.writeText(txt);
                  setToastType('success');
                  setToastMessage("Berhasil disalin ke papan klip!");
                  setShowLaporModal(false);
                }}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-extrabold text-[10px] py-3 rounded-xl transition flex flex-col items-center justify-center gap-1 active:scale-95 uppercase tracking-wider cursor-pointer border border-zinc-200"
              >
                <Copy className="h-3.5 w-3.5 text-zinc-600" />
                <span>Salin</span>
              </button>
              <button 
                onClick={() => {
                  const dNow = new Date(selectedAdminDate);
                  const hari = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(dNow);
                  const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
                  const tglText = `${dNow.getDate().toString().padStart(2, '0')} ${mN[dNow.getMonth()]} ${dNow.getFullYear()}`;
                  
                  const breakdown = getBranchBreakdown();
                  let breakdownText = "";
                  let rincianPesananText = "";

                  breakdown.forEach(b => {
                    breakdownText += `- *${b.name}:* Rp${b.revenue.toLocaleString('id-ID')} (${b.txsCount} transaksi)\n`;
                    rincianPesananText += `\n*Rincian Cabang ${b.name}:*\n`;
                    b.txs.forEach((tx, idx) => {
                      let formattedDate = "";
                      try {
                        const d = new Date(tx.timestamp);
                        formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                      } catch {
                        formattedDate = selectedAdminDate;
                      }
                      rincianPesananText += `${idx + 1}. [${formattedDate}] ${tx.id}: Rp${tx.totalAmount.toLocaleString('id-ID')}\n`;
                    });
                  });
                  
                  const txtUrl = `Halo, berikut adalah *Laporan Omset Semua Cabang (Gabungan)*:\n\n` +
                    `*Tanggal:* ${hari}, ${tglText}\n` +
                    `*Total Omset Gabungan:* Rp${(adminMetrics?.totalRevenue || 0).toLocaleString('id-ID')}\n` +
                    `*Total Cash:* Rp${(adminMetrics?.totalCash || 0).toLocaleString('id-ID')}\n` +
                    `*Total Transfer:* Rp${(adminMetrics?.totalTransfer || 0).toLocaleString('id-ID')}\n` +
                    `*Total Pesanan Gabungan:* ${(adminMetrics?.totalTransactions || 0)} Selesai\n` +
                    `*Rerata Penjualan:* Rp${(adminMetrics?.averageTransactionValue || 0).toLocaleString('id-ID')}\n\n` +
                    `*Rincian Omset per Cabang:*\n` +
                    breakdownText +
                    rincianPesananText + `\n` +
                    `Terima kasih!`;

                  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(txtUrl)}`;
                  window.open(url, '_blank');
                  setToastType('success');
                  setToastMessage("Berhasil dibagikan ke WhatsApp!");
                  setShowLaporModal(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] py-3 rounded-xl transition flex flex-col items-center justify-center gap-1 active:scale-95 uppercase tracking-wider cursor-pointer shadow-sm"
              >
                <Share2 className="h-3.5 w-3.5 text-white" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
