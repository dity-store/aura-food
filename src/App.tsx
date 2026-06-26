import React, { useState, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import AuraDashboard from './components/AuraDashboard';
import POSSimulator from './components/POSSimulator';
import AdminPanel from './components/AdminPanel';
import ReportsPanel from './components/ReportsPanel';
import ReceiptThermal from './components/ReceiptThermal';
import HistoryPage from './components/HistoryPage';
import RekapOperasionalPanel from './components/RekapOperasionalPanel';
import { Transaction, Cabang } from './types';
import { getTransactions, seedMasterDataIfEmpty, getMasterData, processSyncQueue, syncMasterDataFromGAS, saveMasterData } from './utils/db';
import { printReceipt } from './utils/pdf';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings,
  FileText,
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
  User,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  Trash2,
  Activity,
  Terminal,
  CheckCircle2,
  XCircle,
  History,
  ReceiptText,
  Printer,
  ClipboardList
} from 'lucide-react';


// Cache logo in memory to prevent processing/reloading during app lifetime
const logoCache = new Image();
logoCache.src = '/logo.png';

if (typeof window !== 'undefined' && !sessionStorage.getItem('AURA_APP_OPENED')) {
  sessionStorage.setItem('AURA_APP_OPENED', 'true');
  localStorage.removeItem('AURA_DASHBOARD_FILTER_BRANCH');
  localStorage.removeItem('AURA_DASHBOARD_FILTER_DATE');
  localStorage.removeItem('AURA_REPORTS_FILTER_CABANG');
  localStorage.removeItem('AURA_REPORTS_FILTER_PERIODE');
  localStorage.removeItem('AURA_REPORTS_FILTER_TYPE');
}

export default function App() {
  const [activeBranch, setActiveBranch] = useState<string>(() => localStorage.getItem('AURA_FOOD_BRANCH') || '');
  const [storedBranchName, setStoredBranchName] = useState<string>(() => localStorage.getItem('AURA_FOOD_BRANCH_NAME') || '');
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const activeBranchName = cabangList.find(c => String(c.ID_CABANG) === String(activeBranch))?.NAMA_CABANG || (activeBranch === 'ADMIN' ? 'ADMIN' : (storedBranchName || activeBranch));
  const [isCheckoutPageActive, setIsCheckoutPageActive] = useState<boolean>(false);
  
  type TabTypes = 'dashboard' | 'pos' | 'admin' | 'laporan' | 'history' | 'rekap_operasional';
  
  const [activeTab, setActiveTab] = useState<TabTypes>(() => {
    const branch = localStorage.getItem('AURA_FOOD_BRANCH') || '';
    if (branch === 'ADMIN') return 'dashboard';
    return 'pos';
  });
  const [historyBranchFilter, setHistoryBranchFilter] = useState<string>('');
  const [posInitialCreateMode, setPosInitialCreateMode] = useState<boolean>(false);

  const [isAdminModuleActive, setIsAdminModuleActive] = useState<boolean>(false);
  const isFullScreenTab = isCheckoutPageActive || activeTab === 'history' || activeTab === 'rekap_operasional';

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  
  const [gasUrl, setGasUrl] = useState<string>(() => {
    const saved = localStorage.getItem('AURA_FOOD_GAS_URL');
    if (!saved) {
      localStorage.setItem('AURA_FOOD_GAS_URL', 'https://script.google.com/macros/s/AKfycbyQbjH6133fuppW7ercx1bAJwX4P1J37VBaV-JY6Z3gDnWLsqzxrYuEmCngS-zIXGjW/exec');
      return 'https://script.google.com/macros/s/AKfycbyQbjH6133fuppW7ercx1bAJwX4P1J37VBaV-JY6Z3gDnWLsqzxrYuEmCngS-zIXGjW/exec';
    }
    return saved;
  });
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const loginSuggestions = (cabangList || [])
    .map(c => c.NAMA_CABANG)
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .filter(name => {
      if (!loginUsername) return true;
      return name.toUpperCase().includes(loginUsername.toUpperCase()) && name.toUpperCase() !== loginUsername.toUpperCase();
    });

  // Diagnostic states
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [diagnosticStatus, setDiagnosticStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [diagnosticFoundBranches, setDiagnosticFoundBranches] = useState<Cabang[]>([]);
  const [dialogGasUrl, setDialogGasUrl] = useState<string>(gasUrl);
  const [dialogGasSheet, setDialogGasSheet] = useState<string>(() => {
    try {
      const cfg = localStorage.getItem('AURA_FOOD_GAS_CONFIG');
      if (cfg) return JSON.parse(cfg).sheetName || 'Data';
    } catch (e) {}
    return 'Data';
  });

  const runConnectionDiagnostic = async () => {
    setDiagnosticStatus('running');
    setDiagnosticLogs(['Memulai sinkronisasi koneksi sistem kasir...']);
    setDiagnosticFoundBranches([]);

    try {
      // 1. Check browser network status
      const online = navigator.onLine;
      setDiagnosticLogs(prev => [...prev, `[SISTEM] Status konektivitas browser: ${online ? 'ONLINE (Aktif)' : 'OFFLINE (Mati)'}`]);
      if (!online) {
        throw new Error('Sistem kasir offline. Hubungkan perangkat Anda ke WiFi atau data seluler terlebih dahulu.');
      }

      // 2. Validate URL structure
      setDiagnosticLogs(prev => [...prev, `[SISTEM] Memeriksa struktur URL Google Apps Script...`]);
      const targetUrlClean = dialogGasUrl.trim();
      if (!targetUrlClean) {
        throw new Error('Web App URL kosong. Silakan masukkan Web App URL Google Apps Script.');
      }
      if (!targetUrlClean.startsWith('https://script.google.com')) {
        setDiagnosticLogs(prev => [...prev, `⚠️ Peringatan: Tautan tidak standar (bukan beralamat script.google.com).`]);
      }

      // 3. Save current settings temporarily so fetch uses target
      const configObj = { webAppUrl: targetUrlClean, sheetName: dialogGasSheet.trim() };
      localStorage.setItem('AURA_FOOD_GAS_CONFIG', JSON.stringify(configObj));
      localStorage.setItem('AURA_FOOD_GAS_URL', targetUrlClean);
      setGasUrl(targetUrlClean);

      // 4. Fire request with clear response headers / query strings (cache-busting)
      const testUrl = new URL(targetUrlClean);
      testUrl.searchParams.append('action', 'getMasterData');
      testUrl.searchParams.append('sheetName', dialogGasSheet.trim());
      testUrl.searchParams.append('_timestamp', Date.now().toString());

      setDiagnosticLogs(prev => [...prev, `📡 [REQUEST] Mengirimkan data ke Google Apps Script (Metode: GET)...`]);
      setDiagnosticLogs(prev => [...prev, `🔗 [TARGET URL] ${testUrl.origin}${testUrl.pathname}?action=getMasterData&sheetName=${dialogGasSheet.trim()}`]);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

      const res = await fetch(testUrl.toString(), { 
        redirect: 'follow', 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);

      setDiagnosticLogs(prev => [...prev, `📥 [RESPONSE] Menerima sinyal balik dari HTTP. Status kode: ${res.status}`]);
      if (!res.ok) {
        throw new Error(`HTTP Error dari Google Server: ${res.status} (${res.statusText})`);
      }

      const result = await res.json();
      setDiagnosticLogs(prev => [...prev, `[SUKSES] [DECODE] Berhasil membaca format data dari Apps Script.`]);

      const data = result.data || result;
      if (data && (data.cabang || data.kategori || data.menu || data.varian)) {
        const branches = data.cabang || [];
        const activeBranches = branches.filter((c: any) => String(c.STATUS || '').trim().toUpperCase() === 'AKTIF');
        setDiagnosticFoundBranches(activeBranches);

        // Save immediately to replace standard database records (save all branches locally for admin module, but sync state with active only)
        await saveMasterData({
          cabang: branches,
          kategori: data.kategori || [],
          menu: data.menu || [],
          varian: data.varian || []
        });

        // Sync local App state cabang list (only active)
        setCabangList(activeBranches);

        setDiagnosticLogs(prev => [...prev, `SINKRONISASI SUKSES!`]);
        setDiagnosticLogs(prev => [...prev, `Ditemukan: ${branches.length} Cabang (Aktif: ${activeBranches.length}), ${data.menu?.length || 0} Menu.`]);
        setDiagnosticLogs(prev => [
          ...prev, 
          `🔑 Data Cabang dari Spreadsheets:` + activeBranches.map((c: any) => `\n- Nama Cabang: "${c.NAMA_CABANG}" -> Sandi: "${c.PASSWORD}"`).join('')
        ]);
        setDiagnosticStatus('success');
      } else {
        throw new Error('Sinyal sukses tapi struktur JSON data Master kosong/tidak dikenali (pastikan format sheet Anda sudah benar).');
      }
    } catch (err: any) {
      let friendlyError = err.message;
      if (err.name === 'AbortError') {
        friendlyError = 'Waktu tunggu habis (Request Timeout). Koneksi ke Apps Script terlalu lambat.';
      }
      setDiagnosticLogs(prev => [...prev, `ERROR: ${friendlyError}`]);
      setDiagnosticStatus('error');
    }
  };

  const clearCacheAndDestroyDb = async () => {
    if (window.confirm("PERINGATAN: Apakah Anda yakin ingin menghapus cache aplikasi?\n\nSemua riwayat transaksi offline, konfigurasi, dan sandi cabang akan dibersihkan seluruhnya dari memori browser Anda, lalu aplikasi dimulai ulang.")) {
      try {
        localStorage.clear();
        const req = indexedDB.deleteDatabase('Sistem Keuangan Aura Food');
        req.onsuccess = () => {
          window.location.reload();
        };
        req.onerror = () => {
          alert('Gagal membersihkan database lokal browser Anda.');
        };
      } catch (e: any) {
        alert('Gagal membersihkan cache offline: ' + e.message);
      }
    }
  };
  
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState<boolean>(false);
  const [showNetworkInfo, setShowNetworkInfo] = useState<boolean>(false);
  const [exitWarning, setExitWarning] = useState(false);

  useEffect(() => {
    // Initial pushState to give us a back-button buffer so the app doesn't close on first press
    if (!window.history.state || !window.history.state.appInit) {
      window.history.pushState({ appInit: true }, '', window.location.pathname);
    }
    
    // Hide native splash screen
    SplashScreen.hide().catch(err => console.log('Splash hide error:', err));
    
    // Capacitor Android hardware back button handler
    const backListener = CapacitorApp.addListener('backButton', (data) => {
      // 1. Broadcast custom backpress dispatch to child components
      const backEvent = new CustomEvent('aura-backpress', {
        cancelable: true,
        detail: { handled: false }
      });
      window.dispatchEvent(backEvent);

      if (backEvent.defaultPrevented || (backEvent.detail as any).handled) {
        return; // Handled by a component (modal, sheet closed)
      }

      // 2. Clear central App modals
      if (showLogoutModal) {
        setShowLogoutModal(false);
        return;
      }
      if (showDisconnectModal) {
        setShowDisconnectModal(false);
        return;
      }
      if (showNetworkInfo) {
        setShowNetworkInfo(false);
        return;
      }
      if (showDiagnosticModal) {
        setShowDiagnosticModal(false);
        return;
      }

      // 3. Navigate to Dashboard if not already there, else Exit grace period
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        return;
      }

      // 4. Dual-tap Exit grace period
      if (!exitWarning) {
        setExitWarning(true);
        setTimeout(() => setExitWarning(false), 2000);
      } else {
        CapacitorApp.exitApp().catch(() => {});
      }
    });

    return () => {
      backListener.then(listener => listener.remove()).catch(() => {});
    };
  }, [exitWarning, showLogoutModal, showDisconnectModal, showNetworkInfo, showDiagnosticModal, activeTab]);



  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 1. Broadcast custom backpress dispatch to child components
      const backEvent = new CustomEvent('aura-backpress', {
        cancelable: true,
        detail: { handled: false }
      });
      window.dispatchEvent(backEvent);

      if (backEvent.defaultPrevented || (backEvent.detail as any).handled) {
        window.history.pushState({ appInit: true }, '', window.location.pathname);
        return;
      }

      // 2. Clear central App modals
      if (showLogoutModal) {
        setShowLogoutModal(false);
        window.history.pushState({ appInit: true }, '', window.location.pathname);
        return;
      }
      if (showDisconnectModal) {
        setShowDisconnectModal(false);
        window.history.pushState({ appInit: true }, '', window.location.pathname);
        return;
      }
      if (showNetworkInfo) {
        setShowNetworkInfo(false);
        window.history.pushState({ appInit: true }, '', window.location.pathname);
        return;
      }
      if (showDiagnosticModal) {
        setShowDiagnosticModal(false);
        window.history.pushState({ appInit: true }, '', window.location.pathname);
        return;
      }

      // 3. Navigate to Dashboard if not already there, else Exit grace period
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        window.history.pushState({ appInit: true }, '', window.location.pathname);
        return;
      }

      // 4. Dual-tap Exit grace period
      if (!exitWarning) {
        setExitWarning(true);
        window.history.pushState({ appInit: true }, '', window.location.pathname);
        setTimeout(() => setExitWarning(false), 2000);
      } else {
        // Exit normally by blowing past state history or using Capacitor
        window.history.go(-2);
        CapacitorApp.exitApp().catch(() => {});
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [exitWarning, showLogoutModal, showDisconnectModal, showNetworkInfo, showDiagnosticModal, activeTab]);

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

  const [printingStatus, setPrintingStatus] = useState<'idle' | 'printing' | 'success'>('idle');

  // One-time migration to new GAS URL
  useEffect(() => {
    const oldUrl = 'https://script.google.com/macros/s/AKfycbzlVeWkqH3aj1JNc0XHIywMtXOG75arHK4gFn-_VKD6iXciBZAaQBiIsB4tTGI_lzLi/exec';
    const newUrl = 'https://script.google.com/macros/s/AKfycbyQbjH6133fuppW7ercx1bAJwX4P1J37VBaV-JY6Z3gDnWLsqzxrYuEmCngS-zIXGjW/exec';
    
    if (gasUrl === oldUrl) {
      console.log("Migrating to new GAS URL...");
      localStorage.setItem('AURA_FOOD_GAS_URL', newUrl);
      
      const cfgString = localStorage.getItem('AURA_FOOD_GAS_CONFIG');
      if (cfgString) {
        try {
          const cfg = JSON.parse(cfgString);
          if (cfg.webAppUrl === oldUrl) {
            cfg.webAppUrl = newUrl;
            localStorage.setItem('AURA_FOOD_GAS_CONFIG', JSON.stringify(cfg));
          }
        } catch (e) {}
      }
      
      setGasUrl(newUrl);
      setDialogGasUrl(newUrl);
    }
  }, [gasUrl]);

  useEffect(() => {
    // Seed and Load initial Master Data
    const loadMasterData = async () => {
      try {
        let currentCabangList = [];
        const data = await seedMasterDataIfEmpty();
        
        // Filter only active branches
        const activeBranches = (data.cabang || []).filter((c: any) => String(c.STATUS || '').trim().toUpperCase() === 'AKTIF');
        
        currentCabangList = activeBranches;
        setCabangList(activeBranches);

        // Auto-sync Master Data in background on startup if online
        if (navigator.onLine) {
          try {
            await syncMasterDataFromGAS();
            const updatedData = await getMasterData();
            if (updatedData && updatedData.cabang && updatedData.cabang.length > 0) {
              const activeUpdatedBranches = updatedData.cabang.filter((c: any) => String(c.STATUS || '').trim().toUpperCase() === 'AKTIF');
              currentCabangList = activeUpdatedBranches;
              setCabangList(activeUpdatedBranches);
            }
            handleReloadData(); // Refresh POSSimulator data
          } catch (syncErr) {
            console.warn("Background auto-sync of master data failed, using seeded/offline data:", syncErr);
          }
        }
        
        // Auto-logout if branch is invalid
        if (activeBranch && activeBranch !== 'ADMIN') {
          const isValid = currentCabangList.some((c: any) => String(c.ID_CABANG) === String(activeBranch));
          if (!isValid && currentCabangList.length > 0) {
            console.warn("Cabang tidak valid, melakukan auto-logout...");
            localStorage.removeItem('AURA_FOOD_BRANCH');
            localStorage.removeItem('AURA_FOOD_BRANCH_NAME');
            setActiveBranch('');
            setStoredBranchName('');
          }
        }
      } catch (err) {
        console.error("Gagal load data cabang", err);
      }
    };
    loadMasterData();

    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
        processSyncQueue().then(() => loadRecentTxs());
    }

    const handleOn = () => {
      setIsOnline(true);
      processSyncQueue().then(() => loadRecentTxs());
    };
    const handleOff = () => setIsOnline(false);

    window.addEventListener('online', handleOn);
    window.addEventListener('offline', handleOff);

    return () => {
      window.removeEventListener('online', handleOn);
      window.removeEventListener('offline', handleOff);
    };
  }, []);

  // Separated effect to reload recent transactions on key change
  useEffect(() => {
    loadRecentTxs();
  }, [refreshKey, activeBranch]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBranch = loginUsername.toUpperCase().trim();
    const cleanPassword = loginPassword.trim();
    
    setIsLoggingIn(true);
    setLoginError('');

    try {
      // 1. Check ADMIN first
      if (cleanBranch === 'ADMIN') {
        if (cleanPassword === 'admin123') {
           localStorage.setItem('AURA_FOOD_BRANCH', cleanBranch);
           localStorage.setItem('AURA_FOOD_BRANCH_NAME', cleanBranch);
           setActiveBranch(cleanBranch);
           setStoredBranchName(cleanBranch);
           setActiveTab('dashboard');
           setLoginError('');
           setLoginPassword('');
           setIsCheckoutPageActive(false);
           handleReloadData();
        } else {
           setLoginError('Password yang Anda masukkan salah untuk ADMIN.');
        }
        setIsLoggingIn(false);
        return;
      }

      // 2. Prepare local list (fallback to direct IndexedDB read if state is not hydrated)
      let currentList = cabangList;
      if (currentList.length === 0) {
         try {
            const localData = await getMasterData();
            if (localData && localData.cabang && localData.cabang.length > 0) {
               currentList = localData.cabang.filter((c: any) => String(c.STATUS || '').trim().toUpperCase() === 'AKTIF');
               setCabangList(currentList);
            }
         } catch (dbErr) {
            console.warn("Failed reading branches from local db during login:", dbErr);
         }
      }

      // 3. Find branch locally
      let foundCabang = currentList.find(c => c.NAMA_CABANG && String(c.NAMA_CABANG).toUpperCase().trim() === cleanBranch);
      
      // 4. Validate locally if found for near-instant offline/cached login
      if (foundCabang) {
         if (String(foundCabang.PASSWORD).trim() === cleanPassword) {
            localStorage.setItem('AURA_FOOD_BRANCH', String(foundCabang.ID_CABANG));
            localStorage.setItem('AURA_FOOD_BRANCH_NAME', foundCabang.NAMA_CABANG);
            setActiveBranch(String(foundCabang.ID_CABANG));
            setStoredBranchName(foundCabang.NAMA_CABANG);
            setActiveTab('pos');
            setLoginPassword('');
            setIsCheckoutPageActive(false);
            handleReloadData();
            
            // Sync in background to make sure we got latest menu/updates without blocking screen
            if (navigator.onLine && gasUrl) {
               syncMasterDataFromGAS().catch(err => console.warn("Background master sync error:", err));
            }
            return;
         }
         // If cached password is wrong, fallback to online validation (just in case password changed in sheets)
      }

      // 5. If not found locally or password mismatch on local cache, check using fast online verification
      let onlineCheckError: any = null;
      if (navigator.onLine && gasUrl) {
         try {
            const response = await fetch(gasUrl, {
               method: 'POST',
               headers: {
                  'Content-Type': 'text/plain;charset=utf-8',
               },
               body: JSON.stringify({
                  mode: 'LOGIN',
                  namaCabang: cleanBranch,
                  password: cleanPassword
               })
            });

            const result = await response.json();
            if (result.status === 'success' && result.data) {
               const idCabang = String(result.data.ID_CABANG);
               const namaCabang = result.data.NAMA_CABANG || cleanBranch;
               localStorage.setItem('AURA_FOOD_BRANCH', idCabang);
               localStorage.setItem('AURA_FOOD_BRANCH_NAME', namaCabang);
               setActiveBranch(idCabang);
               setStoredBranchName(namaCabang);
               setActiveTab('pos');
               setLoginPassword('');
               setIsCheckoutPageActive(false);

               // Let's optimize: don't block if local DB already has catalog menu items
               const localData = await getMasterData();
               const hasLocalData = localData && localData.menu && localData.menu.length > 0;
               
               if (hasLocalData) {
                  // Non-blocking background sync for speed
                  syncMasterDataFromGAS().then(() => handleReloadData()).catch(err => console.warn(err));
               } else {
                  // Block only for first-time login
                  try {
                     await syncMasterDataFromGAS();
                  } catch (syncErr) {
                     console.warn("Gagal sinkronisasi data master setelah login online sukses:", syncErr);
                  }
               }

               handleReloadData();
               return;
            } else {
               const backendMsg = result.message || '';
               if (backendMsg.toLowerCase().includes('salah') || backendMsg.toLowerCase().includes('incorrect') || backendMsg.toLowerCase().includes('password')) {
                  setLoginError(`Sandi salah untuk cabang "${cleanBranch}".`);
               } else if (backendMsg.toLowerCase().includes('tidak terdaftar') || backendMsg.toLowerCase().includes('tidak ditemukan') || backendMsg.toLowerCase().includes('not found') || backendMsg.toLowerCase().includes('gagal')) {
                  setLoginError(`Nama cabang "${cleanBranch}" atau sandi salah.`);
               } else {
                  setLoginError(result.message || `Login gagal. Sandi salah atau cabang "${cleanBranch}" belum terdaftar.`);
               }
               return;
            }
         } catch (onlineErr) {
            console.warn("Gagal melakukan login online cepat:", onlineErr);
            onlineCheckError = onlineErr;
         }
      }

      // 6. If they're offline or online checking failed to route, output final fallback error message
      if (foundCabang) {
         setLoginError(`Sandi salah untuk cabang "${cleanBranch}".`);
      } else if (onlineCheckError) {
         setLoginError(`Koneksi Gagal: Tidak dapat menghubungi Sistem Pusat. Silakan hubungi admin atau periksa jaringan internet Anda.`);
      } else if (!navigator.onLine) {
         setLoginError(`Cabang "${cleanBranch}" belum terdaftar di sistem lokal. Sambungkan ke internet untuk menyinkronkan data.`);
      } else {
         setLoginError(`Cabang "${cleanBranch}" tidak terdaftar di Sistem Pusat.`);
      }

    } catch (err: any) {
      console.error("Error during handleLogin:", err);
      setLoginError(`Terjadi kesalahan sistem saat memproses login. Silakan coba lagi.`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => setShowLogoutModal(true);
  const executeLogout = async () => {
    setShowLogoutModal(false);
    try {
      localStorage.clear();
      const req = indexedDB.deleteDatabase('Sistem Keuangan Aura Food');
      // Force page reload to ensure full state reset and redirect to login
      window.location.href = '/'; 
    } catch (e: any) {
      alert('Gagal membersihkan cache offline: ' + e.message);
      window.location.reload();
    }
  };

  const disconnectGoogleSheet = () => setShowDisconnectModal(true);
  const executeDisconnect = () => {
    localStorage.setItem('AURA_FOOD_GAS_URL', 'https://script.google.com/macros/s/AKfycbyQbjH6133fuppW7ercx1bAJwX4P1J37VBaV-JY6Z3gDnWLsqzxrYuEmCngS-zIXGjW/exec');
    setGasUrl('https://script.google.com/macros/s/AKfycbyQbjH6133fuppW7ercx1bAJwX4P1J37VBaV-JY6Z3gDnWLsqzxrYuEmCngS-zIXGjW/exec');
    handleReloadData();
    setShowDisconnectModal(false);
  };

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedTx(null);
  }, [activeTab]);

  return (
    <>
      <div className={`min-h-screen bg-neutral-50 text-zinc-950 font-sans flex flex-col justify-between ${isFullScreenTab ? 'pb-0' : 'pb-24'}`}>
      
      {/* EXIT WARNING TOAST */}
      {exitWarning && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000000] animate-in slide-in-from-bottom-8 duration-300">
           <div className="px-5 py-3 rounded-[20px] bg-zinc-900 text-white shadow-2xl">
              <span className="text-xs font-bold">Tekan sekali lagi untuk keluar</span>
           </div>
        </div>
      )}
      
      {/* GLOBAL PRINTING STATUS TOAST (Like Add to Cart) */}
      {printingStatus !== 'idle' && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000000] animate-in slide-in-from-top-8 duration-500 w-full max-w-sm px-4">
           <div className={`px-5 py-3 rounded-[24px] flex items-center justify-center gap-3 shadow-2xl border ${
             printingStatus === 'printing' ? 'bg-amber-500 text-black border-amber-400' : 'bg-emerald-600 text-white border-emerald-500'
           }`}>
              {printingStatus === 'printing' ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-black" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Sedang Mencetak Struk...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-white" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Berhasil Dicetak & Diupload</span>
                </>
              )}
           </div>
        </div>
      )}

      {/* GLOBAL HEADER */}
      {!isFullScreenTab && activeBranch && (
        <header className="bg-red-950 text-white shadow-md relative overflow-hidden border-b border-rose-900/40 py-4 sticky top-0 z-50">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 h-32 w-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 text-left">
              {/* Visual Red-Gold Logo */}
              <img src="/logo.png" alt="Aura Food Logo" decoding="async" className="h-10 w-10 sm:h-11 sm:w-11 rounded-full object-cover border-2 border-amber-400 shadow-md shrink-0 bg-white" />
              
              <div className="min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none uppercase truncate">
                    AURA FOOD <span className="opacity-80 font-medium">|</span> {activeBranchName || 'MATARAM'}
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
                  <span className="truncate">{`${activeBranch === 'ADMIN' ? 'PUSAT' : (activeBranchName || 'MATARAM')}, NTB`} &bull; <Calendar className="h-2.5 w-2.5 shrink-0 inline ml-1 mr-0.5 text-red-300" />{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
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
        <div className="max-w-md mx-auto px-4 py-16 sm:py-24 flex-grow flex flex-col justify-center w-full animate-in fade-in duration-500">
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-zinc-200/90 shadow-2xl space-y-8 relative overflow-hidden">
            {/* Red & Gold gradient top accent border */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-850 via-amber-450 to-red-850"></div>
            
            <div className="text-center space-y-3">
              {/* Outer circular glowing frame for logo */}
              <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-tr from-red-150 to-amber-100 p-1 shadow-md hover:scale-105 transition duration-300">
                <div className="h-full w-full rounded-full bg-white overflow-hidden flex items-center justify-center p-0.5">
                  <img src="/logo.png" alt="Aura Food Logo" decoding="async" className="h-full w-full object-cover rounded-full" />
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black tracking-tight text-red-950 uppercase">AURA FOOD</h2>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto text-center font-medium">
                Selamat bekerja! Silakan masukkan nama cabang tempat Anda bekerja dan kata sandi untuk mulai mencatat pesanan.
              </p>
            </div>
 
            <form onSubmit={handleLogin} className="space-y-5 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-950 block uppercase tracking-wider">
                  Cabang Anda
                </label>
                <div className="relative group">
                  <span className="absolute left-3.5 top-3.5 text-zinc-400 group-focus-within:text-red-750 transition-colors">
                    <Building className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    required
                    disabled={isLoggingIn}
                    placeholder="Contoh: Praya atau Mataram"
                    value={loginUsername}
                    autoCapitalize="characters"
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    onChange={(e) => setLoginUsername(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-50 border border-zinc-200/80 rounded-2xl pl-10 pr-4 py-3 text-xs font-extrabold text-zinc-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-750 focus:border-red-750/30 transition shadow-sm disabled:opacity-60 uppercase"
                  />
                  {showSuggestions && loginSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-2xl shadow-xl z-[1000] max-h-40 overflow-y-auto divide-y divide-zinc-100">
                      {loginSuggestions.map((name, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={() => {
                            setLoginUsername(name.toUpperCase());
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-3 text-xs font-black text-red-950 uppercase hover:bg-zinc-50 active:bg-zinc-100 transition cursor-pointer"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
 
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-950 block uppercase tracking-wider">
                  Kata Sandi
                </label>
                <div className="relative group">
                  <span className="absolute left-3.5 top-3.5 text-zinc-400 group-focus-within:text-red-750 transition-colors">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={isLoggingIn}
                    placeholder="Masukkan sandi atau PIN..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200/80 rounded-2xl pl-10 pr-11 py-3 text-xs font-bold text-zinc-900 placeholder:text-zinc-450 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-750 focus:border-red-750/30 transition shadow-sm disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={isLoggingIn}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 mr-0.5 text-zinc-400 hover:text-red-750 transition focus:outline-none cursor-pointer active:scale-90 disabled:opacity-40"
                    title={showPassword ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              </div>
 
              {loginError && (
                <div className="flex gap-2 items-center text-[11px] font-extrabold text-red-800 bg-red-50 p-3 rounded-2xl border border-red-200 text-center justify-center animate-shake">
                  <AlertTriangle className="h-4 w-4 text-red-850 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
 
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-red-750 hover:bg-red-800 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-extrabold text-xs py-3.5 rounded-2xl transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer uppercase tracking-wider"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <span>MASUK SEKARANG</span>
                )}
              </button>
            </form>
 
            <div className="pt-2 text-center flex flex-col items-center gap-2">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                Aura Food Kasir V.1.1
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <main className={isFullScreenTab ? "w-full flex-grow flex flex-col bg-neutral-50" : "max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full flex-grow space-y-8"}>
            
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-fade-in">
                <AuraDashboard 
                  onNavigateToPOS={() => setActiveTab('pos')} 
                  onNavigateToAdmin={() => setActiveTab('admin')} 
                  activeBranch={activeBranch}
                  cabangList={cabangList}
                  onNavigateToHistory={(branch) => {
                    if (typeof branch === 'string' && branch && branch !== 'Semua') {
                      setHistoryBranchFilter(branch);
                    } else {
                      setHistoryBranchFilter('All');
                    }
                    setActiveTab('history');
                  }}
                  onSelectTransaction={(tx) => {
                    setSelectedTx(tx);
                    // scroll to view after a short delay
                    setTimeout(() => {
                      document.getElementById('thermal-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                />

              </div>
            )}

            {activeTab === 'pos' && (
              <div className={isCheckoutPageActive ? "flex-1 flex flex-col" : "space-y-6 animate-fade-in"}>
                <POSSimulator 
                  refreshTrigger={refreshKey}
                  onSelectTransaction={(tx) => setSelectedTx(tx)} 
                  selectedTransaction={selectedTx} 
                  activeBranch={activeBranch}
                  activeBranchName={activeBranchName}
                  onCreatingStatusChange={(isActive) => {
                    setIsCheckoutPageActive(isActive);
                    if (!isActive) {
                      setPosInitialCreateMode(false);
                    }
                  }}
                  onPrintingStatus={setPrintingStatus}
                  onNavigateToHistory={(branch) => {
                    if (typeof branch === 'string' && branch && branch !== 'Semua') {
                      setHistoryBranchFilter(branch);
                    } else {
                      setHistoryBranchFilter('All');
                    }
                    setActiveTab('history');
                  }}
                  initialCreateMode={posInitialCreateMode}
                />
              </div>
            )}

            {activeTab === 'history' && (
              <div className="flex-1 flex flex-col h-full bg-neutral-50 animate-fade-in w-full">
                 <HistoryPage 
                   activeBranch={activeBranch}
                   cabangList={cabangList}
                   refreshTrigger={refreshKey}
                   initialBranchFilter={historyBranchFilter}
                   onBack={() => setActiveTab(activeBranch === 'ADMIN' ? 'dashboard' : 'pos')}
                   onCreateTransaction={() => {
                     setPosInitialCreateMode(true);
                     setActiveTab('pos');
                   }}
                   onSuccessPrint={async (tx) => {
                     if (!tx) return;
                     try {
                       setPrintingStatus('printing');
                       const { markTransactionAsPrinted } = await import('./utils/db');
                       markTransactionAsPrinted(tx.id);
                       await printReceipt(tx, activeBranch);
                       setPrintingStatus('success');
                       setTimeout(() => setPrintingStatus('idle'), 3000);
                       alert('Struk Berhasil Dicetak & Disimpan');
                     } catch (err) {
                       console.error(err);
                       setPrintingStatus('idle');
                       alert('Gagal mencetak struk. Periksa koneksi printer Anda.');
                     }
                   }}
                   onSelectTransaction={async (tx) => {
                     if (!tx) return;
                     setSelectedTx(tx);
                     if (activeBranch !== 'ADMIN') {
                       setActiveTab('pos');
                     } else {
                       setActiveTab('dashboard');
                       setTimeout(() => {
                         document.getElementById('thermal-section')?.scrollIntoView({ behavior: 'smooth' });
                       }, 100);
                     }
                   }}
                 />
              </div>
            )}

            {activeTab === 'laporan' && (
              <div className="space-y-6 animate-fade-in">
                <ReportsPanel cabangList={cabangList} activeBranch={activeBranch} />
              </div>
            )}

            {activeTab === 'rekap_operasional' && (
              <div className="flex-grow flex flex-col bg-neutral-50 animate-fade-in">
                <RekapOperasionalPanel cabangList={cabangList} onBack={() => setActiveTab('admin')} />
              </div>
            )}

            {activeTab === 'admin' && (
              <div className={isAdminModuleActive ? "flex-grow flex flex-col bg-neutral-50" : "space-y-6 animate-fade-in"}>
                <AdminPanel onRefreshPOSCatalog={handleReloadData} onModuleActiveChange={setIsAdminModuleActive} onOpenRekapOperasional={() => setActiveTab('rekap_operasional')} />
              </div>
            )}

            {/* GLOBAL RECEIPT PREVIEW (Persistent across tabs) */}
            <AnimatePresence>
              {!isFullScreenTab && selectedTx && (
                <motion.div 
                  key="global-receipt-preview"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                  id="thermal-section" 
                  className="border-t border-zinc-200 pt-10 mt-12 space-y-6"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-800 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">
                      <ReceiptText className="h-3 w-3" /> {activeBranch === 'ADMIN' ? 'Detail Transaksi' : 'Pratinjau Struk'}
                    </div>
                    <button 
                      onClick={() => setSelectedTx(null)}
                      className="text-[10px] text-zinc-400 hover:text-red-700 font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      Tutup Pratinjau <X className="h-3 w-3" />
                    </button>
                  </div>
                  
                  <div className="relative">
                    {activeBranch === 'ADMIN' ? (
                      <div className="max-w-[400px] mx-auto bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm text-left pb-20">
                        <div className="flex justify-between items-start mb-6 border-b border-zinc-100 pb-4">
                          <div>
                            <p className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest">ID Pesanan</p>
                            <p className="text-sm font-black text-zinc-900 mt-1">{selectedTx.id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-bold uppercase tracking-widest inline-block">{selectedTx.paymentMethod || (selectedTx.pesanan?.JENIS_PESANAN === 'Compliment' ? 'Compliment' : '')}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500 font-medium whitespace-nowrap">Tanggal & Waktu</span>
                            <span className="text-zinc-900 font-bold text-right">{new Date(selectedTx.timestamp).toLocaleString('id-ID')}</span>
                          </div>
                          <div className="pt-4 mt-2 border-t border-dashed border-zinc-200">
                            <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-3">Item Pesanan</p>
                            <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-[-1px] before:w-[3px] before:bg-zinc-100 before:rounded-full ml-1 pl-3">
                              {selectedTx.detail?.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start text-sm pb-3 last:pb-0">
                                  <div className="text-left font-medium text-zinc-800">
                                    <span className="font-bold text-zinc-900">{item.QTY}x</span> {item.NAMA_MENU} 
                                    {item.VARIAN_NAME && <div className="text-[10px] text-zinc-400 mt-0.5">&bull; {item.VARIAN_NAME}</div>}
                                  </div>
                                  <div className="text-right font-medium text-zinc-700 whitespace-nowrap">
                                    Rp{((item.HARGA_SATUAN || item.HARGA || 0) * item.QTY).toLocaleString('id-ID')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="pt-4 border-t border-zinc-900/10">
                            <div className="flex justify-between items-center text-base sm:text-lg">
                              <span className="font-black text-zinc-900">Total Akhir</span>
                              <span className="font-black text-emerald-600">Rp{selectedTx.totalAmount.toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ReceiptThermal 
                          transaction={selectedTx} 
                          branchName={activeBranchName} 
                          branchLocation={cabangList.find(c => String(c.ID_CABANG) === String(selectedTx.cabang))?.LOKASI}
                        />
                        <div className="max-w-[340px] mx-auto pt-6 pb-20">
                           <button 
                             disabled={printingStatus === 'printing'}
                             onClick={async () => {
                               if (!selectedTx) return;
                               setPrintingStatus('printing');
                               await printReceipt(selectedTx, activeBranch);
                               setPrintingStatus('success');
                               setTimeout(() => setPrintingStatus('idle'), 3000);
                             }}
                             className={`w-full text-white font-extrabold text-xs py-4 rounded-2xl transition flex items-center justify-center shadow-lg active:scale-95 uppercase tracking-widest cursor-pointer gap-3 ${
                               printingStatus === 'printing' 
                                 ? 'bg-amber-500 animate-pulse' 
                                 : printingStatus === 'success'
                                 ? 'bg-emerald-600'
                                 : 'bg-red-700 hover:bg-red-800'
                             }`}
                           >
                             {printingStatus === 'printing' ? (
                               <>
                                 <RefreshCw className="h-4 w-4 animate-spin" /> Sedang Mencetak...
                               </>
                             ) : printingStatus === 'success' ? (
                               <>
                                 <CheckCircle2 className="h-4 w-4" /> Berhasil Dicetak
                               </>
                             ) : (
                               <>
                                 <Printer className="h-4 w-4" /> Cetak Struk Sekarang
                               </>
                             )}
                           </button>
                           <p className="text-center text-[9px] text-zinc-400 font-medium mt-4 uppercase tracking-widest">
                              Pastikan Printer Thermal Menyala & Terhubung
                           </p>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {!isFullScreenTab && activeBranch === 'ADMIN' && (
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200/90 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-safe">
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
                  <span className="text-[9px] mt-1 tracking-wide uppercase font-semibold">Dashboard</span>
                </button>

                <div className="flex-1 flex justify-center -mt-6">
                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
                      activeTab === 'admin' 
                        ? 'bg-red-800 text-white shadow-red-900/30 scale-105 border-4 border-white' 
                        : 'bg-red-700 text-white shadow-red-700/30 border-4 border-white'
                    }`}
                  >
                    <Settings className="h-6 w-6 stroke-[2]" />
                  </button>
                </div>

                <button
                  onClick={() => setActiveTab('laporan')}
                  className={`flex-1 flex flex-col items-center justify-center p-2.5 transition active:scale-95 cursor-pointer ${
                    activeTab === 'laporan' 
                      ? 'text-red-750 font-bold scale-105' 
                      : 'text-zinc-600 hover:text-zinc-700 font-medium'
                  }`}
                >
                  <FileText className={`h-5 w-5 ${activeTab === 'laporan' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  <span className="text-[9px] mt-1 tracking-wide uppercase font-semibold">Laporan</span>
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

      {showDiagnosticModal && (
        <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-205" onClick={() => setShowDiagnosticModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg border border-zinc-200/90 animate-in zoom-in-95 my-8" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-zinc-100 mb-5 text-left">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-50 text-red-800 text-[9px] font-black tracking-widest uppercase rounded">
                  <Settings className="h-3.5 w-3.5" /> DIAGNOSTIK & SISTEM
                </div>
                <h3 className="text-sm font-black text-zinc-950 uppercase">Uji Koneksi & Reset Cache</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1.5 px-3 rounded-lg bg-zinc-50 hover:bg-zinc-150 text-zinc-650 transition cursor-pointer active:scale-90 font-bold text-xs"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Main Content Pane */}
            <div className="space-y-5 text-left text-xs text-zinc-650 leading-relaxed">
              
              {/* 1. Offline Cached Branches Information (Extracted on live check) */}
              <div className="bg-red-50/50 p-4 rounded-2xl border border-red-150/70 space-y-2">
                <h4 className="font-extrabold text-red-950 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <Database className="h-4 w-4 text-red-750" /> Sesi Cabang Aktif saat Ini
                </h4>
                <p className="text-[10px] text-zinc-500 leading-normal font-medium">
                  Berikut adalah daftar cabang & sandi yang tersimpan secara lokal pada browser Anda. Anda dapat mencocokkannya langsung dengan Spreadsheet:
                </p>
                {cabangList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {cabangList.map(c => (
                      <div key={c.ID_CABANG} className="bg-white px-3 py-2 rounded-xl border border-zinc-200/60 flex justify-between items-center shadow-xs">
                        <span className="font-black text-zinc-900 text-[11px]">{c.NAMA_CABANG}</span>
                        <span className="font-mono text-[10px] bg-red-50 text-red-850 px-1.5 py-0.5 rounded leading-none font-bold">
                          {c.PASSWORD || "Mati"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-red-850 font-extrabold flex items-center gap-1">
                    Belum ada cabang dalam database offline (silakan lakukan sinkronisasi).
                  </p>
                )}
              </div>

              {/* 2. Configure spreadsheet integration directly in the modal for troubleshooting */}
              <div className="space-y-3 pt-1">
                <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wide">
                  Integrasi Google Spreadsheet
                </h4>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-500 block uppercase tracking-wider">Web App URL</label>
                  <input 
                    type="text" 
                    value={dialogGasUrl}
                    onChange={(e) => setDialogGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 outline-none focus:border-red-750 focus:ring-2 focus:ring-red-100 transition shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-500 block uppercase tracking-wider">Nama Sheet Target</label>
                  <input 
                    type="text" 
                    value={dialogGasSheet}
                    onChange={(e) => setDialogGasSheet(e.target.value)}
                    placeholder="Misal: Data atau Master"
                    className="w-full text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 outline-none focus:border-red-750 focus:ring-2 focus:ring-red-100 transition shadow-xs"
                  />
                </div>
              </div>

              {/* 3. Action Connection Test Trigger */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={runConnectionDiagnostic}
                  disabled={diagnosticStatus === 'running'}
                  className="w-full bg-red-750 hover:bg-red-800 disabled:bg-zinc-400 text-white font-black text-[11px] py-3.5 rounded-2xl transition shadow-md active:scale-95 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  {diagnosticStatus === 'running' ? (
                    <>
                      <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                      <span>Menguji Koneksi & Menyelaraskan...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="h-4.5 w-4.5" />
                      <span>Jalankan Sinkronisasi Master Data</span>
                    </>
                  )}
                </button>
              </div>

              {/* 4. Connection Terminal Display Logs */}
              {diagnosticLogs.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-500 block uppercase tracking-wider flex items-center gap-1">
                    <Terminal className="h-3.5 w-3.5 text-zinc-500" /> Log Konsol Sistem
                  </label>
                  <div className="bg-zinc-950 text-emerald-400 p-4 rounded-2xl font-mono text-[10px] leading-relaxed max-h-48 overflow-y-auto space-y-1.5 shadow-inner border border-zinc-800 text-left">
                    {diagnosticLogs.map((log, index) => (
                      <div key={index} className="whitespace-pre-line last:font-bold">
                        {log.startsWith('ERROR') ? (
                          <span className="text-red-400 font-extrabold">{log}</span>
                        ) : log.startsWith('SINKRONISASI SUKSES!') ? (
                          <span className="text-emerald-300 font-bold">{log}</span>
                        ) : (
                          <span>{log}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success Info Panel */}
              {diagnosticStatus === 'success' && (
                <div className="bg-emerald-50 text-emerald-800 p-3.5 rounded-2xl border border-emerald-150 flex items-start gap-2 animate-in slide-in-from-top-2 text-left">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-[11px] uppercase tracking-wide">Koneksi & Sinkronisasi Sempurna!</p>
                    <p className="text-[10px] leading-normal text-emerald-700/90 font-medium">Data cabang dan inventaris menu dari Sistem Pusat telah disinkronisasikan ke dalam browser Anda. Anda sudah bisa login menggunakan password terbaru.</p>
                  </div>
                </div>
              )}

              {/* Error Recommendation Info Panel */}
              {diagnosticStatus === 'error' && (
                <div className="bg-red-50 text-red-950 p-3.5 rounded-2xl border border-red-150 flex items-start gap-2 animate-in slide-in-from-top-2 text-left">
                  <XCircle className="h-4.5 w-4.5 text-red-750 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-left">
                    <p className="font-extrabold text-[11px] uppercase tracking-wide text-red-800">Sinkronisasi Gagal</p>
                    <p className="text-[10px] leading-normal text-red-950/80 font-medium">Koneksi tidak dapat terjalin ke Google Apps Script Web App. Rekor Rekomendasi:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-[10px] text-zinc-650 pl-1 font-medium">
                      <li>Buka berkas basis data Sistem Pusat, cek apakah menu <strong>Extensions &gt; Apps Script</strong> sudah dideploy dengan benar.</li>
                      <li>Di setelan pengedaran (Deploy Web App), pastikan opsi <strong>Execute as</strong> diset sebagai "Me" (Anda) dan opsi <strong>Who has access</strong> diset sebagai "Anyone" (Siapapun, bahkan anonim).</li>
                      <li>Periksa kembali salinan tautan Web App URL di atas (harus berakhiran <code>/exec</code>).</li>
                    </ul>
                  </div>
                </div>
              )}

            </div>

            {/* Cashier Factory Reset Block */}
            <div className="mt-6 pt-5 border-t border-zinc-100 flex flex-col items-center gap-1.5 text-center">
              <button
                type="button"
                onClick={clearCacheAndDestroyDb}
                className="inline-flex items-center gap-1.5 bg-zinc-50 hover:bg-rose-50 border border-zinc-200 hover:border-red-150 text-red-800 text-[10px] font-black px-4 py-2.5 rounded-xl cursor-pointer transition active:scale-95 uppercase tracking-wider"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Kosongkan Database & Hapus Cache</span>
              </button>
              <span className="text-[9px] text-zinc-400 font-medium leading-normal max-w-xs">
                Pencet ini jika ingin membersihkan semua sisa data lama offline atau menghapus cache error.
              </span>
            </div>

          </div>
        </div>
      )}

    </div>
    </>
  );
}
