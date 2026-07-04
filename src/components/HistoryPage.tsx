import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Transaction, Cabang } from '../types';
import { getTransactions, getTransactionsFromGAS, getPrintedTransactionIds } from '../utils/db';
import { Search, Filter, X, ArrowLeft, ReceiptText, ChevronLeft, ChevronRight, CalendarClock, Printer, Trash2, Database, Plus, RefreshCw, Gift } from 'lucide-react';
import ReceiptThermal from './ReceiptThermal';

type SortOrder = 'newest' | 'oldest';
interface HistoryFilterState {
  status: 'All' | 'Online' | 'Offline';
  sortOrder: SortOrder;
  paymentMethod: 'All' | 'Cash' | 'Transfer' | 'QRIS';
  date: string | null;
  branch: string; // 'All' or specific branch ID (only for ADMIN)
  jenisPesanan: 'All' | 'Normal' | 'Compliment';
}

interface HistoryPageProps {
  activeBranch: string; // If 'ADMIN', show branch filter and hide "Cetak Struk", show details
  cabangList: Cabang[];
  onSelectTransaction: (tx: Transaction) => void;
  onSuccessPrint?: (tx: Transaction) => void;
  onBack: () => void;
  onCreateTransaction?: () => void;
  refreshTrigger?: number;
  initialBranchFilter?: string;
}

const getDefaultFilterState = (initialBranchFilter?: string): HistoryFilterState => {
  return {
    status: 'All',
    sortOrder: 'newest',
    paymentMethod: 'All',
    date: null,
    branch: initialBranchFilter || 'All',
    jenisPesanan: 'All'
  };
};

let historyInitialFetchDone = new Map<string, string>(); // branch -> last_fetched_date (YYYY-MM-DD)
let historyFetchingInProgress = new Set<string>();

export default function HistoryPage({ activeBranch, cabangList, onSelectTransaction, onSuccessPrint, onBack, onCreateTransaction, refreshTrigger, initialBranchFilter }: HistoryPageProps) {
  const [history, setHistory] = useState<Transaction[]>([]);
  const [isSearchHistoryActive, setIsSearchHistoryActive] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [showHistoryFilter, setShowHistoryFilter] = useState<boolean>(false);
  const [appliedHistoryFilter, setAppliedHistoryFilter] = useState<HistoryFilterState>(() => getDefaultFilterState(initialBranchFilter));
  const [tempHistoryFilter, setTempHistoryFilter] = useState<HistoryFilterState>(() => getDefaultFilterState(initialBranchFilter));
  const [historyModalTx, setHistoryModalTx] = useState<Transaction | null>(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState<boolean>(false);
  const lastFetchParamsRef = useRef<string>('');
  const [printedIds, setPrintedIds] = useState<string[]>([]);

  useEffect(() => {
    setPrintedIds(getPrintedTransactionIds());
    const handleUpdate = () => {
      setPrintedIds(getPrintedTransactionIds());
    };
    window.addEventListener('printed-transactions-updated', handleUpdate);
    return () => {
      window.removeEventListener('printed-transactions-updated', handleUpdate);
    };
  }, []);

  // Pull to refresh gestures
  const [startY, setStartY] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Back button interception for Android
  useEffect(() => {
    const handleAndroidBack = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (historyModalTx !== null) {
        setHistoryModalTx(null);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showHistoryFilter) {
        setShowHistoryFilter(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (isSearchHistoryActive) {
        setIsSearchHistoryActive(false);
        setHistorySearchQuery('');
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      }
    };
    window.addEventListener('aura-backpress', handleAndroidBack);
    return () => window.removeEventListener('aura-backpress', handleAndroidBack);
  }, [historyModalTx, showHistoryFilter, isSearchHistoryActive]);

  const handleForceRefresh = async () => {
    if (!navigator.onLine) return;
    const fetchBranch = activeBranch === 'ADMIN' ? (appliedHistoryFilter.branch || 'All') : activeBranch;
    setIsFetchingHistory(true);
    try {
      const remoteTxs = await getTransactionsFromGAS(fetchBranch);
      if (remoteTxs) {
         const { saveTransaction, clearSyncedTransactions } = await import('../utils/db');
         
         // Clear local synced transactions for this scope to strictly "overwrite"
         await clearSyncedTransactions(fetchBranch === 'All' ? undefined : fetchBranch);
         
         // Save the new ones
         for (const rt of remoteTxs) {
           await saveTransaction(rt);
         }
         
         // Ensure we mark it as fetched
         historyInitialFetchDone.set(fetchBranch, new Date().toISOString().split('T')[0]);
         
         // Reload after saving to DB to have consistent state
         const refreshed = await getTransactions();
         let displayTxs = [...refreshed];
         if (activeBranch !== 'ADMIN') {
           displayTxs = displayTxs.filter(tx => String(tx.cabang) === activeBranch);
         }
         displayTxs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
         setHistory(displayTxs);
      }
    } catch (e) {
      console.warn("History remote fetch failed during force refresh:", e);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const isScrollAtTop = !mainScrollRef.current || mainScrollRef.current.scrollTop === 0;
    if (isScrollAtTop && window.scrollY === 0) {
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
       await handleForceRefresh();
    }
    setPullDistance(0);
    setStartY(null);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const fetchBranch = activeBranch === 'ADMIN' ? (appliedHistoryFilter.branch || 'All') : activeBranch;
        
        if (!activeBranch || activeBranch === '' || !fetchBranch || fetchBranch === '') {
          return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const lastFetched = historyInitialFetchDone.get(fetchBranch);
        
        // 1. Get all local first (including pending_sync)
        const allLocal = await getTransactions();
        let displayTxs = [...allLocal];
        
        if (activeBranch !== 'ADMIN') {
          displayTxs = displayTxs.filter(tx => String(tx.cabang) === activeBranch);
        }
        
        displayTxs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setHistory(displayTxs);

        // 2. Fetch Remote only if this is the first time today for this branch, and online
        if (lastFetched !== today && !historyFetchingInProgress.has(fetchBranch) && navigator.onLine) {
          historyFetchingInProgress.add(fetchBranch);
          setIsFetchingHistory(true);
          try {
            const remoteTxs = await getTransactionsFromGAS(fetchBranch);
            if (remoteTxs) {
               const { saveTransaction, clearSyncedTransactions } = await import('../utils/db');
               
               // 1. Clear local synced transactions for this scope to strictly "overwrite"
               await clearSyncedTransactions(fetchBranch === 'All' ? undefined : fetchBranch);
               
               // 2. Save the new ones
               for (const rt of remoteTxs) {
                 await saveTransaction(rt);
               }
               
               // Reload after saving to DB to have consistent state
               const refreshed = await getTransactions();
               let updatedTxs = [...refreshed];
               if (activeBranch !== 'ADMIN') {
                 updatedTxs = updatedTxs.filter(tx => String(tx.cabang) === activeBranch);
               }
               updatedTxs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
               setHistory(updatedTxs);
            }
            historyInitialFetchDone.set(fetchBranch, today);
          } catch (e) {
            console.warn("History remote fetch failed on first load:", e);
          } finally {
            historyFetchingInProgress.delete(fetchBranch);
            setIsFetchingHistory(false);
          }
        }
      } catch (err) {
        console.error("Error loading history:", err);
        setIsFetchingHistory(false);
      }
    }
    loadData();
  }, [activeBranch, refreshTrigger, appliedHistoryFilter.branch]);

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

  if (appliedHistoryFilter.jenisPesanan && appliedHistoryFilter.jenisPesanan !== 'All') {
    const isComplimentFilter = appliedHistoryFilter.jenisPesanan === 'Compliment';
    filteredHistory = filteredHistory.filter(tx => {
      const isCompliment = String(tx.pesanan?.JENIS_PESANAN || '').toUpperCase() === 'COMPLIMENT';
      return isComplimentFilter ? isCompliment : !isCompliment;
    });
  }

  if (appliedHistoryFilter.date) {
      filteredHistory = filteredHistory.filter(tx => new Date(tx.timestamp).toLocaleDateString('en-CA') === appliedHistoryFilter.date);
  }

  if (activeBranch === 'ADMIN' && appliedHistoryFilter.branch !== 'All') {
      filteredHistory = filteredHistory.filter(tx => String(tx.cabang) === appliedHistoryFilter.branch);
  }

  if (appliedHistoryFilter.sortOrder === 'oldest') {
    filteredHistory.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } else {
    filteredHistory.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  const activeFilterCount = (appliedHistoryFilter.status !== 'All' ? 1 : 0) + 
                            (appliedHistoryFilter.paymentMethod !== 'All' ? 1 : 0) +
                            (appliedHistoryFilter.sortOrder !== 'newest' ? 1 : 0) +
                            (appliedHistoryFilter.date ? 1 : 0) +
                            (appliedHistoryFilter.jenisPesanan && appliedHistoryFilter.jenisPesanan !== 'All' ? 1 : 0) +
                            (activeBranch === 'ADMIN' && appliedHistoryFilter.branch !== 'All' ? 1 : 0);

  const isFilterOrSearchActive = activeFilterCount > 0 || (isSearchHistoryActive && historySearchQuery);

  return (
    <div className="flex flex-col w-full h-full animate-fade-in text-left bg-neutral-50 min-h-screen">
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
                  onClick={onBack}
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
                  onClick={handleForceRefresh}
                  className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-700 transition cursor-pointer active:scale-95"
                  title="Segarkan Riwayat"
                  disabled={isFetchingHistory}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetchingHistory ? 'animate-spin' : ''}`} />
                </button>
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

      <main 
        ref={mainScrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto w-full pb-safe bg-neutral-50 relative selection:bg-red-100 selection:text-red-900"
      >
        {pullDistance > 0 && (
          <div className="absolute top-4 left-0 right-0 flex justify-center items-center h-12 z-50">
            <RefreshCw className={`h-6 w-6 text-red-750 animate-spin`} style={{ opacity: pullDistance / 100 }} />
          </div>
        )}

        <div 
          className="max-w-2xl mx-auto p-4 space-y-3"
          style={{ marginTop: `${pullDistance / 2}px`, transition: pullDistance === 0 ? 'margin-top 0.2s ease-out' : 'none' }}
        >
            {isFetchingHistory && history.length === 0 ? (
                <div className="py-20 text-center text-zinc-500 bg-white rounded-[32px] border border-zinc-200 shadow-sm flex flex-col items-center justify-center gap-3 animate-pulse">
                  <RefreshCw className="h-6 w-6 text-red-650 animate-spin" />
                  <p className="text-sm font-medium text-zinc-600">Memuat data dari sistem pusat...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                  <ReceiptText className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                  <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Riwayat Kosong</p>
                  <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada catatan pesanan hari ini di sistem pusat.</p>
                  {activeBranch !== 'ADMIN' && (
                    <button 
                      onClick={onCreateTransaction || onBack}
                      className="bg-red-50 text-red-700 hover:bg-red-100 font-black text-[10px] px-6 py-3 rounded-xl transition flex items-center gap-2 active:scale-95 uppercase tracking-widest cursor-pointer mt-4 border border-red-100"
                    >
                      <Plus className="h-4 w-4" /> Mulai Transaksi Baru
                    </button>
                  )}
                </div>
            ) : filteredHistory.length === 0 ? (
                <div className="flex items-center justify-center flex-col text-zinc-400 py-16 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm animate-in fade-in duration-200">
                  <Search className="h-12 w-12 mb-4 opacity-70 text-zinc-300" />
                  <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Tidak Ditemukan</p>
                  <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Tidak ada hasil yang sesuai dengan filter pencarian Anda.</p>
                  <button 
                    onClick={() => {
                      setIsSearchHistoryActive(false);
                      setHistorySearchQuery('');
                      setAppliedHistoryFilter(getDefaultFilterState());
                    }}
                    className="bg-zinc-50 text-zinc-600 hover:bg-zinc-100 font-black text-[10px] px-6 py-3 rounded-xl transition flex items-center gap-2 active:scale-95 uppercase tracking-widest cursor-pointer mt-4 border border-zinc-200"
                  >
                    <Trash2 className="h-4 w-4 text-red-700" /> Reset Filter
                  </button>
                </div>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {filteredHistory.map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => setHistoryModalTx(tx)}
                        className={`p-4 border rounded-2xl cursor-pointer transition flex flex-col justify-between text-left group hover:border-zinc-400 bg-white shadow-sm ${
                          historyModalTx?.id === tx.id ? 'border-red-650 bg-red-50/50' : 'border-zinc-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 max-w-[70%]">
                            <p className="text-xs font-extrabold truncate text-zinc-900 flex items-center gap-1.5">
                              {tx.pesanan?.JENIS_PESANAN === 'Compliment' ? (
                                <Gift className="h-3.5 w-3.5 text-amber-500 animate-pulse fill-amber-100 shrink-0" />
                              ) : (
                                <ReceiptText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              )}
                              {tx.id}
                            </p>
                            {printedIds.includes(tx.id) && (
                              <span className="inline-flex items-center justify-center text-emerald-600 bg-emerald-50 p-1 rounded border border-emerald-100 hover:bg-emerald-100 transition shrink-0" title="Struk Sudah Dicetak">
                                <Printer className="h-3 w-3 text-emerald-600" />
                              </span>
                            )}
                          </div>
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
                              {new Date(tx.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} &bull; {new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} &bull; {tx.paymentMethod || (tx.pesanan?.JENIS_PESANAN === 'Compliment' ? 'Compliment' : '')}
                            </p>
                            {activeBranch === 'ADMIN' && (
                              <p className="text-[10px] text-zinc-400 font-medium mb-1 border-red-50/50 bg-neutral-100/50 px-2.5 py-1 rounded inline-block">
                                Cabang: {cabangList.find(c => String(c.ID_CABANG) === String(tx.cabang))?.NAMA_CABANG || tx.cabang}
                              </p>
                            )}
                            <span className="text-[10px] text-red-750 font-bold hover:underline inline-flex items-center gap-0.5 transition">
                              {activeBranch === 'ADMIN' ? 'Lihat Detail Pesanan' : 'Lihat Cetak Struk'}
                            </span>
                            {(() => {
                              const fullCatatan = tx.pesanan?.CATATAN;
                              if (!fullCatatan) return null;
                              
                              const parts = fullCatatan.split('|');
                              let displayNote = '';
                              if (parts.length >= 3) {
                                // New format: Promo | Charge | Note
                                displayNote = parts[2].trim();
                              } else {
                                // Old format or partial: show whole string if no pipes, or first part
                                displayNote = fullCatatan.trim();
                              }

                              if (!displayNote) return null;

                              return (
                                <p className="text-[9px] text-zinc-500 italic mt-1.5 border-l-2 border-zinc-200 pl-2 max-w-[200px] truncate">
                                  "{displayNote}"
                                </p>
                              );
                            })()}
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-black text-zinc-950 whitespace-nowrap">
                               Rp{tx.totalAmount.toLocaleString('id-ID')}
                             </p>
                             {activeBranch === 'ADMIN' && (
                                <p className="text-[10px] text-zinc-400 mt-1">{tx.detail?.length || 0} Item</p>
                             )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
            )}
        </div>
      </main>

      {showHistoryFilter && createPortal(
        <div className="fixed inset-0 z-[100000] bg-zinc-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200" onClick={() => setShowHistoryFilter(false)}>
          <div className="bg-white w-full max-w-sm h-dvh shadow-2xl flex flex-col animate-in slide-in-from-right-1/2" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 pt-safe">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight flex items-center gap-2">
                <Filter className="h-4 w-4 text-red-750" /> Filter Riwayat
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setTempHistoryFilter(getDefaultFilterState(initialBranchFilter))}
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
                {activeBranch === 'ADMIN' && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Cabang (Khusus Admin)</label>
                    <select 
                      value={tempHistoryFilter.branch}
                      onChange={(e) => setTempHistoryFilter({...tempHistoryFilter, branch: e.target.value})}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 focus:ring-2 focus:ring-red-650 focus:border-red-650 transition outline-none bg-white"
                    >
                      <option value="All">Semua Cabang</option>
                      {cabangList.map(c => (
                        <option key={c.ID_CABANG} value={String(c.ID_CABANG)}>{c.NAMA_CABANG}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Tanggal</label>
                  <input 
                    type="date"
                    value={tempHistoryFilter.date || ''}
                    onChange={(e) => setTempHistoryFilter({...tempHistoryFilter, date: e.target.value || null})}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs text-zinc-700 focus:ring-2 focus:ring-red-650 focus:border-red-650 transition outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Urutkan</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, sortOrder: 'newest'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.sortOrder === 'newest' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Terbaru</button>
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, sortOrder: 'oldest'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.sortOrder === 'oldest' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Terlama</button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Status Sync</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, status: 'All'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.status === 'All' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Semua</button>
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, status: 'Online'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.status === 'Online' ? 'bg-emerald-50 border-emerald-600 text-emerald-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Online</button>
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, status: 'Offline'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.status === 'Offline' ? 'bg-amber-50 border-amber-600 text-amber-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Offline</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'All'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.paymentMethod === 'All' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Semua</button>
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'Cash'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.paymentMethod === 'Cash' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Cash</button>
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'Transfer'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.paymentMethod === 'Transfer' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Transfer</button>
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'QRIS'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.paymentMethod === 'QRIS' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>QRIS</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Jenis Pesanan</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, jenisPesanan: 'All'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.jenisPesanan === 'All' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Semua</button>
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, jenisPesanan: 'Normal'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.jenisPesanan === 'Normal' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Normal</button>
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, jenisPesanan: 'Compliment'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.jenisPesanan === 'Compliment' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Compliment</button>
                  </div>
                </div>
            </div>
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 pb-safe">
              <button 
                disabled={JSON.stringify(tempHistoryFilter) === JSON.stringify(appliedHistoryFilter)}
                onClick={() => { setAppliedHistoryFilter(tempHistoryFilter); setShowHistoryFilter(false); }}
                className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs py-3.5 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider cursor-pointer"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {historyModalTx && createPortal(
        <div className="fixed inset-0 z-[100000] bg-zinc-950/60 backdrop-blur-sm transition-all duration-200" onClick={() => setHistoryModalTx(null)}>
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100001] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                {activeBranch === 'ADMIN' ? 'Detail Pesanan' : 'Pratinjau Struk'}
              </h3>
              <button 
                onClick={() => setHistoryModalTx(null)}
                className="p-1.5 bg-white hover:bg-zinc-100 rounded-lg text-zinc-700 transition shadow-sm border border-zinc-200 cursor-pointer active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-5 max-h-[60vh] overflow-y-auto bg-neutral-100">
              {activeBranch === 'ADMIN' ? (
                <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm text-left">
                  <div className="flex justify-between items-start mb-5 border-b border-zinc-100 pb-4">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest">ID Pesanan</p>
                      <p className="text-sm font-black text-zinc-900 mt-1">{historyModalTx.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-bold uppercase tracking-widest inline-block">{historyModalTx.paymentMethod || (historyModalTx.pesanan?.JENIS_PESANAN === 'Compliment' ? 'Compliment' : '')}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-medium whitespace-nowrap">Waktu</span>
                      <span className="text-zinc-900 font-bold text-right">{new Date(historyModalTx.timestamp).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-medium whitespace-nowrap">Cabang</span>
                      <span className="text-zinc-900 font-bold text-right">{cabangList.find(c => String(c.ID_CABANG) === String(historyModalTx.cabang))?.NAMA_CABANG || historyModalTx.cabang}</span>
                    </div>
                    <div className="pt-4 mt-2 border-t border-dashed border-zinc-200">
                      <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-3">Item Pesanan</p>
                      <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-[-1px] before:w-[3px] before:bg-zinc-100 before:rounded-full ml-1 pl-3">
                        {historyModalTx.detail?.map((item, idx) => (
                           <div key={`d-${idx}`} className="flex justify-between items-start text-sm pb-3 last:pb-0">
                             <div className="text-left font-medium text-zinc-800">
                               <span className="font-bold text-zinc-900">{item.QTY}x</span> {item.NAMA_MENU} 
                               {item.VARIAN_NAME && <div className="text-[10px] text-zinc-400 mt-0.5">&bull; {item.VARIAN_NAME}</div>}
                             </div>
                             <div className="text-right font-medium text-zinc-700 whitespace-nowrap">
                               Rp{((item.HARGA_SATUAN || item.HARGA || 0) * item.QTY).toLocaleString('id-ID')}
                             </div>
                           </div>
                        ))}
                        {/* Structured Promos */}
                        {historyModalTx.pesanan?.PROMOS?.map((p, idx) => {
                          const price = p.discountedPrice !== undefined ? p.discountedPrice : p.varian.HARGA;
                          return (
                            <div key={`p-${idx}`} className="flex justify-between items-start text-sm pb-3 last:pb-0">
                              <div className="text-left font-bold text-zinc-900">
                                <span className="font-bold">{p.quantity}x</span> {p.menu.NAMA_MENU.replace('[PROMO] ', '')}
                              </div>
                              <div className="text-right font-bold text-zinc-900 whitespace-nowrap">
                                -Rp{Math.abs(price * p.quantity).toLocaleString('id-ID')}
                              </div>
                            </div>
                          );
                        })}
                        {/* Parsed Promos from CATATAN */}
                        {(() => {
                          if (historyModalTx.pesanan?.PROMOS?.length) return null;
                          const catatan = historyModalTx.pesanan?.CATATAN || '';
                          const promoPart = catatan.split('|')[0]?.trim();
                          if (!promoPart || promoPart === 'Promo/Potongan') return null;
                          
                          return promoPart.split(', ').map((item, idx) => {
                            const match = item.match(/(.*) \(-Rp([\d.]+)\)/);
                            if (!match) return null;
                            return (
                              <div key={`pc-${idx}`} className="flex justify-between items-start text-sm pb-3 last:pb-0">
                                <div className="text-left font-bold text-zinc-900">
                                  {match[1]}
                                </div>
                                <div className="text-right font-bold text-zinc-900 whitespace-nowrap">
                                  -Rp{match[2]}
                                </div>
                              </div>
                            );
                          });
                        })()}
                        {/* Structured Charges */}
                        {historyModalTx.pesanan?.ADDITIONAL_CHARGES?.map((c, idx) => (
                           <div key={`c-${idx}`} className="flex justify-between items-start text-sm pb-3 last:pb-0">
                             <div className="text-left font-bold text-zinc-900">
                               <span className="font-bold">{c.qty}x</span> {c.name}
                             </div>
                             <div className="text-right font-bold text-zinc-900 whitespace-nowrap">
                               Rp{(c.price * c.qty).toLocaleString('id-ID')}
                             </div>
                           </div>
                        ))}
                        {/* Parsed Charges from CATATAN */}
                        {(() => {
                          if (historyModalTx.pesanan?.ADDITIONAL_CHARGES?.length) return null;
                          const catatan = historyModalTx.pesanan?.CATATAN || '';
                          const chargePart = catatan.split('|')[1]?.trim();
                          if (!chargePart) return null;
                          
                          return chargePart.split(', ').map((item, idx) => {
                            const match = item.match(/(.*) \(Rp([\d.]+)\)/);
                            if (!match) return null;
                            return (
                              <div key={`cc-${idx}`} className="flex justify-between items-start text-sm pb-3 last:pb-0">
                                <div className="text-left font-bold text-zinc-900">
                                  {match[1]}
                                </div>
                                <div className="text-right font-bold text-zinc-900 whitespace-nowrap">
                                  Rp{match[2]}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                    <div className="pt-4 mt-2 border-t border-dashed border-zinc-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-zinc-900 uppercase tracking-widest">Total</span>
                        <span className="text-base font-black text-red-700">Rp{historyModalTx.totalAmount.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    {(() => {
                      const fullCatatan = historyModalTx.pesanan?.CATATAN;
                      if (!fullCatatan) return null;
                      
                      const parts = fullCatatan.split('|');
                      let displayNote = '';
                      if (parts.length >= 3) {
                        displayNote = parts[2].trim();
                      } else if (fullCatatan.includes('|')) {
                        displayNote = ''; 
                      } else {
                        displayNote = fullCatatan.trim();
                      }

                      if (!displayNote) return null;

                      return (
                        <div className="pt-4 mt-2 border-t border-dashed border-zinc-200">
                          <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-1">Catatan Pesanan</p>
                          <p className="text-xs text-zinc-700 bg-zinc-50 p-3 rounded-xl border border-zinc-100 leading-relaxed italic">
                            "{displayNote}"
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <ReceiptThermal 
                  transaction={historyModalTx} 
                  branchName={cabangList.find(c => String(c.ID_CABANG) === historyModalTx.cabang)?.NAMA_CABANG || historyModalTx.cabang || activeBranch} 
                  branchLocation={cabangList.find(c => String(c.ID_CABANG) === String(historyModalTx.cabang))?.LOKASI}
                />
              )}
            </div>
            
            {activeBranch !== 'ADMIN' && (
              <div className="p-4 border-t border-zinc-200 bg-zinc-50">
                <button 
                  className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 uppercase tracking-wider cursor-pointer" 
                  onClick={() => {
                    if (onSuccessPrint) {
                      onSuccessPrint(historyModalTx);
                      setHistoryModalTx(null);
                    } else {
                      onSelectTransaction(historyModalTx);
                    }
                  }}
                >
                  Cetak Struk Sekarang
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
