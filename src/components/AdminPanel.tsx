import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Settings, 
  RefreshCw, 
  Save,
  CheckCircle2,
  XCircle,
  Database,
  Server,
  AlertCircle
} from 'lucide-react';
import { getGASConfig, saveGASConfig, syncMasterDataFromGAS } from '../utils/db';
import { GASConfig } from '../types';

interface AdminPanelProps {
  onRefreshPOSCatalog: () => void;
}

export default function AdminPanel({ onRefreshPOSCatalog }: AdminPanelProps) {
  const [gasUrl, setGasUrl] = useState('');
  const [gasSheet, setGasSheet] = useState('Data');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success'|'error', msg: string} | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const cfg = getGASConfig();
    if (cfg) {
      setGasUrl(cfg.webAppUrl);
      setGasSheet(cfg.sheetName);
    }
  }, []);

  const handleSaveConfig = () => {
    saveGASConfig({ webAppUrl: gasUrl, sheetName: gasSheet });
    setSyncStatus({ type: 'success', msg: 'Konfigurasi GAS berhasil disimpan lokal.' });
    setTimeout(() => setSyncStatus(null), 3000);
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      if (!gasUrl) throw new Error("Harap isi Web App URL terlebih dahulu.");
      await syncMasterDataFromGAS();
      setSyncStatus({ type: 'success', msg: 'Sukses! Master Data telah ditarik.' });
      onRefreshPOSCatalog();
    } catch (err: any) {
      setSyncStatus({ type: 'error', msg: err.message || 'Gagal sinkronisasi data.' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 text-left">
      {/* HEADER COMPACT */}
      <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 h-40 w-40 bg-red-850/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-red-50 border border-red-100 text-red-750 flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <span className="text-[10px] bg-red-100 text-red-950 font-extrabold px-2 py-1 rounded inline-block uppercase tracking-wider w-fit">
                ADMINISTRATOR HUB
              </span>
              <button 
                onClick={() => setShowExplanation(true)}
                className="shrink-0 w-full sm:w-auto bg-zinc-900 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-zinc-800 transition active:scale-95 shadow-sm"
              >
                <Server className="h-3.5 w-3.5 text-sky-400" />
                Penjelasan Integrasi Live
              </button>
            </div>
            <h3 className="text-base font-black text-zinc-900 uppercase tracking-tight">Setelan Sistem Admin</h3>
            <p className="text-[10px] sm:text-xs text-zinc-500 mt-1 leading-relaxed max-w-sm">
              Panel kontrol utama untuk sinkronisasi master data (cabang, menu) dengan server backend Google Apps Script secara terpusat untuk multi-cabang.
            </p>
          </div>
        </div>
      </div>

      {/* GAS CONFIGURATION */}
      <div className="bg-white border border-zinc-200/80 p-5 sm:p-6 rounded-[24px] shadow-sm">
        <div className="flex items-center gap-2 mb-5 border-b border-zinc-100 pb-4">
          <Database className="h-5 w-5 text-zinc-900 stroke-[2]" />
          <h4 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Konektor Database GAS</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-600 tracking-wider">Web App URL (Gas)</label>
            <input 
              type="text" 
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 sm:py-3.5 outline-none focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 transition shadow-inner"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-600 tracking-wider">Sheet Master Target</label>
            <input 
              type="text" 
              value={gasSheet}
              onChange={(e) => setGasSheet(e.target.value)}
              placeholder="Misal: Data atau Master"
              className="w-full text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 sm:py-3.5 outline-none focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100 transition shadow-inner"
            />
          </div>
        </div>

        {syncStatus && (
          <div className={`mb-5 p-3 sm:p-4 rounded-xl border flex items-center gap-3 text-xs sm:text-sm font-bold animate-in zoom-in-95 ${
            syncStatus.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-sm shadow-emerald-100' 
              : 'bg-red-50 text-red-800 border-red-200 shadow-sm shadow-red-100'
          }`}>
            {syncStatus.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
            <span className="leading-snug">{syncStatus.msg}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-zinc-100">
          <button
            onClick={handleSaveConfig}
            className="w-full sm:w-auto mt-4 sm:flex-[1] bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black text-[10px] px-5 py-4 rounded-xl transition cursor-pointer active:scale-95 uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" /> Simpan Konfig
          </button>
          
          <button
            onClick={handleSyncData}
            disabled={isSyncing || !gasUrl}
            className="w-full sm:w-auto sm:mt-4 sm:flex-[2] bg-zinc-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-zinc-300 text-white font-extrabold text-[10px] px-4 py-4 rounded-xl transition cursor-pointer active:scale-95 uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Master Data Sekarang'}
          </button>
        </div>
      </div>
      
      {/* EXPLANATION MODAL */}
      {showExplanation && (
        <div className="fixed inset-0 z-[200000] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowExplanation(false)}>
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="bg-zinc-900 px-6 py-5 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Server className="h-4 w-4 text-sky-400" /> Blueprint Endpoint Multi-Cabang
              </h3>
              <button onClick={() => setShowExplanation(false)} className="text-zinc-400 hover:text-white transition"><AlertCircle className="h-5 w-5" /></button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto text-sm text-zinc-700 leading-relaxed space-y-5">
              <p>
                Aplikasi ini dibangun menggunakan arsitektur <strong>Offline-First via IndexedDB</strong>.  
                Artinya, jika Admin login di perangkatnya sendiri, aplikasi secara default <em>hanya melihat transaksi yang terjadi di perangkat/browser tersebut</em>.
              </p>
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                <h4 className="text-xs font-black text-sky-900 mb-2 uppercase tracking-wide">Untuk Mewujudkan Pantauan Multi-Cabang Real-Time:</h4>
                <p className="text-xs text-sky-800 leading-relaxed mb-3">
                  Anda memerlukan modifikasi <strong>Google Apps Script (GAS)</strong> agar aplikasi dapat melakukan instruksi "Tarik Data Transaksi Semua Cabang".
                  Saat ini, fungsi <code className="bg-sky-200/50 px-1 rounded text-sky-900">syncMasterDataFromGAS()</code> hanya menarik "Master Menu & Cabang".
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-sky-800">
                  <li>Buat endpoint baru di Apps Script: <code className="font-bold">?action=getTransactions</code></li>
                  <li>Aplikasi (Admin) akan mengirimkan request <code>GET</code> ke endpoint tersebut dengan parameter seperti <code>startDate</code>, <code>endDate</code>, dan <code>cabangId</code>.</li>
                  <li>GAS membaca sheet <b>"Transaksi"</b> pada Spreadsheet Anda lalu diubah ke struktur JSON Array.</li>
                  <li>Aplikasi menerima JSON tersebut dan mengisi tabel Laporan secara terpusat tanpa bergantung pada IndexedDB lokal perangkat admin.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-black text-zinc-900 mb-2 uppercase tracking-wide">Contoh Skrip Endpoint GAS (doGet):</h4>
                <div className="bg-zinc-950 rounded-xl p-4 overflow-x-auto text-sky-300 font-mono text-[10px] leading-relaxed">
<pre>{`if (e.parameter.action === 'getTransactions') {
  const sheet = ss.getSheetByName("Transaksi");
  const data = sheet.getDataRange().getValues();
  let result = [];
  // Baris pertama = Header
  for(let i=1; i<data.length; i++){
    result.push({
      tgl: Utilities.formatDate(data[i][0], "Asia/Makassar", "yyyy-MM-dd"),
      cabang: data[i][1], // ID_CABANG
      jenis: data[i][2],
      keterangan: data[i][3],
      masuk: data[i][4],
      keluar: data[i][5]
    });
  }
  return ContentService.createTextOutput(JSON.stringify({
    status: "success", 
    data: result
  })).setMimeType(ContentService.MimeType.JSON);
}`}</pre>
                </div>
              </div>
              <p className="text-xs text-zinc-500 bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                Laporan yang Anda lihat di belakang layar saat ini adalah murni transaksi lokal (IndexedDB) dari emulator atau perangkat ini. 
                Gunakan konsep endpoint JSON di atas untuk menyempurnakan alur cloud-sync multi-cabang.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
