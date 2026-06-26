import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MasterData, Varian, Menu, CartItem, Transaction, SyncQueueItem } from '../types';
import ReceiptThermal from './ReceiptThermal';
import { 
  getMasterData, 
  seedMasterDataIfEmpty, 
  getTransactions, 
  saveTransaction, 
  addToSyncQueue, 
  getSyncQueue, 
  removeFromSyncQueue,
  updateTransactionStatus,
  processSyncQueue,
  getGASConfig,
  getTransactionsFromGAS,
  clearSyncedTransactions,
  markTransactionAsPrinted,
  getPrintedTransactionIds
} from '../utils/db';
import { printReceipt, generateAndUploadReceipt } from '../utils/pdf';
import { connectThermalPrinter, printThermalReceipt } from '../utils/printer';
import { getFormattedMenuDisplay } from '../utils/formatter';
import { 
  Printer,
  Coffee, 
  Cookie, 
  CupSoda, 
  IceCream, 
  GlassWater, 
  Search, 
  ShoppingCart, 
  Clock, 
  Plus, 
  Minus,
  Filter,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
  Menu as MenuIcon,
  X,
  CreditCard,
  Banknote,
  Wallet,
  UtensilsCrossed,
  AlertCircle,
  ListOrdered,
  ReceiptText,
  RefreshCw,
  Bluetooth,
  Building,
  Calendar,
  Package,
  Folder,
  CheckCircle2,
  XCircle,
  Gift,
  QrCode,
  ShoppingBag,
  Coins,
  ChevronDown
} from 'lucide-react';

interface POSSimulatorProps {
  onSelectTransaction: (tx: Transaction | null) => void;
  selectedTransaction: Transaction | null;
  refreshTrigger?: number;
  activeBranch: string;
  activeBranchName?: string;
  onCreatingStatusChange?: (isActive: boolean) => void;
  onPrintingStatus?: (status: 'idle' | 'printing' | 'success') => void;
  onNavigateToHistory: (branch?: string) => void;
  initialCreateMode?: boolean;
}

let posInitialFetchDone = new Set<string>();

export default function POSSimulator({ 
  onSelectTransaction, 
  selectedTransaction, 
  refreshTrigger, 
  activeBranch,
  activeBranchName: propActiveBranchName,
  onCreatingStatusChange,
  onPrintingStatus,
  onNavigateToHistory,
  initialCreateMode
}: POSSimulatorProps) {
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  const triggerSync = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      await processSyncQueue();
      await loadDataFromDB();
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const activeBranchObj = React.useMemo(() => {
    return masterData?.cabang?.find(x => String(x.ID_CABANG) === String(activeBranch));
  }, [masterData, activeBranch]);

  const derivedBranchName = React.useMemo(() => {
    if (activeBranchObj && activeBranchObj.NAMA_CABANG) {
      return activeBranchObj.NAMA_CABANG;
    }
    if (propActiveBranchName && propActiveBranchName !== activeBranch && propActiveBranchName !== 'ADMIN' && isNaN(Number(propActiveBranchName))) {
        return propActiveBranchName;
    }
    if (activeBranch === 'ADMIN') return 'ADMIN';
    if (!activeBranch) return 'MATARAM';
    return (propActiveBranchName && isNaN(Number(propActiveBranchName))) ? propActiveBranchName : 'Cabang';
  }, [activeBranchObj, activeBranch, propActiveBranchName]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Transaction queue and status
  const [history, setHistory] = useState<Transaction[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingQueue, setPendingQueue] = useState<SyncQueueItem[]>([]);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [isCreatingTx, setIsCreatingTx] = useState<boolean>(initialCreateMode || false);

  useEffect(() => {
    if (initialCreateMode) {
      setIsCreatingTx(true);
    }
  }, [initialCreateMode]);

  // Layout states for Create Tx mode
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [showPrinterWarning, setShowPrinterWarning] = useState<boolean>(false);
  const [addedItemMessage, setAddedItemMessage] = useState<string | null>(null);

  // Custom Modals
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDiscardCart, setConfirmDiscardCart] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<'success' | 'error' | 'warning'>('warning');

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'warning' = 'warning') => {
    setAlertType(type);
    setAlertMessage(msg);
  };

  // Default payment
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer' | 'QRIS'>('Cash');
  const [isCompliment, setIsCompliment] = useState<boolean>(false);
  const [catatan, setCatatan] = useState<string>('');
  
  const [autoPrint, setAutoPrint] = useState(true);
  const [selectedMenuForVarian, setSelectedMenuForVarian] = useState<Menu | null>(null);
  const [selectedTransactionForKasir, setSelectedTransactionForKasir] = useState<Transaction | null>(null);
  const [previewType, setPreviewType] = useState<'inline' | 'popup'>('popup');
  const [showCartPopup, setShowCartPopup] = useState<boolean>(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedTransactionForKasir && previewType === 'inline' && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedTransactionForKasir, previewType]);
  
  // Pull to refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);

  const [showReportPopup, setShowReportPopup] = useState<boolean>(false);
  const [isReporting, setIsReporting] = useState<boolean>(false);
  const [reportData, setReportData] = useState<{folder_url: string, kontak_wa: string, nama_cabang: string} | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [selectedReportDate, setSelectedReportDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [isMetricsLoading, setIsMetricsLoading] = useState<boolean>(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [thermalPrinter, setThermalPrinter] = useState<any>(null); // BluetoothDevice
  const [showPrinterSettings, setShowPrinterSettings] = useState<boolean>(false);

  // Back button interception for Android
  useEffect(() => {
    const handleAndroidBack = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (showPrinterSettings) {
        setShowPrinterSettings(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showReportPopup) {
        setShowReportPopup(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showCheckoutModal) {
        setShowCheckoutModal(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showCartPopup) {
        setShowCartPopup(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showCatalogModal) {
        setShowCatalogModal(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (selectedMenuForVarian) {
        setSelectedMenuForVarian(null);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (selectedTransactionForKasir) {
        setSelectedTransactionForKasir(null);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (confirmDiscardCart) {
        setConfirmDiscardCart(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (confirmDeleteId) {
        setConfirmDeleteId(null);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (alertMessage) {
        setAlertMessage(null);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showPrinterWarning) {
        setShowPrinterWarning(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (searchQuery !== '') {
        setSearchQuery('');
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      }
    };
    window.addEventListener('aura-backpress', handleAndroidBack);
    return () => window.removeEventListener('aura-backpress', handleAndroidBack);
  }, [
    showPrinterSettings,
    showReportPopup,
    showCheckoutModal,
    showCartPopup,
    showCatalogModal,
    selectedMenuForVarian,
    selectedTransactionForKasir,
    confirmDiscardCart,
    confirmDeleteId,
    alertMessage,
    showPrinterWarning,
    searchQuery
  ]);
  
  const handleConnectPrinter = async () => {
    try {
      const device = await connectThermalPrinter();
      if (device) {
        setThermalPrinter(device);
        triggerAlert(`Printer thermal (${device.name}) berhasil terhubung via Web Bluetooth.`, 'success');
        setShowPrinterSettings(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull-to-refresh on the main dashboard/history list if scrolled to top
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY !== null) {
      const pull = e.touches[0].clientY - startY;
      if (pull > 0) {
        // Less sensitive: increase threshold and reduce pull distance increment
        setPullDistance(Math.min(pull / 2, 100)); 
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    // Ensure sufficient pull distance before acting
    if (pullDistance > 70) {
       setIsRefreshing(true);
       await loadDataFromDB(true); // Always force remote fetch on pull-to-refresh
       setIsRefreshing(false);
    }
    setPullDistance(0);
    setStartY(null);
  };

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (selectedTransaction) {
      setPreviewType('popup');
      setSelectedTransactionForKasir(selectedTransaction);
    }
  }, [selectedTransaction]);

  useEffect(() => {
    if (onCreatingStatusChange) {
      // Sync strictly based on whether we are creating tx
      onCreatingStatusChange(isCreatingTx);
    }
    if (isCreatingTx) {
      onSelectTransaction(null);
    }
  }, [isCreatingTx, onCreatingStatusChange, onSelectTransaction]);

  const loadDataFromDB = async (forceRemote: boolean = false) => {
    setIsInitialLoading(true);
    try {
      const dbMaster = await seedMasterDataIfEmpty();
      setMasterData(dbMaster);

      let allHistory = await getTransactions();
      const branchHistory = activeBranch === 'ADMIN' ? allHistory : allHistory.filter(tx => String(tx.cabang) === String(activeBranch));
      
      // If branchHistory is empty, force remote fetch to ensure data is populated
      let shouldForce = forceRemote;
      if (!shouldForce && branchHistory.length === 0 && activeBranch && activeBranch !== 'ADMIN') {
          shouldForce = true;
      }
      
      if (navigator.onLine && activeBranch && activeBranch !== 'ADMIN' && shouldForce) {
        try {
            const dateObj = new Date();
            const yearStr = dateObj.getFullYear();
            const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dayStr = String(dateObj.getDate()).padStart(2, '0');
            const paramTanggal = `${dayStr}/${monthStr}/${yearStr}`;
            const isoTanggal = `${yearStr}-${monthStr}-${dayStr}`;
            // we only fetch latest remote history of this branch up to today for speed
            const remoteHistory = await getTransactionsFromGAS(activeBranch, paramTanggal);
            console.log("Remote transactions fetched:", remoteHistory);
            
            // Delete today's synced data for this branch and update with new
            await clearSyncedTransactions(activeBranch, isoTanggal);
            for (const tx of remoteHistory) {
                await saveTransaction(tx);
            }
            // Refetch all to get updated list
            allHistory = await getTransactions();
        } catch (e) {
            console.error("Error loading remote transactions:", e);
        }
      }
      
      const updatedBranchHistory = activeBranch === 'ADMIN' ? allHistory : allHistory.filter(tx => String(tx.cabang) === String(activeBranch));
      setHistory(updatedBranchHistory.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

      const dbQueue = await getSyncQueue();
      const branchQueue = activeBranch === 'ADMIN' ? dbQueue : dbQueue.filter(item => String(item.payload?.cabang) === String(activeBranch));
      setPendingQueue(branchQueue);
      setIsInitialLoading(false);
    } catch (err) {
      console.error("IndexedDB error:", err);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    const shouldFetchRemote = !!activeBranch && activeBranch !== 'ADMIN' && !posInitialFetchDone.has(activeBranch);
    if (shouldFetchRemote) {
        posInitialFetchDone.add(activeBranch);
    }
    loadDataFromDB(shouldFetchRemote);
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadDataFromDB();
  }, [refreshTrigger, activeBranch]);

  useEffect(() => {
    if (addedItemMessage) {
      const timer = setTimeout(() => setAddedItemMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [addedItemMessage]);

  // Background prepare setup folder hari ini
  useEffect(() => {
    if (activeBranch && activeBranch !== 'ADMIN') {
      const config = getGASConfig();
      if (config && config.webAppUrl) {
         const url = new URL(config.webAppUrl);
         url.searchParams.append('action', 'get_info_hari_ini');
         url.searchParams.append('id_cabang', activeBranch);
         fetch(url.toString(), { redirect: 'follow' }).catch(() => {});
      }
    }
  }, [activeBranch]);

  useEffect(() => {
    let barcodeString = '';
    let barcodeTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (barcodeString.length > 5) {
          setIsCreatingTx(false);
          setShowCheckoutModal(false);
          setShowCatalogModal(false);
          
          onNavigateToHistory();
        }
        barcodeString = '';
      } else if (e.key.length === 1) {
        barcodeString += e.key;
        clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => {
          barcodeString = '';
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(barcodeTimeout);
    };
  }, []);

  const getProductIcon = (categoryName: string) => {
    if (!categoryName) return <UtensilsCrossed className="h-5 w-5 text-red-750" />;
    const name = categoryName.toLowerCase();
    if (name.includes('minuman') || name.includes('coffee') || name.includes('es') || name.includes('drink')) {
      return <CupSoda className="h-5 w-5 text-red-750" />;
    }
    if (name.includes('makanan') || name.includes('dimsum') || name.includes('snack') || name.includes('food')) {
      return <UtensilsCrossed className="h-5 w-5 text-red-750" />;
    }
    return <UtensilsCrossed className="h-5 w-5 text-red-750" />;
  };

  const handleMenuClick = (menu: any) => {
    // Determine variants based on whether it's a NestedMenu or flat Menu
    const menuVarians = menu.varians || menu.varian || menu.Varian;
    const variants = menuVarians 
      ? menuVarians.filter((v: any) => v.STATUS === 'AKTIF' || v.STATUS === 'Tersedia')
      : (masterData?.varian || []).filter(v => v.ID_MENU === menu.ID_MENU && (v.STATUS === 'AKTIF' || v.STATUS === 'Tersedia'));
    
    if (variants.length === 1) {
      // Auto-add if only one variant
      addToCart({ varian: variants[0], menu: menu });
    } else {
      // Show selection modal
      // We pass the nested menu along with properties so the modal knows its variants
      setSelectedMenuForVarian({...menu, varians: variants});
    }
  };

  const addToCart = (item: { varian: Varian, menu: Menu }) => {
    if (activeBranch === 'ADMIN') {
      triggerAlert("Cabang ADMIN bertindak hanya sebagai pemantau dan tidak dapat menambahkan pesanan baru.", "error");
      return;
    }

    setCart(prev => {
      const existingIndex = prev.findIndex(i => i.varian.ID_VARIAN === item.varian.ID_VARIAN);
      if (existingIndex > -1) {
        const nextCart = [...prev];
        nextCart[existingIndex].quantity += 1;
        return nextCart;
      }
      return [...prev, { id_detail: `DET-${Date.now()}-${Math.floor(Math.random() * 9000)}`, menu: item.menu, varian: item.varian, quantity: 1 }];
    });
    
    setAddedItemMessage(`${getFormattedMenuDisplay(item.menu.NAMA_MENU, item.varian.NAMA_VARIAN)} ditambahkan`);
    setTimeout(() => setAddedItemMessage(null), 1500);
  };

  const updateCartQty = (idVarian: string, delta: number) => {
    const item = cart.find(i => i.varian.ID_VARIAN === idVarian);
    if (!item) return;

    if (item.quantity === 1 && delta === -1) {
      setConfirmDeleteId(idVarian);
      return;
    }

    setCart(prev => prev.map(i => {
      if (i.varian.ID_VARIAN === idVarian) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const removeFromCart = (idVarian: string) => {
    setCart(prev => prev.filter(item => item.varian.ID_VARIAN !== idVarian));
  };

  const getEffectiveCart = () => {
    let effective = [...cart];
    if (masterData?.promo) {
       masterData.promo.forEach(p => {
          const targets = p.TARGET_ITEM ? String(p.TARGET_ITEM).split('|').map(s => s.trim()) : [];
          if (targets.length === 0) return;
          
          let matchingQty = 0;
          let matchingTotalValue = 0;
          for (let item of cart) {
             if (targets.includes(String(item.varian.ID_VARIAN)) || targets.includes(String(item.menu.ID_MENU))) {
                matchingQty += item.quantity;
                matchingTotalValue += (item.varian.HARGA * item.quantity);
             }
          }

          if (matchingQty >= p.SYARAT_QTY && p.SYARAT_QTY > 0) {
             const timesApplied = Math.floor(matchingQty / p.SYARAT_QTY);
             let discountAmount = 0;
             let discountName = `[PROMO] ${p.NAMA_PROMO}`;
             
             if (p.TIPE === 'HARGA_FIX') {
                let targetNormalPriceForSyarat = 0;
                let qToCount = p.SYARAT_QTY * timesApplied;
                
                for (let item of cart) {
                  if (targets.includes(String(item.varian.ID_VARIAN)) || targets.includes(String(item.menu.ID_MENU))) {
                     let takeQty = Math.min(item.quantity, qToCount);
                     targetNormalPriceForSyarat += takeQty * item.varian.HARGA;
                     qToCount -= takeQty;
                     if (qToCount <= 0) break;
                  }
                }
                
                const promoFixedPrice = Number(p.NILAI_PROMO) * timesApplied;
                discountAmount = targetNormalPriceForSyarat - promoFixedPrice;
             } else if (p.TIPE === 'DISKON_PERSEN') {
                discountAmount = matchingTotalValue * (Number(p.NILAI_PROMO) / 100);
             }

             if (discountAmount > 0) {
                effective.push({
                   id_detail: `promo-${p.ID_PROMO}-${Date.now()}`,
                   menu: {
                      ID_MENU: 'PROMO',
                      NAMA_MENU: discountName,
                      ID_KATEGORI: 'PROMO',
                      FOTO: '',
                      TERSEDIA: true
                   },
                   varian: {
                      ID_VARIAN: `var-${p.ID_PROMO}`,
                      ID_MENU: 'PROMO',
                      NAMA_VARIAN: 'Diskon/Promo',
                      HARGA: -discountAmount,
                      KETERANGAN: ''
                   },
                   quantity: 1
                });
             }
          }
       });
    }
    return effective;
  };

  const effectiveCart = getEffectiveCart();
  const checkoutTotal = effectiveCart.reduce((sum, item) => sum + (item.varian.HARGA * item.quantity), 0);

  const printReceiptAndUpload = async (tx: Transaction) => {
    onPrintingStatus?.('printing');
    
    // Mark as printed
    markTransactionAsPrinted(tx.id);
    
    setSelectedTransactionForKasir(null);
    
    await printReceipt(tx, activeBranch);
    
    onPrintingStatus?.('success');
    setTimeout(() => onPrintingStatus?.('idle'), 3000);
  };

  const handleOpenReport = async () => {
    setShowReportPopup(true);
    setIsReporting(true);
    setReportError(null);
    setReportData(null);
    
    try {
      const config = getGASConfig();
      if (!config || !config.webAppUrl) throw new Error('Konfigurasi GAS belum diatur.');
      const url = new URL(config.webAppUrl);
      url.searchParams.append('action', 'get_info_hari_ini');
      url.searchParams.append('id_cabang', activeBranch);
      url.searchParams.append('tanggal', selectedReportDate);
      
      const res = await fetch(url.toString(), { redirect: 'follow' });
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        console.log("Report Data Info Fetched:", data.data);
        setReportData(data.data);
      } else {
        throw new Error(data.message || 'Gagal mengambil info hari ini.');
      }
    } catch (err: any) {
      console.error("Fetch Report Error:", err);
      setReportError('Gagal memuat laporan. Periksa koneksi internet Anda.');
    } finally {
      setIsReporting(false);
    }
  };

  const handleSendWaReport = (totalRevenue: number, totalCash: number, totalTransfer: number, todayTxs: Transaction[], isToday: boolean, displayDateStr: string) => {
    if (!reportData || !reportData.kontak_wa) return;
    
    let kontak = reportData.kontak_wa.toString().replace(/\D/g, '');
    if (kontak.startsWith('0')) kontak = '62' + kontak.substring(1);
    
    let menuSales: { [menuName: string]: { total: number, variants: { [variantName: string]: number } } } = {};
    todayTxs.forEach(tx => {
      tx.detail?.forEach(item => {
        const menu = item.NAMA_MENU || 'Unknown';
        const variant = item.VARIAN || 'Unknown';
        const qty = Number(item.QTY) || 1;
        
        if (!menuSales[menu]) {
          menuSales[menu] = { total: 0, variants: {} };
        }
        menuSales[menu].total += qty;
        
        if (!menuSales[menu].variants[variant]) {
          menuSales[menu].variants[variant] = 0;
        }
        menuSales[menu].variants[variant] += qty;
      });
    });

    let rincianMenuText = "\n*Rincian Menu Terjual:*\n";
    const sortedMenus = Object.entries(menuSales).sort((a, b) => b[1].total - a[1].total);
    if (sortedMenus.length === 0) {
      rincianMenuText += "Tidak ada menu terjual\n";
    } else {
      sortedMenus.forEach(([menu, data], idx) => {
        rincianMenuText += `${idx + 1}. ${menu}: ${data.total}x dipesan\n`;
        const sortedVariants = Object.entries(data.variants).sort(([_vA, qA], [_vB, qB]) => qB - qA);
        sortedVariants.forEach(([variant, qty]) => {
          rincianMenuText += `    - ${variant}: ${qty}x dipesan\n`;
        });
      });
    }

    const text = `Halo, berikut adalah *Laporan Omset ${isToday ? 'Hari Ini' : 'Harian'}*:\n\n` +
      `*Cabang:* ${reportData.nama_cabang}\n` +
      `*Tanggal:* ${displayDateStr}\n` +
      `*Total Omset:* Rp${totalRevenue.toLocaleString('id-ID')}\n` +
      `*Total Cash:* Rp${totalCash.toLocaleString('id-ID')}\n` +
      `*Total Transfer:* Rp${totalTransfer.toLocaleString('id-ID')}\n` +
      `*Total Pesanan:* ${todayTxs.length} Selesai\n` +
      rincianMenuText + `\n` +
      `*Folder Struk:* \n${reportData.folder_url}\n\n` +
      `Terima kasih!`;
      
    const waUrl = `https://wa.me/${kontak}?text=${encodeURIComponent(text)}`;
    console.log("WhatsApp Report URL:", waUrl);
    window.open(waUrl, '_blank');
  };

  const proceedCheckout = async () => {
    setShowPrinterWarning(false);
    // REVERTED ID FORMAT: Simpler format as requested
    const transactionId = `ORD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date();
    const newTx: Transaction = {
      id: transactionId,
      pesanan: {
        ID_PESANAN: transactionId,
        TANGGAL_WAKTU: now.toISOString(),
        ID_CABANG: activeBranch,
        TOTAL_TAGIHAN: checkoutTotal,
        METODE_BAYAR: isCompliment ? 'Compliment' : paymentMethod,
        JENIS_PESANAN: isCompliment ? 'Compliment' : 'Normal',
        CATATAN: catatan
      },
      detail: effectiveCart.map(c => ({
        ID_DETAIL: c.id_detail,
        ID_PESANAN: transactionId,
        NAMA_MENU: c.menu.NAMA_MENU,
        VARIAN: c.varian.NAMA_VARIAN,
        HARGA_SATUAN: c.varian.HARGA,
        QTY: c.quantity,
        SUBTOTAL: c.varian.HARGA * c.quantity
      })),
      timestamp: now.toISOString(),
      cabang: activeBranch,
      totalAmount: checkoutTotal,
      paymentMethod: isCompliment ? 'Compliment' : paymentMethod,
      status: 'pending_sync'
    };

    try {
      await saveTransaction(newTx);
      
      if (thermalPrinter) {
        await printThermalReceipt(thermalPrinter, newTx, derivedBranchName);
        markTransactionAsPrinted(newTx.id);
      }
      
      await addToSyncQueue({
        id: transactionId,
        action: 'POST_TRANSACTION',
        payload: newTx,
        timestamp: Date.now(),
        retries: 0
      });

      if (navigator.onLine) {
        triggerSync();
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#f87171', '#fca5a5', '#fee2e2']
      });

      setCart([]);
      setIsCompliment(false);
      setCatatan('');
      setShowCheckoutModal(false);
      setIsCreatingTx(false);
      
      await loadDataFromDB();
      onSelectTransaction(null); // Prevent global preview from popping up below
      
      setTimeout(() => {
         document.getElementById('thermal-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
         if (autoPrint) {
            printReceiptAndUpload(newTx);
         } else {
            generateAndUploadReceipt(newTx, activeBranch);
         }
      }, 700);

    } catch (err) {
      console.error("Gagal memproses checkout", err);
      triggerAlert("Terjadi kesalahan saat menyimpan transaksi (IndexedDB).", "error");
    }
  };

  const handleCheckout = async () => {
    if (activeBranch === 'ADMIN') return;
    if (cart.length === 0) return;

    if (autoPrint && !thermalPrinter) {
      const isFirstOrderToday = history.filter(tx => new Date(tx.timestamp).toDateString() === new Date().toDateString()).length === 0;
      if (isFirstOrderToday) {
        setShowPrinterWarning(true);
        return;
      }
    }

    proceedCheckout();
  };

  const handleSearchChange = (val: string) => {
    if (searchQuery === '' && val.length > 0) {
      setCategory('Semua');
    }
    setSearchQuery(val);
  };

  const clearFilter = () => {
    setSearchQuery('');
    setCategory('Semua');
  };

  const totalPortions = cart.reduce((sum, item) => sum + item.quantity, 0);

  const katalog = React.useMemo(() => {
    if (masterData?.katalogLengkap && masterData.katalogLengkap.length > 0) {
      return masterData.katalogLengkap;
    }
    if (!masterData) return [];
    return masterData.kategori.map(k => ({
      ...k,
      menus: masterData.menu.filter(m => String(m.ID_KATEGORI).trim() === String(k.ID_KATEGORI).trim()).map(m => ({
        ...m,
        varians: masterData.varian.filter(v => String(v.ID_MENU).trim() === String(m.ID_MENU).trim())
      }))
    }));
  }, [masterData]);

  const displayMenus = React.useMemo(() => {
    let result: any[] = [];
    katalog.forEach((kat: any) => {
      if (category === 'Semua' || kat.NAMA_KATEGORI === category) {
        const menusList = kat.menus || kat.menu || kat.Menu || kat.MENUS || [];
        menusList.forEach((menu: any) => {
          const matchSearch = (menu.NAMA_MENU || '').toLowerCase().includes((searchQuery || '').toLowerCase());
          if (matchSearch) {
            result.push({ menu, categoryName: kat.NAMA_KATEGORI });
          }
        });
      }
    });
    return result;
  }, [katalog, category, searchQuery]);

// Removed showFullHistory block

  function renderCatalogGrid() {
    return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white p-4 border border-zinc-200/80 shadow-sm rounded-3xl space-y-3 shrink-0 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari menu (Dimsum, Pizza...)"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-zinc-50 pl-10 pr-10 py-3 rounded-xl border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-650 transition outline-none"
          />
          {searchQuery && (
            <button 
              onClick={clearFilter}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-zinc-200 hover:bg-zinc-300 rounded-full text-zinc-600 transition active:scale-90"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {['Semua', ...katalog.map(k => k.NAMA_KATEGORI)].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer active:scale-95 uppercase tracking-wider ${
                category === cat 
                  ? 'bg-zinc-900 text-white shadow-md' 
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-24 md:pb-6 overflow-y-auto scrollbar-thin rounded-2xl px-1" id="products-grid">
        {displayMenus.map((p) => {
          const m = p.menu as any;
          const varianList = m.varians || m.varian || m.Varian || [];
          const hasNoVariants = !varianList || varianList.length === 0;
          const isMenuInactive = varianList && varianList.length > 0 && !varianList.some((v: any) => v.STATUS === 'AKTIF' || v.STATUS === 'Tersedia');
          const isDisabled = hasNoVariants || isMenuInactive;
          
          return (
          <div
            key={m.ID_MENU}
            onClick={() => {
              if (isDisabled) return;
              handleMenuClick(m);
            }}
            className={`p-4 rounded-3xl transition flex flex-col justify-between select-none relative overflow-hidden text-left min-h-[140px]
              ${isDisabled ? 'bg-zinc-100 border border-zinc-200 opacity-60 grayscale cursor-not-allowed' : 'bg-white border border-zinc-200/85 hover:border-red-650/40 cursor-pointer shadow-sm hover:shadow-md group active:scale-95'}`}
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className={`text-xl transition origin-left rounded-xl p-2.5 border ${isDisabled ? 'bg-zinc-200 border-zinc-300' : 'bg-zinc-50 border-zinc-100 group-hover:scale-110'}`}>
                  {getProductIcon(p.categoryName)}
                </div>
              </div>
              <h4 className={`text-sm font-bold leading-tight transition ${isDisabled ? 'text-zinc-600' : 'text-zinc-950 group-hover:text-red-800'}`}>{m.NAMA_MENU}</h4>
              <p className="text-[10px] text-zinc-400 mt-2 uppercase tracking-wider font-extrabold">{p.categoryName}</p>
            </div>
            
            <div className="absolute right-4 bottom-4">
               {isDisabled ? (
                 <span className="p-1 px-2 text-[9px] font-bold bg-zinc-300 text-zinc-600 rounded-lg uppercase tracking-wider">
                   {hasNoVariants ? 'Tanpa Varian' : 'Habis'}
                 </span>
               ) : (
                 <span className="p-2 bg-zinc-50 group-hover:bg-red-750 group-hover:text-white rounded-xl transition text-zinc-650 inline-block">
                  <Plus className="h-4 w-4" />
                 </span>
               )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}


  if (isCreatingTx) {
    return (
      <div 
        className="fixed inset-0 z-[100] bg-neutral-50 flex flex-col overflow-hidden w-full h-full animate-fade-in text-left"
      >
        <header className="bg-white border-b border-zinc-200 shadow-sm shrink-0">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  if (cart.length > 0) {
                    setConfirmDiscardCart(true);
                  } else {
                    setIsCreatingTx(false);
                  }
                }}
                className="p-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-700 transition cursor-pointer active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div>
                <h1 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                  AURA FOOD {derivedBranchName.toUpperCase()}
                </h1>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{`${activeBranch === 'ADMIN' ? 'PUSAT' : derivedBranchName}, NTB`}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCheckoutModal(true)}
                disabled={cart.length === 0}
                className="hidden md:flex bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-extrabold text-[10px] px-4 py-2.5 rounded-xl transition items-center gap-2 shadow-sm active:scale-95 uppercase tracking-wider"
              >
                Proses &amp; Cetak
              </button>

              <button
                onClick={() => setShowCatalogModal(true)}
                className="p-2 bg-red-50 text-red-750 rounded-lg hover:bg-red-100 transition active:scale-95 flex items-center gap-1.5 border border-red-100"
              >
                <MenuIcon className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider pr-1">Menu</span>
              </button>
            </div>
          </div>
        </header>

        {addedItemMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[10000000] animate-in slide-in-from-top-8 duration-500">
            <div className="px-5 py-3 rounded-[20px] bg-zinc-950 text-white flex items-center justify-center gap-3 shadow-2xl border border-zinc-800">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shrink-0">
                <Check className="h-3 w-3 text-white" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">{addedItemMessage}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex relative">
          <div id="cart-list-container" className="flex-1 overflow-y-auto bg-neutral-50 p-4 pb-36 md:pb-6 scrollbar-thin flex justify-center">
            <div className="w-full max-w-3xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2 uppercase tracking-wide">
                  <ShoppingCart className="h-5 w-5 text-red-700" />
                  Daftar Pesanan Saat Ini
                </h3>
                <span className="text-[10px] bg-red-100 text-red-800 font-extrabold px-2.5 py-1 rounded-md">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} Porsi
                </span>
              </div>

              <div className="space-y-3 pb-8 pl-1 pr-1">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center bg-white border border-dashed border-zinc-300 rounded-3xl h-full">
                    <div className="h-16 w-16 bg-zinc-50 rounded-full flex items-center justify-center mb-3 border border-zinc-100">
                      <ShoppingCart className="h-8 w-8 text-zinc-300 stroke-[1.5]" />
                    </div>
                    <p className="text-sm font-black text-zinc-700 mb-1">Daftar Pesanan Kosong</p>
                    <p className="text-[10px] text-zinc-500 max-w-[200px] leading-relaxed mx-auto">
                      Pilih menu dari {window.innerWidth >= 768 ? 'panel kanan' : 'tombol menu di pojok kanan atas'} untuk ditambahkan ke daftar ini.
                    </p>
                  </div>
                ) : (
                  effectiveCart.map((item) => (
                    <div key={item.id_detail} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm text-left gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-zinc-950 truncate leading-tight mb-1" title={getFormattedMenuDisplay(item.menu.NAMA_MENU, item.varian.NAMA_VARIAN)}>{getFormattedMenuDisplay(item.menu.NAMA_MENU, item.varian.NAMA_VARIAN)}</h4>
                        <p className="text-[11px] text-zinc-500 font-medium">
                          @ Rp{item.varian.HARGA.toLocaleString('id-ID')}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2.5 shrink-0">
                        <span className="text-xs font-black text-zinc-950">
                          Rp{(item.varian.HARGA * item.quantity).toLocaleString('id-ID')}
                        </span>
                        {item.menu.ID_MENU === 'PROMO' ? null : (
                          <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden h-8 shadow-sm">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.varian.ID_VARIAN, -1)}
                              className="px-3 hover:bg-zinc-200 text-zinc-700 h-full flex items-center transition active:bg-zinc-300"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="px-2 font-mono text-sm font-extrabold text-zinc-900 min-w-[28px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.varian.ID_VARIAN, 1)}
                              className="px-3 hover:bg-zinc-200 hover:text-red-700 text-zinc-700 h-full flex items-center transition active:bg-zinc-300"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Persistent extra empty space at the bottom of the list to ensure the mobile bottom checkout bar NEVER covers any menus or buttons */}
              <div className="h-48 md:hidden" aria-hidden="true" />
            </div>
          </div>

          <div className="hidden md:flex flex-col w-[380px] xl:w-[480px] border-l border-zinc-200 bg-white p-5 overflow-hidden shrink-0 shadow-[-10px_0_20px_rgba(0,0,0,0.02)] z-10">
            <div className="mb-4 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
                  Katalog Menu
                </h3>
                {totalPortions > 0 && (
                  <button 
                    onClick={() => setShowCartPopup(true)}
                    className="flex items-center gap-1.5 bg-red-100 text-red-800 font-extrabold px-3 py-1.5 rounded-full animate-in zoom-in-50 duration-300 hover:bg-red-200 transition cursor-pointer active:scale-95"
                  >
                    <div className="h-2 w-2 bg-red-600 rounded-full animate-pulse"></div>
                    <span className="text-[10px] uppercase tracking-wider">{totalPortions} Porsi</span>
                  </button>
                )}
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              {renderCatalogGrid()}
            </div>
          </div>
        </div>

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-5 shadow-[0_-15px_30px_rgba(0,0,0,0.08)] z-40 pb-safe">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Harga</span>
            <span className="text-xl font-black text-red-750">Rp{checkoutTotal.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPrinterSettings(true)}
              title="Pengaturan Printer Thermal"
              className={`p-4 rounded-xl transition shadow-md border border-zinc-200 cursor-pointer active:scale-95 flex items-center justify-center shrink-0 ${thermalPrinter ? 'bg-emerald-50 text-emerald-700' : 'bg-white hover:bg-zinc-100 text-zinc-700'}`}
            >
               <Printer className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowCheckoutModal(true)}
              disabled={cart.length === 0}
              className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-extrabold text-sm py-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 active:scale-95 uppercase tracking-wider cursor-pointer"
            >
              Proses Struk &amp; Checkout
            </button>
          </div>
        </div>

        {showCatalogModal && (
          <div style={{ zIndex: 99999 }} className="md:hidden fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
            <div className="bg-white w-full h-full shadow-2xl flex flex-col animate-in slide-in-from-bottom-12">
              <div className="p-4 border-b border-zinc-200 flex justify-between items-center shrink-0 pt-safe">
                <h3 className="text-base font-black text-zinc-900 uppercase tracking-tight pl-2">Katalog Menu</h3>
                <div className="flex items-center gap-2">
                  {totalPortions > 0 && (
                    <button 
                      onClick={() => setShowCartPopup(true)}
                      className="flex items-center gap-1.5 bg-red-100 text-red-800 font-extrabold px-3 py-1.5 rounded-full animate-in zoom-in-50 duration-300 hover:bg-red-200 transition cursor-pointer active:scale-95"
                    >
                      <div className="h-2 w-2 bg-red-600 rounded-full animate-pulse"></div>
                      <span className="text-[10px] uppercase tracking-wider">{totalPortions} Porsi</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setShowCatalogModal(false)}
                    className="p-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-full text-zinc-700 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-hidden min-h-0 pb-16">
                {renderCatalogGrid()}
              </div>
            </div>
          </div>
        )}

        {isSyncing && (
          <div style={{ zIndex: 10000002 }} className="fixed bottom-6 right-6 flex items-center gap-3 bg-zinc-900/90 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300 backdrop-blur-md border border-zinc-700/50">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Sinkronisasi</span>
              <span className="text-[9px] font-medium text-zinc-300">Mengirim data ke Cloud...</span>
            </div>
          </div>
        )}

        {showCheckoutModal && (
          <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md xl:max-w-lg rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
              <div className="p-5 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 shrink-0">
                <div>
                  <h2 className="text-base font-black text-zinc-900 uppercase tracking-tight">Konfirmasi Transaksi</h2>
                  <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Selesaikan pembayaran saat ini juga</p>
                </div>
                <button 
                  onClick={() => setShowCheckoutModal(false)}
                  className="p-2 bg-zinc-200 hover:bg-zinc-300 rounded-full text-zinc-700 transition active:scale-95"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <div className="mb-6">
                  <label className="text-[10px] font-black text-zinc-500 block mb-3 uppercase tracking-wider">
                    Cek Ulang Pesanan
                  </label>
                  <div className="space-y-3 mb-4 max-h-[115px] overflow-y-auto pr-2 custom-scrollbar">
                    {effectiveCart.map(item => (
                      <div key={item.id_detail} className="flex justify-between text-xs items-center">
                        <span className="text-zinc-800 font-semibold leading-tight pr-4">
                          <span className="font-extrabold text-zinc-950 inline-block w-6">{item.quantity}x</span> 
                          {getFormattedMenuDisplay(item.menu.NAMA_MENU, item.varian.NAMA_VARIAN)}
                        </span>
                        <span className="text-zinc-900 font-bold shrink-0">{(item.varian.HARGA * item.quantity).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-dashed border-zinc-300">
                    <span className="text-sm font-black text-zinc-900 uppercase">Total Tagihan</span>
                    <span className="text-xl font-black text-red-750">Rp{checkoutTotal.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="mb-2">
                  <label className="text-[10px] font-black text-zinc-500 block mb-3 uppercase tracking-wider">
                    PILIH METODE BAYAR
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      disabled={isCompliment}
                      onClick={() => setPaymentMethod('Cash')}
                      className={`py-3.5 border rounded-2xl flex flex-col items-center gap-2 transition active:scale-95 ${
                        paymentMethod === 'Cash' && !isCompliment
                          ? 'bg-zinc-950 border-zinc-950 text-white shadow-md' 
                          : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                      } ${isCompliment ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Banknote className={`h-5 w-5 ${paymentMethod === 'Cash' && !isCompliment ? 'text-emerald-400' : 'text-zinc-400'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Tunai (Cash)</span>
                    </button>
                    <button
                      disabled={isCompliment}
                      onClick={() => setPaymentMethod('Transfer')}
                      className={`py-3.5 border rounded-2xl flex flex-col items-center gap-2 transition active:scale-95 ${
                        paymentMethod === 'Transfer' && !isCompliment
                          ? 'bg-zinc-950 border-zinc-950 text-white shadow-md' 
                          : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                      } ${isCompliment ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <CreditCard className={`h-5 w-5 ${paymentMethod === 'Transfer' && !isCompliment ? 'text-sky-400' : 'text-zinc-400'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Transfer</span>
                    </button>
                    <button
                      disabled={isCompliment}
                      onClick={() => setPaymentMethod('QRIS')}
                      className={`py-3.5 border rounded-2xl flex flex-col items-center gap-2 transition active:scale-95 ${
                        paymentMethod === 'QRIS' && !isCompliment
                          ? 'bg-zinc-950 border-zinc-950 text-white shadow-md' 
                          : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'
                      } ${isCompliment ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <QrCode className={`h-5 w-5 ${paymentMethod === 'QRIS' && !isCompliment ? 'text-fuchsia-400' : 'text-zinc-400'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">QRIS</span>
                    </button>
                  </div>
                  
                  {/* Warning message moved here */}
                  <div className="mt-3 bg-red-50 text-red-800 p-3 rounded-xl border border-red-100 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold leading-relaxed">
                      Pastikan uang sudah diterima / jika selain cash pastikan bukti pembayaran valid.
                    </p>
                  </div>
                  
                  <div className="mt-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                    <div 
                      className="flex items-center justify-between cursor-pointer mb-2"
                      onClick={() => setIsCompliment(!isCompliment)}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-zinc-900 uppercase">TANDAI SEBAGAI COMPLIMENT</span>
                        <span className="text-[9px] font-medium text-zinc-500 block mt-0.5">transaksi tidak akan dihitung sebagai pemasukan</span>
                      </div>
                      <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isCompliment ? 'bg-red-600' : 'bg-zinc-300'}`}>
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isCompliment ? 'translate-x-5' : 'translate-x-1'}`} />
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <label className="text-[10px] font-black text-zinc-500 block mb-1.5 uppercase tracking-wider">
                        Catatan Pesanan
                      </label>
                      <textarea
                        rows={3}
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                        placeholder="Contoh: Jangan terlalu pedas, sambalnya dipisah, dll"
                        className="w-full bg-white border border-zinc-200 text-xs text-zinc-900 rounded-lg p-2.5 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-zinc-100 bg-white flex flex-col gap-3 shrink-0">
                  <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-xl border border-zinc-200 cursor-pointer" onClick={() => setAutoPrint(!autoPrint)}>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-zinc-900">Cetak & Preview Struk</span>
                      <span className="text-[10px] font-medium text-zinc-500">Jika mati, struk hanya diarsipkan oleh sistem</span>
                    </div>
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoPrint ? 'bg-red-600' : 'bg-zinc-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoPrint ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                  </div>
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-extrabold text-xs py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  <Printer className="h-4 w-4 shrink-0" />
                  {autoPrint ? 'Cetak Struk Sekarang' : 'Arsipkan ke Drive'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showCartPopup && (
          <div style={{ zIndex: 10000001 }} className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowCartPopup(false)}>
              <div 
                className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 h-[90vh] sm:h-[80vh]"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-900 shrink-0">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-red-500" /> 
                    Detail Pesanan ({totalPortions} Porsi)
                  </h3>
                  <button 
                    onClick={() => setShowCartPopup(false)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition active:scale-95"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50">
                    {effectiveCart.map(item => (
                      <div key={item.id_detail} className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-zinc-100 shadow-sm">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black text-zinc-900 truncate">
                              <span className="text-red-700">{item.quantity}x</span> {getFormattedMenuDisplay(item.menu.NAMA_MENU, item.varian.NAMA_VARIAN)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-black text-zinc-950">
                              Rp{(item.varian.HARGA * item.quantity).toLocaleString('id-ID')}
                            </p>
                            {item.menu.ID_MENU !== 'PROMO' && (
                              <button 
                                onClick={() => removeFromCart(item.varian.ID_VARIAN)}
                                className="text-[9px] font-bold text-red-700 hover:underline mt-1 bg-red-50 px-2 py-0.5 rounded-md"
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                      </div>
                    ))}
                    {effectiveCart.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-400 py-10">
                          <ShoppingCart className="h-8 w-8 mb-2 opacity-20" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Keranjang Kosong</p>
                      </div>
                    )}
                </div>
                <div className="p-5 border-t border-zinc-100 bg-white">
                    <div className="flex justify-between items-end mb-4 px-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Bayar</span>
                        <span className="text-lg font-black text-red-800">
                          Rp{checkoutTotal.toLocaleString('id-ID')}
                        </span>
                    </div>
                    <button 
                      onClick={() => {
                        setShowCartPopup(false);
                        setShowCatalogModal(false);
                      }}
                      className="w-full bg-red-700 text-white font-black text-[11px] uppercase py-4 rounded-2xl shadow-xl shadow-red-200 active:scale-95 transition flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Kembali ke Daftar Pesanan
                    </button>
                </div>
              </div>
          </div>
        )}

        {/* MODALS */}
        {selectedMenuForVarian && (
          <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-300 ease-out" onClick={() => setSelectedMenuForVarian(null)}>
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm flex flex-col max-h-[95vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-32 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 ease-out" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50 rounded-t-3xl sm:rounded-t-3xl shrink-0">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">Pilih Varian</h3>
                <button 
                  onClick={() => setSelectedMenuForVarian(null)} 
                  className="p-2 bg-white hover:bg-zinc-200 text-zinc-700 rounded-xl transition cursor-pointer active:scale-95 shadow-sm border border-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="p-5 overflow-y-auto w-full min-h-0">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-dashed border-zinc-200">
                    <div className="h-10 w-10 rounded-xl bg-red-50 text-red-750 flex items-center justify-center shrink-0 border border-red-100">
                      <UtensilsCrossed className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-zinc-950 leading-tight">{selectedMenuForVarian.NAMA_MENU}</h4>
                    </div>
                </div>

                <div className="space-y-3">
                  {/* @ts-ignore */}
                  {(selectedMenuForVarian.varians || masterData?.varian.filter(v => v.ID_MENU === selectedMenuForVarian.ID_MENU && (v.STATUS === 'AKTIF' || v.STATUS === 'Tersedia')) || []).map((v: any) => (
                    <button 
                      key={v.ID_VARIAN}
                      onClick={() => {
                        addToCart({ varian: v, menu: selectedMenuForVarian });
                        setSelectedMenuForVarian(null); // Close modal on select
                      }}
                      className="w-full text-left bg-white border border-zinc-200 p-4 rounded-2xl flex justify-between items-center hover:border-red-600/50 hover:bg-red-50/30 transition group cursor-pointer active:scale-[0.98]"
                    >
                        <div>
                          <p className="text-xs font-bold text-zinc-900 mb-1">{v.NAMA_VARIAN !== 'Reguler' ? v.NAMA_VARIAN : 'Standard / Reguler'}</p>
                          <p className="text-xs font-black text-red-700">Rp{v.HARGA.toLocaleString('id-ID')}</p>
                        </div>
                        <div 
                          className="p-2 bg-red-50 text-red-750 group-hover:bg-red-700 group-hover:text-white rounded-xl transition"
                        >
                            <Plus className="h-5 w-5" />
                        </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteId && (
          <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmDeleteId(null)}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-zinc-200 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4 border border-red-200">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">Hapus Item Pesanan</h3>
              <p className="text-xs text-zinc-600 mb-6 leading-relaxed">Apakah Anda yakin ingin menghapus {cart.find(i => i.varian.ID_VARIAN === confirmDeleteId)?.menu.NAMA_MENU} dari daftar pesanan?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDeleteId(null)} 
                  className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase cursor-pointer transition"
                >
                  Batal
                </button>
                <button 
                  onClick={() => {
                    removeFromCart(confirmDeleteId);
                    setConfirmDeleteId(null);
                  }} 
                  className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase cursor-pointer transition"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmDiscardCart && (
          <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmDiscardCart(false)}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-zinc-200 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4 border border-red-200">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">Batalkan Transaksi?</h3>
              <p className="text-xs text-zinc-600 mb-6 leading-relaxed">Pesanan aktif belum diproses. Semua item dalam daftar pesanan Anda akan dibuang, apakah Anda setuju?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDiscardCart(false)} 
                  className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase cursor-pointer transition"
                >
                  Kembali
                </button>
                <button 
                  onClick={() => {
                    setIsCreatingTx(false);
                    setCart([]);
                    setConfirmDiscardCart(false);
                  }} 
                  className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase cursor-pointer transition"
                >
                  Ya, Buang
                </button>
              </div>
            </div>
          </div>
        )}

        {alertMessage && (
          <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-zinc-200 animate-in zoom-in-95">
              {alertType === 'success' && (
                <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              )}
              {alertType === 'error' && (
                <div className="h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
                  <XCircle className="h-6 w-6" />
                </div>
              )}
              {alertType === 'warning' && (
                <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
                  <AlertCircle className="h-6 w-6" />
                </div>
              )}
              <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">
                {alertType === 'success' ? 'Sukses' : alertType === 'error' ? 'Gagal' : 'Pemberitahuan'}
              </h3>
              <p className="text-xs text-zinc-600 mb-6 leading-relaxed">{alertMessage}</p>
              <button 
                onClick={() => setAlertMessage(null)} 
                className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase cursor-pointer transition shadow-md active:scale-95"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}

        {showPrinterWarning && (
          <div style={{ zIndex: 10000002 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowPrinterWarning(false)}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-center border border-zinc-200 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-4 border border-red-200">
                <Printer className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black text-zinc-950 uppercase mb-2">Peringatan: Printer Belum Terhubung!</h3>
              <p className="text-xs text-zinc-600 mb-6 leading-relaxed">Printer belum tersambung ke HP/Tablet kamu nih. Nanti struck tidak akan keluar tercetak ya, tapi pesanan tetap aman tercatat sistem. Yakin mau lanjut checkout pesanan ini tanpa cetak struk?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowPrinterWarning(false)} 
                  className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase cursor-pointer transition"
                >
                  Batal
                </button>
                <button 
                  onClick={proceedCheckout} 
                  className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs uppercase cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  Lanjut Tanpa Struk
                </button>
              </div>
            </div>
          </div>
        )}

        {showPrinterSettings && createPortal(
          <div className="fixed inset-0 z-[100000] bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowPrinterSettings(false)}>
            <div className="bg-white rounded-[24px] shadow-2xl p-6 w-full max-w-sm border border-zinc-200 animate-in zoom-in-95 text-left" onClick={e => e.stopPropagation()}>
                <div className="h-12 w-12 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center mx-auto mb-4 border border-zinc-200 shrink-0">
                <Printer className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight text-center mb-1">Cetak Struk Thermal</h3>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed text-center font-medium">Buka jalur koneksi Bluetooth serial ESC/POS langsung ke printer thermal fisik Anda lewat browser.</p>
              
              <div className="space-y-3 mb-6">
                 {thermalPrinter ? (
                   <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
                      <div className="bg-emerald-100 text-emerald-600 rounded-full p-2"><CheckCircle2 className="h-5 w-5" /></div>
                      <div>
                        <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">Printer Terkoneksi</p>
                        <p className="text-[10px] text-emerald-700 font-bold">{thermalPrinter.name || 'Bluetooth Device'}</p>
                      </div>
                   </div>
                 ) : (
                   <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-xl flex flex-col items-center gap-2 text-center">
                     <AlertCircle className="h-5 w-5 text-zinc-400" />
                     <p className="text-[10px] text-zinc-500 font-medium">Belum ada printer terkoneksi.<br/>Pastikan Bluetooth aktif.</p>
                   </div>
                 )}
              </div>

              <div className="flex flex-col gap-2">
                {!thermalPrinter ? (
                  <button 
                    onClick={handleConnectPrinter} 
                    className="w-full py-3.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider cursor-pointer transition flex justify-center items-center gap-2"
                  >
                    <Bluetooth className="h-4 w-4" /> Hubungkan Printer Pribadi
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                       thermalPrinter?.gatt?.disconnect();
                       setThermalPrinter(null);
                    }} 
                    className="w-full py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-black text-xs uppercase tracking-wider cursor-pointer transition flex justify-center items-center gap-2"
                  >
                    Putuskan Koneksi Bluetooth
                  </button>
                )}
                <button 
                  onClick={() => setShowPrinterSettings(false)} 
                  className="w-full py-3.5 rounded-xl text-zinc-500 hover:text-zinc-700 font-extrabold text-[10px] uppercase tracking-wider cursor-pointer transition"
                >
                  Tutup Pengaturan
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      </div>
    );
  }

  if (!isCreatingTx) {
    const todayDate = new Date();
    const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
    const displayDateStr = new Date(selectedReportDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    const todayTxs = history.filter(tx => {
      const d = new Date(tx.timestamp);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dStr = `${y}-${m}-${day}`;
      return dStr === selectedReportDate;
    });
    
    let totalRevenue = 0;
    let totalCash = 0;
    let totalTransfer = 0;
    
    todayTxs.forEach(tx => {
      const isCompliment = String(tx.pesanan?.JENIS_PESANAN || tx.paymentMethod || '').toUpperCase() === 'COMPLIMENT';
      if (!isCompliment) {
        totalRevenue += tx.totalAmount;
        const pm = String(tx.paymentMethod || '').toUpperCase();
        if (pm === 'CASH' || pm === 'TUNAI' || pm === '') {
          totalCash += tx.totalAmount;
        } else {
          totalTransfer += tx.totalAmount;
        }
      }
    });

    const isToday = selectedReportDate === todayStr;

    return (
      <>
        <div 
          className="space-y-6 animate-fade-in text-left relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {pullDistance > 0 && (
            <div className="fixed top-20 left-0 right-0 flex justify-center items-center h-12">
              <RefreshCw className={`h-6 w-6 text-red-700 animate-spin`} style={{ opacity: pullDistance / 100 }} />
            </div>
          )}
          <div className="max-w-xl mx-auto flex flex-col gap-5 pt-2" style={{ marginTop: `${pullDistance / 2}px` }}>
          
            {/* Omset Hari Ini Panel for Non-Admin */}
            {activeBranch !== 'ADMIN' && (
              <div className="space-y-3 mb-2 shrink-0">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[13px] font-black text-zinc-800 tracking-tight flex items-center gap-2">Statistik {isToday ? 'Hari Ini' : 'Harian'}</h4>
                  <div className={`relative flex items-center gap-2 bg-white border border-zinc-200 shadow-sm rounded-lg px-2.5 py-1.5 transition-all ${isMetricsLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:border-zinc-300 cursor-pointer'}`}>
                    <Calendar className="h-3.5 w-3.5 text-emerald-650 shrink-0" />
                    <span className="text-[10px] font-extrabold text-zinc-700 tracking-tight">
                      {isMetricsLoading ? "Loading..." : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(selectedReportDate))}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <input 
                      type="date"
                      value={selectedReportDate}
                      max={todayStr}
                      disabled={isMetricsLoading}
                      onChange={async (e) => {
                        if (e.target.value) {
                           if (e.target.value > todayStr) {
                             alert("Tidak bisa memilih tanggal di masa depan.");
                           } else {
                             setIsMetricsLoading(true);
                             setSelectedReportDate(e.target.value);
                             
                             // Try to fetch data for this date if not available locally
                             try {
                                const allHistory = await getTransactions();
                                const filtered = allHistory.filter(tx => {
                                   const d = new Date(tx.timestamp);
                                   const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                   return dStr === e.target.value;
                                });

                                if (filtered.length === 0) {
                                    // Fetch remote
                                    const dateObj = new Date(e.target.value);
                                    const yearStr = dateObj.getFullYear();
                                    const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
                                    const dayStr = String(dateObj.getDate()).padStart(2, '0');
                                    const paramTanggal = `${dayStr}/${monthStr}/${yearStr}`;
                                    const remoteHistory = await getTransactionsFromGAS(activeBranch, paramTanggal);
                                    for (const tx of remoteHistory) {
                                        await saveTransaction(tx);
                                    }
                                    const updatedHistory = await getTransactions();
                                    const branchHistory = activeBranch === 'ADMIN' ? updatedHistory : updatedHistory.filter(tx => String(tx.cabang) === String(activeBranch));
                                    setHistory(branchHistory.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
                                }
                             } catch (err) {
                                console.error("Error fetching remote transactions for date", err);
                             }

                             setIsMetricsLoading(false);
                           }
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-zinc-200/85 p-4 rounded-[24px] shadow-sm flex flex-col justify-center relative overflow-hidden min-h-[90px]">
                <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 text-emerald-50"><Banknote className="h-16 w-16" /></div>
                <div className="relative z-10 flex flex-col justify-center h-full pt-1">
                   <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block mb-0.5">Total Omset</span>
                   {isMetricsLoading || isInitialLoading ? (
                     <p className="text-xs font-black text-zinc-400 animate-pulse pt-1 uppercase tracking-widest">Loading...</p>
                   ) : (
                     <p className="text-sm font-black text-emerald-950 tracking-tight leading-none pt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Rp{totalRevenue.toLocaleString('id-ID')}</p>
                   )}
                </div>
              </div>
              <div className="bg-white border border-zinc-200/85 p-4 rounded-[24px] shadow-sm flex flex-col justify-center relative overflow-hidden min-h-[90px]">
                <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 text-amber-50"><ShoppingBag className="h-16 w-16" /></div>
                <div className="relative z-10 flex flex-col justify-center h-full pt-1">
                   <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block mb-0.5">Total Pesanan</span>
                   <div className="flex flex-col gap-0.5 mt-0.5">
                     {isMetricsLoading || isInitialLoading ? (
                       <p className="text-xs font-black text-zinc-400 animate-pulse uppercase tracking-widest">Loading...</p>
                     ) : (
                       <>
                         <p className="text-lg font-black text-amber-950 tracking-tight leading-none">{todayTxs.length}</p>
                         <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest leading-none">Selesai</span>
                       </>
                     )}
                   </div>
                </div>
              </div>
              <div className="bg-white border border-zinc-200/85 p-4 rounded-[24px] shadow-sm flex flex-col justify-center relative overflow-hidden min-h-[90px]">
                <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 text-blue-50"><Coins className="h-16 w-16" /></div>
                <div className="relative z-10 flex flex-col justify-center h-full pt-1">
                   <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest block mb-0.5">Total Cash</span>
                   {isMetricsLoading || isInitialLoading ? (
                     <p className="text-xs font-black text-zinc-400 animate-pulse pt-1 uppercase tracking-widest">Loading...</p>
                   ) : (
                     <p className="text-sm font-black text-blue-950 tracking-tight leading-none pt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Rp{totalCash.toLocaleString('id-ID')}</p>
                   )}
                </div>
              </div>
              <div className="bg-white border border-zinc-200/85 p-4 rounded-[24px] shadow-sm flex flex-col justify-center relative overflow-hidden min-h-[90px]">
                <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 text-fuchsia-50"><CreditCard className="h-16 w-16" /></div>
                <div className="relative z-10 flex flex-col justify-center h-full pt-1">
                   <span className="text-[10px] font-black text-fuchsia-800 uppercase tracking-widest block mb-0.5">Total Transfer</span>
                   {isMetricsLoading || isInitialLoading ? (
                     <p className="text-xs font-black text-zinc-400 animate-pulse pt-1 uppercase tracking-widest">Loading...</p>
                   ) : (
                     <p className="text-sm font-black text-fuchsia-950 tracking-tight leading-none pt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Rp{totalTransfer.toLocaleString('id-ID')}</p>
                   )}
                </div>
              </div>
                </div>
                <button
                  onClick={handleOpenReport}
                  disabled={isMetricsLoading}
                  className={`w-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition shadow-sm mt-3 ${isMetricsLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:bg-emerald-100 active:scale-95'}`}
                >
                   <Banknote className="h-4 w-4" /> Laporkan Omset {isToday ? 'Hari Ini' : 'Harian'}
                </button>
              </div>
            )}

          <div className="bg-white border border-zinc-200/85 shadow-sm rounded-3xl p-5 sm:p-6 space-y-4 flex flex-col shrink-0 min-h-[300px]">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 shrink-0">
              <div>
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-750" />
                  Riwayat Transaksi
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={onNavigateToHistory} 
                  className="text-[10px] font-black text-red-750 uppercase tracking-widest hover:text-red-900 cursor-pointer bg-transparent border-none"
                >
                  Lihat Semua
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-2.5 pr-1">
              {isInitialLoading ? (
                <div className="flex flex-col gap-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 border border-zinc-100 rounded-2xl bg-zinc-50/50 animate-pulse flex flex-col gap-3">
                      <div className="flex justify-between">
                        <div className="h-3 w-24 bg-zinc-200 rounded"></div>
                        <div className="h-3 w-12 bg-zinc-200 rounded"></div>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="space-y-2">
                          <div className="h-2 w-32 bg-zinc-200 rounded"></div>
                          <div className="h-2 w-16 bg-zinc-200 rounded"></div>
                        </div>
                        <div className="h-4 w-20 bg-zinc-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center bg-zinc-50 border border-zinc-200/50 rounded-2xl">
                  <ReceiptText className="h-8 w-8 text-zinc-300 mb-3" />
                  <p className="text-zinc-500 font-medium text-xs mb-3">Belum ada transaksi dibuat.</p>
                  <button 
                    onClick={() => setIsCreatingTx(true)}
                    disabled={isInitialLoading}
                    className={`bg-red-700 text-white hover:bg-red-800 font-black text-xs px-6 py-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg active:scale-95 uppercase tracking-widest w-full sm:w-auto ${isInitialLoading ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Plus className="h-4 w-4" /> 
                    {isInitialLoading ? 'Memuat Data...' : 'Tambah Pesanan Baru'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2.5">
                    {history.slice(0, 3).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex flex-col gap-2"
                      >
                        <div
                          onClick={() => {
                            if (selectedTransactionForKasir?.id === tx.id) {
                              setSelectedTransactionForKasir(null);
                            } else {
                              setSelectedTransactionForKasir(tx);
                              setPreviewType('inline');
                            }
                          }}
                          className={`p-4 border rounded-2xl transition flex flex-col justify-between text-left group cursor-pointer ${
                            selectedTransactionForKasir?.id === tx.id 
                              ? 'bg-red-50 border-red-700 ring-1 ring-red-700/10' 
                              : 'border-zinc-200/80 hover:border-zinc-400 bg-white hover:bg-zinc-50/20'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <p className={`text-xs font-extrabold truncate flex items-center gap-1.5 ${selectedTransaction?.id === tx.id ? 'text-red-800' : 'text-zinc-900'}`}>
                              {tx.pesanan?.JENIS_PESANAN === 'Compliment' ? (
                                <Gift className="h-3.5 w-3.5 text-amber-500 animate-pulse fill-amber-100 shrink-0" />
                              ) : (
                                <ReceiptText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              )}
                              {tx.id}
                            </p>
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
                              <p className="text-[10px] text-zinc-500 font-medium">
                                {new Date(tx.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} &bull; {new Date(tx.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} &bull; {tx.paymentMethod || (tx.pesanan?.JENIS_PESANAN === 'Compliment' ? 'Compliment' : '')}
                              </p>
                            </div>
                            <p className="text-sm font-black text-zinc-950">
                              Rp{tx.totalAmount.toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {selectedTransactionForKasir && previewType === 'inline' && (
          <div ref={previewRef} className="mt-8 w-full bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-zinc-900 text-sm">Pratinjau Struk</h3>
              <button 
                onClick={() => setSelectedTransactionForKasir(null)}
                className="bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                Tutup
              </button>
            </div>
            <div className="p-4 bg-white rounded-lg flex justify-center mb-4">
                <ReceiptThermal 
                  transaction={selectedTransactionForKasir} 
                  branchName={derivedBranchName} 
                  branchLocation={masterData?.cabang?.find((c: any) => String(c.ID_CABANG) === String(selectedTransactionForKasir.cabang))?.LOKASI}
                />
            </div>
            <button className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 uppercase tracking-wider cursor-pointer" onClick={() => printReceiptAndUpload(selectedTransactionForKasir)}>
                Cetak Struk Sekarang
            </button>
          </div>
        )}

        {/* Modal Pratinjau Struk untuk Kasir */}
        {selectedTransactionForKasir && previewType === 'popup' && (
          <div className="fixed inset-0 z-[1000] bg-zinc-950/60 backdrop-blur-sm flex justify-center items-end p-4 animate-in fade-in duration-200" onClick={() => { setSelectedTransactionForKasir(null); onSelectTransaction(null); }}>
            <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 font-sans">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                  Pratinjau Struk
                </h3>
                <button 
                  onClick={() => { setSelectedTransactionForKasir(null); onSelectTransaction(null); }}
                  className="p-1.5 bg-white hover:bg-zinc-100 rounded-lg text-zinc-700 transition shadow-sm border border-zinc-200 cursor-pointer active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 max-h-[60vh] overflow-y-auto bg-neutral-100 flex justify-center">
                 <ReceiptThermal 
                   transaction={selectedTransactionForKasir} 
                   branchName={derivedBranchName} 
                   branchLocation={masterData?.cabang?.find((c: any) => String(c.ID_CABANG) === String(selectedTransactionForKasir.cabang))?.LOKASI}
                 />
              </div>
              <div className="p-4 border-t border-zinc-200 bg-zinc-50">
                <button className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 uppercase tracking-wider cursor-pointer" onClick={() => printReceiptAndUpload(selectedTransactionForKasir)}>
                  Cetak Struk Sekarang
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

        {/* Modal Laporan Omset */}
        {showReportPopup && createPortal(
          <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={() => setShowReportPopup(false)}>
            <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 font-sans">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight">
                  Laporkan Omset
                </h3>
                <button 
                  onClick={() => setShowReportPopup(false)}
                  className="p-1.5 bg-white hover:bg-zinc-100 rounded-lg text-zinc-700 transition shadow-sm border border-zinc-200 cursor-pointer active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 max-h-[60vh] overflow-y-auto bg-neutral-100 text-left space-y-4">
                {isReporting ? (
                  <div className="flex flex-col justify-center items-center py-10 gap-3">
                    <RefreshCw className="h-8 w-8 text-emerald-700 animate-spin" />
                    <p className="text-sm font-bold text-emerald-900 animate-pulse">Menyiapkan Laporan...</p>
                  </div>
                ) : reportError ? (
                  <div className="bg-red-50 p-4 border border-red-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-center">
                    <AlertCircle className="h-8 w-8 text-red-600 mb-1" />
                    <p className="text-xs font-bold text-red-900">{reportError}</p>
                    <button 
                      onClick={handleOpenReport}
                      className="mt-2 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 px-3 py-1.5 rounded-lg active:scale-95 transition cursor-pointer"
                    >Coba Lagi</button>
                  </div>
                ) : reportData ? (
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3 font-sans relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10"><Banknote className="w-20 h-20 text-emerald-500" /></div>
                    <div className="relative z-10 space-y-3">
                      <p className="text-xs text-zinc-800 leading-relaxed font-medium">Halo, berikut adalah <b className="text-emerald-900">Laporan Omset {isToday ? 'Hari Ini' : 'Harian'}</b>:</p>
                      <div className="space-y-2 mt-2 bg-white/60 p-3 rounded-xl border border-emerald-100 backdrop-blur-sm text-left">
                        <p className="text-xs text-zinc-700 flex items-center gap-2"><Building className="h-4 w-4 shrink-0 text-zinc-500" /> <span><b className="text-zinc-900 break-words">Cabang:</b> {reportData.nama_cabang}</span></p>
                        <p className="text-xs text-zinc-700 flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0 text-zinc-500" /> <span><b className="text-zinc-900 break-words">Tanggal:</b> {displayDateStr}</span></p>
                        <p className="text-xs text-zinc-700 flex items-center gap-2"><Banknote className="h-4 w-4 shrink-0 text-amber-500" /> <span><b className="text-zinc-900 break-words">Total Omset:</b> Rp{totalRevenue.toLocaleString('id-ID')}</span></p>
                        <p className="text-xs text-zinc-700 flex items-center gap-2 pl-6"><span><b className="text-zinc-900 break-words">Total Cash:</b> Rp{totalCash.toLocaleString('id-ID')}</span></p>
                        <p className="text-xs text-zinc-700 flex items-center gap-2 pl-6"><span><b className="text-zinc-900 break-words">Total Transfer:</b> Rp{totalTransfer.toLocaleString('id-ID')}</span></p>
                        <p className="text-xs text-zinc-700 flex items-center gap-2"><Package className="h-4 w-4 shrink-0 text-zinc-500" /> <span><b className="text-zinc-900 break-words">Total Pesanan:</b> {todayTxs.length} Selesai</span></p>
                      </div>
                      <div className="space-y-2 mt-2 bg-white/60 p-3 rounded-xl border border-emerald-100 backdrop-blur-sm text-left">
                        <p className="text-[11px] font-black text-zinc-800 uppercase tracking-tight mb-1">Rincian Menu Terjual:</p>
                        {(() => {
                           let menuSales: { [menuName: string]: { total: number, variants: { [variantName: string]: number } } } = {};
                           todayTxs.forEach(tx => {
                             tx.detail?.forEach(item => {
                               const menu = item.NAMA_MENU || 'Unknown';
                               const variant = item.VARIAN || 'Unknown';
                               const qty = Number(item.QTY) || 1;
                               
                               if (!menuSales[menu]) {
                                 menuSales[menu] = { total: 0, variants: {} };
                               }
                               menuSales[menu].total += qty;
                               
                               if (!menuSales[menu].variants[variant]) {
                                 menuSales[menu].variants[variant] = 0;
                               }
                               menuSales[menu].variants[variant] += qty;
                             });
                           });
                           const sortedMenus = Object.entries(menuSales).sort((a, b) => b[1].total - a[1].total);
                           return sortedMenus.length === 0 ? (
                             <p className="text-xs text-zinc-500 italic">Tidak ada menu terjual</p>
                           ) : (
                             <div className="space-y-2">
                               {sortedMenus.map(([menu, data], idx) => (
                                 <div key={idx} className="text-xs text-zinc-700">
                                   <p className="font-semibold text-zinc-900">{idx + 1}. {menu}: {data.total}x dipesan</p>
                                   <ul className="list-disc list-inside pl-2 text-[10px] text-zinc-600 mt-0.5 space-y-0.5">
                                     {Object.entries(data.variants)
                                       .sort(([_vA, qA], [_vB, qB]) => qB - qA)
                                       .map(([variant, qty], vIdx) => (
                                         <li key={vIdx}>{variant}: {qty}x dipesan</li>
                                       ))}
                                   </ul>
                                 </div>
                               ))}
                             </div>
                           )
                        })()}
                      </div>
                      <div className="space-y-1 mt-2 bg-white/60 p-3 rounded-xl border border-emerald-100 backdrop-blur-sm text-left flex items-start gap-2">
                         <Folder className="h-4 w-4 shrink-0 text-sky-500 mt-0.5" />
                         <p className="text-xs text-zinc-700"><b className="text-zinc-900 block mb-1">Folder Struk:</b> <a href={reportData.folder_url} target="_blank" rel="noreferrer" className="text-emerald-600 underline break-all inline-block mt-0.5">{reportData.folder_url}</a></p>
                      </div>
                      <p className="text-xs text-zinc-800 pt-2 font-medium">Terima kasih!</p>
                    </div>
                  </div>
                ) : null}
              </div>
              
              <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex gap-2">
                <button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3.5 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider cursor-pointer gap-2" 
                  onClick={() => handleSendWaReport(totalRevenue, totalCash, totalTransfer, todayTxs, isToday, displayDateStr)}
                  disabled={isReporting || !!reportError || !reportData}
                >
                  <Banknote className="h-4 w-4" /> Kirim Sekarang
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {activeBranch !== 'ADMIN' && createPortal(
          <button
            onClick={() => {
              if (isInitialLoading) return;
              setCart([]);
              setIsCreatingTx(true);
              onSelectTransaction(null);
            }}
            disabled={isInitialLoading}
            className={`fixed bottom-6 right-4 md:bottom-8 md:right-8 h-14 w-14 md:h-16 md:w-16 bg-red-700 text-white rounded-full shadow-2xl flex items-center justify-center transition active:scale-95 z-40 cursor-pointer ${isInitialLoading ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-red-800'}`}
          >
            <div className="relative">
              {isInitialLoading ? (
                <RefreshCw className="h-6 w-6 md:h-7 md:w-7 text-white animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="h-6 w-6 md:h-7 md:w-7 text-white" />
                  <div className="absolute -top-1 -right-2 md:-top-1.5 md:-right-2.5 h-4 w-4 md:h-5 md:w-5 bg-white text-red-700 rounded-full flex items-center justify-center border-2 border-red-700 shadow-sm">
                     <Plus className="h-2.5 w-2.5 md:h-3 md:w-3 font-bold stroke-[3]" />
                  </div>
                </>
              )}
            </div>
          </button>,
          document.body
        )}


        {showPrinterSettings && createPortal(
          <div className="fixed inset-0 z-[100000] bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowPrinterSettings(false)}>
            <div className="bg-white rounded-[24px] shadow-2xl p-6 w-full max-w-sm border border-zinc-200 animate-in zoom-in-95 text-left" onClick={e => e.stopPropagation()}>
                <div className="h-12 w-12 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center mx-auto mb-4 border border-zinc-200 shrink-0">
                <Printer className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight text-center mb-1">Cetak Struk Thermal</h3>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed text-center font-medium">Buka jalur koneksi Bluetooth serial ESC/POS langsung ke printer thermal fisik Anda lewat browser.</p>
              
              <div className="space-y-3 mb-6">
                 {thermalPrinter ? (
                   <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
                      <div className="bg-emerald-100 text-emerald-600 rounded-full p-2"><CheckCircle2 className="h-5 w-5" /></div>
                      <div>
                        <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">Printer Terkoneksi</p>
                        <p className="text-[10px] text-emerald-700 font-bold">{thermalPrinter.name || 'Bluetooth Device'}</p>
                      </div>
                   </div>
                 ) : (
                   <div className="bg-zinc-50 border border-zinc-200/60 p-4 rounded-xl flex flex-col items-center gap-2 text-center">
                     <AlertCircle className="h-5 w-5 text-zinc-400" />
                     <p className="text-[10px] text-zinc-500 font-medium">Belum ada printer terkoneksi.<br/>Pastikan Bluetooth aktif.</p>
                   </div>
                 )}
              </div>

              <div className="flex flex-col gap-2">
                {!thermalPrinter ? (
                  <button 
                    onClick={handleConnectPrinter} 
                    className="w-full py-3.5 rounded-xl bg-red-700 hover:bg-red-800 text-white font-black text-xs uppercase tracking-wider cursor-pointer transition flex justify-center items-center gap-2"
                  >
                    <Bluetooth className="h-4 w-4" /> Hubungkan Printer Pribadi
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                       thermalPrinter?.gatt?.disconnect();
                       setThermalPrinter(null);
                    }} 
                    className="w-full py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-black text-xs uppercase tracking-wider cursor-pointer transition flex justify-center items-center gap-2"
                  >
                    Putuskan Koneksi Bluetooth
                  </button>
                )}
                <button 
                  onClick={() => setShowPrinterSettings(false)} 
                  className="w-full py-3.5 rounded-xl text-zinc-500 hover:text-zinc-700 font-extrabold text-[10px] uppercase tracking-wider cursor-pointer transition"
                >
                  Tutup Pengaturan
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      </>
    );
  }


}
