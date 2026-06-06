import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { getTransactions, getSyncQueue } from '../utils/db';
import { TrendingUp, ShoppingBag, Landmark, Clock, Database, ChevronRight, Activity, AlertCircle, Sparkles } from 'lucide-react';

interface AuraDashboardProps {
  onNavigateToPOS: () => void;
  onNavigateToAdmin: () => void;
  activeBranch: string;
}

export default function AuraDashboard({ onNavigateToPOS, onNavigateToAdmin, activeBranch }: AuraDashboardProps) {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allQueue, setAllQueue] = useState<any[]>([]);
  const [selectedAdminBranch, setSelectedAdminBranch] = useState<string>('Semua');

  useEffect(() => {
    async function loadStats() {
      try {
        const txs = await getTransactions();
        setAllTransactions(txs);
        
        const queue = await getSyncQueue();
        setAllQueue(queue);
      } catch (err) {
        console.error("Error loading dashboard statistics:", err);
      }
    }
    loadStats();
  }, [activeBranch]);

  const currentBranchFilter = activeBranch === 'ADMIN' ? selectedAdminBranch : activeBranch;
  
  const transactions = currentBranchFilter === 'Semua'
    ? allTransactions
    : allTransactions.filter(tx => tx.cabang === currentBranchFilter);

  const queueCount = currentBranchFilter === 'Semua'
    ? allQueue.length
    : allQueue.filter(item => item.payload?.cabang === currentBranchFilter).length;

  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);

  // Calc category split dynamically
  let mak = 0;
  let min = 0;
  transactions.forEach(tx => {
    tx.items.forEach(item => {
      if (item.product.category === 'Makanan') {
        mak += item.quantity;
      } else if (item.product.category === 'Minuman') {
        min += item.quantity;
      }
    });
  });

  const categorySales = { Makanan: mak, Minuman: min };

  const foodRatio = categorySales.Makanan + categorySales.Minuman > 0 
    ? Math.round((categorySales.Makanan / (categorySales.Makanan + categorySales.Minuman)) * 100)
    : 50;

  return (
    <div className="space-y-6 animate-fade-in">

      {activeBranch === 'ADMIN' && (
        <div className="bg-zinc-900 border border-zinc-800 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm text-left">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 bg-red-950/80 border border-red-900/60 text-red-500 rounded-xl flex items-center justify-center">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pemantau Mutli-Cabang</h4>
              <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed max-w-sm sm:max-w-md">
                Gunakan filter di samping untuk melihat riwayat aktivitas keuangan, status sinc, dan detail transaksi spesifik dari masing-masing cabang.
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 self-stretch sm:self-auto shrink-0 flex-wrap sm:flex-nowrap">
            {['Semua', 'BENGKEL', 'PRAYA', 'MATARAM'].map((branch) => (
              <button
                key={branch}
                onClick={() => setSelectedAdminBranch(branch)}
                className={`flex-1 sm:flex-none uppercase text-[10px] sm:text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition cursor-pointer active:scale-95 ${
                  selectedAdminBranch === branch
                    ? 'bg-red-850 text-white border border-red-750 shadow-md'
                    : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-350 border border-zinc-750/30'
                }`}
              >
                {branch === 'Semua' ? 'Semua Cabang' : branch}
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
              Rp {totalRevenue.toLocaleString('id-ID')}
            </h3>
          </div>
        </div>

        {/* TRANSACTIONS COUNT CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="text-[10px] text-zinc-500 bg-zinc-100 font-bold px-1.5 py-0.5 rounded-md">
              Lokal
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold">Total Pesanan</p>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
              {transactions.length} Transaksi
            </h3>
          </div>
        </div>

        {/* SYNC QUEUE BUFFER CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Database className="h-5 w-5" />
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              queueCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {queueCount > 0 ? 'Pending' : 'Sinkron'}
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold">Belum Terkirim</p>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
              {queueCount} Transaksi
            </h3>
          </div>
        </div>

        {/* SINKRONISASI STATUS CARD */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
              <Activity className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold">Status Pengiriman</p>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1">
              {transactions.length > 0 
                ? `${Math.round(((transactions.length - queueCount) / transactions.length) * 100)}% Terkirim` 
                : '100% Beres'}
            </h3>
          </div>
        </div>

      </div>

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
            <div className="flex justify-between text-xs text-zinc-550">
              <span className="flex items-center gap-1.5 font-semibold text-red-900">
                <span className="h-2 w-2 rounded-full bg-red-650"></span>
                Makanan ({categorySales.Makanan} pcs)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                Minuman ({categorySales.Minuman} pcs)
              </span>
            </div>

            <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden flex">
              <div className="bg-red-650" style={{ width: `${foodRatio}%` }}></div>
              <div className="bg-amber-500 flex-1"></div>
            </div>

            <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-xl space-y-1.5 text-[11px] text-zinc-500">
              <p className="font-bold text-zinc-800">Analisis Favorit:</p>
              {categorySales.Makanan === 0 && categorySales.Minuman === 0 ? (
                <p>Belum ada rekaman preferensi makanan atau minuman pelanggan.</p>
              ) : categorySales.Makanan >= categorySales.Minuman ? (
                <p>Pelanggan paling gemar membeli jenis <strong>Makanan</strong> (seperti Dimsum Grill Mentai hangat atau Quesadillas gurih).</p>
              ) : (
                <p>Pelanggan paling suka menikmati pesanan <strong>Minuman</strong> dingin menyegarkan, khususnya Es Lemonade Aura.</p>
              )}
            </div>
          </div>
        </div>

        {/* RECENT LOCAL HISTORY LIST */}
        <div className="lg:col-span-2 bg-white border border-zinc-200/80 p-5 rounded-2xl shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center justify-between border-b border-zinc-100 pb-3">
            <span>Aktivitas Transaksi Terkini</span>
            <Clock className="h-4 w-4 text-zinc-400" />
          </h4>

          <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="h-6 w-6 text-zinc-300 mb-1" />
                <p className="text-xs text-zinc-400 italic">Belum ada transaksi dibuat.</p>
              </div>
            ) : (
              transactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 hover:bg-zinc-50 transition"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="h-2 w-2 rounded-full bg-zinc-400 shrink-0"></div>
                    <div className="truncate text-left">
                      <p className="text-xs font-bold text-zinc-950 truncate">{tx.id}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {new Date(tx.timestamp).toLocaleString('id-ID')} &bull; {tx.paymentMethod}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <p className="text-xs font-extrabold text-zinc-900">
                      Rp {tx.totalAmount.toLocaleString('id-ID')}
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

    </div>
  );
}
