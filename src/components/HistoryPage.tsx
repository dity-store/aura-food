import React, { useState, useEffect } from 'react';
import { Transaction, Cabang } from '../types';
import { getTransactions, getTransactionsFromGAS } from '../utils/db';
import { Search, Filter, X, ArrowLeft, ReceiptText, ChevronLeft, ChevronRight, CalendarClock, Printer, Trash2, Database, Plus } from 'lucide-react';
import ReceiptThermal from './ReceiptThermal';

type SortOrder = 'newest' | 'oldest';
interface HistoryFilterState {
  status: 'All' | 'Online' | 'Offline';
  sortOrder: SortOrder;
  paymentMethod: 'All' | 'Cash' | 'E-Wallet' | 'Debit Card';
  date: string | null;
  branch: string; // 'All' or specific branch ID (only for ADMIN)
}

interface HistoryPageProps {
  activeBranch: string; // If 'ADMIN', show branch filter and hide "Cetak Struk", show details
  cabangList: Cabang[];
  onSelectTransaction: (tx: Transaction) => void;
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
    branch: initialBranchFilter || 'All'
  };
};

export default function HistoryPage({ activeBranch, cabangList, onSelectTransaction, onBack, onCreateTransaction, refreshTrigger, initialBranchFilter }: HistoryPageProps) {
  const [history, setHistory] = useState<Transaction[]>([]);
  const [isSearchHistoryActive, setIsSearchHistoryActive] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [showHistoryFilter, setShowHistoryFilter] = useState<boolean>(false);
  const [appliedHistoryFilter, setAppliedHistoryFilter] = useState<HistoryFilterState>(() => getDefaultFilterState(initialBranchFilter));
  const [tempHistoryFilter, setTempHistoryFilter] = useState<HistoryFilterState>(() => getDefaultFilterState(initialBranchFilter));
  const [historyModalTx, setHistoryModalTx] = useState<Transaction | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        let localTxs: Transaction[] = [];
        if (activeBranch === 'ADMIN') {
          localTxs = await getTransactions();
          try {
            const remoteTxs = await getTransactionsFromGAS('All');
            if (remoteTxs && remoteTxs.length > 0) {
               const localMap = new Map(localTxs.map(t => [t.id, t]));
               remoteTxs.forEach(rt => {
                 if (!localMap.has(rt.id)) {
                   localTxs.push(rt);
                 } else {
                   localMap.set(rt.id, {...localMap.get(rt.id)!, status: 'synced'});
                   localTxs = Array.from(localMap.values());
                 }
               });
            }
          } catch (e) {}
        } else {
          const allTxs = await getTransactions();
          localTxs = allTxs.filter(tx => String(tx.cabang) === activeBranch);
        }
        
        localTxs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setHistory(localTxs);
      } catch (err) {
        console.error("Error loading history:", err);
      }
    }
    loadData();
  }, [activeBranch, refreshTrigger]);

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

      <main className="flex-1 overflow-y-auto w-full pb-safe bg-neutral-50 relative">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
            {history.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center bg-zinc-50 border border-zinc-200/50 rounded-2xl">
                  <ReceiptText className="h-8 w-8 text-zinc-300 mb-3" />
                  <p className="text-zinc-500 font-medium text-xs mb-3">Belum ada transaksi dibuat.</p>
                  {activeBranch !== 'ADMIN' && (
                    <button 
                      onClick={onCreateTransaction || onBack}
                      className="bg-red-50 text-red-700 hover:bg-red-100 font-bold text-[10px] px-4 py-2 rounded-xl transition flex items-center gap-2 active:scale-95 uppercase tracking-wider cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Buat Transaksi
                    </button>
                  )}
                </div>
            ) : filteredHistory.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center bg-zinc-50 border border-zinc-200/50 rounded-2xl animate-in fade-in duration-200">
                  <Search className="h-8 w-8 text-zinc-300 mb-3" />
                  <p className="text-zinc-500 font-medium text-xs mb-4">Tidak ada hasil untuk pencarian/filter ini.<br/>Coba kata kunci lain.</p>
                  <button 
                    onClick={() => {
                      setIsSearchHistoryActive(false);
                      setHistorySearchQuery('');
                      setAppliedHistoryFilter(getDefaultFilterState());
                    }}
                    className="bg-red-50 text-red-700 hover:bg-red-100 font-bold text-[10px] px-4 py-2 rounded-xl transition flex items-center gap-2 active:scale-95 uppercase tracking-wider cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" /> Hapus Filter
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
                          <p className={`text-xs font-extrabold truncate text-zinc-900`}>{tx.id}</p>
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
                              {new Date(tx.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} &bull; {new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} &bull; {tx.paymentMethod}
                            </p>
                            {activeBranch === 'ADMIN' && (
                              <p className="text-[10px] text-zinc-400 font-medium mb-1">
                                Cabang: {cabangList.find(c => String(c.ID_CABANG) === tx.cabang)?.NAMA_CABANG || tx.cabang}
                              </p>
                            )}
                            <span className="text-[10px] text-red-750 font-bold hover:underline inline-flex items-center gap-0.5 transition">
                              {activeBranch === 'ADMIN' ? 'Lihat Detail Pesanan' : 'Lihat Cetak Struk Kasir'}
                            </span>
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

      {showHistoryFilter && (
        <div className="fixed inset-0 z-[100000] bg-zinc-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200" onClick={() => setShowHistoryFilter(false)}>
          <div className="bg-white w-full max-w-sm h-full shadow-2xl flex flex-col animate-in slide-in-from-right-1/2" onClick={e => e.stopPropagation()}>
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
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'E-Wallet'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.paymentMethod === 'E-Wallet' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>E-Wallet</button>
                    <button 
                      onClick={() => setTempHistoryFilter({...tempHistoryFilter, paymentMethod: 'Debit Card'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempHistoryFilter.paymentMethod === 'Debit Card' ? 'bg-red-50 border-red-700 text-red-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Debit Card</button>
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
        </div>
      )}
      {historyModalTx && (
        <div className="fixed inset-0 z-[100000] bg-zinc-950/60 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={() => setHistoryModalTx(null)}>
          <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
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
                      <p className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-bold uppercase tracking-widest inline-block">{historyModalTx.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-medium whitespace-nowrap">Waktu</span>
                      <span className="text-zinc-900 font-bold text-right">{new Date(historyModalTx.timestamp).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500 font-medium whitespace-nowrap">Cabang</span>
                      <span className="text-zinc-900 font-bold text-right">{cabangList.find(c => String(c.ID_CABANG) === historyModalTx.cabang)?.NAMA_CABANG || historyModalTx.cabang}</span>
                    </div>
                    <div className="pt-4 mt-2 border-t border-dashed border-zinc-200">
                      <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-3">Item Pesanan</p>
                      <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-[-1px] before:w-[3px] before:bg-zinc-100 before:rounded-full ml-1 pl-3">
                        {historyModalTx.detail?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start text-sm pb-3 last:pb-0">
                            <div className="text-left font-medium text-zinc-800">
                              <span className="font-bold text-zinc-900">{item.QTY}x</span> {item.NAMA_MENU} 
                              {item.VARIAN_NAME && <div className="text-[10px] text-zinc-400 mt-0.5">&bull; {item.VARIAN_NAME}</div>}
                            </div>
                            <div className="text-right font-medium text-zinc-700 whitespace-nowrap">
                              Rp{(item.HARGA * item.QTY).toLocaleString('id-ID')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 mt-2 border-t border-dashed border-zinc-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-zinc-900 uppercase tracking-widest">Total</span>
                        <span className="text-base font-black text-red-700">Rp{historyModalTx.totalAmount.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <ReceiptThermal transaction={historyModalTx} branchName={cabangList.find(c => String(c.ID_CABANG) === historyModalTx.cabang)?.NAMA_CABANG || historyModalTx.cabang || activeBranch} />
              )}
            </div>
            
            {activeBranch !== 'ADMIN' && (
              <div className="p-4 border-t border-zinc-200 bg-zinc-50">
                <button className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 uppercase tracking-wider cursor-pointer" onClick={() => onSelectTransaction(historyModalTx)}>
                  Cetak Struk Sekarang
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
