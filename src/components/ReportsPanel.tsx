import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart, 
  PieChart, 
  Calendar, 
  Building, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Banknote, 
  AlertCircle, 
  Search,
  Filter,
  FileText,
  Server,
  TrendingUp,
  TrendingDown,
  Layers,
  Wallet,
  Share2,
  Copy,
  MessageCircle,
  FileDown,
  RefreshCw,
  BookOpen,
  ReceiptText,
  X,
  Info,
  Check,
  CreditCard
} from 'lucide-react';
import { Cabang, Transaction } from '../types';
import { getTransactions, getTransactionsFromGAS, getAdminReportsData } from '../utils/db';
import { getSessionCache, setSessionReports, setSessionFilters } from '../utils/sessionCache';

interface ReportsPanelProps {
  cabangList: Cabang[];
  activeBranch?: string;
}

type ReportPeriod = 'HARIAN' | 'BULANAN' | 'KUARTAL' | 'SEMESTER' | 'TAHUNAN';
type ReportType = 'GABUNGAN' | 'PEMASUKAN' | 'PENGELUARAN' | 'LABARUGI';

// Helper function to robustly parse transaction dates from GAS / Sheets row format
function parseTransactionDate(tglStr: string): Date | null {
  if (!tglStr) return null;
  if (!isNaN(Number(tglStr))) {
    return new Date(Number(tglStr));
  }
  
  const standardDate = new Date(tglStr);
  if (!isNaN(standardDate.getTime()) && (tglStr.includes('T') || tglStr.match(/^\d{4}-\d{2}-\d{2}$/))) {
    return standardDate;
  }
  
  // Try D/M/Y or Y/M/D explicit splitting FIRST before fallback
  const parts = tglStr.split(/[/\-.\s,]+/); 
  // If it's a date like 07/06/2026 or 07/06/2026 14:00
  if (parts.length >= 3) {
    if (parts[2].length >= 4) { // DD/MM/YYYY
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2].substring(0, 4), 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    } else if (parts[0].length >= 4) { // YYYY/MM/DD
      const year = parseInt(parts[0].substring(0, 4), 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Fallback to native parsing
  const dateObj = new Date(tglStr);
  if (!isNaN(dateObj.getTime())) {
    return dateObj;
  }
  return null;
}

function formatDateToDMY(date: Date | null, fallback: string): string {
  if (!date || isNaN(date.getTime())) {
    if (fallback && typeof fallback === 'string') {
      return fallback.replace(/T.*/, '').split('-').reverse().join('/');
    }
    return fallback;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

interface MenuAgg {
  namaMenu: string;
  totalQty: number;
  variants: { [namaVarian: string]: number };
}

function getMenuAggregates(txs: Transaction[]): MenuAgg[] {
  const menuMap: { [namaMenu: string]: MenuAgg } = {};

  txs.forEach(tx => {
    if (tx.detail && Array.isArray(tx.detail)) {
      tx.detail.forEach(item => {
        const nm = item.NAMA_MENU || 'Unknown';
        const v = item.VARIAN || '';
        const qty = Number(item.QTY || 0);

        if (!menuMap[nm]) {
          menuMap[nm] = {
            namaMenu: nm,
            totalQty: 0,
            variants: {}
          };
        }

        menuMap[nm].totalQty += qty;
        
        if (v) {
          if (!menuMap[nm].variants[v]) {
            menuMap[nm].variants[v] = 0;
          }
          menuMap[nm].variants[v] += qty;
        }
      });
    }
  });

  return Object.values(menuMap).sort((a, b) => b.totalQty - a.totalQty);
}

const getTodayLocalDateStr = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
};

export default function ReportsPanel({ cabangList, activeBranch }: ReportsPanelProps) {

  const session = getSessionCache();

  // Filters initialized to HARIAN and today's local date on first mount, or load from session if available
  const [filterCabang, setFilterCabang] = useState<string>(() => session.filters.reports?.filterCabang || localStorage.getItem('AURA_REPORTS_FILTER_CABANG') || 'ALL');
  const [filterPeriode, setFilterPeriode] = useState<ReportPeriod>(() => session.filters.reports?.filterPeriode || 'HARIAN');
  const [filterType, setFilterType] = useState<ReportType>(() => session.filters.reports?.filterType || localStorage.getItem('AURA_REPORTS_FILTER_TYPE') as ReportType || 'GABUNGAN');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => session.filters.reports?.selectedMonth ?? Number(localStorage.getItem('AURA_REPORTS_FILTER_MONTH') || new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<number>(() => session.filters.reports?.selectedYear ?? Number(localStorage.getItem('AURA_REPORTS_FILTER_YEAR') || new Date().getFullYear()));
  const [selectedDate, setSelectedDate] = useState<string>(() => session.filters.reports?.selectedDate || getTodayLocalDateStr());

  // Ref to prevent identical redundant fetches
  const lastFetchParamsRef = useRef<string>(session.reports.lastParams);

  // Cache helper
  const getCacheKey = () => {
    const currentBranchId = activeBranch === 'ADMIN' ? filterCabang : activeBranch;
    return `cached_laporan_data_${currentBranchId || 'ALL'}_${filterPeriode || 'BULANAN'}_${filterType || 'GABUNGAN'}_${selectedYear}_${selectedMonth}_${selectedDate}`;
  };

  const [bukuKasData, setBukuKasData] = useState<{
    pemasukan: number;
    pengeluaran: number;
    saldoBersih: number;
    transaksi: any[];
    totalCash?: number;
    totalTransfer?: number;
    saldoAwal?: number;
    totalSaldoAkhir?: number;
  } | null>(() => {
    // 1. Memory Check
    if (session.reports.data) return session.reports.data;

    try {
      const initialBranch = activeBranch === 'ADMIN' ? filterCabang : activeBranch;
      const initialPeriode = session.filters.reports?.filterPeriode || 'HARIAN';
      const initialType = session.filters.reports?.filterType || localStorage.getItem('AURA_REPORTS_FILTER_TYPE') || 'GABUNGAN';
      const initialMonth = session.filters.reports?.selectedMonth ?? Number(localStorage.getItem('AURA_REPORTS_FILTER_MONTH') || new Date().getMonth());
      const initialYear = session.filters.reports?.selectedYear ?? Number(localStorage.getItem('AURA_REPORTS_FILTER_YEAR') || new Date().getFullYear());
      const initialDate = session.filters.reports?.selectedDate || getTodayLocalDateStr();
      
      const key = `cached_laporan_data_${initialBranch || 'ALL'}_${initialPeriode}_${initialType}_${initialYear}_${initialMonth}_${initialDate}`;
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  
  const [loadingBukuKas, setLoadingBukuKas] = useState<boolean>(false);
  const [bukuKasError, setBukuKasError] = useState<string | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let active = true;
    getTransactions().then(txs => {
      if (active) {
        setAllTransactions(txs);
      }
    });
    return () => {
      active = false;
    };
  }, [bukuKasData]);

  const filteredPOSTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      // 1. Branch Filter
      const targetBranch = activeBranch === 'ADMIN' ? filterCabang : (activeBranch || 'ALL');
      if (targetBranch !== 'ALL' && String(tx.cabang) !== String(targetBranch)) {
        return false;
      }

      // 2. Date/Period Filter
      if (!tx.timestamp) return false;
      const txDate = new Date(tx.timestamp);
      if (isNaN(txDate.getTime())) return false;

      const yr = txDate.getFullYear();
      const mo = txDate.getMonth(); // 0-11
      const dy = txDate.getDate();

      if (filterPeriode === 'HARIAN') {
        const parts = selectedDate.split('-'); // YYYY-MM-DD
        if (parts.length === 3) {
          const targetY = parseInt(parts[0], 10);
          const targetM = parseInt(parts[1], 10) - 1; // 0-11
          const targetD = parseInt(parts[2], 10);
          return yr === targetY && mo === targetM && dy === targetD;
        }
        return false;
      }

      if (filterPeriode === 'BULANAN') {
        return mo === selectedMonth && yr === selectedYear;
      }

      if (filterPeriode === 'KUARTAL') {
        const targetQ = Math.ceil((selectedMonth + 1) / 3);
        const txQ = Math.ceil((mo + 1) / 3);
        return yr === selectedYear && txQ === targetQ;
      }

      if (filterPeriode === 'SEMESTER') {
        const targetS = (selectedMonth + 1) <= 6 ? 1 : 2;
        const txS = (mo + 1) <= 6 ? 1 : 2;
        return yr === selectedYear && txS === targetS;
      }

      if (filterPeriode === 'TAHUNAN') {
        return yr === selectedYear;
      }

      return true;
    });
  }, [allTransactions, activeBranch, filterCabang, filterPeriode, selectedDate, selectedMonth, selectedYear]);

  const rincianPesanan = useMemo(() => {
    return getMenuAggregates(filteredPOSTransactions);
  }, [filteredPOSTransactions]);

  // Toast notifications for file actions (share, copy, pdf)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

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
      await loadData(true); // force remote refresh
    }
    setPullDistance(0);
    setStartY(null);
  };
  
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  // Back button interception for Android
  useEffect(() => {
    const handleAndroidBack = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (selectedTx !== null) {
        setSelectedTx(null);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showShareMenu) {
        setShowShareMenu(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      }
    };
    window.addEventListener('aura-backpress', handleAndroidBack);
    return () => window.removeEventListener('aura-backpress', handleAndroidBack);
  }, [selectedTx, showShareMenu]);
  
  const isBukuKas = true; // Reports is strictly the General Ledger (Buku Kas & Transaksi) as requested
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const rawTransactions = bukuKasData?.transaksi || [];

  // Parse all loaded General Ledger transaction records
  const parsedKasTransactions = useMemo(() => {
    return rawTransactions.map((t: any) => {
      const tglStr = t.TANGGAL || t.Tanggal || t[0] || '';
      const date = parseTransactionDate(tglStr);
      const cabRaw = t.CABANG || t.ID_CABANG || t[2] || '';
      const ket = t.KETERANGAN || t.Keterangan || t[3] || '';
      
      // Find a key matching 'jenis', 'JENIS', 'Jenis Transaksi', 'Kategori', etc. case insensitively
      let kat = '';
      if (t && typeof t === 'object' && !Array.isArray(t)) {
        const keys = Object.keys(t);
        const foundKey = keys.find(k => {
          const lower = k.toLowerCase().replace(/[\s_-]/g, '').trim();
          return lower === 'jenis' || lower === 'jenistransaksi' || lower === 'kategori' || lower === 'jenis_transaksi';
        });
        if (foundKey) {
          kat = String(t[foundKey]).trim();
        }
      }
      
      if (!kat) {
        kat = t.JENIS || t.Kategori || t[1] || '';
      }
      
      const debit = Number(t.DEBIT || t.Masuk || t[4] || 0);
      const kredit = Number(t.KREDIT || t.Keluar || t[5] || 0);

      return {
        original: t,
        date,
        branchId: String(cabRaw).trim(),
        keterangan: ket,
        kategori: kat,
        debit,
        kredit,
        tglStr
      };
    });
  }, [rawTransactions]);

  // Target Branch based on Admin filter or specific logged-in branch user
  const currentBranchId = activeBranch === 'ADMIN' ? filterCabang : activeBranch;

  // Retrieve & calculate the SALDO AWAL (Starting Balance)
  // Note: With pure server-side filtering, previous period cumulative balance is handled upstream if needed,
  // currently we set it to 0 as the API returns exact net total metrics for the requested period.
  const calculatedSaldoAwal = bukuKasData?.saldoAwal || 0;

  // Since the Backend API now perfectly handles all multidimensional filtering (cabang, periode, tipe data),
  // we can use the parsed returned data directly and reduce massive client processing
  const filteredKasTransactions = useMemo(() => {
    let currentSaldo = calculatedSaldoAwal;
    return parsedKasTransactions.map(tx => {
      currentSaldo += (tx.debit - tx.kredit);
      return {
        ...tx,
        saldo: currentSaldo
      };
    });
  }, [parsedKasTransactions, calculatedSaldoAwal]); 
  
  // Directly pull exact aggregated stats from backend
  const totalOmset = bukuKasData?.pemasukan || 0;
  const totalPengeluaran = bukuKasData?.pengeluaran || 0;
  const saldoBersih = bukuKasData?.saldoBersih || 0;

  // Sum up cash and transfer from actual transactions loaded
  // But strictly ONLY when debit > 0 (as requested: "hanya ambil transaksi yg debitnya tidak 0, alias ambil cash hanya dari uang masuk saja")
  const calculatedTotalCashAndTransfer = useMemo(() => {
    let totalCash = 0;
    let totalTransfer = 0;

    parsedKasTransactions.forEach((tx) => {
      if (tx.debit > 0) {
        const t = tx.original || {};
        const cashVal = Number(t.cash || t.CASH || t.total_cash || t.TOTAL_CASH || t.Total_Cash || (Array.isArray(t) ? t[6] : 0) || 0);
        const transVal = Number(t.transfer || t.TRANSFER || t.total_transfer || t.TOTAL_TRANSFER || t.Total_Transfer || (Array.isArray(t) ? t[7] : 0) || 0);

        if (cashVal === 0 && transVal === 0) {
          const lowerKategori = String(tx.kategori || '').toLowerCase();
          const lowerKet = String(tx.keterangan || '').toLowerCase();
          if (lowerKategori.includes('transfer') || lowerKategori.includes('qris') || lowerKategori.includes('debit') || lowerKet.includes('transfer') || lowerKet.includes('qris')) {
            totalTransfer += tx.debit;
          } else {
            totalCash += tx.debit;
          }
        } else {
          totalCash += cashVal;
          totalTransfer += transVal;
        }
      }
    });

    return { totalCash, totalTransfer };
  }, [parsedKasTransactions]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(bukuKasData?.textLaporan || '');
    setToastType('success');
    setToastMessage("Berhasil disalin ke papan klip!");
    setShowShareMenu(false);
  };

  const handleShareWA = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(bukuKasData?.textLaporan || '')}`, '_blank');
    setToastType('success');
    setToastMessage("Berhasil dibagikan ke WhatsApp!");
    setShowShareMenu(false);
  };

  const handleExportPDF = async () => {
    try {
      const element = document.getElementById('report-content');
      if (!element) return;
      
      setToastMessage("Menyiapkan PDF...");
      
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');
      
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Laporan_Aura_${selectedDate}.pdf`);
      
      setToastType('success');
      setToastMessage("Berhasil mengarsipkan laporan menjadi PDF!");
    } catch (err) {
      console.error(err);
      setToastType('error');
      setToastMessage("Gagal menyimpan PDF.");
    } finally {
      setShowShareMenu(false);
    }
  };

  const loadData = async (forceRemote = false) => {
    const cacheKey = getCacheKey();
    if (!forceRemote) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          setBukuKasData(JSON.parse(cached));
        } catch (e) {
          console.error(e);
        }
      }
    }

    setLoadingBukuKas(true);
    setBukuKasError(null);
    try {
      const targetBranch = activeBranch === 'ADMIN' ? filterCabang : (activeBranch || 'ALL');
      
      // Compute formatted params
      const dateParts = selectedDate.split('-'); // YYYY-MM-DD
      const paramTanggal = (filterPeriode === 'HARIAN' && dateParts.length === 3) ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : '';
      const paramBulan = selectedMonth + 1;
      const paramTahun = selectedYear;
      
      let targetKuartal = '';
      if (filterPeriode === 'KUARTAL') {
        const qSelected = Math.ceil(paramBulan / 3);
        targetKuartal = `Q${qSelected}`;
      }
      
      let targetSemester = '';
      if (filterPeriode === 'SEMESTER') {
        targetSemester = paramBulan <= 6 ? 'S1' : 'S2';
      }

      // GUARD: Check if filters actually changed since last remote fetch
      const currentParamsKey = JSON.stringify({
        targetBranch,
        filterPeriode,
        filterType,
        paramTanggal,
        paramBulan,
        paramTahun,
        targetKuartal,
        targetSemester
      });

      // GUARD: Check if filters actually changed since last remote fetch AND we have data
      const hasCachedData = localStorage.getItem(cacheKey) !== null;
      if (!forceRemote && lastFetchParamsRef.current === currentParamsKey && hasCachedData) {
        setLoadingBukuKas(false);
        return; 
      }

      const result = await getAdminReportsData(
        targetBranch,
        filterPeriode,
        filterType,
        paramTanggal,
        paramBulan,
        paramTahun,
        targetKuartal,
        targetSemester
      );
      
      // Successful remote fetch, update ref and state
      lastFetchParamsRef.current = currentParamsKey;
      setBukuKasData(result);
      localStorage.setItem(cacheKey, JSON.stringify(result));
      setSessionReports(currentParamsKey, result);
    } catch (err: any) {
      console.error("Gagal mendapatkan buku kas admin:", err);
    } finally {
      setLoadingBukuKas(false);
    }
  };

  useEffect(() => {
    const cacheKey = getCacheKey();
    const cached = localStorage.getItem(cacheKey);

    // Save current filters to persistence
    localStorage.setItem('AURA_REPORTS_FILTER_CABANG', filterCabang);
    localStorage.setItem('AURA_REPORTS_FILTER_PERIODE', filterPeriode);
    localStorage.setItem('AURA_REPORTS_FILTER_TYPE', filterType);
    localStorage.setItem('AURA_REPORTS_FILTER_MONTH', String(selectedMonth));
    localStorage.setItem('AURA_REPORTS_FILTER_YEAR', String(selectedYear));
    localStorage.setItem('AURA_REPORTS_FILTER_DATE', selectedDate);
    
    // Also save to memory session for fast access
    setSessionFilters('reports', { filterCabang, filterPeriode, filterType, selectedMonth, selectedYear, selectedDate });

    // Optimistic UI state from Cache
    if (cached) {
      try {
        setBukuKasData(JSON.parse(cached));
      } catch (e) {
        console.error(e);
      }
    }
    // ALWAYS fetch latest data completely to ensure syncing
    // Passing false so our guard can check if params haven't actually changed
    loadData(false);
  }, [activeBranch, filterCabang, filterPeriode, filterType, selectedDate, selectedMonth, selectedYear]);

  return (
    <div 
      id="report-content"
      className="space-y-6 animate-fade-in text-left pb-24 relative max-w-full overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* FLOAT NOTIFICATION TOAST */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000000] animate-in slide-in-from-top-8 duration-500 w-full max-w-sm px-4">
          <div className="px-4 py-3 rounded-[24px] bg-zinc-950 text-white flex items-center justify-center gap-3 shadow-2xl border border-zinc-800/80 font-sans">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shrink-0">
              <Check className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-100">{toastMessage}</span>
          </div>
        </div>
      )}

      {pullDistance > 0 && (
        <div className="fixed top-20 left-0 right-0 flex justify-center items-center h-12 z-[1000] pointer-events-none">
          <RefreshCw className="h-6 w-6 text-red-650 animate-spin" style={{ opacity: pullDistance / 100 }} />
        </div>
      )}
      <div style={{ marginTop: `${pullDistance / 2}px`, transition: pullDistance === 0 ? 'margin-top 0.2s ease-out' : 'none' }} className="space-y-6">
      {/* Header & Filter Compact */}
      <div className="bg-white p-4 sm:p-5 rounded-[24px] border border-zinc-200/80 shadow-sm space-y-5 relative">
        <div className="absolute inset-0 overflow-hidden rounded-[24px] pointer-events-none">
          <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 h-40 w-40 bg-sky-200/20 rounded-full blur-3xl"></div>
        </div>

        {/* Share Button Top Right */}
        <div className="absolute top-4 sm:top-5 right-4 sm:right-5 z-50">
          <div className="relative">
            <button 
              onClick={() => setShowShareMenu(!showShareMenu)}
              disabled={loadingBukuKas}
              className={`p-2 sm:p-2 backdrop-blur-md border border-zinc-200 text-zinc-600 rounded-xl transition shadow-sm ${loadingBukuKas ? 'bg-zinc-100 opacity-50 cursor-not-allowed' : 'bg-white/80 hover:bg-zinc-50 active:scale-95 cursor-pointer'}`}
            >
              <Share2 className="h-4 w-4" />
            </button>
            {showShareMenu && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setShowShareMenu(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-48 sm:w-56 bg-white rounded-xl shadow-xl border border-zinc-200 py-1.5 z-[101] animate-in fade-in zoom-in-95 origin-top-right">
                  <button 
                    onClick={handleCopyText}
                    className="w-full text-left px-4 py-2.5 text-[10px] sm:text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition"
                  >
                    <Copy className="h-4 w-4 text-zinc-400" /> Salin Teks
                  </button>
                  <button 
                    onClick={handleShareWA}
                    className="w-full text-left px-4 py-2.5 text-[10px] sm:text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-green-500 fill-current" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    className="w-full text-left px-4 py-2.5 text-[10px] sm:text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition"
                  >
                    <FileDown className="h-4 w-4 text-red-500" /> Simpan PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Compact Header with Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-red-50 border border-red-100 text-red-650 flex items-center justify-center shrink-0 shadow-sm">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider">
                Kinerja Kerja
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5 max-w-sm hidden sm:block">
                Menampilkan rekapitulasi aliran dana kas operasional (debit/kredit) ter-sinkronisasi Sistem Pusat.
              </p>
            </div>
          </div>
        </div>
 
        {/* Summary & Cash/Transfer Bento Grid Container */}
        <div className="space-y-3 relative z-10 pt-2">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1.5 text-emerald-600">
                 <TrendingUp className="h-4 w-4" />
                 <p className="text-[9px] font-black tracking-widest uppercase">Total Omset</p>
              </div>
              <h4 className="text-sm sm:text-base font-black text-emerald-700">
                {loadingBukuKas ? (
                  <span className="text-zinc-400 animate-pulse">Loading...</span>
                ) : (
                  `Rp${totalOmset.toLocaleString('id-ID')}`
                )}
              </h4>
              {/* No nested cash/transfer breakdown here */}
            </div>
            <div className="bg-red-50 border border-red-100 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1.5 text-red-600">
                 <TrendingDown className="h-4 w-4" />
                 <p className="text-[9px] font-black tracking-widest uppercase">Pengeluaran</p>
              </div>
              <h4 className="text-sm sm:text-base font-black text-red-700">
                {loadingBukuKas ? (
                  <span className="text-zinc-400 animate-pulse">Loading...</span>
                ) : (
                  `Rp${totalPengeluaran.toLocaleString('id-ID')}`
                )}
              </h4>
            </div>
            <div className="bg-amber-50 border border-amber-100 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1.5 text-amber-600">
                 <Layers className="h-4 w-4" />
                 <p className="text-[9px] font-black tracking-widest uppercase">Saldo Awal</p>
              </div>
              <h4 className="text-sm sm:text-base font-black text-amber-700">
                {loadingBukuKas ? (
                  <span className="text-zinc-400 animate-pulse">Loading...</span>
                ) : (
                  `Rp${calculatedSaldoAwal.toLocaleString('id-ID')}`
                )}
              </h4>
            </div>
            <div className={`border p-3.5 sm:p-4 rounded-2xl flex flex-col justify-center ${saldoBersih >= 0 ? 'bg-sky-50 border-sky-100 text-sky-600' : 'bg-orange-50 border-orange-100 text-orange-600'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                 <Wallet className="h-4 w-4" />
                 <p className="text-[9px] font-black tracking-widest uppercase">Saldo Bersih</p>
              </div>
              <h4 className={`text-sm sm:text-base font-black ${saldoBersih >= 0 ? 'text-sky-700' : 'text-orange-700'}`}>
                {loadingBukuKas ? (
                  <span className="text-zinc-400 animate-pulse">Loading...</span>
                ) : (
                  `Rp${saldoBersih.toLocaleString('id-ID')}`
                )}
              </h4>
            </div>
          </div>

          {/* Cash & Transfer Split Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-50 border border-purple-100 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1.5 text-purple-600">
                 <Banknote className="h-4 w-4" />
                 <p className="text-[9px] font-black tracking-widest uppercase">Tunai (Cash)</p>
              </div>
              <h4 className="text-sm sm:text-base font-black text-purple-700">
                {loadingBukuKas ? (
                  <span className="text-zinc-400 animate-pulse">Loading...</span>
                ) : (
                  `Rp${calculatedTotalCashAndTransfer.totalCash.toLocaleString('id-ID')}`
                )}
              </h4>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1.5 text-indigo-600">
                 <CreditCard className="h-4 w-4" />
                 <p className="text-[9px] font-black tracking-widest uppercase">Transfer / QRIS</p>
              </div>
              <h4 className="text-sm sm:text-base font-black text-indigo-700">
                {loadingBukuKas ? (
                  <span className="text-zinc-400 animate-pulse">Loading...</span>
                ) : (
                  `Rp${calculatedTotalCashAndTransfer.totalTransfer.toLocaleString('id-ID')}`
                )}
              </h4>
            </div>
          </div>
        </div>

        {/* Filter Bar Inline */}
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 relative z-10 pt-4 border-t border-zinc-100">
          {/* Cabang */}
          <div className="flex-1 space-y-1.5">
            <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Cabang Toko</label>
            <select 
              className={`w-full text-[10px] sm:text-xs font-bold bg-white border border-zinc-200 rounded-xl px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm appearance-auto ${loadingBukuKas ? 'opacity-50 cursor-not-allowed' : ''}`}
              value={filterCabang}
              disabled={loadingBukuKas}
              onChange={(e) => setFilterCabang(e.target.value)}
            >
              <option value="ALL">SEMUA CABANG</option>
              {cabangList.map(c => (
                <option key={c.ID_CABANG} value={c.ID_CABANG}>{c.NAMA_CABANG}</option>
              ))}
            </select>
          </div>

          {/* Periode */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Periode Rekap</label>
              <div className="relative group focus:outline-none" tabIndex={0}>
                <AlertCircle className="h-3 w-3 text-zinc-400 group-hover:text-sky-500 group-active:text-sky-500 transition cursor-pointer" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-zinc-900 text-white text-[10px] p-2.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-active:opacity-100 group-active:visible transition-all pointer-events-none z-[100] text-center shadow-xl leading-relaxed">
                  {filterPeriode === 'KUARTAL' ? 'Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Okt-Des' : 
                   filterPeriode === 'SEMESTER' ? 'S1: Jan-Jun, S2: Jul-Des' : 
                   filterPeriode === 'BULANAN' ? 'Menampilkan total transaksi dalam 1 bulan penuh' :
                   filterPeriode === 'HARIAN' ? 'Menampilkan transaksi untuk tanggal spesifik yang dipilih' :
                   'Menampilkan akumulasi keseluruhan dalam 1 tahun'}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900"></div>
                </div>
              </div>
            </div>
            <select 
              className={`w-full text-[10px] sm:text-xs font-bold bg-white border border-zinc-200 rounded-xl px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm appearance-auto ${loadingBukuKas ? 'opacity-50 cursor-not-allowed' : ''}`}
              value={filterPeriode}
              disabled={loadingBukuKas}
              onChange={(e) => {
                const nextPeriod = e.target.value as ReportPeriod;
                setFilterPeriode(nextPeriod);
                if (nextPeriod === 'KUARTAL') {
                  setSelectedMonth(prev => {
                    const q = Math.floor(prev / 3);
                    return q * 3;
                  });
                } else if (nextPeriod === 'SEMESTER') {
                  setSelectedMonth(prev => {
                    const s = Math.floor(prev / 6);
                    return s * 6;
                  });
                } else if (nextPeriod === 'BULANAN') {
                  setSelectedMonth(new Date().getMonth());
                }
              }}
            >
              <option value="HARIAN">HARIAN</option>
              <option value="BULANAN">BULANAN</option>
              <option value="KUARTAL">KUARTAL (3 BLN)</option>
              <option value="SEMESTER">SEMESTER (6 BLN)</option>
              <option value="TAHUNAN">TAHUNAN</option>
            </select>
          </div>

          {/* Type */}
          <div className="flex-[1.5] space-y-1.5">
            <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Jenis Data</label>
            <select 
              className={`w-full text-[10px] sm:text-xs font-bold bg-white border border-zinc-200 rounded-xl px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm appearance-auto ${loadingBukuKas ? 'opacity-50 cursor-not-allowed' : ''}`}
              value={filterType}
              disabled={loadingBukuKas}
              onChange={(e) => setFilterType(e.target.value as ReportType)}
            >
              <option value="GABUNGAN">PEMASUKAN & PENGELUARAN</option>
              <option value="PEMASUKAN">PEMASUKAN SAJA</option>
              <option value="PENGELUARAN">PENGELUARAN SAJA</option>
            </select>
          </div>

          {/* Date / Time Filters Contextual */}
          {filterPeriode === 'HARIAN' && (
            <div className="flex-1 space-y-1.5">
              <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Pilih Tanggal</label>
              <input 
                type="date"
                max={new Date().toISOString().split('T')[0]}
                className={`w-full text-[10px] sm:text-xs font-bold bg-white border border-zinc-200 rounded-xl px-3 py-2.5 sm:py-3 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm ${loadingBukuKas ? 'opacity-50 cursor-not-allowed' : ''}`}
                value={selectedDate}
                disabled={loadingBukuKas}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}
          {filterPeriode !== 'HARIAN' && (
             <div className="flex-1 flex gap-2">
                <div className="flex-1 space-y-1.5 min-w-0">
                  <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Tahun</label>
                  <select 
                    className={`w-full text-[10px] sm:text-xs font-bold bg-white border border-zinc-200 rounded-xl px-2 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm appearance-auto cursor-pointer ${loadingBukuKas ? 'opacity-50 cursor-not-allowed' : ''}`}
                    value={selectedYear}
                    disabled={loadingBukuKas}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                  >
                    {(() => {
                      const currentYear = new Date().getFullYear();
                      const years = [];
                      for (let y = currentYear - 5; y <= currentYear; y++) {
                        years.push(y);
                      }
                      return years.map(y => <option key={y} value={y}>{y}</option>);
                    })()}
                  </select>
                </div>
                {(filterPeriode === 'BULANAN' || filterPeriode === 'KUARTAL' || filterPeriode === 'SEMESTER') && (
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider truncate">
                      {filterPeriode === 'BULANAN' ? 'Bulan' : filterPeriode === 'KUARTAL' ? 'Kuartal' : 'Semester'}
                    </label>
                    <select 
                      className={`w-full text-[10px] sm:text-xs font-bold bg-white border border-zinc-200 rounded-xl px-2 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm appearance-auto cursor-pointer ${loadingBukuKas ? 'opacity-50 cursor-not-allowed' : ''}`}
                      value={selectedMonth}
                      disabled={loadingBukuKas}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                      {filterPeriode === 'BULANAN' && months.map((m, i) => <option key={i} value={i}>{m.substring(0,3)}</option>)}
                      {filterPeriode === 'KUARTAL' && [0,1,2,3].map(q => <option key={q} value={q*3}>Q{q+1}</option>)}
                      {filterPeriode === 'SEMESTER' && [0,1].map(s => <option key={s} value={s*6}>S{s+1}</option>)}
                    </select>
                  </div>
                )}
             </div>
          )}

          <div className="flex-1 flex items-end">
            <div className="w-full text-[10px] font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl text-center flex items-center justify-center gap-2 select-none">
              <Server className="h-3.5 w-3.5 text-emerald-600 animate-pulse shrink-0" />
              <span>Sistem Pusat Aktif</span>
            </div>
          </div>
        </div>
      </div>

      {isBukuKas && bukuKasError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1 text-left">
            <p className="font-bold">Gagal Menyinkronkan Buku Kas:</p>
            <p className="font-normal mt-0.5">{bukuKasError}</p>
          </div>
          <button 
            onClick={() => loadData()} 
            className="bg-white border border-red-300 text-red-950 text-[9px] px-3 py-1.5 rounded-lg font-bold hover:bg-zinc-50 active:scale-95 transition cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* List of Data */}
      <div className="bg-white rounded-2xl overflow-hidden font-sans">
        <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4" /> 
              Rincian Transaksi
            </h4>
        </div>
        <div className="p-0">
          {loadingBukuKas ? (
            <div className="py-20 text-center text-zinc-500 bg-white rounded-[32px] border border-zinc-200 shadow-sm flex flex-col items-center justify-center gap-3 animate-pulse">
              <RefreshCw className="h-6 w-6 text-red-650 animate-spin" />
              <p className="text-sm font-medium text-zinc-600">Memuat data dari sistem pusat...</p>
            </div>
          ) : (!bukuKasData || !filteredKasTransactions || filteredKasTransactions.length === 0) ? (
            <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
              <Search className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
              <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Tidak Ada Data</p>
              <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada catatan buku kas untuk filter ini. Coba pilih periode atau cabang lain.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 bg-white max-h-[60vh] overflow-y-auto scrollbar-thin">
              {filteredKasTransactions.map((t: any, idx: number) => {
                const tgl = formatDateToDMY(t.date, t.tglStr);
                const cabName = cabangList.find(c => String(c.ID_CABANG) === String(t.branchId))?.NAMA_CABANG || 
                  ((cabangList && cabangList.length > 0) ? cabangList[0].NAMA_CABANG : `Cabang ${t.branchId}`);
                const ket = t.keterangan || 'Jurnal Umum';
                const kat = t.kategori || 'Kas Operasional';
                
                const isDebit = t.debit > 0;
                const nominal = isDebit ? t.debit : t.kredit;

                // WhatsApp-like profile style icon based on type
                const avatarBg = isDebit ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600";
                const IconComponent = isDebit ? ArrowUpCircle : ArrowDownCircle;

                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedTx({ ...t, cabName, tgl, isDebit, nominal, kat, ket })}
                    className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-zinc-50/85 transition-all duration-150 font-sans cursor-pointer text-left active:bg-zinc-100"
                  >
                    {/* Circle Avatar (Foto Profil WA) */}
                    <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${avatarBg}`}>
                      <IconComponent className="h-5.5 w-5.5" />
                    </div>

                    {/* Chat Bubble Body content (Isi Chat) */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        {/* Header: Keterangan / Detail (Nama Jurnal) */}
                        <h5 className="text-[13px] font-bold text-zinc-900 truncate tracking-wide">
                          {ket}
                        </h5>
                        {/* Chat Timestamp (Jam Chat / Tanggal) */}
                        <span className="text-[10px] text-zinc-400 font-semibold whitespace-nowrap ml-2">
                          {tgl}
                        </span>
                      </div>
                      
                      {/* Last Message content (Jenis/Kategori) */}
                      <div className="flex items-start justify-between mt-1">
                        <p className="text-[11px] text-zinc-500 font-medium truncate pr-3 flex items-center gap-1.5 mt-0.5">
                          <span className="bg-zinc-100 text-zinc-650 text-[8.5px] px-1.5 py-0.5 rounded font-black border border-zinc-200/50 uppercase shrink-0">
                            {cabName}
                          </span>
                          <span>{kat}</span>
                        </p>
                        
                        <div className="flex flex-col items-end gap-1">
                          {/* Numeric Badge (Debit/Kredit sesuai warna) */}
                          <span className={`text-[10.5px] font-extrabold tracking-tight px-2 py-0.5 rounded-full shrink-0 ${isDebit ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                            {isDebit ? '+' : '-'}Rp{nominal.toLocaleString('id-ID')}
                          </span>
                          {/* Saldo Kumulatif */}
                          <span className="text-[9px] font-bold text-zinc-400">
                            Saldo: Rp{(t.saldo || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


      </div>

      {/* TRANSACTION DETAILS MODAL */}
      {selectedTx && createPortal(
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in animate-duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-sm p-6 shadow-xl flex flex-col gap-4 text-left transform scale-100 transition-all select-none border-0">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-1 border-b border-zinc-100">
              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                <Info className="h-4 w-4 text-red-650" />
                Rincian Transaksi
              </h4>
              <button 
                onClick={() => setSelectedTx(null)}
                className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Main Decorative Amount Badge */}
            <div className={`p-4 rounded-2xl flex flex-col items-center justify-center text-center ${selectedTx.isDebit ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
              <span className="text-[9px] font-extrabold uppercase tracking-widest mb-1 opacity-75">
                {selectedTx.isDebit ? 'Pemasukan (Debit)' : 'Pengeluaran (Kredit)'}
              </span>
              <span className="text-2xl font-black tracking-tight mt-0.5">
                {selectedTx.isDebit ? '+' : '-'}Rp{selectedTx.nominal.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Detail Grid */}
            <div className="space-y-4 my-1">
              <div className="flex items-start gap-3">
                <Layers className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">Kategori</span>
                  <span className="text-xs font-bold text-zinc-800">{selectedTx.kat || selectedTx.kategori || 'Kas Operasional'}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">Tanggal</span>
                  <span className="text-xs font-bold text-zinc-800">{selectedTx.tgl}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">Cabang</span>
                  <span className="text-xs font-bold text-zinc-800">{selectedTx.cabName || 'Semua'}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-3 border-t border-zinc-100">
                <FileText className="h-4 w-4 text-zinc-400 shrink-0 mt-0.6" />
                <div className="flex-1 min-w-0">
                  <span className="block text-[9px] font-black text-zinc-400 uppercase tracking-wider">Keterangan</span>
                  <span className="text-xs font-medium text-zinc-700 leading-relaxed block break-words">
                    {selectedTx.ket || selectedTx.keterangan || 'Tidak ada catatan'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <button 
              onClick={() => setSelectedTx(null)}
              className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold text-[11px] py-3.5 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 uppercase tracking-wider cursor-pointer mt-1"
            >
              Tutup Rincian
            </button>

          </div>
        </div>,
        document.body
      )}
      {/* EXPLANATION MODAL */}
    </div>
  );
}
