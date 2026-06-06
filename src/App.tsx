import React, { useState, useEffect } from 'react';
import AuraDashboard from './components/AuraDashboard';
import POSSimulator from './components/POSSimulator';
import AdminPanel from './components/AdminPanel';
import ReceiptThermal from './components/ReceiptThermal';
import { Transaction } from './types';
import { getTransactions, seedProductsIfEmpty } from './utils/db';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Sliders, 
  MapPin,
  Building,
  Lock,
  LogOut,
  Database,
  UtensilsCrossed,
  ChevronRight,
  X,
  Calendar,
  User
} from 'lucide-react';

// Cache logo in memory to prevent processing/reloading during app lifetime
const logoCache = new Image();
logoCache.src = '/logo.png';

export default function App() {
  const [activeBranch, setActiveBranch] = useState<string>(() => localStorage.getItem('AURA_FOOD_BRANCH') || '');
  const [isCheckoutPageActive, setIsCheckoutPageActive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'admin'>(() => {
    const branch = localStorage.getItem('AURA_FOOD_BRANCH') || '';
    if (branch === 'ADMIN') return 'dashboard';
    return 'pos';
  });
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  
  const [gasUrl, setGasUrl] = useState<string>(() => {
    const saved = localStorage.getItem('AURA_FOOD_GAS_URL');
    if (!saved) {
      localStorage.setItem('AURA_FOOD_GAS_URL', 'https://script.google.com/macros/s/AKfycbzlVeWkqH3aj1JNc0XHIywMtXOG75arHK4gFn-_VKD6iXciBZAaQBiIsB4tTGI_lzLi/exec');
      return 'https://script.google.com/macros/s/AKfycbzlVeWkqH3aj1JNc0XHIywMtXOG75arHK4gFn-_VKD6iXciBZAaQBiIsB4tTGI_lzLi/exec';
    }
    return saved;
  });
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState<boolean>(false);
  const [showNetworkInfo, setShowNetworkInfo] = useState<boolean>(false);

  const handleReloadData = () => {
    setRefreshKey(prev => prev + 1);
  };

  const loadRecentTxs = async () => {
    try {
      const txs = await getTransactions();
      const filtered = activeBranch === 'ADMIN'
        ? txs
        : txs.filter(tx => tx.cabang === activeBranch);
      setRecentTransactions(filtered.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    seedProductsIfEmpty();
    loadRecentTxs();

    setIsOnline(navigator.onLine);
    const handleOn = () => setIsOnline(true);
    const handleOff = () => setIsOnline(false);

    window.addEventListener('online', handleOn);
    window.addEventListener('offline', handleOff);

    return () => {
      window.removeEventListener('online', handleOn);
      window.removeEventListener('offline', handleOff);
    };
  }, [refreshKey, gasUrl, activeBranch]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBranch = loginUsername.toUpperCase().trim();
    const cleanPassword = loginPassword.trim();

    const expectedPw = 
      cleanBranch === 'BENGKEL' ? 'bengkel123' :
      cleanBranch === 'PRAYA' ? 'praya123' :
      cleanBranch === 'MATARAM' ? 'mataram123' :
      cleanBranch === 'ADMIN' ? 'admin123' : '';

    if (expectedPw && cleanPassword === expectedPw) {
      localStorage.setItem('AURA_FOOD_BRANCH', cleanBranch);
      setActiveBranch(cleanBranch);
      if (cleanBranch === 'ADMIN') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('pos');
      }
      setLoginError('');
      setLoginPassword('');
      setIsCheckoutPageActive(false);
      handleReloadData();
    } else {
      if (!expectedPw) {
        setLoginError('Username/Cabang tidak ditemukan.');
      } else {
        setLoginError('Password yang Anda masukkan salah untuk cabang terpilih.');
      }
    }
  };

  const handleLogout = () => setShowLogoutModal(true);
  const executeLogout = () => {
    localStorage.removeItem('AURA_FOOD_BRANCH');
    setActiveBranch('');
    setSelectedTx(null);
    setActiveTab('pos');
    setIsCheckoutPageActive(false);
    setShowLogoutModal(false);
  };

  const disconnectGoogleSheet = () => setShowDisconnectModal(true);
  const executeDisconnect = () => {
    localStorage.setItem('AURA_FOOD_GAS_URL', 'https://script.google.com/macros/s/AKfycbzlVeWkqH3aj1JNc0XHIywMtXOG75arHK4gFn-_VKD6iXciBZAaQBiIsB4tTGI_lzLi/exec');
    setGasUrl('https://script.google.com/macros/s/AKfycbzlVeWkqH3aj1JNc0XHIywMtXOG75arHK4gFn-_VKD6iXciBZAaQBiIsB4tTGI_lzLi/exec');
    handleReloadData();
    setShowDisconnectModal(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-zinc-950 font-sans flex flex-col justify-between pb-24 md:pb-28">
      
      {/* GLOBAL HEADER */}
      {!isCheckoutPageActive && activeBranch && (
        <header className="bg-red-950 text-white shadow-md relative overflow-hidden border-b border-rose-900/40 py-4 sticky top-0 z-50">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 h-32 w-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 text-left">
              {/* Visual Red-Gold Logo */}
              <img src="/logo.png" alt="Aura Food Logo" className="h-10 w-10 sm:h-11 sm:w-11 rounded-full object-cover border-2 border-amber-400 shadow-md shrink-0 bg-white" />
              
              <div className="min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none uppercase truncate">
                    AURA FOOD <span className="opacity-80 font-medium">|</span> {activeBranch || 'MATARAM'}
                  </h1>
                  <button 
                    onClick={() => setShowNetworkInfo(true)}
                    className="relative flex items-center justify-center p-1.5 cursor-pointer transition active:scale-95 shrink-0"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full absolute ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                    <span className={`h-2.5 w-2.5 rounded-full animate-ping absolute ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  </button>
                </div>
                <p className="text-[10px] text-red-100/70 mt-1.5 leading-snug font-medium flex items-center gap-1 truncate max-w-full">
                  <MapPin className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                  <span className="truncate">Mataram, NTB &bull; <Calendar className="h-2.5 w-2.5 shrink-0 inline ml-1 mr-0.5 text-red-300" />{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 relative z-20 shrink-0">
              {activeBranch && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowLogoutModal(true);
                  }}
                  title="Keluar Sesi Cabang"
                  className="bg-red-900 border border-red-800 hover:bg-amber-500 hover:text-red-950 hover:border-amber-400 text-white p-2.5 sm:p-3 rounded-xl flex items-center justify-center transition shadow-[0_0_10px_rgba(0,0,0,0.1)] active:scale-95 cursor-pointer relative z-50 pointer-events-auto"
                >
                  <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {!activeBranch ? (
        <div className="max-w-md mx-auto px-4 py-12 flex-grow flex flex-col justify-center w-full">
          {/* LOGIN SAME AS ORIGINAL */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200/80 shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-800 via-amber-400 to-red-800"></div>
            
            <div className="text-center space-y-2">
              <div className="h-16 w-16 mx-auto rounded-full bg-white border border-red-200/60 shadow-sm overflow-hidden flex items-center justify-center p-0.5 animate-bounce">
                <img src="/logo.png" alt="Aura Food Logo" className="h-full w-full object-cover rounded-full" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-red-950 uppercase">Login Kasir Cabang</h2>
              <p className="text-xs text-zinc-505 leading-relaxed max-w-xs mx-auto text-center">
                Silakan pilih cabang Anda untuk masuk ke sistem dan mencatat transaksi.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-500 block uppercase tracking-wider">
                  Username Cabang
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-zinc-400">
                    <Building className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Masukkan username cabang..."
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-zinc-950 uppercase placeholder:text-zinc-400 placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-red-600 transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-zinc-500 block uppercase tracking-wider">
                  Sandi Keamanan
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-zinc-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Masukkan password keamanan..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-3 text-xs text-zinc-850 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600 transition"
                  />
                </div>
              </div>

              {loginError && (
                <p className="text-[11px] font-bold text-red-800 bg-red-50 p-2.5 rounded-xl border border-red-150 text-center">
                  &#9888; {loginError}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer uppercase tracking-wider"
              >
                LOGIN
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <main className={isCheckoutPageActive ? "w-full flex-grow flex flex-col bg-neutral-50" : "max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full flex-grow space-y-8"}>
            
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-fade-in">
                <AuraDashboard 
                  onNavigateToPOS={() => setActiveTab('pos')} 
                  onNavigateToAdmin={() => setActiveTab('admin')} 
                  activeBranch={activeBranch}
                />
                
                <div className="border-t border-zinc-200 pt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">Lihat Struk Thermal Aktif</h3>
                    </div>
                  </div>

                  {selectedTx ? (
                    <div className="relative pt-4">
                      <button 
                        onClick={() => setSelectedTx(null)}
                        className="absolute right-0 top-0 text-[10px] bg-red-50 text-red-700 hover:bg-red-100 font-bold px-3 py-1.5 rounded-full flex items-center gap-1 cursor-pointer transition active:scale-95 z-10"
                      >
                         Tutup <X className="h-3 w-3" />
                      </button>
                      <ReceiptThermal transaction={selectedTx} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {recentTransactions.map(tx => (
                        <div 
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="bg-white border border-zinc-200/80 hover:border-red-600/40 p-4 rounded-xl cursor-pointer transition shadow-sm flex justify-between items-center group active:scale-95 text-left"
                        >
                          <div>
                            <p className="text-xs font-bold text-zinc-900 group-hover:text-red-800 transition">{tx.id}</p>
                            <p className="text-[9px] text-zinc-400 mt-1">
                              {new Date(tx.timestamp).toLocaleTimeString('id-ID')} &bull; {tx.paymentMethod}
                            </p>
                          </div>
                          <div className="text-right pl-2">
                            <p className="text-xs font-extrabold text-zinc-800">Rp {tx.totalAmount.toLocaleString('id-ID')}</p>
                            <span 
                              className="text-[9px] font-bold text-red-700 flex items-center justify-end gap-0.5 mt-0.5 hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTx(tx);
                                setTimeout(() => document.getElementById('thermal-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                              }}
                            >
                              Lihat Struk <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pos' && (
              <div className={isCheckoutPageActive ? "flex-1 flex flex-col" : "space-y-6 animate-fade-in"}>
                <POSSimulator 
                  refreshTrigger={refreshKey}
                  onSelectTransaction={(tx) => setSelectedTx(tx)} 
                  selectedTransaction={selectedTx} 
                  activeBranch={activeBranch}
                  onCreatingStatusChange={setIsCheckoutPageActive}
                />

                {!isCheckoutPageActive && selectedTx && (
                  <div className="border-t border-zinc-200 pt-6 mt-8 space-y-4">
                     <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-zinc-900">Pratinjau Struk Kasir Terproses:</h3>
                      <button 
                        onClick={() => setSelectedTx(null)}
                        className="text-[10px] bg-red-50 text-red-700 hover:bg-red-100 font-bold px-3 py-1.5 rounded-full flex items-center gap-1 cursor-pointer transition active:scale-95"
                      >
                         Tutup <X className="h-3 w-3" />
                      </button>
                    </div>
                    <ReceiptThermal transaction={selectedTx} />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="space-y-6 animate-fade-in">
                <AdminPanel onRefreshPOSCatalog={handleReloadData} />
                
                <div className="bg-red-50 border border-red-100 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                  <div>
                    <h4 className="text-xs font-bold text-red-900 uppercase tracking-widest">Status Koneksi Database</h4>
                  </div>
                  <button
                    onClick={disconnectGoogleSheet}
                    className="bg-red-800 hover:bg-red-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  >
                    Putuskan Hubungan Database
                  </button>
                </div>
              </div>
            )}

          </main>

          {!isCheckoutPageActive && activeBranch === 'ADMIN' && (
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200/90 shadow-2xl pb-safe">
              <div className="max-w-md mx-auto px-6 h-16 sm:h-18 flex justify-around items-center relative">
                
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex-1 flex flex-col items-center justify-center p-2.5 transition active:scale-95 cursor-pointer ${
                    activeTab === 'dashboard' 
                      ? 'text-red-750 font-bold scale-105' 
                      : 'text-zinc-600 hover:text-zinc-700 font-medium'
                  }`}
                >
                  <LayoutDashboard className={`h-5 w-5 ${activeTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  <span className="text-[9px] mt-1 tracking-wide uppercase font-semibold">Laporan</span>
                </button>

                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex-1 flex flex-col items-center justify-center p-2.5 transition active:scale-95 cursor-pointer ${
                    activeTab === 'admin' 
                      ? 'text-red-750 font-bold scale-105' 
                      : 'text-zinc-600 hover:text-zinc-700 font-medium'
                  }`}
                >
                  <Sliders className={`h-5 w-5 ${activeTab === 'admin' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  <span className="text-[9px] mt-1 tracking-wide uppercase font-semibold">Admin</span>
                </button>

              </div>
            </nav>
          )}
        </>
      )}

      {/* MODALS */}
      {showLogoutModal && (
        <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowLogoutModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-zinc-200 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4 border border-red-200">
              <LogOut className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">Konfirmasi Logout</h3>
            <p className="text-xs text-zinc-600 mb-6 leading-relaxed">Apakah Anda yakin ingin keluar dari sesi cabang saat ini? Anda harus login kembali untuk mencatat pesanan.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase cursor-pointer transition">Batal</button>
              <button type="button" onClick={executeLogout} className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase cursor-pointer transition">Ya, Logout</button>
            </div>
          </div>
        </div>
      )}

      {showDisconnectModal && (
        <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowDisconnectModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-zinc-200 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">Konfirmasi Disconnect</h3>
            <p className="text-xs text-zinc-600 mb-6 leading-relaxed">Apakah Anda yakin ingin memutuskan koneksi dengan database saat ini dan beralih ke sistem bawaan otomatis?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDisconnectModal(false)} className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase cursor-pointer transition">Batal</button>
              <button type="button" onClick={executeDisconnect} className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase cursor-pointer transition">Putuskan</button>
            </div>
          </div>
        </div>
      )}

      {showNetworkInfo && (
        <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowNetworkInfo(false)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-xs text-center border border-zinc-200 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className={`h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4 border ${isOnline ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
               <span className={`h-4 w-4 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </div>
            <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">Status Jaringan</h3>
            <p className="text-xs text-zinc-600 mb-6 leading-relaxed">
              {isOnline 
                ? "Internet Tersedia. Semua data transaksi yang dibuat akan langsung tersinkronisasi ke sistem pusat secara otomatis." 
                : "Offline / Internet Terputus. Transaksi akan disimpan sementara di kasir Anda. Data otomatis dikirim saat sinyal internet kembali stabil."}
            </p>
            <button onClick={() => setShowNetworkInfo(false)} className="w-full py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase cursor-pointer transition">Mengerti</button>
          </div>
        </div>
      )}

    </div>
  );
}
