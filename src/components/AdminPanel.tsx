import { getWITAString } from "../utils/date";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Building, 
  UtensilsCrossed, 
  Tag, 
  ShoppingBag,
  Calendar,
  Layers, 
  Plus,
  X,
  MapPin,
  Camera,
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
  AlertCircle,
  Users,
  ClipboardList,
  FileImage,
  ImageOff,
  Database
} from 'lucide-react';
import { getMasterData, saveMasterData, syncMasterDataFromGAS, postUniversalDataToGAS, fetchUniversalDataFromGAS, uploadBukuKasFotoToGAS } from '../utils/db';
import { CustomSelect } from './CustomSelect';
import { ImageWithFallback } from './ImageWithFallback';
import { MasterData, Cabang, Kategori, Menu, Varian, Promo } from '../types';
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
  className?: string;
}

const SelectableCard: React.FC<SelectableCardProps> = ({ 
  item, 
  children,
  className = "" 
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
      className={`selectable-card-class bg-white rounded-[24px] border shadow-sm p-4.5 flex items-center gap-3.5 transition duration-200 text-left active:scale-[0.98] cursor-pointer touch-manipulation select-none relative overflow-hidden ${isSelected ? 'border-red-500 bg-red-50/10 ring-2 ring-red-600 ring-offset-2' : 'border-zinc-200/90 hover:border-zinc-300'} ${className}`}
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
  onOpenRekapOperasional?: () => void;
}

type TabType = 'kas' | 'cabang' | 'kategori' | 'menu' | 'varian' | 'inventaris' | 'shift' | 'promo' | 'pegawai' | 'rekap_operasional';

export default function AdminPanel({ onRefreshPOSCatalog, onModuleActiveChange, onOpenRekapOperasional }: AdminPanelProps) {
  const [activeModule, setActiveModule] = useState<TabType | null>(null);
  const [showModal, setShowModal] = useState<TabType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<{ base64: string, preview: string, name: string, mimeType: string } | null>(null);
  const [photoError, setPhotoError] = useState<string>('');

  const handlePhotoSelect = (file: File) => {
    setPhotoError('');
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setPhotoError('Hanya file foto/gambar saja yang diperbolehkan (JPG, PNG, dll).');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Ukuran file foto maksimal adalah 5MB.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64String = e.target?.result as string;
      if (base64String) {
        const base64DataOnly = base64String.split(',')[1] || base64String;
        setSelectedPhotoFile({
          base64: base64DataOnly,
          preview: base64String,
          name: file.name,
          mimeType: file.type
        });
      }
    };
    reader.onerror = () => {
      setPhotoError('Gagal membaca file foto.');
    };
    reader.readAsDataURL(file);
  };
  
  // Selection mode state (WhatsApp style)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isSelectionMode = selectedIds.length > 0;
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  type SortOrder = 'newest' | 'oldest';
  interface AdminFilterState {
    branch: string;
    category: string;
    sortOrder: SortOrder;
    date: string | null;
    sifat: 'All' | 'Pemasukan' | 'Pengeluaran';
    menu: string;
    statusFilter: string;
  }
  const getDefaultAdminFilterState = (): AdminFilterState => ({
    branch: 'All',
    category: 'All',
    sortOrder: 'newest',
    date: null,
    sifat: 'All',
    menu: 'All',
    statusFilter: 'All'
  });
  const [appliedAdminFilter, setAppliedAdminFilter] = useState<AdminFilterState>(getDefaultAdminFilterState());
  const [tempAdminFilter, setTempAdminFilter] = useState<AdminFilterState>(getDefaultAdminFilterState());
  const [showKasSuggestions, setShowKasSuggestions] = useState<boolean>(false);  
  
  // Pull to Refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  
  // Data for rendering lists
  const [master, setMaster] = useState<MasterData | null>(null);
  const [bukuKasList, setBukuKasList] = useState<any[]>([]);
  const [inventarisData, setInventarisData] = useState<any[]>([]);
  const [shiftData, setShiftData] = useState<any[]>([]);
  const [isLoadingPanel, setIsLoadingPanel] = useState(false);
  const [isUniversalLoading, setIsUniversalLoading] = useState(false);

  // Back button interception for Android
  // Basic Form States
  const [formData, setFormData] = useState<any>({ STATUS: 'Tersedia' });
  const [showKeteranganSuggestions, setShowKeteranganSuggestions] = useState(false);
  const [promoVariantSearch, setPromoVariantSearch] = useState('');
  const [promoBranchSearch, setPromoBranchSearch] = useState('');
  const [isAllVariantsSelected, setIsAllVariantsSelected] = useState(false);

  const getVariantDisplayLabel = (variantId: string): string => {
    const v = master?.varian?.find(x => String(x.ID_VARIAN) === String(variantId));
    if (!v) return variantId;
    const m = master?.menu?.find(x => String(x.ID_MENU) === String(v.ID_MENU));
    return m ? `${m.NAMA_MENU} (${v.NAMA_VARIAN})` : v.NAMA_VARIAN;
  };
  const [originalEditData, setOriginalEditData] = useState<any>(null);
  const [initialFormData, setInitialFormData] = useState<any>(null);

  const syncBukuKasFromGASHelper = async (showLoading = true) => {
    if (showLoading) setIsUniversalLoading(true);
    try {
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
    } catch (err) {
      console.error("Gagal sinkronisasi Buku Kas:", err);
    } finally {
      if (showLoading) setIsUniversalLoading(false);
    }
  };

  const handleCloseModal = () => {
    const hasUnsavedChanges = checkHasChanges(true);

    if (hasUnsavedChanges) {
      setConfirmState({
        isOpen: true,
        title: 'Buang Perubahan?',
        message: 'Terdapat perubahan yang belum disimpan. Apakah Anda yakin ingin membuangnya?',
        type: 'save',
        onCancel: () => {},
        onConfirm: () => {
          setShowModal(null);
          setFormData({});
          setOriginalEditData(null);
          setInitialFormData(null);
          setSelectedPhotoFile(null);
          setPhotoError('');
        }
      });
    } else {
      setShowModal(null);
      setFormData({});
      setOriginalEditData(null);
      setInitialFormData(null);
      setSelectedPhotoFile(null);
      setPhotoError('');
    }
  };
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

  useEffect(() => {
    const handleAndroidBack = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (confirmState && confirmState.isOpen) {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showFilterModal) {
        setShowFilterModal(false);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (showModal !== null) {
        handleCloseModal();
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (selectedIds.length > 0) {
        setSelectedIds([]);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (isSearchActive) {
        setIsSearchActive(false);
        setSearchQuery('');
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      } else if (activeModule !== null) {
        setActiveModule(null);
        if (customEvt.detail) customEvt.detail.handled = true;
        customEvt.preventDefault();
      }
    };
    window.addEventListener('aura-backpress', handleAndroidBack);
    return () => window.removeEventListener('aura-backpress', handleAndroidBack);
  }, [showFilterModal, showModal, selectedIds, isSearchActive, activeModule, formData, originalEditData, initialFormData, confirmState]);


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

  const getPegawaiName = (pegawaiId: any) => {
    if (!master?.pegawai || !pegawaiId) return pegawaiId || '-';
    const targetId = String(pegawaiId).trim().toLowerCase();
    const found = master.pegawai.find((p: any) => String(p.ID_PEGAWAI).trim().toLowerCase() === targetId);
    return found ? found.NAMA_PEGAWAI : pegawaiId;
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
    if (!dateInput) return getWITAString().substring(0, 16);
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
      return getWITAString().substring(0, 16);
    }
    return getWITAString(d).substring(0, 16);
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
    if (module === 'promo') {
      return generateClientSideId('PRM-', master?.promo || [], 'ID_PROMO');
    }
    if (module === 'pegawai') {
      return generateClientSideId('PGW-', master?.pegawai || [], 'ID_PEGAWAI');
    }
    return '';
  };

  const getIsEditing = () => {
    return !!originalEditData;
  };

  const checkRequiredFields = (): boolean => {
    if (!formData) return false;
    
    if (showModal === 'kas') {
      const cab = formData.cabang || formData.CABANG || formData.ID_CABANG;
      const jen = formData.jenis || formData.JENIS;
      const ket = formData.keterangan || formData.KETERANGAN;
      const debit = Number(formData.nominal || formData.DEBIT || 0);
      const kredit = Number(formData.KREDIT || 0);
      const isValidNominal = (debit > 0 || kredit > 0);
      return !!cab && !!jen && !!String(ket).trim() && isValidNominal;
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
    
    if (showModal === 'promo') {
      const nama = formData.NAMA_PROMO;
      const tipe = formData.TIPE;
      const targetItem = formData.TARGET_ITEM;
      const nilai = Number(formData.NILAI_PROMO || 0);
      const jenisPromo = formData.JENIS_PROMO || 'PER_MENU';
      
      const isTargetValid = jenisPromo === 'PER_PESANAN' ? true : !!String(targetItem || '').trim();
      
      return !!String(nama || '').trim() && !!tipe && isTargetValid && nilai > 0;
    }

    if (showModal === 'pegawai') {
      const cab = formData.ID_CABANG;
      const nm = formData.NAMA_PEGAWAI;
      return !!cab && !!String(nm).trim();
    }
    
    return false;
  };

  const checkHasChanges = (checkForNew: boolean = false): boolean => {
    const isEdit = getIsEditing();
    if (!isEdit && !checkForNew) return true; // original behavior for save button
    
    // For close warning
    const compareData = isEdit ? originalEditData : initialFormData;
    if (!compareData) return false;
    
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
    } else if (showModal === 'promo') {
      keysToCheck = ['NAMA_PROMO', 'TIPE', 'TARGET_ITEM', 'SYARAT_QTY', 'NILAI_PROMO', 'JENIS_PROMO', 'ID_CABANG', 'PERIODE'];
    } else if (showModal === 'pegawai') {
      keysToCheck = ['ID_PEGAWAI', 'ID_CABANG', 'NAMA_PEGAWAI', 'KONTAK'];
    }
    
    for (const key of keysToCheck) {
      const originalValue = compareData[key];
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
      getMasterData().then(setMaster).catch(() => {});
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
      
      const cachedInv = localStorage.getItem('cached_inventaris_data');
      if (cachedInv) {
        setInventarisData(JSON.parse(cachedInv));
      }
      
      const cachedShift = localStorage.getItem('cached_shift_data');
      if (cachedShift) {
        setShiftData(JSON.parse(cachedShift));
      }
    } catch (e) {
      console.log('Error reading cached buku kas/inventaris/shift:', e);
    } finally {
      setIsLoadingPanel(false);
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
          await syncBukuKasFromGASHelper(false);
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
      } else if (activeModule === 'promo') {
        sheetName = 'Master_Promo';
        idCol = 'ID_PROMO';
      } else if (activeModule === 'pegawai') {
        sheetName = 'Master_Pegawai';
        idCol = 'ID_PEGAWAI';
      }

      if (sheetName && idCol) {
        try {
          if (activeModule === 'kas') {
            const selectedItems = bukuKasList.filter((item: any) => selectedIds.includes(getItemId(item)));
            for (const item of selectedItems) {
              const id = getItemId(item);
              
              // If there's a real ID, use DELETE_DATA (matches the user's provided GAS script)
              if (id && !id.startsWith('TEMP-')) {
                // Try to determine the ID column name
                const idColName = item.ID_TRANSAKSI ? 'ID_TRANSAKSI' : (item.ID ? 'ID' : (item._id ? '_id' : 'ID_TRANSAKSI'));
                
                await postUniversalDataToGAS('DELETE_DATA', 'Transaksi', idColName, id, {});
              } else {
                // Fallback for items without ID or temp items (matching by content)
                const matchTgl = item.tanggal || item.TANGGAL || (Array.isArray(item) ? item[0] : '');
                const matchCab = item.cabang || item.CABANG || item.ID_CABANG || (Array.isArray(item) ? item[2] : '');
                const matchKet = (item.keterangan || item.KETERANGAN || (Array.isArray(item) ? item[3] : '')).trim();
                const matchDeb = Number(item.debit || item.DEBIT || (Array.isArray(item) ? item[4] : 0));
                const matchKre = Number(item.kredit || item.KREDIT || (Array.isArray(item) ? item[5] : 0));
                
                // Note: The user's script doesn't explicitly have DELETE_DATA_MATCH, 
                // but we keep this as a fallback in case they add it or for local filtering
                await postUniversalDataToGAS('DELETE_DATA', 'Transaksi', 'KETERANGAN', matchKet, {
                  matchData: {
                    TANGGAL: matchTgl,
                    CABANG: matchCab,
                    KETERANGAN: matchKet,
                    DEBIT: matchDeb,
                    KREDIT: matchKre
                  }
                });
              }
            }
          } else {
            await postUniversalDataToGAS('DELETE_DATA', sheetName, idCol, null, { idValues: selectedIds });
          }
        } catch (apiErr) {
          console.warn("Gagal menghapus dari server, menghapus secara lokal:", apiErr);
        }
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
        
        // RE-FETCH in background to ensure local state matches Spreadsheet perfectly
        setTimeout(() => syncBukuKasFromGASHelper(false), 1500);
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
        } else if (activeModule === 'promo') {
          newData.promo = (newData.promo || []).filter((p: any) => !selectedIds.includes(p.ID_PROMO) && !selectedIds.includes(p.NAMA_PROMO));
        } else if (activeModule === 'pegawai') {
          newData.pegawai = (newData.pegawai || []).filter((p: any) => !selectedIds.includes(p.ID_PEGAWAI) && !selectedIds.includes(p.NAMA_PEGAWAI));
        }
        await saveMasterData(newData);
        setMaster(newData);
        onRefreshPOSCatalog();
      }

      setSelectedIds([]);
      showToastBanner('Data berhasil dihapus dari sistem');
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
      formattedItem.cabang = parsed.cabang;
      formattedItem.CABANG = parsed.cabang;
      formattedItem.cash = parsed.cash;
      formattedItem.CASH = parsed.cash;
      formattedItem.transfer = parsed.transfer;
      formattedItem.TRANSFER = parsed.transfer;
      formattedItem.compliment = parsed.compliment;
      formattedItem.COMPLIMENT = parsed.compliment;
      formattedItem.foto = parsed.foto;
      formattedItem.FOTO = parsed.foto;
      formattedItem.bukti = parsed.foto;
    }

    // Track original properties for cascade update checks
    formattedItem._id_or_original = formattedItem.id || getItemId(item);
    setOriginalEditData({ ...formattedItem });
    setFormData(formattedItem);
    setShowModal(activeModule);
  };

  const openModule = async (id: TabType) => {
    setIsLoadingPanel(true);
    window.scrollTo({ top: 0 });
    setSearchQuery('');
    setIsSearchActive(false);
    setSelectedIds([]); // Clear selection when switching modules
    setAppliedAdminFilter(getDefaultAdminFilterState()); // Auto reset filter
    setTempAdminFilter(getDefaultAdminFilterState());
    setActiveModule(id);
    
    try {
      if (id === 'inventaris') {
        const cachedInv = localStorage.getItem('cached_inventaris_data');
        if (cachedInv) {
          try { setInventarisData(JSON.parse(cachedInv)); } catch (e) {}
        }
        setIsUniversalLoading(true);
        const data = await fetchUniversalDataFromGAS('Data_Inventaris');
        if (data && data.length > 0) {
          setInventarisData(data);
          localStorage.setItem('cached_inventaris_data', JSON.stringify(data));
        }
      } else if (id === 'shift') {
        const cachedShift = localStorage.getItem('cached_shift_data');
        if (cachedShift) {
          try { setShiftData(JSON.parse(cachedShift)); } catch (e) {}
        }
        setIsUniversalLoading(true);
        const data = await fetchUniversalDataFromGAS('Data_Izin_Shift');
        if (data && data.length > 0) {
          setShiftData(data);
          localStorage.setItem('cached_shift_data', JSON.stringify(data));
        }
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
      } else if (id === 'promo') {
        setIsUniversalLoading(true);
        const data = await fetchUniversalDataFromGAS('Master_Promo');
        if (master) {
          const newData = { ...master, promo: data || [] };
          await saveMasterData(newData);
          setMaster(newData);
        }
      }
    } catch (e) {
      console.warn("Error fetching data for module:", id, e);
    } finally {
      setIsUniversalLoading(false);
      setIsLoadingPanel(false);
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
      initialData = { tipe: 'Masuk', tanggal: nowLocal, cabang: '', CABANG: '', jenis: 'Pendapatan Usaha', JENIS: 'Pendapatan Usaha', keterangan: '', nominal: 0 };
    } else if (tab === 'inventaris') {
      initialData = { TANGGAL: nowLocal, CABANG: '', cabang: '', NAMA_BARANG: '', JENIS: 'MASUK', JUMLAH: '', PIC: '', KETERANGAN: '' };
    } else if (tab === 'shift') {
      initialData = { TANGGAL: nowLocal, CABANG: '', cabang: '', NAMA_STAFF: '', ALASAN: '', PENGGANTI: '' };
    } else if (tab === 'menu') {
      initialData = { ID_KATEGORI: defaultKategoriId };
    } else if (tab === 'varian') {
      initialData = { STATUS: 'Tersedia', ID_KATEGORI: defaultKategoriId, ID_MENU: defaultMenuId };
    } else if (tab === 'promo') {
      const defaultPromoId = generateClientIdForModule('promo');
      initialData = { 
        ID_PROMO: defaultPromoId, 
        NAMA_PROMO: '', 
        JENIS_PROMO: 'PER_MENU',
        TIPE: 'DISKON_PERSEN', 
        TARGET_ITEM: '', 
        SYARAT_QTY: 1, 
        NILAI_PROMO: 0,
        ID_CABANG: 'ALL'
      };
    } else {
      initialData = {};
    }
    setOriginalEditData(null);
    setInitialFormData(initialData);
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
        } else if (showModal === 'pegawai') {
          finalFormData.ID_PEGAWAI = generateClientIdForModule('pegawai');
        } else if (showModal === 'promo') {
          finalFormData.ID_PROMO = generateClientIdForModule('promo');
          finalFormData.JENIS_PROMO = finalFormData.JENIS_PROMO || 'PER_MENU';
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
          if (lower.includes('produksi') || lower.includes('bahan') || lower.includes('pengeluaran')) return 'Biaya Produksi';
          if (lower.includes('beban')) return 'Beban Usaha';
          if (lower.includes('prive')) return 'Prive';
          if (lower.includes('utang')) return 'Utang Usaha';
          if (lower.includes('piutang')) return 'Piutang Usaha';
          return clean;
        };

        const cleanJenis = cleanJenisStr(rawJenis);
        
        let derivedTipe = 'Masuk';
        if (cleanJenis === 'Biaya Produksi' || cleanJenis === 'Beban Usaha' || cleanJenis === 'Prive' || cleanJenis === 'Piutang Usaha') {
          derivedTipe = 'Keluar';
        }

        // Handle photo upload if present
        let finalFotoUrl = '';
        if (selectedPhotoFile) {
          try {
            console.log("Attempting photo upload for Buku Kas...");
            finalFotoUrl = await uploadBukuKasFotoToGAS(selectedPhotoFile.base64, selectedPhotoFile.name, selectedPhotoFile.mimeType);
            console.log("Photo upload success:", finalFotoUrl);
          } catch (uploadErr: any) {
            console.warn("Gagal mengupload foto ke GAS, menggunakan fallback base64 lokal:", uploadErr);
            finalFotoUrl = selectedPhotoFile.preview; // Fallback to local base64 preview with prefix so it's a valid renderable data URI
          }
        } else {
          // If editing and no new photo, keep the old one if it exists
          finalFotoUrl = finalFormData.foto || finalFormData.FOTO || finalFormData.bukti || finalFormData.BUKTI || finalFormData.BUKTI_NOTA || '';
        }

        const payload = {
          TANGGAL: finalFormData.tanggal || finalFormData.TANGGAL || getWITAString(),
          ID_CABANG: finalFormData.cabang || finalFormData.CABANG || finalFormData.ID_CABANG || defaultCabId,
          CABANG: finalFormData.cabang || finalFormData.CABANG || finalFormData.ID_CABANG || defaultCabId,
          JENIS_TRANSAKSI: cleanJenis,
          KATEGORI: cleanJenis,
          JENIS: cleanJenis,
          KETERANGAN: (finalFormData.keterangan || finalFormData.KETERANGAN || '').trim(),
          DEBIT: derivedTipe === 'Masuk' ? Number(finalFormData.nominal || 0) : 0,
          KREDIT: derivedTipe === 'Keluar' ? Number(finalFormData.nominal || 0) : 0,
          CASH: Number(finalFormData.cash || 0),
          TRANSFER: Number(finalFormData.transfer || 0),
          COMPLIMENT: Number(finalFormData.compliment || 0),
          TOTAL_CASH: Number(finalFormData.cash || 0),
          TOTAL_TRANSFER: Number(finalFormData.transfer || 0),
          TOTAL_COMPLIMENT: Number(finalFormData.compliment || 0),
          FOTO: finalFotoUrl,
          BUKTI: finalFotoUrl,
          BUKTI_NOTA: finalFotoUrl
        };

        console.log("Submitting Buku Kas payload:", payload);
        try {
          if (isEditing && finalFormData._id_or_original) {
            const originalMatch = {
              TANGGAL: originalEditData.tanggal || originalEditData.TANGGAL || '',
              CABANG: originalEditData.cabang || originalEditData.CABANG || '',
              KETERANGAN: originalEditData.keterangan || originalEditData.KETERANGAN || ''
            };
            await postUniversalDataToGAS('UPDATE_DATA_MATCH', 'Transaksi', null, null, { matchData: originalMatch, ...payload });
          } else {
            await postUniversalDataToGAS('INSERT_DATA', 'Transaksi', null, null, payload);
          }
          console.log("Buku Kas submission success");
        } catch (apiErr) {
          console.warn("Gagal sinkronisasi Buku Kas ke server, menyimpan secara lokal:", apiErr);
          // Proceed with local update anyway for flawless resilience
        }
        
        // Optimistic UI local store updates
        const newEntry = {
          tanggal: payload.TANGGAL,
          cabang: payload.ID_CABANG,
          jenis: payload.KATEGORI,
          keterangan: payload.KETERANGAN,
          debit: payload.DEBIT,
          kredit: payload.KREDIT,
          nominal: payload.DEBIT || payload.KREDIT,
          cash: payload.CASH,
          CASH: payload.CASH,
          total_cash: payload.CASH,
          TOTAL_CASH: payload.CASH,
          transfer: payload.TRANSFER,
          TRANSFER: payload.TRANSFER,
          total_transfer: payload.TRANSFER,
          TOTAL_TRANSFER: payload.TRANSFER,
          compliment: payload.COMPLIMENT,
          COMPLIMENT: payload.COMPLIMENT,
          total_compliment: payload.COMPLIMENT,
          TOTAL_COMPLIMENT: payload.COMPLIMENT,
          foto: payload.FOTO,
          FOTO: payload.FOTO,
          bukti: payload.FOTO,
          BUKTI_NOTA: payload.FOTO,
          bukti_nota: payload.FOTO,
          _original: {
            ...payload,
            _id_or_original: finalFormData._id_or_original
          }
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
          CABANG: finalFormData.CABANG || finalFormData.cabang || finalFormData.ID_CABANG || defaultCabId,
          cabang: finalFormData.cabang || finalFormData.CABANG || finalFormData.ID_CABANG || defaultCabId,
          TANGGAL: finalFormData.TANGGAL || finalFormData.tanggal || getWITAString() 
        };
        
        try {
          if (isEditing) {
             await postUniversalDataToGAS("UPDATE_DATA", "Data_Inventaris", idCol, idVal, finalData);
          } else {
             await postUniversalDataToGAS("INSERT_DATA", "Data_Inventaris", idCol, idVal, finalData);
          }
        } catch (apiErr) {
          console.warn("Gagal sinkronisasi Inventaris ke server, menyimpan secara lokal:", apiErr);
        }

        const updatedInv = isEditing 
          ? inventarisData.map((x:any) => x[idCol] === idVal ? finalData : x)
          : [finalData, ...inventarisData];
        setInventarisData(updatedInv);
        localStorage.setItem('cached_inventaris_data', JSON.stringify(updatedInv));

      } else if (showModal === 'shift') {
        const idCol = "ID_IZIN";
        const idVal = finalFormData[idCol];
        const defaultCabId = (master?.cabang && master.cabang.length > 0) ? master.cabang[0].ID_CABANG : '';
        const finalData = { 
          ...finalFormData, 
          CABANG: finalFormData.CABANG || finalFormData.cabang || finalFormData.ID_CABANG || defaultCabId,
          cabang: finalFormData.cabang || finalFormData.CABANG || finalFormData.ID_CABANG || defaultCabId,
          TANGGAL: finalFormData.TANGGAL || finalFormData.tanggal || getWITAString() 
        };
        
        try {
          if (isEditing) {
             await postUniversalDataToGAS("UPDATE_DATA", "Data_Izin_Shift", idCol, idVal, finalData);
          } else {
             await postUniversalDataToGAS("INSERT_DATA", "Data_Izin_Shift", idCol, idVal, finalData);
          }
        } catch (apiErr) {
          console.warn("Gagal sinkronisasi Shift ke server, menyimpan secara lokal:", apiErr);
        }

        const updatedShift = isEditing
          ? shiftData.map((x:any) => x[idCol] === idVal ? finalData : x)
          : [finalData, ...shiftData];
        setShiftData(updatedShift);
        localStorage.setItem('cached_shift_data', JSON.stringify(updatedShift));

      } else if (showModal) {
        // Master Data Form
        let sheetName = "";
        let idCol = "";
        if (showModal === 'cabang') { sheetName = 'Master_Cabang'; idCol = 'ID_CABANG'; }
        if (showModal === 'kategori') { sheetName = 'Master_Kategori'; idCol = 'ID_KATEGORI'; }
        if (showModal === 'menu') { sheetName = 'Master_Menu'; idCol = 'ID_MENU'; }
        if (showModal === 'varian') { sheetName = 'Master_Varian'; idCol = 'ID_VARIAN'; }
        if (showModal === 'promo') { sheetName = 'Master_Promo'; idCol = 'ID_PROMO'; }
        if (showModal === 'pegawai') { sheetName = 'Master_Pegawai'; idCol = 'ID_PEGAWAI'; }
        
        try {
          if (isEditing) {
             await postUniversalDataToGAS("UPDATE_DATA", sheetName, idCol, finalFormData[idCol], finalFormData);
          } else {
             await postUniversalDataToGAS("INSERT_DATA", sheetName, idCol, finalFormData[idCol], finalFormData);
          }
        } catch (apiErr) {
          console.warn(`Gagal sinkronisasi master ${sheetName} ke server, menyimpan secara lokal:`, apiErr);
        }
        
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
          if (showModal === 'promo') {
            if (!newData.promo) newData.promo = [];
            const idx = newData.promo.findIndex((p:any) => p.ID_PROMO === finalFormData.ID_PROMO);
            if (idx >= 0) newData.promo[idx] = finalFormData as Promo; else newData.promo.push(finalFormData as Promo);
          }
          if (showModal === 'pegawai') {
            if (!newData.pegawai) newData.pegawai = [];
            const idx = newData.pegawai.findIndex((p:any) => p.ID_PEGAWAI === finalFormData.ID_PEGAWAI);
            if (idx >= 0) newData.pegawai[idx] = finalFormData as any; else newData.pegawai.push(finalFormData as any);
          }
          await saveMasterData(newData);
          setMaster(newData);
          onRefreshPOSCatalog();
        }
      }

      showToastBanner(`Data ${moduleNameLabel} Berhasil ${isEditing ? 'Diperbarui' : 'Ditambahkan'}`);
      
      // Trigger background re-fetch for Buku Kas to replace local base64 with real Spreadsheet Drive links
      if (showModal === 'kas') {
        // Sync immediately and update current formData if it's the same item
        syncBukuKasFromGASHelper(false).then(() => {
          // If the user hasn't closed the modal yet, try to find the updated item
          setBukuKasList(prevList => {
            const updatedItem = prevList.find(it => {
              const itId = getItemId(it);
              return itId && itId === (formData.ID_TRANSAKSI || formData._id);
            });
            if (updatedItem && showModal === 'kas') {
              // We don't update formData directly to avoid flickering, but the list is updated
            }
            return prevList;
          });
        });
        
        // Second sync after a short delay to be absolutely sure Spreadsheet is updated
        setTimeout(() => syncBukuKasFromGASHelper(false), 3000);
      }

      setShowModal(null);
      setFormData({});
      setSelectedPhotoFile(null);
    } catch (err: any) {
      console.error("Submit Error:", err);
      showToastBanner("Gagal menyimpan: " + (err.message || "Kesalahan tidak diketahui"));
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
    onClick?: () => void;
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
      id: 'rekap_operasional', 
      label: 'Operasional', 
      icon: <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Lihat ringkasan operasional toko per hari',
      colorClass: 'bg-amber-50 border border-amber-100/80 hover:bg-amber-100 text-amber-950',
      iconColorClass: 'text-amber-700 bg-amber-100 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white',
      borderColorClass: '',
      onClick: onOpenRekapOperasional
    },
    { 
      id: 'cabang', 
      label: 'Cabang', 
      icon: <Building className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Pengaturan data outlet / cabang Aura Food',
      colorClass: 'bg-blue-50 border border-blue-100/80 hover:bg-blue-100 text-blue-950',
      iconColorClass: 'text-blue-700 bg-blue-100 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white',
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
    { 
      id: 'promo', 
      label: 'Promo & Diskon', 
      icon: <Tag className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Kelola promosi, paket harga tetap, dan persen diskon',
      colorClass: 'bg-rose-50 border border-rose-100/80 hover:bg-rose-100 text-rose-950',
      iconColorClass: 'text-rose-700 bg-rose-100 group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white',
      borderColorClass: ''
    },
    { 
      id: 'pegawai', 
      label: 'Staff Pegawai', 
      icon: <Users className="w-6 h-6 sm:w-7 sm:h-7" />, 
      desc: 'Kelola data master pegawai cabang Aura Food',
      colorClass: 'bg-teal-50 border border-teal-100/80 hover:bg-teal-100 text-teal-950',
      iconColorClass: 'text-teal-700 bg-teal-100 group-hover:scale-110 group-hover:bg-teal-500 group-hover:text-white',
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
    const cash = Number(rawK.cash || rawK.CASH || rawK.total_cash || rawK.TOTAL_CASH || rawK.Total_Cash || 0);
    const transfer = Number(rawK.transfer || rawK.TRANSFER || rawK.total_transfer || rawK.TOTAL_TRANSFER || rawK.Total_Transfer || 0);
    const compliment = Number(rawK.compliment || rawK.COMPLIMENT || rawK.total_compliment || rawK.TOTAL_COMPLIMENT || rawK.Total_Compliment || 0);
    const tipe = rawK.tipe || '';
    const isDebit = debit > 0 || String(tipe).toLowerCase() === 'masuk' || String(jenis).toLowerCase().includes('pemasukan') || String(jenis).toLowerCase().includes('usaha');
    const rawFoto = rawK.BUKTI_NOTA || rawK.bukti_nota || rawK.LINK_DRIVE || rawK.link_drive || rawK.FOTO || rawK.foto || rawK.bukti || rawK.BUKTI || '';
    const foto = (typeof rawFoto === 'string' && (rawFoto.startsWith('http://') || rawFoto.startsWith('https://') || rawFoto.startsWith('data:image/'))) ? rawFoto.trim() : '';
    
    return {
      tanggal,
      jenis,
      cabang,
      keterangan,
      debit,
      kredit,
      nominal,
      cash,
      transfer,
      compliment,
      isDebit,
      tipe,
      foto,
      _original: rawK
    };
  };

  const parseToDate = (cellValue: any): Date => {
    if (!cellValue) return new Date(0);
    if (cellValue instanceof Date) return cellValue;
    let str = String(cellValue).trim().substring(0, 10);
    if (str.includes('/')) {
      const p = str.split('/');
      if (p.length === 3) return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    }
    return new Date(cellValue);
  };

  // Filtering states mapping
  const filteredBukuKas = bukuKasList.map(parseKasItem).filter(item => {
    if (appliedAdminFilter.branch !== 'All' && String(item.cabang) !== appliedAdminFilter.branch) return false;
    if (appliedAdminFilter.sifat === 'Pemasukan' && !item.isDebit) return false;
    if (appliedAdminFilter.sifat === 'Pengeluaran' && item.isDebit) return false;
    if (appliedAdminFilter.date) {
      try {
        const itemDate = parseToDate(item.tanggal);
        const y = itemDate.getFullYear();
        const m = String(itemDate.getMonth() + 1).padStart(2, '0');
        const d = String(itemDate.getDate()).padStart(2, '0');
        if (`${y}-${m}-${d}` !== appliedAdminFilter.date) return false;
      } catch (e) { return false; }
    }
    const query = searchQuery.toLowerCase();
    return (
      (item.jenis || '').toLowerCase().includes(query) ||
      (item.keterangan || '').toLowerCase().includes(query) ||
      (item.cabang || '').toLowerCase().includes(query) ||
      String(item.nominal || item.debit || item.kredit || '').includes(query)
    );
  }).sort((a,b) => {
    const da = parseToDate(a.tanggal).getTime();
    const db = parseToDate(b.tanggal).getTime();
    return appliedAdminFilter.sortOrder === 'oldest' ? da - db : db - da;
  });

  const filteredCabang = (master?.cabang || []).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_CABANG || '').toLowerCase().includes(query) ||
      (item.LOKASI || '').toLowerCase().includes(query) ||
      (item.ID_CABANG || '').toLowerCase().includes(query)
    );
  }).sort((a, b) => {
    const aActive = String(a.STATUS || 'AKTIF').trim().toUpperCase() === 'AKTIF' ? 1 : 0;
    const bActive = String(b.STATUS || 'AKTIF').trim().toUpperCase() === 'AKTIF' ? 1 : 0;
    return bActive - aActive; // 1 (Active) comes before 0 (Inactive)
  });

  const filteredKategori = (master?.kategori || []).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_KATEGORI || '').toLowerCase().includes(query) ||
      (item.ID_KATEGORI || '').toLowerCase().includes(query)
    );
  });

  const filteredMenu = (master?.menu || []).filter(item => {
    if (appliedAdminFilter.category !== 'All' && String(item.ID_KATEGORI) !== appliedAdminFilter.category) return false;
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_MENU || '').toLowerCase().includes(query) ||
      (item.ID_MENU || '').toLowerCase().includes(query) ||
      (item.ID_KATEGORI || '').toLowerCase().includes(query)
    );
  });

  const filteredVarian = (master?.varian || []).filter(item => {
    if (appliedAdminFilter.menu !== 'All' && String(item.ID_MENU) !== appliedAdminFilter.menu) return false;
    if (appliedAdminFilter.statusFilter !== 'All' && String(item.STATUS).toLowerCase() !== appliedAdminFilter.statusFilter.toLowerCase()) return false;
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_VARIAN || '').toLowerCase().includes(query) ||
      (item.ID_VARIAN || '').toLowerCase().includes(query) ||
      (item.ID_MENU || '').toLowerCase().includes(query) ||
      (item.STATUS || '').toLowerCase().includes(query)
    );
  }).sort((a, b) => {
    const aActive = (a.STATUS === 'Tersedia' || String(a.STATUS || '').trim().toUpperCase() === 'AKTIF') ? 1 : 0;
    const bActive = (b.STATUS === 'Tersedia' || String(b.STATUS || '').trim().toUpperCase() === 'AKTIF') ? 1 : 0;
    return bActive - aActive;
  });

  const filteredInventaris = (Array.isArray(inventarisData) ? inventarisData : []).filter(item => {
    if (appliedAdminFilter.branch !== 'All' && String(item.CABANG || item.ID_CABANG) !== appliedAdminFilter.branch) return false;
    if (appliedAdminFilter.date) {
      try {
        const itemDate = parseToDate(item.TANGGAL || item.tanggal);
        const y = itemDate.getFullYear();
        const m = String(itemDate.getMonth() + 1).padStart(2, '0');
        const d = String(itemDate.getDate()).padStart(2, '0');
        if (`${y}-${m}-${d}` !== appliedAdminFilter.date) return false;
      } catch (e) { return false; }
    }
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_BARANG || '').toLowerCase().includes(query) ||
      (item.KETERANGAN || '').toLowerCase().includes(query) ||
      (item.PIC || '').toLowerCase().includes(query)
    );
  }).sort((a,b) => {
    const da = parseToDate(a.TANGGAL || a.tanggal).getTime();
    const db = parseToDate(b.TANGGAL || b.tanggal).getTime();
    return appliedAdminFilter.sortOrder === 'oldest' ? da - db : db - da;
  });

  const filteredShift = (Array.isArray(shiftData) ? shiftData : []).filter(item => {
    if (appliedAdminFilter.branch !== 'All' && String(item.CABANG || item.ID_CABANG) !== appliedAdminFilter.branch) return false;
    if (appliedAdminFilter.date) {
      try {
        const itemDate = parseToDate(item.TANGGAL || item.tanggal);
        const y = itemDate.getFullYear();
        const m = String(itemDate.getMonth() + 1).padStart(2, '0');
        const d = String(itemDate.getDate()).padStart(2, '0');
        if (`${y}-${m}-${d}` !== appliedAdminFilter.date) return false;
      } catch (e) { return false; }
    }
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_STAFF || '').toLowerCase().includes(query) ||
      (item.ALASAN || '').toLowerCase().includes(query) ||
      (item.PENGGANTI || '').toLowerCase().includes(query)
    );
  }).sort((a,b) => {
    const da = parseToDate(a.TANGGAL || a.tanggal).getTime();
    const db = parseToDate(b.TANGGAL || b.tanggal).getTime();
    return appliedAdminFilter.sortOrder === 'oldest' ? da - db : db - da;
  });

  const filteredPromo = (master?.promo || []).filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_PROMO || '').toLowerCase().includes(query) ||
      (item.ID_PROMO || '').toLowerCase().includes(query) ||
      (item.TIPE || '').toLowerCase().includes(query) ||
      (item.TARGET_ITEM || '').toLowerCase().includes(query)
    );
  });

  const filteredPegawai = (master?.pegawai || []).filter(item => {
    if (appliedAdminFilter.branch !== 'All' && String(item.ID_CABANG) !== appliedAdminFilter.branch) return false;
    const query = searchQuery.toLowerCase();
    return (
      (item.NAMA_PEGAWAI || '').toLowerCase().includes(query) ||
      (item.ID_PEGAWAI || '').toLowerCase().includes(query) ||
      (item.KONTAK || '').toLowerCase().includes(query)
    );
  });

  const activeFilterCount = (appliedAdminFilter.branch !== 'All' ? 1 : 0) + 
                            (appliedAdminFilter.category !== 'All' ? 1 : 0) +
                            (appliedAdminFilter.sortOrder !== 'newest' ? 1 : 0) +
                            (appliedAdminFilter.date ? 1 : 0) +
                            (appliedAdminFilter.sifat !== 'All' ? 1 : 0) +
                            (appliedAdminFilter.menu !== 'All' ? 1 : 0) +
                            (appliedAdminFilter.statusFilter !== 'All' ? 1 : 0);

  let filteredListLength = 0;
  let originalListLength = 0;
  if (activeModule === 'kas') { filteredListLength = filteredBukuKas.length; originalListLength = bukuKasList.length; }
  else if (activeModule === 'cabang') { filteredListLength = filteredCabang.length; originalListLength = master?.cabang?.length || 0; }
  else if (activeModule === 'kategori') { filteredListLength = filteredKategori.length; originalListLength = master?.kategori?.length || 0; }
  else if (activeModule === 'menu') { filteredListLength = filteredMenu.length; originalListLength = master?.menu?.length || 0; }
  else if (activeModule === 'varian') { filteredListLength = filteredVarian.length; originalListLength = master?.varian?.length || 0; }
  else if (activeModule === 'promo') { filteredListLength = filteredPromo.length; originalListLength = master?.promo?.length || 0; }
  else if (activeModule === 'inventaris') { filteredListLength = filteredInventaris.length; originalListLength = inventarisData.length; }
  else if (activeModule === 'shift') { filteredListLength = filteredShift.length; originalListLength = shiftData.length; }
  else if (activeModule === 'pegawai') { filteredListLength = filteredPegawai.length; originalListLength = master?.pegawai?.length || 0; }

  return (
    <SelectionContext.Provider value={{ selectedIds, isSelectionMode, toggleSelection, handleEditItem, getItemId }}>
      {isLoadingPanel && (
        <div style={{ zIndex: 1000001 }} className="fixed inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="flex flex-col items-center gap-4">
              <div className="relative h-16 w-16">
                 <div className="absolute inset-0 rounded-full border-4 border-red-100"></div>
                 <div className="absolute inset-0 rounded-full border-4 border-red-600 border-t-transparent animate-spin"></div>
                 <Loader className="absolute inset-0 m-auto h-6 w-6 text-red-600 animate-pulse" />
              </div>
              <div className="text-center space-y-1">
                 <p className="text-sm font-black text-zinc-900 uppercase tracking-widest animate-pulse">Menyiapkan Panel Admin</p>
                 <p className="text-[10px] text-zinc-500 font-medium">Sinkronisasi data dengan sistem pusat...</p>
              </div>
           </div>
        </div>
      )}
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
                    <h3 className="text-xs sm:text-base font-black text-zinc-900 uppercase tracking-widest leading-none">
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
                  onClick={() => {
                    if (m.onClick) m.onClick();
                    else openModule(m.id);
                  }}
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
                      disabled={isUniversalLoading}
                      onClick={() => {
                        if (isSelectionMode) {
                          setSelectedIds([]);
                        } else {
                          setActiveModule(null);
                        }
                      }} 
                      className={`p-2.5 rounded-xl transition cursor-pointer active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${isSelectionMode ? 'bg-red-50 text-red-650 hover:bg-red-100' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650'}`}
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
                         disabled={isUniversalLoading}
                         onClick={handleDeleteSelected}
                         className="p-2.5 bg-red-100/90 hover:bg-red-200 rounded-xl text-red-700 transition cursor-pointer active:scale-95 shrink-0 animate-in fade-in zoom-in-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                         {(activeModule === 'kas' || activeModule === 'inventaris' || activeModule === 'shift' || activeModule === 'menu' || activeModule === 'varian') && (
                           <button 
                             className="p-2.5 rounded-xl transition relative cursor-pointer active:scale-95 shrink-0 bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                             onClick={() => {
                               setTempAdminFilter(appliedAdminFilter);
                               setShowFilterModal(true);
                             }}
                           >
                             <Filter className="h-4 w-4" />
                             {activeFilterCount > 0 && (
                               <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-700 text-white flex items-center justify-center rounded-full text-[9px] font-black pointer-events-none">
                                 {activeFilterCount}
                               </span>
                             )}
                           </button>
                         )}
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
              
              {isUniversalLoading ? (
                <div className="max-w-4xl mx-auto py-20 text-center text-zinc-500 bg-white rounded-[32px] border border-zinc-200 shadow-sm flex flex-col items-center justify-center gap-3 animate-pulse">
                  <RefreshCw className="h-6 w-6 text-red-650 animate-spin" />
                  <p className="text-sm font-medium text-zinc-600">Memuat data dari sistem pusat...</p>
                </div>
              ) : originalListLength > 0 && filteredListLength === 0 ? (
                <div className="max-w-4xl mx-auto py-16">
                  <div className="flex items-center justify-center flex-col text-zinc-400 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                    <Search className="h-12 w-12 mb-4 opacity-70 text-zinc-300" />
                    <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Tidak Ditemukan</p>
                    <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Tidak ada hasil yang sesuai dengan filter pencarian Anda.</p>
                    <button 
                      onClick={() => {
                        setIsSearchActive(false);
                        setSearchQuery('');
                        setAppliedAdminFilter(getDefaultAdminFilterState());
                      }}
                      className="bg-zinc-50 text-zinc-600 hover:bg-zinc-100 font-black text-[10px] px-6 py-3 rounded-xl transition flex items-center gap-2 active:scale-95 uppercase tracking-widest cursor-pointer mt-4 border border-zinc-200"
                    >
                      <Trash2 className="h-4 w-4 text-red-700" /> Reset Filter
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
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada catatan transaksi manual. Riwayat dari sistem pusat dapat dilihat di Laporan.</p>
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
                                <h5 className="text-[13px] font-black text-zinc-900 truncate tracking-tight">
                                  {k.keterangan}
                                </h5>
                                <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap ml-2">
                                  {formatDateString(k.tanggal)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <div className="text-[11px] text-zinc-500 font-semibold truncate pr-3 flex items-center gap-1.5 min-w-0">
                                  <span className="bg-zinc-100 text-zinc-650 text-[8.5px] px-1.5 py-0.5 rounded font-black border border-zinc-200/50 uppercase shrink-0">
                                    {getCabangName(k.cabang)}
                                  </span>
                                  <span className="truncate">{k.jenis}</span>
                                </div>
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
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada data cabang yang terdaftar di sistem pusat.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredCabang.map((c, i) => {
                        const isInactive = String(c.STATUS || 'AKTIF').trim().toUpperCase() === 'TIDAK AKTIF';
                        return (
                          <SelectableCard key={i} item={c} className={isInactive ? "opacity-50 grayscale" : ""}>
                            <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${isInactive ? 'bg-zinc-100 text-zinc-500' : 'bg-blue-50 text-blue-700'}`}>
                              <Building className="h-5.5 w-5.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h5 className="text-[13px] font-black text-zinc-900 truncate tracking-widest leading-none text-left">
                                  {c.NAMA_CABANG}
                                  {isInactive && <span className="ml-2 text-[10px] bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded font-black">NONAKTIF</span>}
                                </h5>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-[11px] text-zinc-500 font-semibold truncate pr-3 flex items-center gap-1">
                                  <MapPin className={`h-3 w-3 shrink-0 inline ${isInactive ? 'text-zinc-400' : 'text-blue-500'}`} /> <span className="truncate">{c.LOKASI}</span>
                                </p>
                                {c.KONTAK && (
                                  <span className="text-[9px] font-black text-zinc-500 bg-zinc-55 border border-zinc-105 px-1.5 py-0.5 rounded self-center shrink-0">
                                    WA: {c.KONTAK}
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectableCard>
                        );
                      })}
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
                              <h5 className="text-[13px] font-black text-zinc-900 truncate tracking-widest leading-none text-left">
                                {k.NAMA_KATEGORI}
                              </h5>
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
                              <h5 className="text-[13px] font-black text-zinc-900 truncate tracking-tight leading-none text-left">
                                {m.NAMA_MENU}
                              </h5>
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
                      {filteredVarian.map((v, i) => {
                        const isInactive = v.STATUS !== 'Tersedia' && String(v.STATUS || '').trim().toUpperCase() !== 'AKTIF';
                        return (
                          <SelectableCard key={i} item={v} className={isInactive ? "opacity-50 grayscale" : ""}>
                            <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${isInactive ? 'bg-zinc-100 text-zinc-500' : 'bg-orange-50 text-orange-700'}`}>
                              <Layers className="h-5.5 w-5.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h5 className="text-[13px] font-black text-zinc-900 truncate tracking-wider leading-none text-left">
                                  {v.NAMA_VARIAN}
                                </h5>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <div className="text-[11px] text-zinc-500 font-semibold truncate flex items-center gap-1.5 min-w-0">
                                  <span className="truncate">Menu: {getMenuName(v.ID_MENU)}</span>
                                  <span className="opacity-40">&bull;</span>
                                  <span className={`px-1.5 py-0.2 rounded font-black uppercase text-[8px] self-center shrink-0 ${!isInactive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                    {!isInactive ? 'Tersedia' : 'Tidak Tersedia'}
                                  </span>
                                </div>
                                <span className={`text-xs sm:text-sm font-black self-center shrink-0 ml-2 ${isInactive ? 'text-zinc-500' : 'text-red-850'}`}>
                                  Rp{Number(v.HARGA).toLocaleString('id-ID')}
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

              {activeModule === 'promo' && master && (
                <div className="max-w-4xl mx-auto">
                  {filteredPromo.length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <Tag className="h-14 w-14 mb-4 opacity-70 text-rose-350 animate-pulse" />
                      <p className="text-sm font-black text-rose-700 uppercase tracking-widest">Promo Kosong</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada promo aktif atau diskon khusus terdaftar untuk menu Anda.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredPromo.map((p, i) => {
                        const startDateStr = p.PERIODE ? p.PERIODE.split(' - ')[0] : '-';
                        const endDateStr = p.PERIODE ? p.PERIODE.split(' - ')[1] : '-';
                        
                        return (
                          <SelectableCard key={i} item={p}>
                            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 shadow-sm border border-rose-100">
                              <Tag className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h5 className="text-sm font-black text-zinc-900 truncate tracking-tight leading-none text-left flex items-center gap-2">
                                    {p.NAMA_PROMO}
                                    {p.JENIS_PROMO === 'PER_PESANAN' && (
                                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider border border-blue-100">Pesanan</span>
                                    )}
                                  </h5>
                                  <div className="flex flex-col gap-1 mt-2">
                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold">
                                      <Calendar className="h-3 w-3 text-zinc-400" />
                                      <span>{startDateStr} s/d {endDateStr}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold">
                                      <ShoppingBag className="h-3 w-3 text-zinc-400" />
                                      <span>Min. {p.SYARAT_QTY} item</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-base sm:text-lg font-black text-rose-650 leading-none">
                                    {p.TIPE === 'DISKON_PERSEN' ? `${p.NILAI_PROMO}%` : `-Rp${Number(p.NILAI_PROMO).toLocaleString('id-ID')}`}
                                  </div>
                                  <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                                    {p.TIPE === 'DISKON_PERSEN' ? 'Diskon Persen' : 'Potongan Harga'}
                                  </div>
                                </div>
                              </div>
                              
                              {p.JENIS_PROMO === 'PER_MENU' && (
                                <div className="mt-3 pt-3 border-t border-zinc-50 flex gap-1.5 items-baseline flex-wrap">
                                  <span className="text-[10px] font-black text-zinc-400 uppercase shrink-0">Target:</span>
                                  <span className="text-[10px] font-bold text-zinc-600 line-clamp-1">
                                    {p.TARGET_ITEM ? String(p.TARGET_ITEM).split('|').map(getVariantDisplayLabel).join(', ') : '-'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </SelectableCard>
                        );
                      })}
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
                                <h5 className="text-[13px] font-black text-zinc-900 truncate tracking-widest leading-none">
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
                          <div className="flex-1 min-w-0 text-left">
                             <div className="flex items-start justify-between gap-2">
                                <h5 className="text-[13px] font-black text-zinc-900 truncate tracking-widest leading-none">
                                   {item.NAMA_STAFF || getPegawaiName(item.ID_PEGAWAI)}
                                 </h5>
                                 <span className="bg-zinc-100 text-zinc-650 text-[8.5px] px-1.5 py-0.5 rounded font-black border border-zinc-200/50 uppercase shrink-0">
                                   {getCabangName(item.CABANG || item.ID_CABANG)}
                                 </span>
                             </div>
                             <div className="flex items-center justify-between mt-1">
                                <p className="text-[11px] text-zinc-500 font-semibold truncate flex items-center gap-1 text-left">
                                  <span className="truncate">Alasan: {item.ALASAN}</span>
                                </p>
                                <span className="text-[10px] text-zinc-400 font-bold whitespace-nowrap ml-2">
                                  {formatDateString(item.TANGGAL || item.tanggal)}
                                </span>
                             </div>
                             {(item.PENGGANTI || item.ID_PENGGANTI) && (
                                <div className="mt-1 text-left">
                                  <span className="bg-amber-50 text-amber-700 text-[9px] font-black border border-amber-100 px-1.5 py-0.5 rounded uppercase">Pengganti: {item.PENGGANTI || getPegawaiName(item.ID_PENGGANTI)}</span>
                                </div>
                             )}
                          </div>
                        </SelectableCard>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModule === 'pegawai' && master && (
                <div className="max-w-4xl mx-auto">
                  {(master.pegawai || []).length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <Users className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                      <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Pegawai Kosong</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Belum ada catatan master pegawai terdaftar. Tambahkan baru dengan tombol + di bawah.</p>
                    </div>
                  ) : filteredPegawai.length === 0 ? (
                    <div className="flex items-center justify-center flex-col text-zinc-400 py-20 text-center bg-white rounded-[32px] border border-zinc-200 border-dashed p-8 shadow-sm">
                      <Search className="h-14 w-14 mb-4 opacity-70 text-zinc-300" />
                      <p className="text-sm font-black text-zinc-700 uppercase tracking-widest">Pencarian Tidak Ditemukan</p>
                      <p className="text-xs text-zinc-400 mt-2 max-w-xs font-medium leading-relaxed">Tidak ada pegawai yang cocok dengan kata kunci pencarian Anda.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3.5">
                      {filteredPegawai.map((item, i) => (
                        <SelectableCard key={i} item={item}>
                          <div className="h-11 w-11 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                            <Users className="h-5.5 w-5.5" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                             <div className="flex items-start justify-between gap-2">
                                <h5 className="text-[13px] font-black text-zinc-900 truncate tracking-widest leading-none">
                                   {item.NAMA_PEGAWAI}
                                </h5>
                                <span className="bg-zinc-100 text-zinc-650 text-[8.5px] px-1.5 py-0.5 rounded font-black border border-zinc-200/50 uppercase shrink-0">
                                  {getCabangName(item.ID_CABANG)}
                                </span>
                             </div>
                             <div className="flex items-center justify-between mt-1">
                                <p className="text-[11px] text-zinc-500 font-semibold truncate text-left">
                                  Kontak: {item.KONTAK || 'Tidak ada kontak'}
                                </p>
                             </div>
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
          <div className="bg-white bottom-0 fixed sm:relative w-full max-w-lg sm:rounded-[32px] rounded-t-[24px] shadow-2xl flex flex-col h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[95vh] animate-in slide-in-from-bottom-32 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 ease-out">
            {isSubmitting && (
              <div className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-[3px] flex flex-col items-center justify-center animate-in fade-in rounded-t-[24px] sm:rounded-[32px]">
                <div className="bg-white px-6 py-5 rounded-2xl shadow-xl border border-zinc-100 flex flex-col items-center max-w-[240px]">
                  <RefreshCw className="h-9 w-9 text-red-650 animate-spin mb-3" />
                  <span className="text-[11px] font-black text-zinc-900 uppercase tracking-widest text-center animate-pulse">Sedang Menyimpan...</span>
                  <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider text-center mt-1">Harap Tunggu</span>
                </div>
              </div>
            )}

            <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <h3 className="font-black text-zinc-900 uppercase tracking-widest text-lg">
                {getIsEditing() ? 'Edit' : 'Tambah'} {
                  showModal === 'kas' ? 'Buku Arus Kas' : 
                  showModal === 'shift' ? 'Izin Shift' : 
                  showModal === 'inventaris' ? 'Stok Logistik' : 
                  showModal
                }
              </h3>
              <button onClick={handleCloseModal} className="h-8 w-8 bg-zinc-100 hover:bg-zinc-200 rounded-full flex items-center justify-center text-zinc-500 transition cursor-pointer active:scale-90">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto w-full relative flex-1">
              <form id="admin-form" onSubmit={handleSubmit} className="space-y-4">
                <fieldset className="space-y-4 w-full" disabled={isSubmitting}>
                
                {/* INVENTARIS FORM */}
                {showModal === 'inventaris' && (
                  <>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Tanggal</label>
                      <input type="date" value={formData.tanggal ? formData.tanggal.split('T')[0] : (formData.TANGGAL ? formData.TANGGAL.split('T')[0] : '')} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, tanggal: e.target.value, TANGGAL: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Cabang</label>
                      <CustomSelect 
                        required
                        className="w-full"
                        textSizeClass="text-sm"
                        placeholder="-- Pilih Cabang --"
                        value={formData.cabang || formData.CABANG || formData.ID_CABANG || ''}
                        onChange={val => setFormData({...formData, cabang: val, CABANG: val})}
                        options={master?.cabang?.filter(c => c.STATUS === 'AKTIF').map(c => ({ value: c.ID_CABANG, label: c.NAMA_CABANG })) || []}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Barang</label>
                      <input type="text" placeholder="Gelas Plastik / Ayam Potong" value={formData.NAMA_BARANG || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, NAMA_BARANG: e.target.value})}/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Jenis (Masuk/Keluar)</label>
                        <CustomSelect 
                          required 
                          className="w-full"
                          textSizeClass="text-sm"
                          value={formData.JENIS || ''}
                          onChange={(val) => setFormData({...formData, JENIS: val})}
                          placeholder="-- Pilih Jenis --"
                          options={[{ value: 'MASUK', label: 'Masuk' }, { value: 'KELUAR', label: 'Keluar' }]}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Jumlah</label>
                        <input 
                          type="text"
                          inputMode="numeric"
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
                      <CustomSelect 
                        required
                        className="w-full"
                        textSizeClass="text-sm"
                        placeholder="-- Pilih Staff --"
                        value={formData.PIC || ''}
                        onChange={val => {
                           const pObj = (master?.pegawai || []).find(x => x.ID_PEGAWAI === val || x.NAMA_PEGAWAI === val);
                           setFormData({...formData, PIC: pObj ? pObj.NAMA_PEGAWAI : val});
                        }}
                        options={(master?.pegawai || [])
                          .filter(p => {
                            const selectedCab = formData.cabang || formData.CABANG || '';
                            return !selectedCab || String(p.ID_CABANG).trim().toLowerCase() === String(selectedCab).trim().toLowerCase();
                          })
                          .map(p => ({ value: p.NAMA_PEGAWAI, label: p.NAMA_PEGAWAI }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Keterangan Lengkap</label>
                      <div className="relative">
                        <textarea 
                          rows={3} 
                          placeholder="Sebutkan detail, keperluan, atau deskripsi logistik..." 
                          value={formData.KETERANGAN || ''} 
                          onFocus={() => setShowKeteranganSuggestions(true)}
                          onBlur={() => {
                            setTimeout(() => setShowKeteranganSuggestions(false), 200);
                          }}
                          className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" 
                          onChange={e => setFormData({...formData, KETERANGAN: e.target.value})}
                        ></textarea>
                        {showKeteranganSuggestions && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-2xl shadow-xl z-[1000] max-h-48 overflow-y-auto divide-y divide-zinc-100">
                            {(formData.JENIS === 'MASUK' ? [
                              "Pemasukan dari penjualan tunai harian",
                              "Penerimaan setoran modal awal dari sistem pusat",
                              "Pengembalian dana sisa belanja bahan baku operasional",
                              "Penerimaan dana kompensasi / subsidi operasional",
                              "Pemasukan dari kerja sama promosi / sponsorship lokal"
                            ] : [
                              "Belanja kebutuhan bahan baku dapur harian",
                              "Pembayaran iuran listrik token outlet bulanan",
                              "Uang makan staff pegawai dan operasional lapangan",
                              "Pengadaan peralatan memasak dan perlengkapan inventaris baru",
                              "Biaya perbaikan kerusakan mesin pres gelas atau kompor",
                              "Biaya transportasi/kurir pengantaran logistik darurat",
                              "Biaya tak terduga penunjang kebersihan dan keamanan outlet"
                            ]).map((text, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onMouseDown={() => {
                                  setFormData({...formData, KETERANGAN: text});
                                  setShowKeteranganSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-3 text-xs font-black text-red-950 uppercase hover:bg-zinc-50 active:bg-zinc-100 transition cursor-pointer"
                              >
                                {text}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* SHIFT STAFF FORM */}
                {showModal === 'shift' && (
                  <>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Tanggal Izin</label>
                      <input type="date" value={formData.tanggal ? formData.tanggal.split('T')[0] : (formData.TANGGAL ? formData.TANGGAL.split('T')[0] : '')} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, tanggal: e.target.value, TANGGAL: e.target.value})}/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Cabang</label>
                      <CustomSelect 
                        required
                        className="w-full"
                        textSizeClass="text-sm"
                        placeholder="-- Pilih Cabang --"
                        value={formData.cabang || formData.CABANG || formData.ID_CABANG || ''}
                        onChange={val => setFormData({...formData, cabang: val, CABANG: val})}
                        options={master?.cabang?.filter(c => c.STATUS === 'AKTIF').map(c => ({ value: c.ID_CABANG, label: c.NAMA_CABANG })) || []}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Staff</label>
                        <CustomSelect 
                          required
                          className="w-full"
                          textSizeClass="text-sm"
                          placeholder="-- Pilih Staff --"
                          value={formData.ID_PEGAWAI || ''}
                          onChange={val => {
                             const pObj = (master?.pegawai || []).find(x => x.ID_PEGAWAI === val);
                             setFormData({
                               ...formData,
                               ID_PEGAWAI: val,
                               NAMA_STAFF: pObj ? pObj.NAMA_PEGAWAI : ''
                             });
                          }}
                          options={(master?.pegawai || [])
                            .filter(p => {
                              const selectedCab = formData.cabang || formData.CABANG || '';
                              return !selectedCab || String(p.ID_CABANG).trim().toLowerCase() === String(selectedCab).trim().toLowerCase();
                            })
                            .map(p => ({ value: p.ID_PEGAWAI, label: p.NAMA_PEGAWAI }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Staff Pengganti</label>
                        <CustomSelect 
                          className="w-full"
                          textSizeClass="text-sm"
                          placeholder="-- Pilih Staff --"
                          value={formData.ID_PENGGANTI || ''}
                          onChange={val => setFormData({...formData, ID_PENGGANTI: val})}
                          options={(master?.pegawai || [])
                            .filter(p => {
                              const selectedCab = formData.cabang || formData.CABANG || '';
                              return !selectedCab || String(p.ID_CABANG).trim().toLowerCase() === String(selectedCab).trim().toLowerCase();
                            })
                            .map(p => ({ value: p.ID_PEGAWAI, label: p.NAMA_PEGAWAI }))
                          }
                        />
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
                          max={getWITAString().split('T')[0]}
                          value={formData.tanggal ? formData.tanggal.split('T')[0] : (formData.TANGGAL ? formData.TANGGAL.split('T')[0] : '')} required className="w-full text-sm font-bold bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-zinc-400 focus:bg-white transition-all"
                          onChange={e => setFormData({...formData, tanggal: e.target.value, TANGGAL: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5">Cabang</label>
                        <CustomSelect
                            required 
                            className="w-full"
                            value={formData.cabang || formData.CABANG || formData.ID_CABANG || ''}
                            onChange={(val) => setFormData({...formData, cabang: val, CABANG: val})}
                            placeholder="-- Pilih Cabang --"
                            options={master?.cabang?.filter(c => c.STATUS === 'AKTIF').map(c => ({ value: c.ID_CABANG, label: c.NAMA_CABANG })) || []}
                          />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5">Jenis Transaksi (Kategori)</label>
                      <CustomSelect 
                        required 
                        className="w-full"
                        textSizeClass="text-sm"
                        placeholder="-- Pilih Jenis Transaksi --"
                        value={formData.jenis || formData.JENIS || 'Pendapatan Usaha'} 
                        onChange={(val) => {
                          let matchedTipe = 'Masuk';
                          if (val === 'Biaya Produksi' || val === 'Beban Usaha' || val === 'Prive' || val === 'Piutang Usaha') {
                            matchedTipe = 'Keluar';
                          }
                          setFormData({
                            ...formData,
                            jenis: val,
                            JENIS: val,
                            tipe: matchedTipe
                          });
                        }}
                        options={[
                          { value: 'Pendapatan Usaha', label: 'Pendapatan Usaha' },
                          { value: 'Biaya Produksi', label: 'Pengeluaran Bahan Baku' },
                          { value: 'Beban Usaha', label: 'Beban Usaha' },
                          { value: 'Prive', label: 'Prive' },
                          { value: 'Utang Usaha', label: 'Utang Usaha' },
                          { value: 'Piutang Usaha', label: 'Piutang Usaha' }
                        ]}
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5">Keterangan Tambahan</label>
                      <input 
                        type="text" 
                        placeholder="Detail transaksi..." 
                        value={formData.keterangan || formData.KETERANGAN || ''} 
                        className="w-full text-xs font-bold bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 outline-none focus:border-zinc-400 focus:bg-white transition-all"
                        onFocus={() => setShowKasSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowKasSuggestions(false), 200)}
                        autoCapitalize="none"
                        autoCorrect="off"
                        onChange={e => setFormData({...formData, keterangan: e.target.value, KETERANGAN: e.target.value})} 
                      />
                      {showKasSuggestions && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-2xl shadow-xl z-[1000] max-h-40 overflow-y-auto divide-y divide-zinc-100">
                          {(() => {
                            const jenis = formData.jenis || formData.JENIS || 'Pendapatan Usaha';
                            let suggestions: string[] = [];
                            if (jenis === 'Pendapatan Usaha') suggestions = ['Pendapatan Harian Usaha'];
                            if (jenis === 'Biaya Produksi') suggestions = ['Pengeluaran Biaya Bahan Baku'];
                            if (jenis === 'Beban Usaha') suggestions = ['Beban Operasional'];
                            if (jenis === 'Prive') suggestions = ['Pengambilan Dana Pribadi'];
                            if (jenis === 'Utang Usaha') suggestions = ['Utang Harian Usaha'];
                            if (jenis === 'Piutang Usaha') suggestions = ['Piutang Harian Usaha'];

                            return suggestions.map((sg, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onMouseDown={() => {
                                  setFormData({...formData, keterangan: sg, KETERANGAN: sg});
                                  setShowKasSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-3 text-xs font-black text-red-950 hover:bg-zinc-50 active:bg-zinc-100 transition cursor-pointer"
                              >
                                {sg}
                              </button>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 font-bold">Total Cash</label>
                        <div className="relative rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden focus-within:border-zinc-400 focus-within:bg-white transition-all">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-zinc-400 font-extrabold text-sm">Rp</span>
                          </div>
                          <input 
                            type="text" 
                            inputMode="numeric"
                            placeholder="0" 
                            value={formatRupiahInput(formData.cash || '')} 
                            className="w-full pl-9 pr-3 py-3 bg-transparent text-sm font-bold text-zinc-900 outline-none" 
                            onChange={e => {
                              const parsedVal = parseRupiahInput(e.target.value);
                              const currentTransfer = Number(formData.transfer || 0);
                              setFormData({...formData, cash: parsedVal, nominal: parsedVal + currentTransfer, compliment: 0});
                            }} 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 font-bold">Total Transfer</label>
                        <div className="relative rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden focus-within:border-zinc-400 focus-within:bg-white transition-all">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-zinc-400 font-extrabold text-sm">Rp</span>
                          </div>
                          <input 
                            type="text" 
                            inputMode="numeric"
                            placeholder="0" 
                            value={formatRupiahInput(formData.transfer || '')} 
                            className="w-full pl-9 pr-3 py-3 bg-transparent text-sm font-bold text-zinc-900 outline-none" 
                            onChange={e => {
                              const parsedVal = parseRupiahInput(e.target.value);
                              const currentCash = Number(formData.cash || 0);
                              setFormData({...formData, transfer: parsedVal, nominal: currentCash + parsedVal, compliment: 0});
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 font-bold">Total Nominal (Otomatis)</label>
                      <div className="relative rounded-xl border border-zinc-200 bg-zinc-100 overflow-hidden">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-zinc-400 font-extrabold text-sm">Rp</span>
                        </div>
                        <input 
                          type="text" 
                          readOnly
                          value={formatRupiahInput(formData.nominal || formData.DEBIT || formData.KREDIT || '')} 
                          className="w-full pl-11 pr-4 py-3 bg-transparent text-xl font-black text-zinc-600 tracking-tight outline-none select-none" 
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-zinc-200 mt-4">
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 font-bold">Bukti Nota (Hanya Foto)</label>
                      
                      {/* 1. Existing Photo in Database */}
                      {(formData.foto || formData.FOTO || formData.bukti || formData.BUKTI) && !selectedPhotoFile ? (
                        <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center gap-3">
                          <ImageWithFallback 
                            src={formData.foto || formData.FOTO || formData.bukti || formData.BUKTI} 
                            alt="Bukti Nota" 
                            className="h-14 w-14 object-cover rounded-lg border border-zinc-200 bg-white"
                            fallbackClassName="h-14 w-14 rounded-lg border border-red-100 bg-red-50 flex flex-col items-center justify-center text-red-500 shrink-0"
                          />
                          <div className="flex-1 min-w-0 text-left">
                            <span className="block text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">Foto Tersimpan</span>
                            <a 
                              href={formData.foto || formData.FOTO || formData.bukti || formData.BUKTI} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-xs font-bold text-red-700 hover:underline truncate block text-left"
                            >
                              Buka Foto Penuh ↗
                            </a>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                foto: '',
                                FOTO: '',
                                bukti: '',
                                BUKTI: ''
                              });
                            }}
                            className="p-2 text-zinc-400 hover:text-red-700 bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 rounded-lg transition active:scale-90 cursor-pointer animate-in fade-in"
                            title="Hapus Foto"
                          >
                            <Trash2 className="h-4 w-4 text-zinc-500 hover:text-red-700" />
                          </button>
                        </div>
                      ) : selectedPhotoFile ? (
                        /* 2. New Photo Selected Locally */
                        <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center gap-3 animate-in zoom-in-95 duration-200">
                          <img 
                            src={selectedPhotoFile.preview} 
                            alt="Pratinjau Foto" 
                            className="h-14 w-14 object-cover rounded-lg border border-zinc-200 bg-white"
                          />
                          <div className="flex-1 min-w-0 text-left">
                            <span className="block text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider animate-pulse">Foto Baru Terpilih</span>
                            <span className="text-xs font-bold text-zinc-700 truncate block text-left">{selectedPhotoFile.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotoFile(null);
                              setPhotoError('');
                            }}
                            className="p-2 text-zinc-400 hover:text-red-700 bg-white hover:bg-red-50 border border-zinc-200 hover:border-red-200 rounded-lg transition active:scale-90 cursor-pointer"
                            title="Batalkan Pilihan"
                          >
                            <X className="h-4 w-4 text-zinc-500 hover:text-red-700" />
                          </button>
                        </div>
                      ) : (
                        /* 3. Drag and Drop / Select File Zone */
                        <div className="animate-in fade-in">
                          <div
                            onDragOver={e => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              const files = e.dataTransfer.files;
                              if (files && files.length > 0) {
                                handlePhotoSelect(files[0]);
                              }
                            }}
                            onClick={() => {
                              document.getElementById('photo-file-input')?.click();
                            }}
                            className="border-2 border-dashed border-zinc-300 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
                          >
                            <Camera className="h-6 w-6 text-zinc-400" />
                            <div>
                              <span className="text-xs font-bold text-zinc-700 block">Pilih atau Tarik Foto Bukti</span>
                              <span className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider block">Format: JPG / PNG (Maks 5MB)</span>
                            </div>
                          </div>
                          <input 
                            id="photo-file-input"
                            type="file" 
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                handlePhotoSelect(files[0]);
                              }
                            }}
                          />
                        </div>
                      )}
                      
                      {photoError && (
                        <p className="text-[10px] text-red-650 font-extrabold uppercase tracking-wide mt-1.5 flex items-center gap-1 animate-bounce text-left">
                          <AlertCircle className="h-3 w-3" />
                          {photoError}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* MASTER CABANG FORM */}
                {showModal === 'cabang' && (
                  <>

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
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Status Cabang</label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={String(formData.STATUS || 'AKTIF').trim().toUpperCase() === 'AKTIF'}
                          onChange={e => setFormData({...formData, STATUS: e.target.checked ? 'AKTIF' : 'TIDAK AKTIF'})}
                        />
                        <div className="w-14 h-7 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ml-3 text-xs font-bold text-zinc-700">
                          {String(formData.STATUS || 'AKTIF').trim().toUpperCase() === 'AKTIF' ? 'Cabang Aktif' : 'Tidak Aktif'}
                        </span>
                      </label>
                    </div>
                  </>
                )}

                {/* MASTER KATEGORI FORM */}
                {showModal === 'kategori' && (
                  <>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Kategori</label>
                      <input type="text" placeholder="Minuman Sachet" value={formData.NAMA_KATEGORI || ''} required className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" onChange={e => setFormData({...formData, NAMA_KATEGORI: e.target.value})}/>
                    </div>
                  </>
                )}

                {/* MASTER MENU FORM */}
                {showModal === 'menu' && (
                  <>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Kategori</label>
                      <CustomSelect 
                        required
                        className="w-full"
                        textSizeClass="text-sm"
                        placeholder={!master?.kategori || master.kategori.length === 0 ? "Tidak ada Kategori" : "-- Pilih Kategori --"}
                        disabled={!master?.kategori || master.kategori.length === 0}
                        value={formData.ID_KATEGORI || ''}
                        onChange={val => setFormData({...formData, ID_KATEGORI: val})}
                        options={master?.kategori?.map(k => ({ value: k.ID_KATEGORI, label: k.NAMA_KATEGORI })) || []}
                      />
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
                            inputMode="numeric"
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
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Status Varian</label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={formData.STATUS === 'Tersedia' || String(formData.STATUS || '').trim().toUpperCase() === 'AKTIF'}
                            onChange={e => setFormData({...formData, STATUS: e.target.checked ? 'Tersedia' : 'Tidak Tersedia'})}
                          />
                          <div className="w-14 h-7 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                          <span className="ml-3 text-xs font-bold text-zinc-700">
                            {formData.STATUS === 'Tersedia' || String(formData.STATUS || '').trim().toUpperCase() === 'AKTIF' ? 'Tersedia (Aktif)' : 'Tidak Tersedia'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {/* MASTER PROMO FORM */}
                {showModal === 'promo' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">ID Promo (Otomatis)</label>
                        <input 
                          type="text" 
                          value={formData.ID_PROMO || ''} 
                          disabled 
                          className="w-full p-3 rounded-xl bg-zinc-100 border border-zinc-200 text-sm font-bold text-zinc-500 outline-none" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Promo</label>
                        <input 
                          type="text" 
                          placeholder="Contoh: Promo Gajian" 
                          value={formData.NAMA_PROMO || ''} 
                          required 
                          className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" 
                          onChange={e => setFormData({...formData, NAMA_PROMO: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Jenis Promo</label>
                        <CustomSelect 
                          required 
                          className="w-full"
                          textSizeClass="text-sm"
                          value={formData.JENIS_PROMO || 'PER_MENU'} 
                          onChange={(val) => setFormData({...formData, JENIS_PROMO: val})}
                          placeholder="-- Pilih Jenis Promo --"
                          options={[
                            { value: 'PER_MENU', label: 'Promo Per Menu' },
                            { value: 'PER_PESANAN', label: 'Promo Per Pesanan' }
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Tipe Nilai</label>
                        <CustomSelect 
                          required 
                          className="w-full"
                          textSizeClass="text-sm"
                          value={formData.TIPE || 'DISKON_PERSEN'} 
                          onChange={(val) => setFormData({...formData, TIPE: val})}
                          placeholder="-- Pilih Tipe --"
                          options={[
                            { value: 'DISKON_PERSEN', label: 'Diskon Persen (%)' },
                            { value: 'DISKON_NOMINAL', label: 'Diskon Nominal (Rp)' },
                            { value: 'HARGA_FIX', label: 'Harga Tetap (Rp)' }
                          ]}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Syarat Qty Min</label>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          placeholder="0" 
                          value={formData.SYARAT_QTY === 0 ? '' : formData.SYARAT_QTY} 
                          required 
                          className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" 
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            setFormData({...formData, SYARAT_QTY: val === '' ? 0 : parseInt(val)});
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-zinc-550 mb-1">
                          {formData.TIPE === 'DISKON_PERSEN' ? 'Nilai Diskon (%)' : 'Nilai (Rupiah)'}
                        </label>
                        <div className="relative rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden focus-within:border-zinc-400 focus-within:bg-white transition-all">
                          {formData.TIPE !== 'DISKON_PERSEN' && (
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-zinc-400 font-extrabold text-sm">Rp</span>
                            </div>
                          )}
                          <input 
                            type="number" 
                            min="1" 
                            placeholder="0" 
                            value={formData.NILAI_PROMO || ''} 
                            required 
                            className={`w-full ${formData.TIPE !== 'DISKON_PERSEN' ? 'pl-9' : 'pl-3'} pr-8 py-3 bg-transparent text-sm font-bold text-zinc-900 outline-none`} 
                            onChange={e => setFormData({...formData, NILAI_PROMO: parseFloat(e.target.value) || 0})}
                          />
                          {formData.TIPE === 'DISKON_PERSEN' && (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <span className="text-zinc-500 font-extrabold text-sm">%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Pilih Cabang (Berlaku Di)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Building className="h-4 w-4 text-zinc-400" />
                        </div>
                        <input 
                          type="text" 
                          placeholder="Cari Cabang..." 
                          value={promoBranchSearch} 
                          className="w-full pl-9 pr-3 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none"
                          onChange={e => setPromoBranchSearch(e.target.value)}
                        />
                        
                        {promoBranchSearch.trim() && (
                          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-lg z-50">
                            <div 
                              className="p-3 text-xs font-bold text-zinc-800 hover:bg-neutral-50 cursor-pointer flex justify-between items-center border-b border-zinc-100"
                              onClick={() => {
                                setFormData({ ...formData, ID_CABANG: 'ALL' });
                                setPromoBranchSearch('');
                              }}
                            >
                              <span>SEMUA CABANG</span>
                              <Plus className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            </div>
                            {(master?.cabang || []).filter(c => c.NAMA_CABANG.toLowerCase().includes(promoBranchSearch.toLowerCase())).map(cab => (
                              <div 
                                key={cab.ID_CABANG}
                                className="p-3 text-xs font-bold text-zinc-800 hover:bg-neutral-50 cursor-pointer flex justify-between items-center border-b border-zinc-100 last:border-0"
                                onClick={() => {
                                  const current = formData.ID_CABANG === 'ALL' ? [] : (formData.ID_CABANG ? String(formData.ID_CABANG).split('|').filter(Boolean) : []);
                                  if (!current.includes(cab.ID_CABANG)) {
                                    const next = [...current, cab.ID_CABANG].join('|');
                                    setFormData({ ...formData, ID_CABANG: next });
                                  }
                                  setPromoBranchSearch('');
                                }}
                              >
                                <span>{cab.NAMA_CABANG}</span>
                                <Plus className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.ID_CABANG === 'ALL' ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-bold text-white transition">
                            <span>SEMUA CABANG</span>
                            <button type="button" onClick={() => setFormData({...formData, ID_CABANG: ''})} className="p-0.5 rounded-full hover:bg-zinc-700 transition cursor-pointer">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          formData.ID_CABANG ? String(formData.ID_CABANG).split('|').filter(Boolean).map(id => (
                            <div key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 rounded-full text-xs font-bold text-zinc-800 transition">
                              <span>{getCabangName(id)}</span>
                              <button type="button" onClick={() => {
                                const next = String(formData.ID_CABANG).split('|').filter(x => x !== id).join('|');
                                setFormData({...formData, ID_CABANG: next});
                              }} className="p-0.5 rounded-full hover:bg-neutral-200 transition cursor-pointer">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )) : (
                            <p className="text-[10px] font-bold text-zinc-400 italic">Belum ada cabang terpilih.</p>
                          )
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Jenis Periode Promo</label>
                      <CustomSelect 
                        required 
                        className="w-full"
                        textSizeClass="text-sm"
                        value={formData.JENIS_PERIODE || 'HARIAN'} 
                        onChange={(val) => {
                          let periode = '';
                          const today = getWITAString().split('T')[0];
                          if (val === 'JAM') {
                            periode = `${today} 00:00 - ${today} 23:59`;
                          } else if (val === 'HARIAN') {
                            periode = `${today} 00:00 - ${today} 23:59`;
                          }
                          setFormData({...formData, JENIS_PERIODE: val, PERIODE: periode});
                        }}
                        placeholder="-- Pilih Jenis Periode --"
                        options={[
                          { value: 'JAM', label: 'Berdasarkan Jam (Hari Ini)' },
                          { value: 'HARIAN', label: 'Harian (Hari Ini)' },
                          { value: 'TANGGAL', label: 'Tanggal Tertentu' },
                          { value: 'RENTANG', label: 'Rentang Bulan' }
                        ]}
                      />
                    </div>

                    {formData.JENIS_PERIODE === 'JAM' && (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                        <div className="col-span-2 text-[10px] font-bold text-zinc-400 mb-1">Berlaku khusus HARI INI:</div>
                        <div>
                          <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Jam Mulai</label>
                          <input 
                            type="time" 
                            required
                            value={(String(formData.PERIODE || '')).split(' - ')[0]?.split(' ')[1] || ''}
                            className="w-full p-2.5 rounded-lg bg-white border border-zinc-200 text-xs font-bold outline-none"
                            onChange={(e) => {
                              const today = getWITAString().split('T')[0];
                              const currentEnd = (String(formData.PERIODE || '')).split(' - ')[1] || '23:59';
                              setFormData({...formData, PERIODE: `${today} ${e.target.value} - ${currentEnd}`});
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Jam Berakhir</label>
                          <input 
                            type="time" 
                            required
                            value={(String(formData.PERIODE || '')).split(' - ')[1]?.split(' ')[1] || ''}
                            className="w-full p-2.5 rounded-lg bg-white border border-zinc-200 text-xs font-bold outline-none"
                            onChange={(e) => {
                              const today = getWITAString().split('T')[0];
                              const currentStart = (String(formData.PERIODE || '')).split(' - ')[0] || `${today} 00:00`;
                              setFormData({...formData, PERIODE: `${currentStart} - ${today} ${e.target.value}`});
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {formData.JENIS_PERIODE === 'TANGGAL' && (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                        <div>
                          <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Tanggal & Jam Mulai</label>
                          <input 
                            type="datetime-local" 
                            required
                            value={(String(formData.PERIODE || '')).split(' - ')[0]?.replace(' ', 'T') || ''}
                            className="w-full p-2.5 rounded-lg bg-white border border-zinc-200 text-xs font-bold outline-none"
                            onChange={(e) => {
                              const val = e.target.value.replace('T', ' ');
                              const currentEnd = (String(formData.PERIODE || '')).split(' - ')[1] || '';
                              setFormData({...formData, PERIODE: `${val} - ${currentEnd}`});
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Tanggal & Jam Selesai</label>
                          <input 
                            type="datetime-local" 
                            required
                            value={(String(formData.PERIODE || '')).split(' - ')[1]?.replace(' ', 'T') || ''}
                            className="w-full p-2.5 rounded-lg bg-white border border-zinc-200 text-xs font-bold outline-none"
                            onChange={(e) => {
                              const val = e.target.value.replace('T', ' ');
                              const currentStart = (String(formData.PERIODE || '')).split(' - ')[0] || '';
                              setFormData({...formData, PERIODE: `${currentStart} - ${val}`});
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {formData.JENIS_PERIODE === 'RENTANG' && (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                        <div>
                          <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Bulan Mulai</label>
                          <select 
                            required
                            className="w-full p-2.5 rounded-lg bg-white border border-zinc-200 text-xs font-bold outline-none"
                            onChange={(e) => {
                              const monthIdx = parseInt(e.target.value);
                              const year = new Date().getFullYear();
                              const dateStart = new Date(year, monthIdx, 1);
                              const formattedStart = `${dateStart.getFullYear()}-${String(dateStart.getMonth()+1).padStart(2,'0')}-01 00:00`;
                              const currentEnd = (String(formData.PERIODE || '')).split(' - ')[1] || '';
                              setFormData({...formData, PERIODE: `${formattedStart} - ${currentEnd}`});
                            }}
                          >
                            <option value="">Pilih Bulan</option>
                            {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m, i) => (
                              <option key={i} value={i}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase text-zinc-500 mb-1">Bulan Akhir</label>
                          <select 
                            required
                            className="w-full p-2.5 rounded-lg bg-white border border-zinc-200 text-xs font-bold outline-none"
                            onChange={(e) => {
                              const monthIdx = parseInt(e.target.value);
                              const year = new Date().getFullYear();
                              const dateEnd = new Date(year, monthIdx + 1, 0); // last day of month
                              const formattedEnd = `${dateEnd.getFullYear()}-${String(dateEnd.getMonth()+1).padStart(2,'0')}-${String(dateEnd.getDate()).padStart(2,'0')} 23:59`;
                              const currentStart = (String(formData.PERIODE || '')).split(' - ')[0] || '';
                              setFormData({...formData, PERIODE: `${currentStart} - ${formattedEnd}`});
                            }}
                          >
                            <option value="">Pilih Bulan</option>
                            {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m, i) => (
                              <option key={i} value={i}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-xl">
                      <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Ringkasan Periode Terpilih:</p>
                      <p className="text-xs font-bold text-zinc-900">{formData.PERIODE || 'Belum diatur'}</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-[10px] font-black uppercase text-zinc-500">
                          Pilih Item Target (Menu/Varian) {formData.JENIS_PROMO === 'PER_PESANAN' && '(Opsional)'}
                        </label>
                        <button 
                          type="button"
                          onClick={() => {
                            const hasAnyTarget = !!(formData.TARGET_ITEM && String(formData.TARGET_ITEM).trim());
                            if (hasAnyTarget) {
                              setFormData({ ...formData, TARGET_ITEM: '' });
                            } else {
                              const allIds = (master?.varian || []).map(v => String(v.ID_VARIAN)).join('|');
                              setFormData({ ...formData, TARGET_ITEM: allIds });
                            }
                          }}
                          className="text-[10px] font-black text-red-650 uppercase hover:text-red-800 transition px-2 py-1 rounded-md bg-red-50 border border-red-100"
                        >
                          {!!(formData.TARGET_ITEM && String(formData.TARGET_ITEM).trim()) ? 'Hapus Semua' : 'Pilih Semua Item'}
                        </button>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-1.5">
                        <span className="text-[9px] font-black text-zinc-400 uppercase w-full mb-0.5">Filter Kategori:</span>
                        {master?.kategori?.map(kat => {
                          const variantsInKat = (master?.varian || []).filter(v => v.ID_KATEGORI === kat.ID_KATEGORI);
                          const variantIdsInKat = variantsInKat.map(v => v.ID_VARIAN);
                          const currentTargets = formData.TARGET_ITEM ? String(formData.TARGET_ITEM).split('|').filter(Boolean) : [];
                          const isAllInKatSelected = variantIdsInKat.length > 0 && variantIdsInKat.every(id => currentTargets.includes(id));
                          
                          return (
                            <button
                              key={kat.ID_KATEGORI}
                              type="button"
                              onClick={() => {
                                const current = formData.TARGET_ITEM ? String(formData.TARGET_ITEM).split('|').filter(Boolean) : [];
                                let next;
                                if (isAllInKatSelected) {
                                  // Remove all from this category
                                  next = current.filter(id => !variantIdsInKat.includes(id));
                                } else {
                                  // Add all from this category (avoid duplicates)
                                  const toAdd = variantIdsInKat.filter(id => !current.includes(id));
                                  next = [...current, ...toAdd];
                                }
                                setFormData({ ...formData, TARGET_ITEM: next.join('|') });
                              }}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all border ${
                                isAllInKatSelected 
                                  ? 'bg-zinc-800 text-white border-zinc-800' 
                                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                              }`}
                            >
                              {kat.NAMA_KATEGORI}
                            </button>
                          );
                        })}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-4 w-4 text-zinc-400" />
                        </div>
                        <input 
                          type="text" 
                          placeholder="Ketik Nama Menu atau Nama Varian..." 
                          value={promoVariantSearch} 
                          className="w-full pl-9 pr-3 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none"
                          onChange={e => setPromoVariantSearch(e.target.value)}
                        />
                        
                        {promoVariantSearch.trim() && (
                          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-lg z-50">
                            {((master?.varian || []).map(v => {
                              const m = master?.menu?.find(x => String(x.ID_MENU) === String(v.ID_MENU));
                              const label = m ? `${m.NAMA_MENU} (${v.NAMA_VARIAN})` : v.NAMA_VARIAN;
                              return { id: String(v.ID_VARIAN), label };
                            }).filter(item => {
                              const currentTargets = formData.TARGET_ITEM ? String(formData.TARGET_ITEM).split('|').filter(Boolean) : [];
                              return item.label.toLowerCase().includes(promoVariantSearch.toLowerCase()) && !currentTargets.includes(item.id);
                            })).map(item => (
                              <div 
                                key={item.id}
                                className="p-3 text-xs font-bold text-zinc-800 hover:bg-neutral-50 cursor-pointer flex justify-between items-center border-b border-zinc-100 last:border-0"
                                onClick={() => {
                                  const currentTargets = formData.TARGET_ITEM ? String(formData.TARGET_ITEM).split('|').filter(Boolean) : [];
                                  if (!currentTargets.includes(item.id)) {
                                    const newTargets = [...currentTargets, item.id].join('|');
                                    setFormData({ ...formData, TARGET_ITEM: newTargets });
                                  }
                                  setPromoVariantSearch('');
                                }}
                              >
                                <span>{item.label}</span>
                                <Plus className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.TARGET_ITEM ? String(formData.TARGET_ITEM).split('|').filter(Boolean).map(id => (
                          <div key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 rounded-full text-xs font-bold text-zinc-800 transition">
                            <span>{getVariantDisplayLabel(id)}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                const currentTargets = formData.TARGET_ITEM ? String(formData.TARGET_ITEM).split('|').filter(Boolean) : [];
                                const newTargets = currentTargets.filter(item => item !== id).join('|');
                                setFormData({ ...formData, TARGET_ITEM: newTargets });
                                setIsAllVariantsSelected(false);
                              }}
                              className="p-0.5 rounded-full hover:bg-neutral-200 text-zinc-555 hover:text-zinc-850 transition cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )) : (
                          <p className="text-[10px] font-bold text-zinc-400 italic">Belum ada varian yang dipilih.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* MASTER PEGAWAI FORM */}
                {showModal === 'pegawai' && (
                  <>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Pilih Cabang</label>
                      <select 
                        required 
                        value={formData.ID_CABANG || ''} 
                        className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" 
                        onChange={e => setFormData({...formData, ID_CABANG: e.target.value})}
                      >
                        <option value="">-- Pilih Cabang --</option>
                        {(master?.cabang || []).map(cab => (
                          <option key={cab.ID_CABANG} value={cab.ID_CABANG}>{cab.NAMA_CABANG}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Nama Pegawai</label>
                      <input 
                        type="text" 
                        placeholder="Nama Pegawai (Contoh: Joni)" 
                        value={formData.NAMA_PEGAWAI || ''} 
                        required 
                        className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" 
                        onChange={e => setFormData({...formData, NAMA_PEGAWAI: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Kontak / No. Telepon</label>
                      <input 
                        type="text" 
                        placeholder="08123456789" 
                        value={formData.KONTAK || ''} 
                        className="w-full p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold focus:bg-white transition-all outline-none" 
                        onChange={e => setFormData({...formData, KONTAK: e.target.value})}
                      />
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

      {showFilterModal && createPortal(
        <div className="fixed inset-0 z-[100000] bg-zinc-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200" onClick={() => setShowFilterModal(false)}>
          <div className="bg-white w-full max-w-sm h-dvh shadow-2xl flex flex-col animate-in slide-in-from-right-1/2" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 pt-safe">
              <h3 className="text-sm font-black text-zinc-900 uppercase tracking-tight flex items-center gap-2">
                <Filter className="h-4 w-4 text-red-700" /> Filter
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setTempAdminFilter(getDefaultAdminFilterState())}
                  className="p-1.5 bg-white hover:bg-red-50 text-red-700 hover:text-red-900 rounded-lg transition shadow-sm border border-zinc-200 cursor-pointer"
                  title="Hapus Filter"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setShowFilterModal(false)}
                  className="p-1.5 bg-white hover:bg-zinc-100 rounded-lg text-zinc-700 transition shadow-sm border border-zinc-200 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-6">
              {(activeModule === 'kas' || activeModule === 'inventaris' || activeModule === 'shift') && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Cabang</label>
                  <select 
                    value={tempAdminFilter.branch}
                    onChange={(e) => setTempAdminFilter({...tempAdminFilter, branch: e.target.value})}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 focus:ring-2 focus:ring-red-600 focus:border-red-600 transition outline-none bg-white cursor-pointer"
                  >
                    <option value="All">Semua Cabang</option>
                    {master?.cabang?.map(c => (
                      <option key={c.ID_CABANG} value={String(c.ID_CABANG)}>{c.NAMA_CABANG}</option>
                    ))}
                  </select>
                 </div>
              )}
              
              {activeModule === 'menu' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Kategori</label>
                  <select 
                    value={tempAdminFilter.category}
                    onChange={(e) => setTempAdminFilter({...tempAdminFilter, category: e.target.value})}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 focus:ring-2 focus:ring-red-600 focus:border-red-600 transition outline-none bg-white cursor-pointer"
                  >
                    <option value="All">Semua Kategori</option>
                    {master?.kategori?.map(c => (
                      <option key={c.ID_KATEGORI} value={String(c.ID_KATEGORI)}>{c.NAMA_KATEGORI}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeModule === 'varian' && (
                <>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Menu</label>
                    <select 
                      value={tempAdminFilter.menu}
                      onChange={(e) => setTempAdminFilter({...tempAdminFilter, menu: e.target.value})}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 focus:ring-2 focus:ring-red-600 focus:border-red-600 transition outline-none bg-white cursor-pointer"
                    >
                      <option value="All">Semua Menu</option>
                      {master?.menu?.map(m => (
                        <option key={m.ID_MENU} value={String(m.ID_MENU)}>{m.NAMA_MENU}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3 mt-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Status</label>
                    <select 
                      value={tempAdminFilter.statusFilter}
                      onChange={(e) => setTempAdminFilter({...tempAdminFilter, statusFilter: e.target.value})}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 focus:ring-2 focus:ring-red-600 focus:border-red-600 transition outline-none bg-white cursor-pointer"
                    >
                      <option value="All">Semua Status</option>
                      <option value="Tersedia">Tersedia</option>
                      <option value="Tidak Tersedia">Tidak Tersedia</option>
                    </select>
                  </div>
                </>
              )}

              {(activeModule === 'kas' || activeModule === 'inventaris' || activeModule === 'shift') && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Tanggal</label>
                  <input 
                    type="date"
                    value={tempAdminFilter.date || ''}
                    onChange={(e) => setTempAdminFilter({...tempAdminFilter, date: e.target.value || null})}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs text-zinc-700 focus:ring-2 focus:ring-red-600 focus:border-red-600 transition outline-none"
                  />
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Urutkan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setTempAdminFilter({...tempAdminFilter, sortOrder: 'newest'})}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempAdminFilter.sortOrder === 'newest' ? 'bg-red-50 border-red-600 text-red-700' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Terbaru</button>
                  <button 
                    onClick={() => setTempAdminFilter({...tempAdminFilter, sortOrder: 'oldest'})}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempAdminFilter.sortOrder === 'oldest' ? 'bg-red-50 border-red-600 text-red-700' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Terlama</button>
                </div>
              </div>

              {activeModule === 'kas' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Sifat</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setTempAdminFilter({...tempAdminFilter, sifat: 'All'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempAdminFilter.sifat === 'All' ? 'bg-red-50 border-red-600 text-red-700' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Semua</button>
                    <button 
                      onClick={() => setTempAdminFilter({...tempAdminFilter, sifat: 'Pemasukan'})}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempAdminFilter.sifat === 'Pemasukan' ? 'bg-emerald-50 border-emerald-600 text-emerald-700' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Pemasukan</button>
                    <button 
                       onClick={() => setTempAdminFilter({...tempAdminFilter, sifat: 'Pengeluaran'})}
                       className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer ${tempAdminFilter.sifat === 'Pengeluaran' ? 'bg-rose-50 border-rose-600 text-rose-700' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>Pengeluaran</button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 pb-safe">
              <button 
                disabled={JSON.stringify(tempAdminFilter) === JSON.stringify(appliedAdminFilter)}
                onClick={() => { setAppliedAdminFilter(tempAdminFilter); setShowFilterModal(false); }}
                className="w-full bg-zinc-900 hover:bg-black text-white font-extrabold text-xs py-3.5 rounded-xl transition flex items-center justify-center shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider cursor-pointer"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>,
        document.body
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
                disabled={isUniversalLoading}
                onClick={async () => {
                  if (confirmState.onCancel.constructor.name === "AsyncFunction") {
                      await confirmState.onCancel();
                  } else {
                      confirmState.onCancel();
                  }
                  setConfirmState(prev => ({ ...prev, isOpen: false }));
                }}
                className="flex-1 py-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-widest transition cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isUniversalLoading}
                onClick={() => {
                  setConfirmState(prev => ({ ...prev, isOpen: false }));
                  confirmState.onConfirm();
                }}
                className={`flex-1 py-3.5 rounded-xl text-white font-extrabold text-xs uppercase tracking-widest transition cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${confirmState.type === 'delete' ? 'bg-red-750 hover:bg-red-800' : 'bg-zinc-900 hover:bg-black'}`}
              >
                {isUniversalLoading ? 'Memproses...' : 'Ya, Lanjut'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SelectionContext.Provider>
  );
}
