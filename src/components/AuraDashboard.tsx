import confetti from 'canvas-confetti';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Transaction } from '../types';
import { getTransactions, getSyncQueue, getTransactionsFromGAS, getAdminDashboardMetrics, triggerGASSyncRekapHarian } from '../utils/db';
import { TrendingUp, ShoppingBag, Landmark, Clock, Database, ChevronRight, ChevronDown, Activity, AlertCircle, Sparkles, Filter, X, Search, ArrowLeft, Utensils, Trash2, ReceiptText, RefreshCw, LayoutDashboard, Calendar, Check, Share2, Copy, FileDown, Banknote, CreditCard, Gift, FileText } from 'lucide-react';
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
  initialTransactions?: Transaction[];
}

export default function AuraDashboard({ 
  onNavigateToPOS, 
  onNavigateToAdmin, 
  onNavigateToHistory, 
  activeBranch, 
  onSelectTransaction, 
  cabangList,
  initialTransactions = []
}: AuraDashboardProps) {
  const session = getSessionCache();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>(initialTransactions);
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

  // Robust date parsing helper that correctly handles DD/MM/YYYY or YYYY-MM-DD formats
  const checkTxDateMatch = (txDateRaw: any, targetDateStr: string) => {
    if (!txDateRaw) return false;
    try {
      let parsedDateStr = '';
      if (typeof txDateRaw === 'string') {
        if (txDateRaw.includes('T')) {
          parsedDateStr = txDateRaw.substring(0, 10);
        } else {
          const p = txDateRaw.split(' ')[0].split(/[\/\-]/);
          if (p.length === 3) {
            if (p[2].length === 4) {
              parsedDateStr = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            } else if (p[0].length === 4) {
              parsedDateStr = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
            }
          }
          if (!parsedDateStr) {
            const d = new Date(txDateRaw);
            if (!isNaN(d.getTime())) {
              parsedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
          }
        }
      } else if (txDateRaw instanceof Date || (typeof txDateRaw === 'number' && !isNaN(txDateRaw))) {
        const d = new Date(txDateRaw);
        parsedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      return parsedDateStr === targetDateStr;
    } catch {
      return false;
    }
  };

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
  
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(() => {
    const initialBranch = activeBranch === 'ADMIN' ? selectedAdminBranch : activeBranch;
    const initialDate = session.filters.dashboard?.selectedAdminDate || localStorage.getItem('AURA_DASHBOARD_FILTER_DATE') || getTodayLocalDateStr();
    const cacheKey = `cached_dashboard_metrics_${initialBranch}_${initialDate}`;
    
    if (session.dashboard.data) return false;
    try {
      const cached = localStorage.getItem(cacheKey);
      return !cached;
    } catch {
      return true;
    }
  });
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
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showConfirmRekap) {
        setShowConfirmRekap(false);
        if (customEvt.detail) customEvt.detail.handled = true;
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
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
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

    // For non-admin (cashiers), we ALWAYS want to refresh allTransactions from local DB to support date filtering
    // and ensuring "Riwayat Transaksi Terakhir" works correctly.
    if (activeBranch !== 'ADMIN') {
      try {
        const txsLocal = await getTransactions();
        setAllTransactions(txsLocal);
      } catch (err) {}
    }

    const cached = localStorage.getItem(cacheKey);
    if (!forceRemote && session.dashboard.lastParams === currentParamsKey && (session.dashboard.data || cached)) {
      if (session.dashboard.data) {
         setAdminMetrics(session.dashboard.data);
      } else if (cached) {
         try { setAdminMetrics(JSON.parse(cached)); } catch(e){}
      }
      try {
        const queue = await getSyncQueue();
        setAllQueue(queue);
      } catch (queueErr) {}
      return;
    }

    if (!forceRemote && cached) {
      try {
        setAdminMetrics(JSON.parse(cached));
      } catch (e) {}
    }

    // Reset metrics before fetching to ensure we don't show stale/monthly data
    setAdminMetrics(null);
    setLoadingMetrics(true);
    setMetricsError(null);
    
    lastFetchParamsRef.current = currentParamsKey;

    if (activeBranch === 'ADMIN') {
      try {
        const apiBranchId = selectedAdminBranch === 'Semua' ? 'All' : selectedAdminBranch;
        const metrics = await getAdminDashboardMetrics(apiBranchId, selectedAdminDate);
        
        // Final double check: only set if the params haven't changed while fetching
        if (lastFetchParamsRef.current === currentParamsKey) {
          setAdminMetrics(metrics);
          
          // Populate allTransactions with the daily data from server
          if (metrics.recentTransactions) {
            setAllTransactions(metrics.recentTransactions);
          }
          
          localStorage.setItem(cacheKey, JSON.stringify(metrics));
          setSessionDashboard(currentParamsKey, metrics);
        }
      } catch (err: any) {
        console.error("Gagal memuat metrik dashboard admin dari GAS, menghitung metrik lokal:", err);
        try {
          const txsLocal = await getTransactions();
          const currentDateStr = selectedAdminDate;
          const currentTransactions = txsLocal.filter(tx => {
            const apiBranchId = selectedAdminBranch === 'Semua' ? 'All' : selectedAdminBranch;
            if (apiBranchId !== 'All' && String(tx.cabang) !== String(apiBranchId)) {
              return false;
            }
            try {
              return checkTxDateMatch(tx.timestamp, currentDateStr);
            } catch {
              return false;
            }
          });

          const revenue = currentTransactions.reduce((sum, tx) => {
            const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
            if (isCompliment) return sum;
            return sum + (tx.totalAmount || 0);
          }, 0);
          const transCount = currentTransactions.length;
          const avg = transCount > 0 ? Math.round(revenue / transCount) : 0;
          
          let makSales = 0, minSales = 0, pasSales = 0, speSales = 0;
          currentTransactions.forEach(tx => {
            tx.detail?.forEach(item => {
              const nm = String(item.NAMA_MENU || '').toLowerCase();
              if (nm.includes('pasta') || nm.includes('spaghetti') || nm.includes('macaroni')) {
                pasSales += item.QTY || 1;
              } else if (nm.includes('special') || nm.includes("aura's") || nm.includes('auras')) {
                speSales += item.QTY || 1;
              } else if (nm.includes('es ') || nm.includes('kopi') || nm.includes('mojito') || nm.includes('air') || nm.includes('teh') || nm.includes('yakult') || nm.includes('matcha') || nm.includes('squash') || nm.includes('chocolate')) {
                minSales += item.QTY || 1;
              } else {
                makSales += item.QTY || 1;
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
            
            const yesterdayTransactions = txsLocal.filter(tx => {
              const apiBranchId = selectedAdminBranch === 'Semua' ? 'All' : selectedAdminBranch;
              if (apiBranchId !== 'All' && String(tx.cabang) !== String(apiBranchId)) {
                return false;
              }
              try {
                return checkTxDateMatch(tx.timestamp, yesterdayDateStr);
              } catch { return false; }
            });
            yesterdayRevenueObj = yesterdayTransactions.reduce((sum, tx) => {
              const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
              if (isCompliment) return sum;
              return sum + (tx.totalAmount || 0);
            }, 0);
          } catch (e) {}

          let localTotalCash = 0;
          let localTotalTransfer = 0;
          currentTransactions.forEach(tx => {
            const isCompliment = String(tx.pesanan?.JENIS_PESANAN || '').toUpperCase() === 'COMPLIMENT';
            if (isCompliment) return;
            
            const method = String(tx.paymentMethod || '').toUpperCase();
            if (method === 'CASH' || method === 'TUNAI') {
              localTotalCash += tx.totalAmount || 0;
            } else {
              localTotalTransfer += tx.totalAmount || 0;
            }
          });

          const fallbackMetrics = {
            totalRevenue: revenue,
            totalTransactions: transCount,
            totalCash: localTotalCash,
            totalTransfer: localTotalTransfer,
            averageTransactionValue: avg,
            categorySales: { Makanan: makSales, Minuman: minSales, Pasta: pasSales, Special: speSales },
            recentTransactions: currentTransactions.slice(0, 10),
            yesterdayRevenue: yesterdayRevenueObj
          };

          if (lastFetchParamsRef.current === currentParamsKey) {
            setAdminMetrics(fallbackMetrics);
            setAllTransactions(currentTransactions);
          }
        } catch (localErr) {
          setMetricsError("Gagal memuat metrik admin dari GAS dan perhitungan lokal gagal.");
        }
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
            return checkTxDateMatch(tx.timestamp, currentDateStr);
          } catch {
            return false;
          }
        });

        const revenue = currentTransactions.reduce((sum, tx) => {
          const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
          if (isCompliment) return sum;
          return sum + (tx.totalAmount || 0);
        }, 0);
        const transCount = currentTransactions.length;
        const avg = transCount > 0 ? Math.round(revenue / transCount) : 0;
        
        let makSales = 0, minSales = 0, pasSales = 0, speSales = 0;
        currentTransactions.forEach(tx => {
          tx.detail?.forEach(item => {
            const nm = String(item.NAMA_MENU || '').toLowerCase();
            if (nm.includes('pasta') || nm.includes('spaghetti') || nm.includes('macaroni')) {
              pasSales += item.QTY || 1;
            } else if (nm.includes('special') || nm.includes("aura's") || nm.includes('auras')) {
              speSales += item.QTY || 1;
            } else if (nm.includes('es ') || nm.includes('kopi') || nm.includes('mojito') || nm.includes('air') || nm.includes('teh') || nm.includes('yakult') || nm.includes('matcha') || nm.includes('squash') || nm.includes('chocolate')) {
              minSales += item.QTY || 1;
            } else {
              makSales += item.QTY || 1;
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
            ? unique.filter(tx => checkTxDateMatch(tx.timestamp, yesterdayDateStr))
            : unique.filter(tx => String(tx.cabang) === String(currentBranch) && checkTxDateMatch(tx.timestamp, yesterdayDateStr));
          yesterdayRevenueObj = yesterdayTransactions.reduce((sum, tx) => {
            const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
            if (isCompliment) return sum;
            return sum + (tx.totalAmount || 0);
          }, 0);
        } catch (e) {
          console.error("Error calculating local yesterday revenue:", e);
        }

        let localTotalCash = 0;
        let localTotalTransfer = 0;
        currentTransactions.forEach(tx => {
          const isCompliment = String(tx.pesanan?.JENIS_PESANAN || '').toUpperCase() === 'COMPLIMENT';
          if (isCompliment) return;
          
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
    // But ONLY if the cache corresponds to the CURRENT filters
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAdminMetrics(parsed);
      } catch (e) {
        console.error(e);
        setAdminMetrics(null);
      }
    } else {
      setAdminMetrics(null);
    }
    
    // Then ALWAYS fetch fresh stats in the background
    loadStats(false);
    
  }, [activeBranch, selectedAdminBranch, selectedAdminDate]);

  const currentBranchFilter = activeBranch === 'ADMIN' ? selectedAdminBranch : activeBranch;
  
  const isServerAdmin = activeBranch === 'ADMIN' && adminMetrics !== null;

  // Local logic configurations
  const currentDateStr = selectedAdminDate;

  // Recalculate Admin Stats locally to ensure strictly daily data
  let adminFilteredTxs: Transaction[] = [];
  
  if (isServerAdmin && adminMetrics?.recentTransactions) {
    adminFilteredTxs = adminMetrics.recentTransactions.filter(tx => {
      // Cabang Filter
      if (currentBranchFilter !== 'Semua' && String(tx.cabang) !== String(currentBranchFilter)) return false;
      return true;
    });
  }
  
  const getBranchBreakdown = () => {
    if (!adminFilteredTxs || adminFilteredTxs.length === 0) return [];
    
    // Group transactions by branch ID
    const grouped: { [key: string]: Transaction[] } = {};
    cabangList.forEach(c => {
      grouped[String(c.ID_CABANG)] = [];
    });
    
    adminFilteredTxs.forEach(tx => {
      const cbId = String(tx.cabang);
      if (!grouped[cbId]) {
        grouped[cbId] = [];
      }
      grouped[cbId].push(tx);
    });

    const breakdown = Object.keys(grouped).map(cbId => {
      const c = cabangList.find(cab => String(cab.ID_CABANG) === cbId);
      const txs = grouped[cbId];
      const revenue = txs.reduce((sum, tx) => {
        const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
        return isCompliment ? sum : sum + (tx.totalAmount || 0);
      }, 0);
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

  
  const transactions = allTransactions.filter(tx => {
    // 1. Cabang Filter
    if (currentBranchFilter !== 'Semua' && String(tx.cabang) !== String(currentBranchFilter)) {
      return false;
    }
    
    // 2. Date Filter
    if (!tx.timestamp) return false;
    return checkTxDateMatch(tx.timestamp, currentDateStr);
  });

  const queueCount = currentBranchFilter === 'Semua'
    ? allQueue.length
    : allQueue.filter(item => item.payload?.cabang === currentBranchFilter).length;

  // Decide source of metric values (whether to read from server-side adminMetrics or local calculated variables)

  const totalRevenue = isServerAdmin 
    ? (adminMetrics?.totalRevenue || 0)
    : transactions.reduce((sum, tx) => {
        const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
        return isCompliment ? sum : sum + (tx.totalAmount || 0);
      }, 0);

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

  const totalTransactionsCount = isServerAdmin
    ? (adminMetrics?.totalTransactions || 0)
    : transactions.reduce((sum, tx) => {
        const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
        return isCompliment ? sum : sum + 1;
      }, 0);

  const totalCashVal = isServerAdmin
    ? (adminMetrics?.totalCash || 0)
    : transactions.reduce((sum, tx) => {
        const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
        if (isCompliment) return sum;
        const method = String(tx.paymentMethod || '').toUpperCase();
        return (method === 'CASH' || method === 'TUNAI') ? sum + (tx.totalAmount || 0) : sum;
      }, 0);

  const totalTransferVal = isServerAdmin
    ? (adminMetrics?.totalTransfer || 0)
    : transactions.reduce((sum, tx) => {
        const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
        if (isCompliment) return sum;
        const method = String(tx.paymentMethod || '').toUpperCase();
        return (method !== 'CASH' && method !== 'TUNAI') ? sum + (tx.totalAmount || 0) : sum;
      }, 0);

  const avgTx = isServerAdmin
    ? (adminMetrics?.averageTransactionValue || 0)
    : (transactions.length > 0 ? Math.round(totalRevenue / transactions.length) : 0);

  // Recalculate categories
  let mak = 0;
  let min = 0;
  let pas = 0;
  let spe = 0;

  if (isServerAdmin && adminMetrics) {
    mak = adminMetrics.categorySales.Makanan || 0;
    min = adminMetrics.categorySales.Minuman || 0;
    pas = adminMetrics.categorySales.Pasta || 0;
    spe = adminMetrics.categorySales.Special || 0;
  } else {
    transactions.forEach(tx => {
      tx.detail?.forEach(item => {
        const nm = String(item.NAMA_MENU || '').toLowerCase();
        if (nm.includes('pasta') || nm.includes('spaghetti') || nm.includes('macaroni')) {
          pas += item.QTY || 1;
        } else if (nm.includes('special') || nm.includes("aura's") || nm.includes('auras')) {
          spe += item.QTY || 1;
        } else if (nm.includes('es ') || nm.includes('kopi') || nm.includes('mojito') || nm.includes('air') || nm.includes('teh') || nm.includes('yakult') || nm.includes('matcha') || nm.includes('squash') || nm.includes('chocolate')) {
          min += item.QTY || 1;
        } else {
          mak += item.QTY || 1;
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
    ? adminFilteredTxs 
    : transactions;

  // Recount total menu items sold
  let totalItemsSold = 0;
  if (isServerAdmin) {
    totalItemsSold = mak + min + pas + spe;
  } else {
    totalItemsSold = transactions.reduce((sum, tx) => sum + (tx.detail?.reduce((s, item) => s + item.QTY, 0) || 0), 0);
  }

  const getLaporanText = () => {
    const dNow = new Date(selectedAdminDate);
    const hari = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(dNow);
    const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const tglText = `${dNow.getDate().toString().padStart(2, '0')} ${mN[dNow.getMonth()]} ${dNow.getFullYear()}`;
    
    let breakdownText = "";
    let rincianPesananText = "";
    
    const currentBranch = activeBranch === 'ADMIN' ? selectedAdminBranch : activeBranch;
    const cName = currentBranch === 'Semua' ? 'Semua Cabang (Gabungan)' : (cabangList.find(c => String(c.ID_CABANG) === currentBranch)?.NAMA_CABANG || currentBranch);
    
    let currentTotalRevenue = isServerAdmin ? (adminMetrics?.totalRevenue || 0) : (totalRevenue || 0);
    let currentTotalCash = isServerAdmin ? (adminMetrics?.totalCash || 0) : (totalCashVal || 0);
    let currentTotalTransfer = isServerAdmin ? (adminMetrics?.totalTransfer || 0) : (totalTransferVal || 0);
    
    if (currentBranch === 'Semua' && activeBranch === 'ADMIN') {
      const breakdown = getBranchBreakdown();
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
          const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
          const complimentText = isCompliment ? ' (Compliment)' : '';
          const catatanText = tx.pesanan?.CATATAN ? ` [Ket: ${tx.pesanan.CATATAN}]` : '';
          rincianPesananText += `${idx + 1}. [${formattedDate}] ${tx.id}: Rp${tx.totalAmount.toLocaleString('id-ID')}${complimentText}${catatanText}\n`;
        });
      });
      breakdownText = `*Rincian Omset per Cabang:*\n` + breakdownText;
    } else {
      rincianPesananText += `\n*Rincian Transaksi:*\n`;
      recentTxList.forEach((tx, idx) => {
        let formattedDate = "";
        try {
          const d = new Date(tx.timestamp);
          formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        } catch {
          formattedDate = selectedAdminDate;
        }
        const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
        const complimentText = isCompliment ? ' (Compliment)' : '';
        const catatanText = tx.pesanan?.CATATAN ? ` [Ket: ${tx.pesanan.CATATAN}]` : '';
        rincianPesananText += `${idx + 1}. [${formattedDate}] ${tx.id}: Rp${tx.totalAmount.toLocaleString('id-ID')}${complimentText}${catatanText}\n`;
      });
    }

    return `Halo, berikut adalah *Laporan Omset ${cName}*:\n\n` +
      `*Tanggal:* ${hari}, ${tglText}\n\n` +
      `*Total Omset:* Rp${(currentTotalRevenue || 0).toLocaleString('id-ID')}\n` +
      `  ├ *Total Cash:* Rp${(currentTotalCash || 0).toLocaleString('id-ID')}\n` +
      `  └ *Total Transfer:* Rp${(currentTotalTransfer || 0).toLocaleString('id-ID')}\n\n` +
      `*Total Pesanan:* ${(recentTxList.length || 0)} Selesai\n\n` +
      breakdownText +
      rincianPesananText + `\n` +
      `Terima kasih!`;
  };

  // Define whether we should show the full-screen spinner
  // For cashier, show it when loadingMetrics is true but only if we don't have local data yet (first load)
  // The user requested: "Di admin biarkan tanpa loading spinner itu, tapi di kasir tambahkan loading spinner saat pertama kali login itu"
  const isFirstCashierLoad = activeBranch !== 'ADMIN' && allTransactions.length === 0;
  const shouldShowSpinner = loadingMetrics && isFirstCashierLoad;

  if (shouldShowSpinner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-500">
        <div className="relative">
          <div className="h-16 w-16 border-4 border-zinc-100 border-t-red-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <LayoutDashboard className="h-6 w-6 text-red-600/50" />
          </div>
        </div>
        <div className="text-center space-y-2 px-6">
          <h3 className="text-zinc-900 font-black uppercase tracking-widest text-sm">Menyiapkan Dashboard</h3>
          <p className="text-zinc-500 text-xs font-medium max-w-[240px] mx-auto leading-relaxed">
            Menyinkronkan data transaksi dan statistik operasional terbaru Anda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`space-y-6 animate-fade-in pb-24 relative ${loadingMetrics ? 'opacity-70 pointer-events-none transition-opacity duration-300' : ''}`}
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

      <div className="bg-white border border-zinc-200/80 px-4 py-3 sm:p-5 rounded-[24px] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm text-left relative overflow-hidden">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center justify-center">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse" />
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <h4 className="text-[10px] sm:text-xs font-bold text-zinc-900 uppercase tracking-widest">{activeBranch === 'ADMIN' ? 'Pemantau Multi-Cabang' : 'Dashboard Cabang'}</h4>
              {activeBranch === 'ADMIN' && (
                <>
                  <button
                    onClick={() => setShowConfirmRekap(true)}
                    disabled={isTriggeringRekap || loadingMetrics}
                    className={`flex-none uppercase text-[8px] sm:text-[9px] font-extrabold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg transition whitespace-nowrap flex items-center justify-center gap-1.5 ${isTriggeringRekap || loadingMetrics ? 'opacity-50 cursor-not-allowed bg-zinc-100 text-zinc-400 border-zinc-200' : 'cursor-pointer active:scale-95 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'}`}
                  >
                    <Database className={`h-3 w-3 ${isTriggeringRekap ? 'animate-spin' : ''}`} />
                    {isTriggeringRekap ? 'Memproses...' : 'Rekap Harian'}
                  </button>
                  <button
                    onClick={() => setShowLaporModal(true)}
                    disabled={loadingMetrics}
                    className={`flex-none uppercase text-[8px] sm:text-[9px] font-extrabold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg transition whitespace-nowrap flex items-center justify-center gap-1.5 ${loadingMetrics ? 'opacity-50 cursor-not-allowed bg-zinc-100 text-zinc-400 border-zinc-200' : 'cursor-pointer active:scale-95 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
                  >
                    <FileText className="h-3 w-3" />
                    Lapor
                  </button>
                </>
              )}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className={`relative flex items-center gap-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-350 hover:bg-zinc-100 transition-all rounded-xl px-3 py-1.5 overflow-hidden ${loadingMetrics ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-97'}`}>
                <Calendar className="h-3.5 w-3.5 text-red-650 shrink-0" />
                <span className="font-extrabold text-zinc-805 tracking-tight group-hover:text-red-750 transition-colors">
                  {formatIndonesianDate(selectedAdminDate)}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-450 shrink-0 ml-0.5" />
                <input 
                  type="date"
                  disabled={loadingMetrics}
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
                  className={`absolute inset-0 opacity-0 w-full h-full ${loadingMetrics ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                />
              </div>
            </div>
          </div>
        </div>
        {activeBranch === 'ADMIN' && (
          <div className={`flex gap-2 self-stretch sm:self-auto shrink-0 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide w-full sm:w-auto ${loadingMetrics ? 'opacity-60 pointer-events-none' : ''}`}>
            <button
              onClick={() => setSelectedAdminBranch('Semua')}
              disabled={loadingMetrics}
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
                disabled={loadingMetrics}
                className={`flex-none uppercase text-[9px] font-extrabold px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg transition whitespace-nowrap cursor-pointer active:scale-95 ${
                  selectedAdminBranch === String(c.ID_CABANG)
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                {c.NAMA_CABANG}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* METRICS BENTO GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* REVENUE CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
              <Landmark className="h-5 w-5" />
            </span>
            {!loadingMetrics && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${getRevenueGrowthStyles().classes}`}>
                {getRevenueGrowthStyles().text}
              </span>
            )}
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
                <p>Pelanggan paling gemar membeli jenis <strong>Makanan</strong> hari ini.</p>
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onSelectTransaction) onSelectTransaction(tx);
                  }}
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 transition group hover:bg-zinc-50 cursor-pointer active:scale-95 touch-manipulation"
                >
                  <div className="flex items-center gap-3 truncate">
                    {tx.pesanan?.JENIS_PESANAN === 'Compliment' ? (
                      <Gift className="h-5 w-5 text-amber-500 fill-amber-100 shrink-0 p-0.5" />
                    ) : (
                      <ReceiptText className="h-5 w-5 text-zinc-400 shrink-0 p-0.5" />
                    )}
                    <div className="truncate text-left">
                      <p className="text-xs font-bold text-zinc-950 truncate group-hover:text-red-800 transition">{tx.id}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1 flex-wrap">
                        <span>
                          {tx.timestamp ? (
                            isNaN(new Date(tx.timestamp).getTime())
                              ? String(tx.timestamp)
                              : new Date(tx.timestamp).toLocaleString('id-ID')
                          ) : 'Beberapa saat yang lalu'}
                        </span>
                        <span>&bull;</span>
                        <span className="uppercase text-[9px] font-bold text-zinc-500">{tx.paymentMethod || (tx.pesanan?.JENIS_PESANAN === 'Compliment' ? 'Compliment' : '')}</span>
                        <span>&bull;</span>
                        <span className="font-extrabold text-[9px] text-red-750 bg-red-50/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {cabangList.find(c => String(c.ID_CABANG) === String(tx.cabang))?.NAMA_CABANG || `Cabang ${tx.cabang}`}
                        </span>
                      </p>
                      {tx.pesanan?.CATATAN && (
                        <p className="text-[9px] text-zinc-500 italic mt-1 line-clamp-1 border-l-2 border-zinc-200 pl-2">
                          "{tx.pesanan.CATATAN}"
                        </p>
                      )}
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
                {currentBranchFilter === 'Semua' ? 'Laporan Semua Cabang' : `Laporan Omset ${cabangList.find(c => String(c.ID_CABANG) === currentBranchFilter)?.NAMA_CABANG || currentBranchFilter}`}
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
                    {currentBranchFilter === 'Semua' ? 'Laporan Omset Semua Cabang' : `Laporan Omset Cabang ${cabangList.find(c => String(c.ID_CABANG) === currentBranchFilter)?.NAMA_CABANG || currentBranchFilter}`}
                  </p>
                  
                  <div className="space-y-2 mt-2 bg-white/80 p-3 rounded-xl border border-emerald-150 backdrop-blur-sm text-left">
                    <p className="text-xs text-zinc-700 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-zinc-500" /> 
                      <span><b className="text-zinc-900 font-extrabold">Tanggal:</b> {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(selectedAdminDate))}</span>
                    </p>
                    <p className="text-xs text-zinc-700 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> 
                      <span><b className="text-zinc-900 font-extrabold">{currentBranchFilter === 'Semua' ? 'Total Omset Gabungan:' : 'Total Omset:'}</b> Rp{(totalRevenue || 0).toLocaleString('id-ID')}</span>
                    </p>
                    <p className="text-xs text-zinc-700 flex items-center gap-2 pl-[22px]">
                      <span><b className="text-zinc-900 font-bold">Total Cash:</b> Rp{(totalCashVal || 0).toLocaleString('id-ID')}</span>
                    </p>
                    <p className="text-xs text-zinc-700 flex items-center gap-2 pl-[22px]">
                      <span><b className="text-zinc-900 font-bold">Total Transfer:</b> Rp{(totalTransferVal || 0).toLocaleString('id-ID')}</span>
                    </p>
                    <p className="text-xs text-zinc-700 flex items-center gap-2">
                      <ShoppingBag className="h-3.5 w-3.5 text-zinc-500" /> 
                      <span><b className="text-zinc-900 font-extrabold">Total Pesanan:</b> {totalTransactionsCount || 0} Selesai</span>
                    </p>
                  </div>

                  {currentBranchFilter === 'Semua' && (
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
                  )}

                  {currentBranchFilter === 'Semua' ? (
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
                              const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
                              return (
                                <div key={tx.id} className="flex flex-col pb-0.5 border-b border-dashed border-zinc-100 last:border-0 last:pb-0">
                                  <div className="flex justify-between items-center">
                                    <span>{idx + 1}. [{formattedDate}] {tx.id}</span>
                                    <span className="font-bold text-zinc-900 shrink-0">Rp{tx.totalAmount.toLocaleString('id-ID')}{isCompliment ? ' (Compliment)' : ''}</span>
                                  </div>
                                  {tx.pesanan?.CATATAN && (
                                    <div className="text-[8px] text-zinc-400 italic pl-4 mb-0.5">
                                      Catatan: {tx.pesanan.CATATAN}
                                    </div>
                                  )}
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
                  ) : (
                    <div className="bg-white p-3 rounded-xl border border-zinc-200 text-left space-y-2">
                      <p className="text-[11px] font-black text-zinc-850 uppercase tracking-tight">
                        Rincian Transaksi:
                      </p>
                      <div className="space-y-1.5 text-[10px] font-mono text-zinc-650">
                        {recentTxList.map((tx, idx) => {
                          let formattedDate = "";
                          try {
                            const d = new Date(tx.timestamp);
                            formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                          } catch {
                            formattedDate = selectedAdminDate;
                          }
                          const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
                          return (
                            <div key={tx.id} className="flex flex-col pb-0.5 border-b border-dashed border-zinc-100 last:border-0 last:pb-0">
                              <div className="flex justify-between items-center">
                                <span>{idx + 1}. [{formattedDate}] {tx.id}</span>
                                <span className="font-bold text-zinc-900 shrink-0">Rp{tx.totalAmount.toLocaleString('id-ID')}{isCompliment ? ' (Compliment)' : ''}</span>
                              </div>
                              {tx.pesanan?.CATATAN && (
                                <div className="text-[8px] text-zinc-400 italic pl-4 mb-0.5">
                                  Catatan: {tx.pesanan.CATATAN}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {recentTxList.length === 0 && (
                          <p className="text-zinc-400 italic">Tidak ada pesanan</p>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] font-black uppercase text-zinc-500 mb-2 pl-1 mt-4 border-t border-emerald-100/50 pt-3">Pratinjau Salinan (WhatsApp):</p>
                  <div className="bg-white border border-zinc-200/60 p-4 rounded-xl relative max-h-[200px] overflow-y-auto font-mono text-[9px] text-zinc-600 leading-relaxed whitespace-pre-wrap shadow-inner">
                    {getLaporanText()}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(getLaporanText());
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
                  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(getLaporanText())}`;
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
