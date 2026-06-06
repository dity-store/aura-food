import React from 'react';
import { 
  Menu as MenuIcon, 
  Receipt, 
  BarChart3, 
  TrendingUp, 
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { resetProductsToDefault } from '../utils/db';

interface AdminPanelProps {
  onRefreshPOSCatalog: () => void;
}

export default function AdminPanel({ onRefreshPOSCatalog }: AdminPanelProps) {
  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* HEADER PANELS */}
      <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 h-28 w-28 bg-red-850/5 rounded-full blur-xl"></div>
        <div className="space-y-1.5 max-w-2xl">
          <span className="text-[10px] bg-red-100 text-red-950 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider">
            ADMINISTRATOR HUB
          </span>
          <h3 className="text-base font-black text-zinc-900 uppercase tracking-tight mt-2 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-red-755" />
            Panel Utama Admin Cabang Pusat
          </h3>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Selamat datang di gerbang pengawasan Aura Food. Di bawah ini adalah menu-metode administrator tingkat tinggi untuk memantau inventaris, menganalisis jurnal transaksi harian, menyusun rekapan laporan berkala, serta mengontrol bagan arus laba rugi secara keseluruhan.
          </p>
        </div>
      </div>

      {/* ADMIN BOX GRID CONTROLS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* CARD 1: MENU */}
        <div className="bg-white border border-zinc-200/80 hover:border-red-650/40 p-5 rounded-2xl transition shadow-sm hover:shadow-md cursor-pointer group active:scale-95 flex flex-col justify-between h-[150px]">
          <div className="h-10 w-10 rounded-xl bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-800 group-hover:bg-red-50 group-hover:text-red-750 transition group-hover:scale-105">
            <MenuIcon className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider group-hover:text-red-750 transition">Menu</h4>
            <p className="text-[10px] text-zinc-500 mt-1 leading-normal">Atur varias hidangan, stok bahan, dan penyesuaian harga jual menu.</p>
          </div>
        </div>

        {/* CARD 2: TRANSAKSI */}
        <div className="bg-white border border-zinc-200/80 hover:border-red-650/40 p-5 rounded-2xl transition shadow-sm hover:shadow-md cursor-pointer group active:scale-95 flex flex-col justify-between h-[150px]">
          <div className="h-10 w-10 rounded-xl bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-800 group-hover:bg-red-50 group-hover:text-red-750 transition group-hover:scale-105">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider group-hover:text-red-750 transition">Transaksi</h4>
            <p className="text-[10px] text-zinc-500 mt-1 leading-normal">Pantau mutasi penjualan terpusat, status sync, dan audit struk digital.</p>
          </div>
        </div>

        {/* CARD 3: LAPORAN */}
        <div className="bg-white border border-zinc-200/80 hover:border-red-650/40 p-5 rounded-2xl transition shadow-sm hover:shadow-md cursor-pointer group active:scale-95 flex flex-col justify-between h-[150px]">
          <div className="h-10 w-10 rounded-xl bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-800 group-hover:bg-red-50 group-hover:text-red-750 transition group-hover:scale-105">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider group-hover:text-red-750 transition">Laporan</h4>
            <p className="text-[10px] text-zinc-500 mt-1 leading-normal">Grafik analisis performa kasir harian dan mingguan seluruh cabang.</p>
          </div>
        </div>

        {/* CARD 4: LABA RUGI */}
        <div className="bg-white border border-zinc-200/80 hover:border-red-650/40 p-5 rounded-2xl transition shadow-sm hover:shadow-md cursor-pointer group active:scale-95 flex flex-col justify-between h-[150px]">
          <div className="h-10 w-10 rounded-xl bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-800 group-hover:bg-red-50 group-hover:text-red-750 transition group-hover:scale-105">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider group-hover:text-red-750 transition">Laba Rugi</h4>
            <p className="text-[10px] text-zinc-500 mt-1 leading-normal">Estimasi keuntungan bersih setelah pajak dan potongan bahan operasional.</p>
          </div>
        </div>
      </div>

      {/* MINIMAL SEED TRIGGER IN ADMIN SO CATALOG RE-SEED CAN BE QUICKLY RUN */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-zinc-500" />
          <p className="text-[11px] text-zinc-650 font-medium font-sans">Butuh mereset atau menyetel ulang katalog produk lokal ke kondisi default Aura Food?</p>
        </div>
        <button
          onClick={async () => {
            if (window.confirm("Apakah Anda yakin ingin menyetel ulang katalog produk lokal kasir ke menu bawaan Aura Food?")) {
              await resetProductsToDefault();
              onRefreshPOSCatalog();
              alert("Katalog diatur ulang ke bawaan!");
            }
          }}
          className="bg-white border border-zinc-200 hover:bg-zinc-100 font-extrabold text-[10px] text-zinc-700 px-4 py-2 rounded-xl transition cursor-pointer active:scale-95 uppercase tracking-wider shrink-0"
        >
          Reset Katalog Produk Bawaan
        </button>
      </div>

    </div>
  );
}
