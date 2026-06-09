import React, { useState, useEffect } from 'react';
import { 
  Building, 
  UtensilsCrossed, 
  Tag, 
  Layers, 
  Plus,
  X,
  MapPin,
  Settings,
  RefreshCw,
  Briefcase,
  ChevronLeft,
  ArrowLeft,
  Search,
  Filter,
  Loader,
  ArrowUpCircle,
  ArrowDownCircle,
  Box,
  UserCog,
  Trash2,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { postBukuKasToGAS, postMasterDataToGAS, getMasterData, saveMasterData, syncMasterDataFromGAS, postUniversalDataToGAS, fetchUniversalDataFromGAS } from '../utils/db';
import { MasterData, Cabang, Kategori, Menu, Varian } from '../types';
import { getSessionCache } from '../utils/sessionCache';

interface SelectionContextType {
  selectedIds: string[];
  isSelectionMode: boolean;
  toggleSelection: (item: any) => void;
  handleEditItem: (item: any) => void;
  getItemId: (item: any) => string;
}

const SelectionContext = React.createContext<SelectionContextType | null>(null);

interface SelectableCardProps {
  item: any;
  children: React.ReactNode;
}

const SelectableCard: React.FC<SelectableCardProps> = ({ 
  item, 
  children 
}) => {
  const context = React.useContext(SelectionContext);
  if (!context) {
    throw new Error('SelectableCard must be used within SelectionContext.Provider');
  }

  const { selectedIds, isSelectionMode, toggleSelection, handleEditItem, getItemId } = context;
  const id = getItemId(item);
  const isSelected = selectedIds.includes(id);

  const timerRef = React.useRef<any>(null);
  const startPosRef = React.useRef({ x: 0, y: 0 });
  const isLongPressedRef = React.useRef(false);
  const isTouchDeviceRef = React.useRef(false);
  const hasMovedRef = React.useRef(false);

  // Clear timeout on unmount to prevent leaks
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const clearHoldTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // TOUCH EVENTS FOR MOBILE OR TABLETS
  const handleTouchStart = (e: React.TouchEvent) => {
    isTouchDeviceRef.current = true;
    isLongPressedRef.current = false;
    hasMovedRef.current = false;
    startPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

    clearHoldTimer();
    
    if (isSelectionMode) {
      // In selection mode, short tap instantly toggles selection. No timer.
      return;
    }

    timerRef.current = setTimeout(() => {
      isLongPressedRef.current = true;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch (err) {}
      }
      toggleSelection(item);
    }, 650); // 650ms click and hold latency
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - startPosRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - startPosRef.current.y);
    // Increased threshold to 18px to filter out minor touch jitters during scrolls
    if (dx > 18 || dy > 18) {
      hasMovedRef.current = true;
      clearHoldTimer();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    clearHoldTimer();
    if (e.changedTouches && e.changedTouches[0]) {
      const dx = Math.abs(e.changedTouches[0].clientX - startPosRef.current.x);
      const dy = Math.abs(e.changedTouches[0].clientY - startPosRef.current.y);
      if (dx > 18 || dy > 18) {
        hasMovedRef.current = true;
      }
    }
    if (!isLongPressedRef.current && !hasMovedRef.current) {
      // Prevent browser default touch behavior (double clicks etc)
      e.preventDefault();
      if (isSelectionMode) {
        toggleSelection(item);
      } else {
        handleEditItem(item);
      }
    }
  };

  const handleTouchCancel = () => {
    clearHoldTimer();
  };

  // MOUSE EVENTS FOR LAPTOPS AND DESKTOPS
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isTouchDeviceRef.current) return;
    if (e.button !== 0) return; // ignore right clicks
    
    isLongPressedRef.current = false;
    hasMovedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    clearHoldTimer();

    if (isSelectionMode) {
      return;
    }

    timerRef.current = setTimeout(() => {
      isLongPressedRef.current = true;
      toggleSelection(item);
    }, 650);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTouchDeviceRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 18 || dy > 18) {
      hasMovedRef.current = true;
      clearHoldTimer();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isTouchDeviceRef.current) return;
    clearHoldTimer();
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 18 || dy > 18) {
      hasMovedRef.current = true;
    }
    if (!isLongPressedRef.current && !hasMovedRef.current) {
      if (isSelectionMode) {
        toggleSelection(item);
      } else {
        handleEditItem(item);
      }
    }
  };

  const handleMouseLeave = () => {
    if (isTouchDeviceRef.current) return;
    clearHoldTimer();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const childrenArray = React.Children.toArray(children);
  const firstChild = childrenArray[0];
  const remainingChildren = childrenArray.slice(1);

  // Replace default avatar/icon with checkmark ONLY when selected
  const displayAvatar = isSelected ? (
    <div className="h-11 w-11 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 border-2 border-red-200 shadow-md animate-in zoom-in duration-200">
      <Check className="h-5.5 w-5.5 stroke-[3]" />
    </div>
  ) : firstChild;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      className={`selectable-card-class bg-white rounded-[24px] border shadow-sm p-4.5 flex items-center gap-3.5 transition duration-200 text-left active:scale-[0.98] cursor-pointer touch-manipulation select-none relative overflow-hidden ${isSelected ? 'border-red-500 bg-red-50/10 ring-2 ring-red-600 ring-offset-2' : 'border-zinc-200/90 hover:border-zinc-300'}`}
    >
      {isSelected && (
        <div className="absolute inset-0 bg-red-600/5 pointer-events-none" />
      )}
      <div className="relative z-10 flex items-center gap-3.5 w-full">
         {displayAvatar}
         {remainingChildren}
      </div>
    </div>
  );
};

interface AdminPanelProps {
  onRefreshPOSCatalog: () => void;
  onModuleActiveChange?: (isActive: boolean) => void;
}

type TabType = 'kas' | 'cabang' | 'kategori' | 'menu' | 'varian' | 'inventaris' | 'shift';

export default function AdminPanel({ onRefreshPOSCatalog, onModuleActiveChange }: AdminPanelProps) {
  const [activeModule, setActiveModule] = useState<TabType | null>(null);
  const [showModal, setShowModal] = useState<TabType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Selection mode state (WhatsApp style)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isSelectionMode = selectedIds.length > 0;
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  
  // Pull to Refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  
  // Data for rendering lists
  const [master, setMaster] = useState<MasterData | null>(null);
  const [bukuKasList, setBukuKasList] = useState<any[]>([]);
  const [inventarisData, setInventarisData] = useState<any[]>([]);
  const [shiftData, setShiftData] = useState<any[]>([]);
  const [isUniversalLoading, setIsUniversalLoading] = useState(false);

  // Back button interception for Android
  useEffect(() => {
    const handleAndroidBack = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (showModal !== null) {
        setShowModal(null);
        customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (selectedIds.length > 0) {
        setSelectedIds([]);
        customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (isSearchActive) {
        setIsSearchActive(false);
        setSearchQuery('');
        customEvt.detail.handled = true;
        customEvt.preventDefault();
      }
    };
    window.addEventListener('aura-backpress', handleAndroidBack);
    return () => window.removeEventListener('aura-backpress', handleAndroidBack);
  }, [showModal, selectedIds, isSearchActive]);
  
  // Basic Form States
  const [formData, setFormData] = useState<any>({ STATUS: 'Tersedia' });
  const [originalEditData, setOriginalEditData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  interface ConfirmationState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    type: 'save' | 'delete';
  }

  const [confirmState, setConfirmState] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
    type: 'save'
  });

  const showToastBanner = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatRupiahInput = (value: string | number) => {
    if (value === undefined || value === null) return '';
    const clean = String(value).replace(/\D/g, '');
    if (!clean) return '';
    return Number(clean).toLocaleString('id-ID');
  };

  const parseRupiahInput = (value: string) => {
    const clean = value.replace(/\D/g, '');
    return clean ? parseInt(clean, 10) : 0;
  };

  // RELATION RESOLUTION HELPERS FOR BEAUTIFUL NAMES INSTEAD OF CRYPTIC IDs
  const getCabangName = (cabangId: any) => {
    const defaultName = (master?.cabang && master.cabang.length > 0) ? master.cabang[0].NAMA_CABANG : '-';
    if (!cabangId && cabangId !== 0) return defaultName;
    if (!master?.cabang) return cabangId;
    const targetId = String(cabangId).trim().toLowerCase();
    const found = master.cabang.find((c: any) => 
      String(c.ID_CABANG).trim().toLowerCase() === targetId || 
      String(c.NAMA_CABANG).trim().toLowerCase() === targetId
    );
    return found ? found.NAMA_CABANG : (cabangId || defaultName);
  };

  const getKategoriName = (kategoriId: any) => {
    if (!master?.kategori || !kategoriId) return kategoriId || '-';
    const targetId = String(kategoriId).trim().toLowerCase();
    const found = master.kategori.find((k: any) => String(k.ID_KATEGORI).trim().toLowerCase() === targetId);
    return found ? found.NAMA_KATEGORI : kategoriId;
  };

  const getMenuName = (menuId: any) => {
    if (!master?.menu || !menuId) return menuId || '-';
    const targetId = String(menuId).trim().toLowerCase();
    const found = master.menu.find((m: any) => String(m.ID_MENU).trim().toLowerCase() === targetId);
    return found ? found.NAMA_MENU : menuId;
  };

  // ROBUST DATE FORMATTING HELPERS (e.g., "22/10/2026")
  const formatDateString = (dateInput: any) => {
    if (!dateInput) return '-';
    let d: Date;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      const str = String(dateInput).trim();
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length >= 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].split(' ')[0];
          return `${day}/${month}/${year}`;
        }
      }
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatToDatetimeLocal = (dateInput: any) => {
    if (!dateInput) return new Date().toISOString().substring(0, 16);
    let d: Date;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      const str = String(dateInput).trim();
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length >= 3) {
          const tPart = parts[2].split(' ');
          const year = parseInt(tPart[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[0], 10);
          let hour = 12, min = 0; // Default midday
          if (tPart[1]) {
            const tParts = tPart[1].split(':');
            hour = parseInt(tParts[0], 10) || 0;
            min = parseInt(tParts[1], 10) || 0;
          }
          d = new Date(year, month, day, hour, min);
        } else {
          d = new Date(dateInput);
        }
      } else {
        d = new Date(dateInput);
      }
    }
    if (isNaN(d.getTime())) {
      return new Date().toISOString().substring(0, 16);
    }
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localTime = new Date(d.getTime() - tzOffset);
    return localTime.toISOString().substring(0, 16);
  };

  // CLIENT-SIDE SEQUENCE AUTO-INCREMENT GENERATOR FOR PERFECT SYNCHRONICITY
  const generateClientSideId = (prefix: string, list: any[], idField: string) => {
    if (!list || list.length === 0) return prefix + '001';
    let maxNum = 0;
    list.forEach(item => {
      const id = String(item[idField] || '');
      const numPart = id.replace(prefix, '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    const paddedNum = String(nextNum).padStart(3, '0');
    return prefix + paddedNum;
  };

  const generateClientIdForModule = (module: TabType): string => {
    if (module === 'cabang') {
      return generateClientSideId('CAB-', master?.cabang || [], 'ID_CABANG');
    }
    if (module === 'kategori') {
      return generateClientSideId('KAT-', master?.kategori || [], 'ID_KATEGORI');
    }
    if (module === 'menu') {
      return generateClientSideId('MNU-', master?.menu || [], 'ID_MENU');
    }
    if (module === 'varian') {
      return generateClientSideId('VAR-', master?.varian || [], 'ID_VARIAN');
    }
    if (module === 'inventaris') {
      return generateClientSideId('INV-', inventarisData || [], 'ID_LOG');
    }
    if (module === 'shift') {
      return generateClientSideId('SFT-', shiftData || [], 'ID_IZIN');
    }
    return '';
  };

  const getIsEditing = () => {
    if (!formData) return false;
    if (showModal === 'kas') {
      return !!formData._id_or_original;
    }
    if (showModal === 'inventaris') return !!formData.ID_LOG;
    if (showModal === 'shift') return !!formData.ID_IZIN;
    if (showModal === 'cabang') return !!formData.ID_CABANG;
    if (showModal === 'kategori') return !!formData.ID_KATEGORI;
    if (showModal === 'menu') return !!formData.ID_MENU;
    if (showModal === 'varian') return !!formData.ID_VARIAN;
    return false;
  };

  const checkRequiredFields = (): boolean => {
    if (!formData) return false;
    
    if (showModal === 'kas') {
      const cab = formData.cabang || formData.CABANG;
      const jen = formData.jenis || formData.JENIS;
      const ket = formData.keterangan || formData.KETERANGAN;
      const nom = Number(formData.nominal || formData.DEBIT || formData.KREDIT || 0);
      return !!cab && !!jen && !!String(ket).trim() && nom > 0;
    }
    
    if (showModal === 'inventaris') {
      const cab = formData.CABANG || formData.cabang;
      const nm = formData.NAMA_BARANG;
      const jen = formData.JENIS;
      const jml = Number(formData.JUMLAH || 0);
      const pic = formData.PIC;
      return !!cab && !!String(nm).trim() && !!jen && jml > 0 && !!String(pic).trim();
    }
    
    if (showModal === 'shift') {
      const tgl = formData.tanggal || formData.TANGGAL;
      const cab = formData.CABANG || formData.cabang;
      const staff = formData.NAMA_STAFF;
      const alasan = formData.ALASAN;
      return !!tgl && !!cab && !!String(staff).trim() && !!String(alasan).trim();
    }
    
    if (showModal === 'cabang') {
      const nm = formData.NAMA_CABANG;
      const pwd = formData.PASSWORD;
      return !!String(nm).trim() && !!String(pwd).trim();
    }
    
    if (showModal === 'kategori') {
      const nm = formData.NAMA_KATEGORI;
      return !!String(nm).trim();
    }
    
    if (showModal === 'menu') {
      const kat = formData.ID_KATEGORI;
      const nm = formData.NAMA_MENU;
      return !!kat && !!String(nm).trim();
    }
    
    if (showModal === 'varian') {
      const kat = formData.ID_KATEGORI;
      const menu = formData.ID_MENU;
      const nm = formData.NAMA_VARIAN;
      const hrg = Number(formData.HARGA || 0);
      return !!kat && !!menu && !!String(nm).trim() && hrg > 0;
    }
    
    return false;
  };

  const checkHasChanges = (): boolean => {
    if (!getIsEditing()) return true;
    if (!originalEditData) return false;
    
    let keysToCheck: string[] = [];
    if (showModal === 'kas') {
      keysToCheck = ['tanggal', 'TANGGAL', 'cabang', 'CABANG', 'jenis', 'JENIS', 'keterangan', 'KETERANGAN', 'nominal', 'debit', 'DEBIT', 'kredit', 'KREDIT', 'tipe'];
    } else if (showModal === 'inventaris') {
      keysToCheck = ['TANGGAL', 'tanggal', 'CABANG', 'cabang', 'NAMA_BARANG', 'JENIS', 'JUMLAH', 'PIC', 'KETERANGAN'];
    } else if (showModal === 'shift') {
      keysToCheck = ['TANGGAL', 'tanggal', 'CABANG', 'cabang', 'NAMA_STAFF', 'ALASAN', 'PENGGANTI'];
    } else if (showModal === 'cabang') {
      keysToCheck = ['NAMA_CABANG', 'PASSWORD', 'LOKASI', 'KONTAK'];
    } else if (showModal === 'kategori') {
      keysToCheck = ['NAMA_KATEGORI'];
    } else if (showModal === 'menu') {
      keysToCheck = ['ID_KATEGORI', 'NAMA_MENU'];
    } else if (showModal === 'varian') {
      keysToCheck = ['ID_KATEGORI', 'ID_MENU', 'NAMA_VARIAN', 'HARGA', 'STATUS'];
    }
    
    for (const key of keysToCheck) {
      const originalValue = originalEditData[key];
      const currentValue = formData[key];
      
      const normOriginal = originalValue !== undefined && originalValue !== null ? String(originalValue).trim() : '';
      const normCurrent = currentValue !== undefined && currentValue !== null ? String(currentValue).trim() : '';
      
      if (normOriginal !== normCurrent) {
        return true; 
      }
    }
    return false;
  };

  const isSaveDisabled = !checkRequiredFields() || (getIsEditing() && !checkHasChanges());

  useEffect(() => {
    onModuleActiveChange?.(activeModule !== null);
  }, [activeModule, onModuleActiveChange]);

  useEffect(() => {
    const session = getSessionCache();
    if (!session.admin.loaded) {
      loadData();
    } else {
      // Use cached offline data state if available, do not fetch immediately
      const cached = localStorage.getItem('cached_master_data');
      if (cached) {
        try {
          const m = JSON.parse(cached);
          setMaster(m);
        } catch (e) {}
      }
      const cachedKas = localStorage.getItem('cached_buku_kas_data_ALL');
      if (cachedKas) {
        try {
          const parsed = JSON.parse(cachedKas);
          if (parsed && Array.isArray(parsed.transaksi)) {
            const sorted = [...parsed.transaksi].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
            setBukuKasList(sorted);
          }
        } catch (e) {}
      }
    }
  }, []);

  const loadData = async () => {
    const session = getSessionCache();
    session.admin.loaded = true;
    const data = await getMasterData();
    if (data) setMaster(data);
    
    // Load local cached Buku Kas entries
    try {
      const cachedKas = localStorage.getItem('cached_buku_kas_data_ALL');
      if (cachedKas) {
        const parsed = JSON.parse(cachedKas);
        if (parsed && Array.isArray(parsed.transaksi)) {
          const sorted = [...parsed.transaksi].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
          setBukuKasList(sorted);
        }
      }
    } catch (e) {
      console.log('Error reading cached buku kas:', e);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only capture pull at the top of scroll view
    let isAtTop = window.scrollY <= 2 || document.documentElement.scrollTop <= 2;
    if (activeModule) {
      const scrollElement = document.getElementById('module-scroll-container');
      isAtTop = scrollElement ? scrollElement.scrollTop <= 2 : true;
    }

    if (isAtTop) {
      setStartY(e.touches[0].clientY);
    } else {
      setStartY(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY <= 0) return;
    const y = e.touches[0].clientY;
    const diff = y - startY;
    
    if (diff > 0) {
      const damping = 0.4;
      const distance = diff * damping;
      setPullDistance(Math.min(distance, 130));
      
      if (distance > 15 && e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (startY <= 0) return;
    const thresh = 60;
    if (pullDistance >= thresh && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(60);
      
      // Connection failsafe: reset loading after 10s if the GAS call hangs
      const selfDestructTimeout = setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
        setStartY(0);
      }, 10000);

      try {
        await syncMasterDataFromGAS();
        
        if (activeModule === 'kas') {
          const data = await fetchUniversalDataFromGAS('Transaksi');
          if (data && data.length > 0) {
            const sorted = [...data].sort((a, b) => {
              const parseToDate = (cellValue: any): Date => {
                if (!cellValue) return new Date(0);
                if (cellValue instanceof Date) return cellValue;
                let str = String(cellValue).trim().substring(0, 10);
                if (str.includes('/')) {
                  const p = str.split('/');
                  return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
                } else if (str.includes('-')) {
                  const p = str.split('-');
                  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
                }
                return new Date(cellValue);
              };
              return parseToDate(b.tanggal || b.TANGGAL || (Array.isArray(b) ? b[0] : '')).getTime() - parseToDate(a.tanggal || a.TANGGAL || (Array.isArray(a) ? a[0] : '')).getTime();
            });
            setBukuKasList(sorted);
            localStorage.setItem('cached_buku_kas_data_ALL', JSON.stringify({
              status: 'success',
              transaksi: sorted,
              pemasukan: sorted.reduce((sum: number, tx: any) => sum + Number(tx.debit || tx.DEBIT || (Array.isArray(tx) ? tx[4] : 0) || 0), 0),
              pengeluaran: sorted.reduce((sum: number, tx: any) => sum + Number(tx.kredit || tx.KREDIT || (Array.isArray(tx) ? tx[5] : 0) || 0), 0),
              saldoBersih: 0
            }));
          }
        } else if (activeModule === 'inventaris') {
          const data = await fetchUniversalDataFromGAS('Data_Inventaris');
          setInventarisData(data || []);
        } else if (activeModule === 'shift') {
          const data = await fetchUniversalDataFromGAS('Data_Izin_Shift');
          setShiftData(data || []);
        }
        
        await loadData();
        onRefreshPOSCatalog();
      } catch (err: any) {
        alert("Gagal sinkron: " + err.message);
      } finally {
        clearTimeout(selfDestructTimeout);
        setIsRefreshing(false);
        setPullDistance(0);
        setStartY(0);
      }
    } else {
      setPullDistance(0);
      setStartY(0);
    }
  };

  const getItemId = (item: any): string => {
    if (!item) return '';
    if (activeModule === 'kas') {
      const tgl = item.tanggal || item.TANGGAL || '';
      const ket = item.keterangan || item.KETERANGAN || 'ops';
      const deb = item.debit || item.DEBIT || '0';
      const kre = item.kredit || item.KREDIT || '0';
      return `kas_${tgl}_${ket}_${deb}_${kre}`.replace(/\s+/g, '_');
    }
    if (activeModule === 'cabang') {
      return String(item.ID_CABANG || item.id_cabang || item.idCabang || '').trim();
    }
    if (activeModule === 'kategori') {
      return String(item.ID_KATEGORI || item.id_kategori || item.idKategori || item.NAMA_KATEGORI || '').trim();
    }
    if (activeModule === 'menu') {
      return String(item.ID_MENU || item.id_menu || item.idMenu || item.NAMA_MENU || '').trim();
    }
    if (activeModule === 'varian') {
      return String(item.ID_VARIAN || item.id_varian || item.idVarian || item.NAMA_VARIAN || '').trim();
    }
    if (activeModule === 'inventaris') {
      return String(item.ID_LOG || item.id_log || item.idLog || item.NAMA_BARANG || '').trim();
    }
    if (activeModule === 'shift') {
      return String(item.ID_IZIN || item.id_izin || item.idIzin || item.NAMA_STAFF || '').trim();
    }
    return '';
  };

  const toggleSelection = (item: any) => {
    const id = getItemId(item);
    if (!id) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;

    setConfirmState({
      isOpen: true,
      title: 'Hapus Data',
      message: `Apakah Anda yakin ingin menghapus ${selectedIds.length} data yang dipilih ini? Tindakan ini tidak dapat dibatalkan.`,
      type: 'delete',
      onCancel: () => {},
      onConfirm: () => proceedDelete()
    });
  };

  const proceedDelete = async () => {
    setIsUniversalLoading(true);
    try {
      let sheetName = '';
      let idCol = '';
      
      if (activeModule === 'inventaris') {
        sheetName = 'Data_Inventaris';
        idCol = 'ID_LOG';
      } else if (activeModule === 'shift') {
        sheetName = 'Data_Izin_Shift';
        idCol = 'ID_IZIN';
      } else if (activeModule === 'kas') {
        sheetName = 'Transaksi';
        idCol = 'KETERANGAN';
      } else if (activeModule === 'cabang') {
        sheetName = 'Master_Cabang';
        idCol = 'ID_CABANG';
      } else if (activeModule === 'kategori') {
        sheetName = 'Master_Kategori';
        idCol = 'ID_KATEGORI';
      } else if (activeModule === 'menu') {
        sheetName = 'Master_Menu';
        idCol = 'ID_MENU';
      } else if (activeModule === 'varian') {
        sheetName = 'Master_Varian';
        idCol = 'ID_VARIAN';
      }

      if (sheetName && idCol) {
        await postUniversalDataToGAS('DELETE_DATA', sheetName, idCol, null, { idValues: selectedIds });
      }

      // Optimistic UI updates
      if (activeModule === 'kas') {
        setBukuKasList(prev => prev.filter(item => !selectedIds.includes(getItemId(item))));
        localStorage.removeItem('cached_buku_kas_data_ALL');
        localStorage.removeItem('cached_buku_kas_data_All');
        // Clear all laporan caches to trigger fresh load
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('cached_laporan_data_')) {
            localStorage.removeItem(key);
          }
        });
      } else if (activeModule === 'inventaris') {
        setInventarisData(prev => prev.filter((item: any) => !selectedIds.includes(item.ID_LOG)));
      } else if (activeModule === 'shift') {
        setShiftData(prev => prev.filter((item: any) => !selectedIds.includes(item.ID_IZIN)));
      } else if (master) {
        const newData = { ...master };
        if (activeModule === 'cabang') {
          newData.cabang = newData.cabang.filter((c: any) => !selectedIds.includes(c.ID_CABANG));
        } else if (activeModule === 'kategori') {
          newData.kategori = newData.kategori.filter((c: any) => !selectedIds.includes(c.ID_KATEGORI) && !selectedIds.includes(c.NAMA_KATEGORI));
        } else if (activeModule === 'menu') {
          newData.menu = newData.menu.filter((m: any) => !selectedIds.includes(m.ID_MENU) && !selectedIds.includes(m.NAMA_MENU));
        } else if (activeModule === 'varian') {
          newData.varian = newData.varian.filter((v: any) => !selectedIds.includes(v.ID_VARIAN) && !selectedIds.includes(v.NAMA_VARIAN));
        }
        await saveMasterData(newData);
        setMaster(newData);
        onRefreshPOSCatalog();
      }

      setSelectedIds([]);
      showToastBanner('Data berhasil dihapus dari cloud dan lokal');
    } catch (e: any) {
      alert('Gagal menghapus data: ' + e.message);
    }
    setIsUniversalLoading(false);
  };

  const handleEditItem = (item: any) => {
    // Open edit bottomsheet directly for selected item with formatted dates
    const formattedItem = { ...item };
    if (formattedItem.tanggal) {
      formattedItem.tanggal = formatToDatetimeLocal(formattedItem.tanggal);
    }
    if (formattedItem.TANGGAL) {
      formattedItem.TANGGAL = formatToDatetimeLocal(formattedItem.TANGGAL);
    }
    
    // Auto resolve key variations for edited cash entries to avoid empty dropdown states
    if (activeModule === 'kas') {
      const parsed = parseKasItem(item);
      formattedItem.tipe = parsed.isDebit ? 'Masuk' : 'Keluar';
      formattedItem.jenis = parsed.jenis;
      formattedItem.JENIS = parsed.jenis;
      formattedItem.nominal = parsed.nominal;
    }

    // Track original properties for cascade update checks
    formattedItem._id_or_original = formattedItem.id || getItemId(item);
    setOriginalEditData({ ...formattedItem });
    setFormData(formattedItem);
    setShowModal(activeModule);
  };

  const openModule = async (id: TabType) => {
    window.scrollTo({ top: 0 });
    setSearchQuery('');
    setIsSearchActive(false);
    setSelectedIds([]); // Clear selection when switching modules
    setActiveModule(id);
    
    try {
      if (id === 'inventaris' && inventarisData.length === 0) {
        setIsUniversalLoading(true);
        const data = await fetchUniversalDataFromGAS('Data_Inventaris');
        setInventarisData(data || []);
      } else if (id === 'shift' && shiftData.length === 0) {
        setIsUniversalLoading(true);
        const data = await fetchUniversalDataFromGAS('Data_Izin_Shift');
        setShiftData(data || []);
      } else if (id === 'kas') {
        setIsUniversalLoading(true);
        const data = await fetchUniversalDataFromGAS('Transaksi');
        if (data && data.length > 0) {
          const sorted = [...data].sort((a, b) => {
            const parseToDate = (cellValue: any): Date => {
              if (!cellValue) return new Date(0);
              if (cellValue instanceof Date) return cellValue;
              let str = String(cellValue).trim().substring(0, 10);
              if (str.includes('/')) {
                const p = str.split('/');
                return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
              } else if (str.includes('-')) {
                const p = str.split('-');
                return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
              }
              return new Date(cellValue);
            };
            return parseToDate(b.tanggal || b.TANGGAL || (Array.isArray(b) ? b[0] : '')).getTime() - parseToDate(a.tanggal || a.TANGGAL || (Array.isArray(a) ? a[0] : '')).getTime();
          });
          setBukuKasList(sorted);
          localStorage.setItem('cached_buku_kas_data_ALL', JSON.stringify({
            status: 'success',
            transaksi: sorted,
            pemasukan: sorted.reduce((sum: number, tx: any) => sum + Number(tx.debit || tx.DEBIT || (Array.isArray(tx) ? tx[4] : 0) || 0), 0),
            pengeluaran: sorted.reduce((sum: number, tx: any) => sum + Number(tx.kredit || tx.KREDIT || (Array.isArray(tx) ? tx[5] : 0) || 0), 0),
            saldoBersih: 0
          }));
        }
      }
    } catch (e) {
      console.warn("Error fetching data for module:", id, e);
    } finally {
      setIsUniversalLoading(false);
    }
  };

  const handleOpenModal = (tab: TabType) => {
    let initialData: any = {};
    const nowLocal = formatToDatetimeLocal(new Date());
    setShowPassword(false);
    
    const defaultCabangId = (master?.cabang && master.cabang.length > 0) ? master.cabang[0].ID_CABANG : '';
    const defaultKategoriId = (master?.kategori && master.kategori.length > 0) ? master.kategori[0].ID_KATEGORI : '';
    const defaultMenuId = (master?.menu && master.menu.length > 0) ? master.menu[0].ID_MENU : '';
    
    if (tab === 'kas') {
      initialData = { tipe: 'Masuk', tanggal: nowLocal, cabang: defaultCabangId, CABANG: defaultCabangId, jenis: 'Pendapatan Usaha', JENIS: 'Pendapatan Usaha', keterangan: '', nominal: 0 };
    } else if (tab === 'inventaris') {
      initialData = { TANGGAL: nowLocal, CABANG: defaultCabangId, cabang: defaultCabangId, NAMA_BARANG: '', JENIS: 'MASUK', JUMLAH: '', PIC: '', KETERANGAN: '' };
    } else if (tab === 'shift') {
      initialData = { TANGGAL: nowLocal, CABANG: defaultCabangId, cabang: defaultCabangId, NAMA_STAFF: '', ALASAN: '', PENGGANTI: '' };
    } else if (tab === 'menu') {
      initialData = { ID_KATEGORI: defaultKategoriId };
    } else if (tab === 'varian') {
      initialData = { STATUS: 'Tersedia', ID_KATEGORI: defaultKategoriId, ID_MENU: defaultMenuId };
    } else {
      initialData = {};
    }
    setOriginalEditData(null);
    setFormData(initialData);
    setShowModal(tab);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = getIsEditing();
    const moduleLabel = showModal === 'kas' ? 'Buku Kas' : modules.find(m => m.id === showModal)?.label || showModal;

    setConfirmState({
      isOpen: true,
      title: isEditing ? 'Simpan Perubahan Data' : 'Simpan Data Baru',
      message: isEditing 
        ? `Apakah Anda yakin ingin memperbarui data ${moduleLabel} ini dengan perubahan terbaru?` 
        : `Apakah Anda yakin ingin menyimpan data ${moduleLabel} baru ini ke dalam catatan toko?`,
      type: 'save',
      onCancel: () => {},
      onConfirm: () => proceedSubmit()
    });
  };

  const proceedSubmit = async () => {
    setIsSubmitting(true);
    try {
      const isEditing = getIsEditing();
      let finalFormData = { ...formData };

      // AUTOMATIC NO-COLLISION SEQUENCE GENERATOR IF CREATING NEW ENTRIES
      if (!isEditing) {
        if (showModal === 'cabang') {
          finalFormData.ID_CABANG = generateClientIdForModule('cabang');
        } else if (showModal === 'kategori') {
          finalFormData.ID_KATEGORI = generateClientIdForModule('kategori');
        } else if (showModal === 'menu') {
          finalFormData.ID_MENU = generateClientIdForModule('menu');
        } else if (showModal === 'varian') {
          finalFormData.ID_VARIAN = generateClientIdForModule('varian');
        } else if (showModal === 'inventaris') {
          finalFormData.ID_LOG = generateClientIdForModule('inventaris');
        } else if (showModal === 'shift') {
          finalFormData.ID_IZIN = generateClientIdForModule('shift');
        }
      }

      // Enforce default relation selections for master dropdown fields to avoid any vacant selections
      if (showModal === 'menu') {
        const defaultKatId = (master?.kategori && master.kategori.length > 0) ? master.kategori[0].ID_KATEGORI : '';
        finalFormData.ID_KATEGORI = finalFormData.ID_KATEGORI || defaultKatId;
      } else if (showModal === 'varian') {
        const defaultKatId = (master?.kategori && master.kategori.length > 0) ? master.kategori[0].ID_KATEGORI : '';
        const defaultMenuId = (master?.menu && master.menu.length > 0) ? master.menu[0].ID_MENU : '';
        finalFormData.ID_KATEGORI = finalFormData.ID_KATEGORI || defaultKatId;
        finalFormData.ID_MENU = finalFormData.ID_MENU || defaultMenuId;
      }

      const moduleNameLabel = showModal === 'kas' ? 'Buku Kas' : modules.find(m => m.id === showModal)?.label || showModal;

      if (showModal === 'kas') {
        const defaultCabId = (master?.cabang && master.cabang.length > 0) ? master.cabang[0].ID_CABANG : '';
        const rawJenis = finalFormData.jenis || finalFormData.JENIS || 'Pendapatan Usaha';
        
        // Strip any parentheses content and trim to get clean exact string
        const cleanJenisStr = (val: string) => {
          if (!val) return 'Pendapatan Usaha';
          let clean = val.replace(/\s*\(.*\)/g, '').trim();
          const lower = clean.toLowerCase();
          if (lower.includes('pendapatan')) return 'Pendapatan Usaha';
          if (lower.includes('produksi')) return 'Biaya Produksi';
          if (lower.includes('beban')) return 'Beban Usaha';
          if (lower.includes('privee')) return 'Privee';
          if (lower.includes('utang')) return 'Utang Usaha';
          if (lower.includes('piutang')) return 'Piutang Usaha';
          return clean;
        };

        const cleanJenis = cleanJenisStr(rawJenis);
        
        let derivedTipe = 'Masuk';
        if (cleanJenis === 'Biaya Produksi' || cleanJenis === 'Beban Usaha' || cleanJenis === 'Privee' || cleanJenis === 'Piutang Usaha') {
          derivedTipe = 'Keluar';
        }

        const payload = {
          TANGGAL: finalFormData.tanggal || finalFormData.TANGGAL || new Date().toISOString(),
          CABANG: finalFormData.cabang || finalFormData.CABANG || defaultCabId,
          JENIS: cleanJenis,
          KETERANGAN: finalFormData.keterangan || finalFormData.KETERANGAN || '',
          DEBIT: derivedTipe === 'Masuk' ? Number(finalFormData.nominal || 0) : 0,
          KREDIT: derivedTipe === 'Keluar' ? Number(finalFormData.nominal || 0) : 0
        };

        if (isEditing && finalFormData._id_or_original) {
          // Edit mode: delete the old one first by description or unique composite reference
          const oldKeterangan = finalFormData._id_or_original.includes('kas_')
            ? finalFormData._id_or_original.split('_')[2]
            : finalFormData.KETERANGAN || finalFormData.keterangan;
          
          if (oldKeterangan) {
            await postUniversalDataToGAS('DELETE_DATA', 'Transaksi', 'KETERANGAN', null, { idValues: [oldKeterangan] });
          }
        }

        await postBukuKasToGAS(payload);
        
        // Optimistic UI local store updates
        const newEntry = {
          tanggal: payload.TANGGAL,
          cabang: payload.CABANG,
          jenis: payload.JENIS,
          keterangan: payload.KETERANGAN,
          debit: payload.DEBIT,
          kredit: payload.KREDIT,
          nominal: payload.DEBIT || payload.KREDIT
        };

        let newList = [];
        if (isEditing) {
          newList = bukuKasList.map(item => getItemId(item) === finalFormData._id_or_original ? newEntry : item);
        } else {
          newList = [newEntry, ...bukuKasList];
        }
        setBukuKasList(newList);
        
        // Sync local cache matching report structure
        try {
          // Clear all laporan caches to trigger fresh load
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cached_laporan_data_')) {
              localStorage.removeItem(key);
            }
          });

          const cached = localStorage.getItem('cached_buku_kas_data_ALL');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (isEditing) {
              parsed.transaksi = parsed.transaksi.map((item: any) => {
                const itemCompositeId = `kas_${item.tanggal || item.TANGGAL || ''}_${item.keterangan || item.KETERANGAN || 'ops'}_${item.debit || item.DEBIT || '0'}_${item.kredit || item.KREDIT || '0'}`.replace(/\s+/g, '_');
                return itemCompositeId === finalFormData._id_or_original ? newEntry : item;
              });
              // Recalculate totals
              parsed.pemasukan = parsed.transaksi.reduce((sum: number, tx: any) => sum + (tx.debit || tx.DEBIT || 0), 0);
              parsed.pengeluaran = parsed.transaksi.reduce((sum: number, tx: any) => sum + (tx.kredit || tx.KREDIT || 0), 0);
              parsed.saldoBersih = parsed.pemasukan - parsed.pengeluaran;
            } else {
              parsed.transaksi = [newEntry, ...(parsed.transaksi || [])];
              parsed.pemasukan += payload.DEBIT;
              parsed.pengeluaran += payload.KREDIT;
              parsed.saldoBersih += (payload.DEBIT - payload.KREDIT);
            }
            localStorage.setItem('cached_buku_kas_data_ALL', JSON.stringify(parsed));
          }
        } catch (_) {}

      } else if (showModal === 'inventaris') {
        const idCol = "ID_LOG";
        const idVal = finalFormData[idCol];
        const defaultCabId = (master?.cabang && master.cabang.length > 0) ? master.cabang[0].ID_CABANG : '';
        const finalData = { 
          ...finalFormData, 
          CABANG: finalFormData.CABANG || finalFormData.cabang || defaultCabId,
          cabang: finalFormData.cabang || finalFormData.CABANG || defaultCabId,
          TANGGAL: finalFormData.TANGGAL || finalFormData.tanggal || new Date().toISOString() 
        };
        
        if (isEditing) {
           await postUniversalDataToGAS("UPDATE_DATA", "Data_Inventaris", idCol, idVal, finalData);
           setInventarisData(inventarisData.map((x:any) => x[idCol] === idVal ? finalData : x));
        } else {
           await postUniversalDataToGAS("INSERT_DATA", "Data_Inventaris", idCol, idVal, finalData);
           setInventarisData([finalData, ...inventarisData]);
        }
      } else if (showModal === 'shift') {
        const idCol = "ID_IZIN";
        const idVal = finalFormData[idCol];
        const defaultCabId = (master?.cabang && master.cabang.length > 0) ? master.cabang[0].ID_CABANG : '';
        const finalData = { 
          ...finalFormData, 
          CABANG: finalFormData.CABANG || finalFormData.cabang || defaultCabId,
          cabang: finalFormData.cabang || finalFormData.CABANG || defaultCabId,
          TANGGAL: finalFormData.TANGGAL || finalFormData.tanggal || new Date().toISOString() 
        };
        
        if (isEditing) {
           await postUniversalDataToGAS("UPDATE_DATA", "Data_Izin_Shift", idCol, idVal, finalData);
           setShiftData(shiftData.map((x:any) => x[idCol] === idVal ? finalData : x));
        } else {
           await postUniversalDataToGAS("INSERT_DATA", "Data_Izin_Shift", idCol, idVal, finalData);
           setShiftData([finalData, ...shiftData]);
        }
      } else if (showModal) {
        // Master Data Form
        await postMasterDataToGAS(showModal, finalFormData);
        
        // Optimistic UI Update for local IndexedDB (Upsert)
        if (master) {
          const newData = { ...master };
          if (showModal === 'cabang') {
            const idx = newData.cabang.findIndex((c:any) => c.ID_CABANG === finalFormData.ID_CABANG);
            if (idx >= 0) newData.cabang[idx] = finalFormData as Cabang; else newData.cabang.push(finalFormData as Cabang);
          }
          if (showModal === 'kategori') {
            const idx = newData.kategori.findIndex((c:any) => c.ID_KATEGORI === finalFormData.ID_KATEGORI);
            if (idx >= 0) newData.kategori[idx] = finalFormData as Kategori; else newData.kategori.push(finalFormData as Kategori);
          }
          if (showModal === 'menu') {
            const idx = newData.menu.findIndex((m:any) => m.ID_MENU === finalFormData.ID_MENU);
            if (idx >= 0) newData.menu[idx] = finalFormData as Menu; else newData.menu.push(finalFormData as Menu);
          }
          if (showModal === 'varian') {
            const idx = newData.varian.findIndex((v:any) => v.ID_VARIAN === finalFormData.ID_VARIAN);
            if (idx >= 0) newData.varian[idx] = finalFormData as Varian; else newData.varian.push(finalFormData as Varian);
          }
          await saveMasterData(newData);
          setMaster(newData);
          onRefreshPOSCatalog();
        }
      }

      showToastBanner(`Data ${moduleNameLabel} Berhasil ${isEditing ? 'Diperbarui' : 'Ditambahkan'}`);
      setShowModal(null);
      setFormData({});
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modules: {
    id: TabType; 
    label: string; 
    icon: React.ReactNode; 
    desc: string;
    colorClass: string; 
    iconColorClass: string; 
    borderColorClass: string;
  }[] = [
    { 
      id: 'kas', 
      label: 'Buku Arus Kas', 
      icon: <Briefcase className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Buku operasional debit & kredit kas manual',
      colorClass: 'bg-red-50 border border-red-100/80 hover:bg-red-100 text-red-950',
      iconColorClass: 'text-red-700 bg-red-100 group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white',
      borderColorClass: ''
    },
    { 
      id: 'cabang', 
      label: 'Cabang', 
      icon: <Building className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Pengaturan data outlet / cabang Aura Food',
      colorClass: 'bg-amber-50 border border-amber-100/80 hover:bg-amber-100 text-amber-950',
      iconColorClass: 'text-amber-700 bg-amber-100 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white',
      borderColorClass: ''
    },
    { 
      id: 'kategori', 
      label: 'Kategori', 
      icon: <Tag className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Kategori hidangan utama, spesial & minuman',
      colorClass: 'bg-emerald-50 border border-emerald-100/80 hover:bg-emerald-100 text-emerald-950',
      iconColorClass: 'text-emerald-700 bg-emerald-100 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white',
      borderColorClass: ''
    },
    { 
      id: 'menu', 
      label: 'Menu', 
      icon: <UtensilsCrossed className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Kelola hidangan makanan & minuman',
      colorClass: 'bg-indigo-50 border border-indigo-100/80 hover:bg-indigo-100 text-indigo-950',
      iconColorClass: 'text-indigo-700 bg-indigo-100 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white',
      borderColorClass: ''
    },
    { 
      id: 'varian', 
      label: 'Varian', 
      icon: <Layers className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Varian rasa, level pedas, porsi & status stok',
      colorClass: 'bg-orange-50 border border-orange-100/80 hover:bg-orange-100 text-orange-950',
      iconColorClass: 'text-orange-700 bg-orange-100 group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white',
      borderColorClass: ''
    },
    { 
      id: 'inventaris', 
      label: 'Stok Logistik', 
      icon: <Box className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Data barang masuk/keluar & peralatan',
      colorClass: 'bg-sky-50 border border-sky-100/80 hover:bg-sky-100 text-sky-950',
      iconColorClass: 'text-sky-700 bg-sky-100 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white',
      borderColorClass: ''
    },
    { 
      id: 'shift', 
      label: 'Izin Shift', 
      icon: <UserCog className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Riwayat absensi dan izin pergantian shift',
      colorClass: 'bg-fuchsia-50 border border-fuchsia-100/80 hover:bg-fuchsia-100 text-fuchsia-950',
      iconColorClass: 'text-fuchsia-700 bg-fuchsia-100 group-hover:scale-110 group-hover:bg-fuchsia-500 group-hover:text-white',
      borderColorClass: ''
    },
  ];

  // Helper to parse any cash transaction format cleanly
  const parseKasItem = (rawK: any) => {
    const tanggal = rawK.tanggal || rawK.TANGGAL || rawK.Tanggal || (Array.isArray(rawK) ? rawK[0] : '');
    
    // Find a key matching 'jenis', 'JENIS', 'Jenis Transaksi', 'Kategori', etc. case insensitively
    let jenis = '';
    let cabang = '';
    if (rawK && typeof rawK === 'object' && !Array.isArray(rawK)) {
      const keys = Object.keys(rawK);
      const foundKey = keys.find(k => {
        const lower = k.toLowerCase().replace(/[\s_-]/g, '').trim();
        return lower === 'jenis' || lower === 'jenistransaksi' || lower === 'kategori' || lower === 'jenis_transaksi';
      });
      if (foundKey) {
        jenis = String(rawK[foundKey]).trim();
      }

      const cabangKey = keys.find(k => {
        const lower = k.toLowerCase().replace(/[\s_-]/g, '').trim();
        return lower === 'cabang' || lower === 'idcabang' || lower === 'branch';
      });
      if (cabangKey) {
        cabang = String(rawK[cabangKey]).trim();
      }
    }
    
    if (!jenis) {
      jenis = rawK.jenis || rawK.JENIS || rawK.Kategori || (Array.isArray(rawK) ? rawK[1] : '') || 'Pemasukan/Pengeluaran';
    }

    if (!cabang) {
      cabang = rawK.cabang || rawK.CABANG || rawK.ID_CABANG || rawK.Cabang || (Array.isArray(rawK) ? rawK[2] : '');
    }

    const keterangan = rawK.keterangan || rawK.KETERANGAN || rawK.Keterangan || (Array.isArray(rawK) ? rawK[3] : '') || 'Transaksi Kas';
    const debit = Number(rawK.debit || rawK.DEBIT || (Array.isArray(rawK) ? rawK[4] : 0) || 0);
    const kredit = Number(rawK.kredit || rawK.KREDIT || (Array.isArray(rawK) ? rawK[5] : 0) || 0);
    const nominal = Number(rawK.nominal || rawK.debit || rawK.DEBIT || (Array.isArray(rawK) ? rawK[4] : 0) || rawK.kredit || rawK.KREDIT || (Array.isArray(rawK) ? rawK[5] : 0) || 0);
    const tipe = rawK.tipe || '';
    const isDebit = debit > 0 || String(tipe).toLowerCase() === 'masuk' || String(jenis).toLowerCase().includes('pemasukan') || String(jenis).toLowerCase().includes('usaha');
    
    return {
      tanggal,
      jenis,
      cabang,
      keterangan,
      debit,
      kredit,
      nominal,
      isDebit,
      tipe,
      _original: rawK
    };
  };

  // Filtering states mapping
  const filteredBukuKas = bukuKasList.map(parseKasItem).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.jenis || '').toLowerCase().includes(query) ||
      (item.keterangan || '').toLowerCase().includes(query) ||
      (item.cabang || '').toLowerCase().includes(query) ||
      String(item.nominal || item.debit || item.kredit || '').includes(query)
    );
  });

  const filteredCabang = (master?.cabang || []).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_CABANG || '').toLowerCase().includes(query) ||
      (item.LOKASI || '').toLowerCase().includes(query) ||
      (item.ID_CABANG || '').toLowerCase().includes(query)
    );
  });

  const filteredKategori = (master?.kategori || []).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_KATEGORI || '').toLowerCase().includes(query) ||
      (item.ID_KATEGORI || '').toLowerCase().includes(query)
    );
  });

  const filteredMenu = (master?.menu || []).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_MENU || '').toLowerCase().includes(query) ||
      (item.ID_MENU || '').toLowerCase().includes(query) ||
      (item.ID_KATEGORI || '').toLowerCase().includes(query)
    );
  });

  const filteredVarian = (master?.varian || []).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_VARIAN || '').toLowerCase().includes(query) ||
      (item.ID_VARIAN || '').toLowerCase().includes(query) ||
      (item.ID_MENU || '').toLowerCase().includes(query) ||
      (item.STATUS || '').toLowerCase().includes(query)
    );
  });

  const filteredInventaris = (Array.isArray(inventarisData) ? inventarisData : []).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_BARANG || '').toLowerCase().includes(query) ||
      (item.KETERANGAN || '').toLowerCase().includes(query) ||
      (item.PIC || '').toLowerCase().includes(query)
    );
  });

  const filteredShift = (Array.isArray(shiftData) ? shiftData : []).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_STAFF || '').toLowerCase().includes(query) ||
      (item.ALASAN || '').toLowerCase().includes(query) ||
      (item.PENGGANTI || '').toLowerCase().includes(query)
    );
  });

  let filteredListLength = 0;
  if (activeModule === 'kas') filteredListLength = filteredBukuKas.length;
  else if (activeModule === 'cabang') filteredListLength = filteredCabang.length;
  else if (activeModule === 'kategori') filteredListLength = filteredKategori.length;
  else if (activeModule === 'menu') filteredListLength = filteredMenu.length;
  else if (activeModule === 'varian') filteredListLength = filteredVarian.length;
  else if (activeModule === 'inventaris') filteredListLength = filteredInventaris.length;
  else if (activeModule === 'shift') filteredListLength = filteredShift.length;

  return (
    <SelectionContext.Provider value={{ selectedIds, isSelectionMode, toggleSelection, handleEditItem, getItemId }}>
      <div 
        className="space-y-6 text-left pb-24 relative max-w-full overflow-x-hidden"
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
      >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div className="fixed top-20 left-0 right-0 flex justify-center items-center h-12 z-[1000] pointer-events-none animate-in fade-in">
          <RefreshCw className="h-6 w-6 text-red-850 animate-spin" style={{ opacity: pullDistance / 100 }} />
        </div>
      )}

      <div style={{ marginTop: `${pullDistance / 2}px`, transition: pullDistance === 0 ? 'margin-top 0.2s ease-out' : 'none' }} className="space-y-6">
        {!activeModule ? (
          <div className="space-y-6 pt-4 px-1">
            {/* Elegant Simpler Header Card matching Reports Style without boring technical jargon */}
            <div className="bg-white p-4 sm:p-5 rounded-[24px] border border-zinc-200/80 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 overflow-hidden rounded-[24px] pointer-events-none">
                <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 h-40 w-40 bg-rose-200/20 rounded-full blur-3xl"></div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm sm:text-base font-black text-zinc-900 uppercase tracking-widest leading-none">
                      Manajemen Data Pokok
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1.5 font-medium leading-relaxed max-w-xl">
                      Kelola informasi dasar toko mulai dari data cabang, kategori menu, daftar hidangan, varian harga, hingga pencatatan kas harian.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Beautiful Colorful Gradient Box Panel Grid (Consistent, Stunning, High-Contrast) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 px-1 pb-4 animate-in fade-in duration-300">
              {modules.map(m => (
                <button
                  key={m.id}
                  onClick={() => openModule(m.id)}
                  className={`border border-zinc-200/80 rounded-[28px] p-5 text-left hover:border-zinc-300 hover:shadow-md hover:-translate-y-1 transition-all group flex flex-col justify-between items-start w-full aspect-square relative overflow-hidden cursor-pointer ${m.colorClass} ${m.borderColorClass}`}
                >
                  <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all shadow-sm ${m.iconColorClass}`}>
                    {m.icon}
                  </div>
                  <div className="w-full">
                    <h4 className="text-xs sm:text-sm font-black text-zinc-900 tracking-tight uppercase line-clamp-1">{m.label}</h4>
                    <p className="text-[10px] text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed font-semibold">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Full Screen Overlay mimicking history appbar and native details view */
          <div style={{ zIndex: 100 }} className="fixed inset-0 bg-neutral-50 flex flex-col overflow-hidden animate-in fade-in duration-150">
            
            {/* Premium Sticky Header exactly matching user screenshot design */}
            <div className="bg-white border-b border-zinc-200/80 px-4 py-3.5 flex items-center justify-between shadow-sm shrink-0 h-16 relative z-50">
              {isSearchActive && !isSelectionMode ? (
                <div className="flex items-center gap-3 w-full animate-in fade-in duration-200">
                  <button
                    onClick={() => { setIsSearchActive(false); setSearchQuery(''); }}
                    className="p-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-700 transition cursor-pointer active:scale-95 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <input 
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Cari data ${modules.find(m => m.id === activeModule)?.label}...`}
                    className="w-full bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-zinc-900 placeholder:text-zinc-400"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        if (isSelectionMode) {
                          setSelectedIds([]);
                        } else {
                          setActiveModule(null);
                        }
                      }} 
                      className={`p-2.5 rounded-xl transition cursor-pointer active:scale-95 shrink-0 ${isSelectionMode ? 'bg-red-50 text-red-650 hover:bg-red-100' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650'}`}
                    >
                      {isSelectionMode ? <X className="h-4.5 w-4.5" /> : <ArrowLeft className="h-4.5 w-4.5" />}
                    </button>
                    <div className="text-left animate-in fade-in">
                      {isSelectionMode ? (
                         <>
                           <h1 className="text-sm font-black text-red-700 uppercase tracking-widest leading-none">
                             {selectedIds.length} Terpilih
                           </h1>
                           <p className="text-[10px] text-red-500/80 font-bold mt-1.5 uppercase">Tindakan Khusus</p>
                         </>
                      ) : (
                         <>
                           <h1 className="text-sm font-black text-zinc-900 uppercase tracking-widest leading-none">
                             {modules.find(m => m.id === activeModule)?.label}
                           </h1>
                           <p className="text-[10px] text-zinc-400 font-bold mt-1.5">{filteredListLength} Item ditemukan</p>
                         </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isSelectionMode ? (
                       <button
                         onClick={handleDeleteSelected}
                         className="p-2.5 bg-red-100/90 hover:bg-red-200 rounded-xl text-red-700 transition cursor-pointer active:scale-95 shrink-0 animate-in fade-in zoom-in-95"
                       >
                         <Trash2 className="h-4.5 w-4.5" />
                       </button>
                    ) : (
                       <>
                         <button
                           onClick={() => setIsSearchActive(true)}
                           className="p-2.5 bg-zinc-100/95 hover:bg-zinc-200 rounded-xl text-zinc-700 transition cursor-pointer active:scale-95"
                         >
                           <Search className="h-4 w-4" />
                         </button>
                         <button 
                           className="p-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-700 transition cursor-pointer active:scale-95 shrink-0"
                           onClick={() => alert('Fitur penyaringan tersedia di update mendatang')}
                         >
                           <Filter className="h-4 w-4" />
                         </button>
                       </>
                    )}
                  </div>
                </>
              )}
            </div>

             {/* Scrollable List Container with ID binding */}
            <div 
              id="module-scroll-container" 
              onClick={(e) => {
                if (isSelectionMode) {
                  const target = e.target as HTMLElement;
                  if (
                    !target.closest('.selectable-card-class') && 
                    !target.closest('.action-button-class') && 
                    !target.closest('.modal-container-class')
                  ) {
                    setSelectedIds([]);
                  }
                }
              }}
              className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50 pb-28 relative"
            >
              
              {isSearchActive && searchQuery && filteredListLength === 0 ? (
                <div className="max-w-4xl mx-auto py-16">
                  <div className="flex items-center justify-center flex-col text-zinc-400 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                    <Search className="h-12 w-12 mb-4 opacity-70 text-zinc-300" />
                    <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Tidak Ditemukan</p>
                    <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Tidak ada hasil yang sesuai dengan filter pencarian Anda.</p>
                    <button 
                      onClick={() => {
                        setIsSearchActive(false);
                        setSearchQuery('');
                      }}
                      className="bg-zinc-50 text-zinc-600 hover:bg-zinc-100 font-black text-[10px] px-6 py-3 rounded-xl transition flex items-center gap-2 active:scale-95 uppercase tracking-widest cursor-pointer mt-4 border border-zinc-200"
                    >
                      <Trash2 className="h-4 w-4 text-red-700" /> Reset Carian
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {activeModule === 'kas' && (
                <div className="max-w-4xl mx-auto">
                  {filteredBukuKas.length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <Briefcase className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                      <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Buku Kas Kosong</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada catatan transaksi manual. Riwayat dari cloud dapat dilihat di Laporan.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredBukuKas.map((k, i) => {
                        const avatarBg = k.isDebit ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600";
                        return (
                          <SelectableCard key={i} item={k._original}>
                            <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${avatarBg}`}>
                              {k.isDebit ? <ArrowUpCircle className="h-5.5 w-5.5" /> : <ArrowDownCircle className="h-5.5 w-5.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h5 className="text-[13px] font-black text-zinc-900 truncate uppercase tracking-tight">
                                  {k.keterangan}
                                </h5>
                                <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap ml-2">
                                  {formatDateString(k.tanggal)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-[11px] text-zinc-500 font-semibold truncate pr-3 flex items-center gap-1.5">
                                  <span className="bg-zinc-100 text-zinc-650 text-[8.5px] px-1.5 py-0.5 rounded font-black border border-zinc-200/50 uppercase shrink-0">
                                    {getCabangName(k.cabang)}
                                  </span>
                                  <span className="truncate">{k.jenis}</span>
                                </p>
                                <span className={`text-[11px] font-black tracking-tight px-2.5 py-0.5 rounded-full shrink-0 ${k.isDebit ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                                  {k.isDebit ? '+' : '-'}Rp{k.nominal.toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                          </SelectableCard>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {activeModule === 'cabang' && master?.cabang && (
                <div className="max-w-4xl mx-auto">
                  {filteredCabang.length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <Building className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                      <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Cabang Kosong</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada data cabang yang terdaftar di sistem lokal.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredCabang.map((c, i) => (
                        <SelectableCard key={i} item={c}>
                          <div className="h-11 w-11 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                            <Building className="h-5.5 w-5.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[13px] font-black text-zinc-900 truncate uppercase tracking-widest leading-none">
                                {c.NAMA_CABANG}
                              </h5>
                              <span className="font-mono bg-zinc-100 border border-zinc-200 text-zinc-600 text-[9px] font-black px-2 py-0.5 rounded-md self-center shrink-0">
                                ID: {c.ID_CABANG}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-[11px] text-zinc-500 font-semibold truncate pr-3 flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-amber-500 shrink-0 inline" /> <span className="truncate">{c.LOKASI}</span>
                              </p>
                              {c.KONTAK && (
                                <span className="text-[9px] font-black text-zinc-500 bg-zinc-55 border border-zinc-105 px-1.5 py-0.5 rounded self-center shrink-0">
                                  WA: {c.KONTAK}
                                </span>
                              )}
                            </div>
                          </div>
                        </SelectableCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModule === 'kategori' && master?.kategori && (
                <div className="max-w-4xl mx-auto">
                  {filteredKategori.length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <Tag className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                      <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Kategori Kosong</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Kelompokkan menu Anda dengan membuat kategori baru.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredKategori.map((k, i) => (
                        <SelectableCard key={i} item={k}>
                          <div className="h-11 w-11 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                            <Tag className="h-5.5 w-5.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[13px] font-black text-zinc-900 truncate uppercase tracking-widest leading-none">
                                {k.NAMA_KATEGORI}
                              </h5>
                              <span className="font-mono bg-zinc-100 border border-zinc-200 text-zinc-650 text-[9px] font-black px-2 py-0.5 rounded-md self-center shrink-0">
                                ID: {k.ID_KATEGORI}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-[11px] text-zinc-400 font-bold truncate">
                                Grup Hidangan Utama
                              </p>
                            </div>
                          </div>
                        </SelectableCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModule === 'menu' && master?.menu && (
                <div className="max-w-4xl mx-auto">
                  {filteredMenu.length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <UtensilsCrossed className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                      <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Menu Kosong</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Daftar hidangan makanan & minuman belum tersedia.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredMenu.map((m, i) => (
                        <SelectableCard key={i} item={m}>
                          <div className="h-11 w-11 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                            <UtensilsCrossed className="h-5.5 w-5.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[13px] font-black text-zinc-900 truncate uppercase tracking-tight leading-none">
                                {m.NAMA_MENU}
                              </h5>
                              <span className="font-mono bg-zinc-100 border border-zinc-200 text-zinc-650 text-[9px] font-black px-2 py-0.5 rounded-md self-center shrink-0">
                                ID: {m.ID_MENU}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-[11px] text-zinc-500 font-semibold truncate flex items-center gap-1">
                                <Tag className="h-3 w-3 text-indigo-500 inline mr-0.5 shrink-0" /> Kategori: {getKategoriName(m.ID_KATEGORI)}
                              </p>
                            </div>
                          </div>
                        </SelectableCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModule === 'varian' && master?.varian && (
                <div className="max-w-4xl mx-auto">
                  {filteredVarian.length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <Layers className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                      <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Varian Kosong</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada variasi rasa atau porsi untuk menu Anda.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredVarian.map((v, i) => (
                        <SelectableCard key={i} item={v}>
                          <div className="h-11 w-11 rounded-full bg-orange-50 text-orange-700 flex items-center justify-center shrink-0">
                            <Layers className="h-5.5 w-5.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h5 className="text-[13px] font-black text-zinc-900 truncate uppercase tracking-wider leading-none">
                                {v.NAMA_VARIAN}
                              </h5>
                              <span className="font-mono bg-zinc-100 border border-zinc-200 text-zinc-650 text-[9px] font-black px-2 py-0.5 rounded-md self-center shrink-0">
                                ID: {v.ID_VARIAN}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-[11px] text-zinc-500 font-semibold truncate flex items-center gap-1.5 min-w-0">
                                <span className="truncate">Menu: {getMenuName(v.ID_MENU)}</span>
                                <span className="opacity-40">&bull;</span>
                                <span className={`px-1.5 py-0.2 rounded font-black uppercase text-[8px] self-center shrink-0 ${v.STATUS === 'Tersedia' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                  {v.STATUS}
                                </span>
                              </div>
                              <span className="text-xs sm:text-sm font-black text-red-850 self-center shrink-0 ml-2">
                                Rp{Number(v.HARGA).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        </SelectableCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

               {activeModule === 'inventaris' && (
                <div className="max-w-4xl mx-auto">
                  {isUniversalLoading ? (
                    <div className="py-20 text-center text-zinc-500 bg-white rounded-[32px] border border-zinc-200 shadow-sm flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="h-6 w-6 text-red-650 animate-spin" />
                      <p className="text-sm font-medium">Memuat data dari sistem pusat...</p>
                    </div>
                  ) : filteredInventaris.length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <Box className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                      <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Logistik Kosong</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada riwayat pencatatan stok barang logistik.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredInventaris.map((item, i) => (
                        <SelectableCard key={i} item={item}>
                          <div className={`h-11 w-11 rounded-full ${String(item.JENIS).toLowerCase() === 'masuk' ? 'bg-sky-50 text-sky-700' : 'bg-red-50 text-red-700'} flex items-center justify-center shrink-0`}>
                            <Box className="h-5.5 w-5.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between">
                                <h5 className="text-[13px] font-black text-zinc-900 truncate uppercase tracking-widest leading-none">
                                  {item.NAMA_BARANG}
                                </h5>
                                <span className={`font-mono bg-zinc-100 border border-zinc-200 text-[9px] font-black px-2 py-0.5 rounded-md self-center shrink-0 ${String(item.JENIS).toLowerCase() === 'masuk' ? 'text-sky-650' : 'text-red-650'}`}>
                                  {item.JENIS} : {item.JUMLAH} qty
                                </span>
                             </div>
                             <div className="flex items-center justify-between mt-1">
                                <p className="text-[11px] text-zinc-500 font-semibold truncate flex items-center gap-1">
                                  <span className="bg-zinc-100 text-zinc-650 text-[8.5px] px-1.5 py-0.5 rounded font-black border border-zinc-200/50 uppercase shrink-0">{getCabangName(item.CABANG || item.ID_CABANG)}</span>
                                  <span className="truncate">PIC: {item.PIC} &bull; {item.KETERANGAN}</span>
                                </p>
                                <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap ml-2">
                                  {formatDateString(item.TANGGAL || item.tanggal)}
                                </span>
                             </div>
                          </div>
                        </SelectableCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

               {activeModule === 'shift' && (
                <div className="max-w-4xl mx-auto">
                  {isUniversalLoading ? (
                    <div className="py-20 text-center text-zinc-500 bg-white rounded-[32px] border border-zinc-200 shadow-sm flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="h-6 w-6 text-red-650 animate-spin" />
                      <p className="text-sm font-medium">Memuat data dari sistem pusat...</p>
                    </div>
                  ) : filteredShift.length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <UserCog className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                      <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Izin Staff Kosong</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada catatan pergantian shift atau izin staff hari ini.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredShift.map((item, i) => (
                        <SelectableCard key={i} item={item}>
                          <div className="h-11 w-11 rounded-full bg-fuchsia-50 text-fuchsia-700 flex items-center justify-center shrink-0">
                            <UserCog className="h-5.5 w-5.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between">
                                <h5 className="text-[13px] font-black text-zinc-900 truncate uppercase tracking-widest leading-none">
                                  {item.NAMA_STAFF}
                                </h5>
                                <span className="font-mono bg-zinc-100 border border-zinc-200 text-zinc-650 text-[9px] font-black px-2 py-0.5 rounded-md self-center shrink-0">
                                  {item.CABANG}
                                </span>
                             </div>
                             <div className="flex items-center justify-between mt-1">
                                <p className="text-[11px] text-zinc-500 font-semibold truncate flex items-center gap-1">
                                  <span className="bg-zinc-100 text-zinc-650 text-[8.5px] px-1.5 py-0.5 rounded font-black border border-zinc-200/50 uppercase shrink-0">{getCabangName(item.CABANG || item.ID_CABANG)}</span>
                                  <span className="truncate">Alasan: {item.ALASAN}</span>
                                </p>
                                <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap ml-2">
                                  {formatDateString(item.TANGGAL || item.tanggal)}
                                </span>
                             </div>
                             {item.PENGGANTI && (
                                <div className="mt-1">
                                  <span className="bg-amber-50 text-amber-700 text-[9px] font-black border border-amber-100 px-1.5 py-0.5 rounded uppercase">Pengganti: {item.PENGGANTI}</span>
                                </div>
                             )}
                          </div>
                        </SelectableCard>
                      ))}
                    </div>
                  )}
                </div>
              )}
                </>
              )}
            </div>
            
            {/* Floating Action Button (FAB) for adding items */}
            <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 z-[110]">
              <button 
                onClick={() => {
                  setSelectedIds([]);
                  handleOpenModal(activeModule);
                }}
                title="Tambah Data Master"
                className="action-button-class h-14 w-14 bg-red-750 hover:bg-red-800 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all active:scale-95 group focus:outline-none cursor-pointer"
              >
                <Plus className="h-6 w-6 stroke-[3] group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showModal && (
        <div style={{ zIndex: 999999 }} className="modal-container-class fixed inset-0 bg-zinc-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300 ease-out">
          <div className="bg-white bottom-0 fixed sm:relative w-full max-w-lg sm:rounded-[32px] rounded-t-[32px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-32 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 ease-out">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <h3 className="font-black text-zinc-900 uppercase tracking-widest text-lg">
                {getIsEditing() ? 'Edit' : 'Tambah'} {
                  showModal === 'kas' ? 'Buku Arus Kas' : 
                  showModal === 'shift' ? 'Izin Shift' : 
                  showModal === 'inventaris' ? 'Stok Logistik' : 
                  showModal
                }
              </h3>
              <button onClick={() => setShowModal(null)} className="h-8 w-8 bg-zinc-100 hover:bg-zinc-200 rounded-full flex items-center justify-center text-zinc-500 transition cursor-pointer active:scale-90">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto w-full">
              <form id="admin-form" onSubmit={handleSubmit} className="space-y-4">
                <fieldset className="space-y-4 w-full" disabled={isSubmitting}>
                
                {/* INVENTARIS FORM */}
                {showModal === 'inventaris' && (
                  <>
                    {getIsEditing() && (
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">ID Logistik</label>
                        <div className="w-full p-3 bg-zinc-100 border border-zinc-200 rounded-xl text-sm font-bold font-mono text-zinc-600 select-none">
                          {formData.ID_LOG}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Tanggal</label>
                      <input type="datetime-local" value={formData.tanggal || formData.TANGGAL || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, tanggal: e.target.value, TANGGAL: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Cabang</label>
                      <select required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" value={formData.cabang || formData.CABANG || ''} onChange={e => setFormData({...formData, cabang: e.target.value, CABANG: e.target.value})}>
                        <option value="">-- Pilih Cabang --</option>
                        {master?.cabang?.map(c => (
                          <option key={c.ID_CABANG} value={c.ID_CABANG}>{c.NAMA_CABANG}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Barang</label>
                      <input type="text" placeholder="Gelas Plastik / Ayam Potong" value={formData.NAMA_BARANG || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, NAMA_BARANG: e.target.value})}/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Jenis (Masuk/Keluar)</label>
                        <select required value={formData.JENIS || ''} className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, JENIS: e.target.value})}>
                          <option value="MASUK">Masuk</option>
                          <option value="KELUAR">Keluar</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Jumlah</label>
                        <input 
                          type="number" 
                          placeholder="0" 
                          min="0"
                          value={formData.JUMLAH || ''} 
                          required 
                          className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" 
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            setFormData({...formData, JUMLAH: val ? parseInt(val, 10) : ''});
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">PIC / Penanggung Jawab</label>
                      <input type="text" placeholder="Nama Staff" value={formData.PIC || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, PIC: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Keterangan Lengkap</label>
                      <textarea rows={3} placeholder="Sebutkan detail, keperluan, atau deskripsi logistik..." value={formData.KETERANGAN || ''} className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, KETERANGAN: e.target.value})}></textarea>
                    </div>
                  </>
                )}

                {/* SHIFT STAFF FORM */}
                {showModal === 'shift' && (
                  <>
                    {getIsEditing() && (
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">ID Izin</label>
                        <div className="w-full p-3 bg-zinc-100 border border-zinc-200 rounded-xl text-sm font-bold font-mono text-zinc-600 select-none">
                          {formData.ID_IZIN}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Tanggal Izin</label>
                      <input type="datetime-local" value={formData.tanggal || formData.TANGGAL || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, tanggal: e.target.value, TANGGAL: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Cabang</label>
                      <select required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" value={formData.cabang || formData.CABANG || ''} onChange={e => setFormData({...formData, cabang: e.target.value, CABANG: e.target.value})}>
                        <option value="">-- Pilih Cabang --</option>
                        {master?.cabang?.map(c => (
                          <option key={c.ID_CABANG} value={c.ID_CABANG}>{c.NAMA_CABANG}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Staff</label>
                        <input type="text" placeholder="Budi" value={formData.NAMA_STAFF || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, NAMA_STAFF: e.target.value})}/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Staff Pengganti</label>
                        <input type="text" placeholder="(Optional)" value={formData.PENGGANTI || ''} className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, PENGGANTI: e.target.value})}/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Alasan Izin</label>
                      <textarea rows={3} placeholder="Sakit / Acara Keluarga..." value={formData.ALASAN || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, ALASAN: e.target.value})}></textarea>
                    </div>
                  </>
                )}
                
                {/* BUKU KAS FORM */}
                {showModal === 'kas' && (
                  <>
                    <div className="mb-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5">Tanggal Entri</label>
                        <input type="date"
                          max={new Date().toISOString().split('T')[0]}
                          value={formData.tanggal ? formData.tanggal.split('T')[0] : (formData.TANGGAL ? formData.TANGGAL.split('T')[0] : '')} required className="w-full text-sm font-bold bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-zinc-400 focus:bg-white transition-all"
                          onChange={e => setFormData({...formData, tanggal: e.target.value, TANGGAL: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5">Cabang</label>
                        <select required className="w-full text-sm font-bold bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-zinc-400 focus:bg-white transition-all" value={formData.cabang || formData.CABANG || ''} onChange={e => setFormData({...formData, cabang: e.target.value, CABANG: e.target.value})}>
                          <option value="">-- Pilih Cabang --</option>
                          {master?.cabang?.map(c => (
                            <option key={c.ID_CABANG} value={c.ID_CABANG}>{c.NAMA_CABANG}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5">Jenis Transaksi (Kategori)</label>
                      <select 
                        required 
                        className="w-full text-sm font-bold bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-zinc-400 focus:bg-white transition-all" 
                        value={formData.jenis || formData.JENIS || 'Pendapatan Usaha'} 
                        onChange={e => {
                          const val = e.target.value;
                          let matchedTipe = 'Masuk'; // Debit
                          if (val === 'Biaya Produksi' || val === 'Beban Usaha' || val === 'Privee' || val === 'Piutang Usaha') {
                            matchedTipe = 'Keluar'; // Kredit
                          } else if (val === 'Pendapatan Usaha' || val === 'Utang Usaha') {
                            matchedTipe = 'Masuk'; // Debit
                          }
                          
                          setFormData({
                            ...formData,
                            jenis: val,
                            JENIS: val,
                            tipe: matchedTipe
                          });
                        }}
                      >
                        <option value="Pendapatan Usaha">Pendapatan Usaha (Debit / Uang Masuk)</option>
                        <option value="Biaya Produksi">Biaya Produksi (Kredit / Bahan Baku)</option>
                        <option value="Beban Usaha">Beban Usaha (Kredit / Operasional)</option>
                        <option value="Privee">Privee (Kredit / Ambil Pribadi)</option>
                        <option value="Utang Usaha">Utang Usaha (Debit / Pinjaman)</option>
                        <option value="Piutang Usaha">Piutang Usaha (Kredit / Tagihan)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5">Keterangan Tambahan</label>
                      <input type="text" placeholder="Detail transaksi..." value={formData.keterangan || formData.KETERANGAN || ''} className="w-full text-sm font-bold bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-zinc-400 focus:bg-white transition-all"
                        onChange={e => setFormData({...formData, keterangan: e.target.value, KETERANGAN: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 font-bold uppercase text-zinc-500 mb-1.5">Nominal</label>
                      <div className="relative rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden focus-within:border-zinc-400 focus-within:bg-white transition-all">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-zinc-400 font-extrabold text-sm">Rp</span>
                        </div>
                        <input 
                          type="text" 
                          placeholder="0" 
                          required 
                          value={formatRupiahInput(formData.nominal || formData.DEBIT || formData.KREDIT || '')} 
                          className="w-full pl-11 pr-4 py-3 bg-transparent text-2xl font-black text-zinc-900 tracking-tight outline-none" 
                          onChange={e => {
                            const parsedVal = parseRupiahInput(e.target.value);
                            setFormData({...formData, nominal: parsedVal});
                          }} 
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* MASTER CABANG FORM */}
                {showModal === 'cabang' && (
                  <>
                    {getIsEditing() && (
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">ID Cabang</label>
                        <div className="w-full p-3 bg-zinc-100 border border-zinc-200 rounded-xl text-sm font-bold font-mono text-zinc-650 select-none">
                          {formData.ID_CABANG}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Cabang</label>
                      <input type="text" placeholder="Aura Makassar" value={formData.NAMA_CABANG || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, NAMA_CABANG: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Password</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="***" 
                          value={formData.PASSWORD || ''} 
                          required 
                          className="w-full p-3 pr-10 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" 
                          onChange={e => setFormData({...formData, PASSWORD: e.target.value})}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-650 cursor-pointer focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Lokasi Cabang</label>
                      <input type="text" placeholder="Palu, Sulawesi Tengah" value={formData.LOKASI || ''} className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, LOKASI: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Kontak WA</label>
                      <input type="text" placeholder="08123456789" value={formData.KONTAK || ''} className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, KONTAK: e.target.value})}/>
                    </div>
                  </>
                )}

                {/* MASTER KATEGORI FORM */}
                {showModal === 'kategori' && (
                  <>
                    {getIsEditing() && (
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">ID Kategori</label>
                        <div className="w-full p-3 bg-zinc-100 border border-zinc-200 rounded-xl text-sm font-bold font-mono text-zinc-650 select-none">
                          {formData.ID_KATEGORI}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Kategori</label>
                      <input type="text" placeholder="Minuman Sachet" value={formData.NAMA_KATEGORI || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, NAMA_KATEGORI: e.target.value})}/>
                    </div>
                  </>
                )}

                {/* MASTER MENU FORM */}
                {showModal === 'menu' && (
                  <>
                    {getIsEditing() && (
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">ID Menu</label>
                        <div className="w-full p-3 bg-zinc-100 border border-zinc-200 rounded-xl text-sm font-bold font-mono text-zinc-650 select-none">
                          {formData.ID_MENU}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Kategori</label>
                      <select 
                        required 
                        disabled={!master?.kategori || master.kategori.length === 0}
                        value={formData.ID_KATEGORI || ''} 
                        className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none disabled:opacity-50" 
                        onChange={e => setFormData({...formData, ID_KATEGORI: e.target.value})}
                      >
                        {(!master?.kategori || master.kategori.length === 0) && <option value="">Tidak ada Kategori</option>}
                        {master?.kategori?.map((k: any) => (
                          <option key={k.ID_KATEGORI} value={k.ID_KATEGORI}>{k.NAMA_KATEGORI}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Menu</label>
                      <input type="text" placeholder="Kopi Susu Regal" value={formData.NAMA_MENU || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, NAMA_MENU: e.target.value})}/>
                    </div>
                  </>
                )}

                {/* MASTER VARIAN FORM */}
                {showModal === 'varian' && (
                  <>
                    {getIsEditing() && (
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">ID Varian</label>
                        <div className="w-full p-3 bg-zinc-100 border border-zinc-200 rounded-xl text-sm font-bold font-mono text-zinc-650 select-none">
                          {formData.ID_VARIAN}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Kategori</label>
                        <select 
                          required 
                          disabled={!master?.kategori || master.kategori.length === 0}
                          value={formData.ID_KATEGORI || ''} 
                          className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none disabled:opacity-50" 
                          onChange={e => setFormData({...formData, ID_KATEGORI: e.target.value})}
                        >
                          {(!master?.kategori || master.kategori.length === 0) && <option value="">Tidak ada Kategori</option>}
                          {master?.kategori?.map((k: any) => (
                            <option key={k.ID_KATEGORI} value={k.ID_KATEGORI}>{k.NAMA_KATEGORI}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Menu</label>
                        <select 
                          required 
                          disabled={!master?.menu || master.menu.length === 0}
                          value={formData.ID_MENU || ''} 
                          className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none disabled:opacity-50" 
                          onChange={e => setFormData({...formData, ID_MENU: e.target.value})}
                        >
                          {(!master?.menu || master.menu.length === 0) && <option value="">Tidak ada Menu</option>}
                          {master?.menu?.map((m: any) => (
                            <option key={m.ID_MENU} value={m.ID_MENU}>{m.NAMA_MENU}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Varian</label>
                      <input type="text" placeholder="Ekstra Espresso" value={formData.NAMA_VARIAN || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, NAMA_VARIAN: e.target.value})}/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-550 mb-1">Harga</label>
                        <div className="relative rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden focus-within:border-zinc-400 focus-within:bg-white transition-all">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-zinc-400 font-extrabold text-sm">Rp</span>
                          </div>
                          <input 
                            type="text" 
                            placeholder="0" 
                            required 
                            value={formatRupiahInput(formData.HARGA || '')} 
                            className="w-full pl-9 pr-3 py-3 bg-transparent text-sm font-bold text-zinc-900 outline-none" 
                            onChange={e => {
                              const parsedVal = parseRupiahInput(e.target.value);
                              setFormData({...formData, HARGA: parsedVal});
                            }} 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Status</label>
                        <select className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none"
                          value={formData.STATUS || 'Tersedia'}
                          onChange={e => setFormData({...formData, STATUS: e.target.value})}>
                          <option value="Tersedia">Tersedia</option>
                          <option value="Tidak Tersedia">Tidak Tersedia</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                </fieldset>
              </form>
            </div>
            
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 rounded-b-[32px] shrink-0">
              <button 
                type="submit"
                form="admin-form"
                disabled={isSubmitting || isSaveDisabled}
                className="w-full bg-zinc-900 hover:bg-black disabled:opacity-50 text-white font-extrabold text-sm py-4 rounded-xl transition cursor-pointer active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div style={{ zIndex: 100000001 }} className="fixed top-4 left-1/2 -translate-x-1/2 animate-in slide-in-from-top-8 duration-500 w-full max-w-sm px-4">
          <div className="px-5 py-3 rounded-[20px] bg-zinc-950 text-white flex items-center justify-center gap-3 shadow-2xl border border-zinc-800">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shrink-0">
              <Check className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">{toastMessage}</span>
          </div>
        </div>
      )}

      {confirmState.isOpen && (
        <div style={{ zIndex: 100000000 }} className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] border border-zinc-200 shadow-2xl p-8 w-full max-w-sm text-center animate-in zoom-in-95 duration-200">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-5 border-2 ${confirmState.type === 'delete' ? 'bg-red-50 text-red-750 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {confirmState.type === 'delete' ? (
                <AlertCircle className="h-7 w-7 text-red-650" />
              ) : (
                <AlertTriangle className="h-7 w-7 text-amber-600" />
              )}
            </div>
            <h3 className="text-base font-black text-zinc-900 uppercase tracking-wider mb-2">
              {confirmState.title}
            </h3>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed mb-6">
              {confirmState.message}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  confirmState.onCancel();
                  setConfirmState(prev => ({ ...prev, isOpen: false }));
                }}
                className="flex-1 py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-widest transition cursor-pointer active:scale-95"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(prev => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 py-3.5 rounded-xl text-white font-extrabold text-xs uppercase tracking-widest transition cursor-pointer active:scale-95 ${confirmState.type === 'delete' ? 'bg-red-750 hover:bg-red-800' : 'bg-zinc-900 hover:bg-black'}`}
              >
                Ya, Lanjut
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SelectionContext.Provider>
  );
}
