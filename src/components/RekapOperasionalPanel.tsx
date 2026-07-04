import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, 
  Building2, 
  Users, 
  ClipboardList, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Share2, 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  ShoppingBag, 
  Check, 
  CheckCircle2,
  FileText,
  UserCheck,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  X,
  FileDown,
  XCircle
} from 'lucide-react';
import { Cabang, Transaction } from '../types';
import { fetchUniversalDataFromGAS, getMasterData } from '../utils/db';
import { CustomSelect } from './CustomSelect';

interface RekapOperasionalPanelProps {
  cabangList: Cabang[];
  onBack: () => void;
}

type ReportPeriod = 'HARIAN' | 'BULANAN' | 'KUARTAL' | 'SEMESTER' | 'TAHUNAN';

interface CalendarDate {
  year: number;
  month: number; // 0-11
  date: number;  // 1-31
}

function getCalendarDate(dateVal: any): CalendarDate | null {
  if (!dateVal) return null;
  
  if (dateVal instanceof Date) {
    return {
      year: dateVal.getFullYear(),
      month: dateVal.getMonth(),
      date: dateVal.getDate()
    };
  }

  const num = Number(dateVal);
  if (!isNaN(num) && num > 30000) {
    const utcDate = new Date((num - 25569) * 86400 * 1000);
    return {
      year: utcDate.getUTCFullYear(),
      month: utcDate.getUTCMonth(),
      date: utcDate.getUTCDate()
    };
  }

  const str = String(dateVal).trim();
  
  // Try matching YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (yyyymmdd) {
    return {
      year: parseInt(yyyymmdd[1], 10),
      month: parseInt(yyyymmdd[2], 10) - 1,
      date: parseInt(yyyymmdd[3], 10)
    };
  }

  // Try matching DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (ddmmyyyy) {
    return {
      year: parseInt(ddmmyyyy[3], 10),
      month: parseInt(ddmmyyyy[2], 10) - 1,
      date: parseInt(ddmmyyyy[1], 10)
    };
  }

  // Fallback to standard JS parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    if (str.includes('T')) {
      return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(),
        date: d.getUTCDate()
      };
    }
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      date: d.getDate()
    };
  }

  return null;
}

// Robust date parser matching existing systems
function parseDateRobust(dateVal: any): Date | null {
  const cal = getCalendarDate(dateVal);
  if (!cal) return null;
  return new Date(cal.year, cal.month, cal.date);
}

function cleanAndParseNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (!str) return 0;
  
  const cleanStr = str
    .replace(/Rp/gi, '')
    .replace(/\s/g, '');
  
  if (cleanStr.includes('.') && cleanStr.includes(',')) {
    const standardStr = cleanStr.replace(/\./g, '').replace(/,/g, '.');
    const num = parseFloat(standardStr);
    return isNaN(num) ? 0 : num;
  }
  
  if (cleanStr.includes('.')) {
    const parts = cleanStr.split('.');
    const lastPart = parts[parts.length - 1];
    if (lastPart.length === 3) {
      const standardStr = cleanStr.replace(/\./g, '');
      const num = parseFloat(standardStr);
      return isNaN(num) ? 0 : num;
    } else {
      const num = parseFloat(cleanStr);
      return isNaN(num) ? 0 : num;
    }
  }
  
  if (cleanStr.includes(',')) {
    const standardStr = cleanStr.replace(/,/g, '.');
    const num = parseFloat(standardStr);
    return isNaN(num) ? 0 : num;
  }

  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

function getTransaksiKategori(t: any): string {
  if (!t) return '';
  let kat = '';
  if (typeof t === 'object' && !Array.isArray(t)) {
    const keys = Object.keys(t);
    const foundKey = keys.find(k => {
      const lower = k.toLowerCase().replace(/[\s_-]/g, '').trim();
      return lower === 'jenis' || lower === 'jenistransaksi' || lower === 'kategori' || lower === 'jenis_transaksi' || lower === 'tipe_transaksi';
    });
    if (foundKey) {
      kat = String(t[foundKey]).trim();
    }
  }
  if (!kat) {
    kat = t.JENIS || t.Kategori || t.kategori || t.jenis || (Array.isArray(t) ? t[2] || t[1] : '');
  }
  return String(kat || '').trim();
}

function getTransaksiDebit(t: any): number {
  if (!t) return 0;
  const raw = t.DEBIT ?? t.debit ?? t.Masuk ?? t.masuk ?? t.Pemasukan ?? t.pemasukan ?? (Array.isArray(t) ? t[4] : 0);
  return cleanAndParseNumber(raw);
}

function getTransaksiKredit(t: any): number {
  if (!t) return 0;
  const raw = t.KREDIT ?? t.kredit ?? t.Keluar ?? t.keluar ?? t.Pengeluaran ?? t.pengeluaran ?? (Array.isArray(t) ? t[5] : 0);
  return cleanAndParseNumber(raw);
}

function formatDateToLocalString(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('id-ID', { weekday: 'long' });
}

export default function RekapOperasionalPanel({ cabangList, onBack }: RekapOperasionalPanelProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');

  // Filter states matching ReportsPanel
  const [filterPeriode, setFilterPeriode] = useState<ReportPeriod>('BULANAN');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedKuartal, setSelectedKuartal] = useState<number>(Math.floor(new Date().getMonth() / 3));
  const [selectedSemester, setSelectedSemester] = useState<number>(Math.floor(new Date().getMonth() / 6));
  
  // Active month for pagination
  const [activePaginationMonth, setActivePaginationMonth] = useState<number>(new Date().getMonth());

  // Database states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pegawaiList, setPegawaiList] = useState<any[]>([]);
  const [shiftList, setShiftList] = useState<any[]>([]);
  const [inventarisList, setInventarisList] = useState<any[]>([]);
  const [kasList, setKasList] = useState<any[]>([]);
  const [pesananList, setPesananList] = useState<any[]>([]);

  // Expanded day (holds single date string or null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const loadAllOperationalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [masterRes, shifts, inventaris, kas, pesanan] = await Promise.all([
        getMasterData().catch(() => ({ pegawai: [] })),
        fetchUniversalDataFromGAS('Data_Izin_Shift').catch(() => []),
        fetchUniversalDataFromGAS('Data_Inventaris').catch(() => []),
        fetchUniversalDataFromGAS('Transaksi').catch(() => []),
        fetchUniversalDataFromGAS('Data_Pesanan').catch(() => [])
      ]);

      setPegawaiList(masterRes?.pegawai || []);
      setShiftList(shifts || []);
      setInventarisList(inventaris || []);
      setKasList(kas || []);
      setPesananList(pesanan || []);
    } catch (err: any) {
      console.error(err);
      setError("Gagal memuat rekap operasional dari sistem pusat. Harap periksa koneksi atau setelan Google Sheet Anda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllOperationalData();
  }, []);

  // Sync activePaginationMonth when filters change
  useEffect(() => {
    if (filterPeriode === 'BULANAN') {
      setActivePaginationMonth(selectedMonth);
    } else if (filterPeriode === 'KUARTAL') {
      const startMonth = selectedKuartal * 3;
      if (activePaginationMonth < startMonth || activePaginationMonth > startMonth + 2) {
        setActivePaginationMonth(startMonth);
      }
    } else if (filterPeriode === 'SEMESTER') {
      const startMonth = selectedSemester * 6;
      if (activePaginationMonth < startMonth || activePaginationMonth > startMonth + 5) {
        setActivePaginationMonth(startMonth);
      }
    } else if (filterPeriode === 'HARIAN') {
      const d = new Date(selectedDate);
      if (!isNaN(d.getTime())) {
        setActivePaginationMonth(d.getMonth());
        setSelectedYear(d.getFullYear());
      }
    }
  }, [filterPeriode, selectedMonth, selectedKuartal, selectedSemester, selectedDate]);

  // Filter staff members based on selected branch
  const filteredStaffList = useMemo(() => {
    if (selectedBranch === 'ALL') return pegawaiList;
    return pegawaiList.filter(p => String(p.ID_CABANG).trim().toUpperCase() === selectedBranch.trim().toUpperCase());
  }, [pegawaiList, selectedBranch]);

  const branchOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'SEMUA CABANG' },
      ...cabangList.map(cab => ({ value: String(cab.ID_CABANG), label: cab.NAMA_CABANG }))
    ];
  }, [cabangList]);

  const staffOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'SEMUA PEGAWAI' },
      ...filteredStaffList.map(peg => ({ value: String(peg.ID_PEGAWAI), label: peg.NAMA_PEGAWAI }))
    ];
  }, [filteredStaffList]);

  // Handle auto-reset staff selection when branch changes
  useEffect(() => {
    if (selectedStaff !== 'ALL') {
      const existsInBranch = filteredStaffList.some(p => p.ID_PEGAWAI === selectedStaff || p.NAMA_PEGAWAI === selectedStaff);
      if (!existsInBranch) {
        setSelectedStaff('ALL');
      }
    }
  }, [selectedBranch, filteredStaffList, selectedStaff]);

  // Generate list of days based on filters
  const daysToProcess = useMemo(() => {
    const days: Date[] = [];
    if (filterPeriode === 'HARIAN') {
      const d = new Date(selectedDate);
      if (!isNaN(d.getTime())) {
        days.push(d);
      }
    } else {
      // For Bulanan, Kuartal, Semester, Tahunan -> Use activePaginationMonth & selectedYear
      const year = selectedYear;
      const month = activePaginationMonth;
      
      const date = new Date(year, month, 1);
      while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
      }
    }
    return days;
  }, [filterPeriode, selectedDate, activePaginationMonth, selectedYear]);

  const getCabangName = (id: string) => {
    if (!id || id === 'ALL') return 'Semua Cabang';
    const found = cabangList.find(c => String(c.ID_CABANG).trim().toUpperCase() === String(id).trim().toUpperCase());
    return found ? found.NAMA_CABANG : id;
  };
  
  const getPegawaiName = (id: string) => {
    if (!id) return 'Unknown';
    const found = pegawaiList.find(p => String(p.ID_PEGAWAI).trim().toUpperCase() === String(id).trim().toUpperCase());
    return found ? found.NAMA_PEGAWAI : id;
  };

  // Compile detailed daily reports based on filters
  const processedDays = useMemo(() => {
    return daysToProcess.map(dayDate => {
      const year = dayDate.getFullYear();
      const month = String(dayDate.getMonth() + 1).padStart(2, '0');
      const date = String(dayDate.getDate()).padStart(2, '0');
      const dayStr = `${year}-${month}-${date}`; // YYYY-MM-DD

      const targetCal = {
        year: dayDate.getFullYear(),
        month: dayDate.getMonth(),
        date: dayDate.getDate()
      };

      const resolveBranchId = (bStr: string) => {
        if (!bStr) return bStr;
        const bUpper = bStr.trim().toUpperCase();
        const found = cabangList.find(c => {
          const id = String(c.ID_CABANG).trim().toUpperCase();
          const nm = String(c.NAMA_CABANG).trim().toUpperCase();
          return id === bUpper || nm === bUpper || nm.includes(bUpper) || bUpper.includes(nm) || bUpper.includes(id) || id.includes(bUpper);
        });
        return found ? found.ID_CABANG : bUpper;
      };

      // 1. Filter Orders
      const dayOrders = pesananList.filter(p => {
        const cal = getCalendarDate(p.TANGGAL_WAKTU || p.TANGGAL || p.tanggal || p[3] || p[1]);
        if (!cal) return false;
        if (cal.year !== targetCal.year || cal.month !== targetCal.month || cal.date !== targetCal.date) return false;
        const pBranch = resolveBranchId(String(p.ID_CABANG || p.idCabang || p.CABANG || p[2] || ''));
        if (selectedBranch !== 'ALL' && pBranch !== selectedBranch) return false;
        return true;
      });

      const totalSalesCount = dayOrders.length;
      const totalSalesRevenue = dayOrders.reduce((sum, p) => {
        const isCompliment = String(p.JENIS_PESANAN || p[5] || '').toUpperCase() === 'COMPLIMENT';
        if (isCompliment) return sum;
        return sum + Number(p.TOTAL_TAGIHAN || p.TOTAL_BAYAR || p.totalBayAR || p[12] || p[3] || 0);
      }, 0);

      // 2. Filter Izin Shift
      const dayShifts = shiftList.filter(s => {
        const cal = getCalendarDate(s.TANGGAL || s.tanggal);
        if (!cal) return false;
        if (cal.year !== targetCal.year || cal.month !== targetCal.month || cal.date !== targetCal.date) return false;
        const sBranch = resolveBranchId(String(s.CABANG || s.cabang || s.ID_CABANG || ''));
        if (selectedBranch !== 'ALL' && sBranch !== selectedBranch) return false;
        
        if (selectedStaff !== 'ALL') {
          const staffName = String(s.NAMA_STAFF || '').trim().toUpperCase();
          const staffId = String(s.ID_PEGAWAI || '').trim().toUpperCase();
          const filterUpper = selectedStaff.trim().toUpperCase();
          if (staffName !== filterUpper && staffId !== filterUpper) return false;
        }
        return true;
      });

      // 3. Filter Buku Kas
      const dayKas = kasList.filter(k => {
        const cal = getCalendarDate(k.TANGGAL || k.Tanggal || k.tanggal || k[0]);
        if (!cal) return false;
        if (cal.year !== targetCal.year || cal.month !== targetCal.month || cal.date !== targetCal.date) return false;
        const rawCab = k.CABANG || k.Cabang || k.cabang || k.ID_CABANG || (Array.isArray(k) ? k[2] : '');
        const kBranch = resolveBranchId(String(rawCab || ''));
        if (selectedBranch !== 'ALL' && kBranch !== selectedBranch) return false;
        return true;
      });

      let cashIn = 0;
      let cashOut = 0;

      dayKas.forEach(k => {
        const kat = getTransaksiKategori(k).toLowerCase();
        const debit = getTransaksiDebit(k);
        const kredit = getTransaksiKredit(k);

        if (kat === 'pendapatan usaha' || kat.includes('pendapatan usaha')) {
          cashIn += debit;
        } else if (kredit !== 0) {
          cashOut += kredit;
        }
      });

      const isOpen = totalSalesCount > 0; // Buka/tutup hanya didasari pesanan

      // Group per branch if ALL is selected
      const branchBreakdown: Record<string, {
        revenue: number;
        orders: number;
        cashIn: number;
        cashOut: number;
        shifts: any[];
      }> = {};

      if (selectedBranch === 'ALL') {
        cabangList.forEach(c => {
          branchBreakdown[c.ID_CABANG] = { revenue: 0, orders: 0, cashIn: 0, cashOut: 0, shifts: [] };
        });

        dayOrders.forEach(p => {
          const b = resolveBranchId(String(p.ID_CABANG || p.idCabang || p.CABANG || p[2] || ''));
          if (branchBreakdown[b]) {
            branchBreakdown[b].orders++;
            const isCompliment = String(p.JENIS_PESANAN || p[5] || '').toUpperCase() === 'COMPLIMENT';
            if (!isCompliment) branchBreakdown[b].revenue += Number(p.TOTAL_TAGIHAN || p.TOTAL_BAYAR || p.totalBayAR || p[12] || p[3] || 0);
          }
        });
        
        dayShifts.forEach(s => {
          const b = resolveBranchId(String(s.CABANG || s.cabang || s.ID_CABANG || ''));
          if (branchBreakdown[b]) {
            branchBreakdown[b].shifts.push(s);
          }
        });
        
        dayKas.forEach(k => {
          const rawCab = k.CABANG || k.Cabang || k.cabang || k.ID_CABANG || (Array.isArray(k) ? k[2] : '');
          const b = resolveBranchId(String(rawCab || ''));
          if (branchBreakdown[b]) {
            const kat = getTransaksiKategori(k).toLowerCase();
            const debit = getTransaksiDebit(k);
            const kredit = getTransaksiKredit(k);

            if (kat === 'pendapatan usaha' || kat.includes('pendapatan usaha')) {
              branchBreakdown[b].cashIn += debit;
            } else if (kredit !== 0) {
              branchBreakdown[b].cashOut += kredit;
            }
          }
        });
      }

      return {
        dateStr: dayStr,
        dayDate,
        dayName: getDayName(dayDate),
        formattedDate: formatDateToLocalString(dayDate),
        isOpen,
        ordersCount: totalSalesCount,
        revenue: totalSalesRevenue,
        shifts: dayShifts,
        kas: dayKas,
        cashIn,
        cashOut,
        branchBreakdown
      };
    }).sort((a, b) => b.dayDate.getTime() - a.dayDate.getTime()); // newest first
  }, [daysToProcess, pesananList, shiftList, kasList, selectedBranch, selectedStaff, cabangList]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    let daysOpen = 0;
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalPermissions = 0;
    let totalCashIn = 0;
    let totalCashOut = 0;

    processedDays.forEach(day => {
      if (day.isOpen) daysOpen++;
      totalRevenue += day.revenue;
      totalOrders += day.ordersCount;
      totalPermissions += day.shifts.length;
      totalCashIn += day.cashIn;
      totalCashOut += day.cashOut;
    });

    return { daysOpen, totalRevenue, totalOrders, totalPermissions, totalCashIn, totalCashOut };
  }, [processedDays]);

  const toggleDayExpansion = (dateStr: string) => {
    setExpandedDay(prev => (prev === dateStr ? null : dateStr));
  };

  const generateReportText = () => {
    const branchLabel = selectedBranch === 'ALL' ? 'SEMUA CABANG' : getCabangName(selectedBranch).toUpperCase();
    const monthLabel = new Date(selectedYear, activePaginationMonth, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const staffListToUse = selectedBranch === 'ALL' ? pegawaiList : filteredStaffList;
    const totalStaffCount = staffListToUse.length;
    const totalIzinCount = metrics.totalPermissions;
    const totalHariLibur = processedDays.length - metrics.daysOpen;

    let text = `*🛎️ LAPORAN REKAPITULASI OPERASIONAL AURA FOOD*\n\n`;
    text += `Periode: ${filterPeriode === 'HARIAN' ? selectedDate : monthLabel}\n`;
    text += `Cabang: ${branchLabel}\n\n`;

    text += `*📊 RINGKASAN OPERASIONAL:*\n`;
    text += `🔓 Total Hari Buka: ${metrics.daysOpen} Hari\n`;
    text += `🚫 Total Hari Tutup: ${totalHariLibur} Hari\n`;
    text += `👥 Total Pegawai: ${totalStaffCount} Orang\n`;
    text += `📝 Total Izin: ${totalIzinCount} Izin\n\n`;

    text += `*💰 RINGKASAN KEUANGAN:*\n`;
    text += `💵 Total Omset: Rp${metrics.totalRevenue.toLocaleString('id-ID')}\n`;
    text += `📥 Total Cash Masuk: Rp${metrics.totalCashIn.toLocaleString('id-ID')}\n`;
    text += `📤 Total Cash Keluar: Rp${metrics.totalCashOut.toLocaleString('id-ID')}\n\n`;

    staffListToUse.forEach(p => {
      const pIzinCount = processedDays.reduce((acc, day) => {
        return acc + day.shifts.filter(s => {
          const staffId = String(s.ID_PEGAWAI || '').trim().toUpperCase();
          const staffName = String(s.NAMA_STAFF || '').trim().toUpperCase();
          return staffId === String(p.ID_PEGAWAI).trim().toUpperCase() || staffName === String(p.NAMA_PEGAWAI).trim().toUpperCase();
        }).length;
      }, 0);

      if (pIzinCount > 0) {
        text += `            - ${p.NAMA_PEGAWAI}: ${pIzinCount}x izin\n`;
      } else {
        text += `            - ${p.NAMA_PEGAWAI}: 0x izin (full)\n`;
      }
    });

    text += `⛔ Total Tidak Hadir: 0 Alpa\n\n`;
    text += `*🗓️ RINCIAN OPERASIONAL HARIAN:*\n`;

    const chronologicalDays = [...processedDays].sort((a, b) => a.dayDate.getTime() - b.dayDate.getTime());
    
    chronologicalDays.forEach((day, index) => {
      const statusLabel = day.isOpen ? 'Buka' : 'Tutup';
      text += `${index + 1}. [${day.dayName}, ${day.formattedDate}] (${statusLabel}):\n`;
      if (day.isOpen) {
        if (day.shifts.length > 0) {
          day.shifts.forEach(sh => {
            const staffName = sh.NAMA_STAFF || getPegawaiName(sh.ID_PEGAWAI) || 'Unknown';
            text += `    - ${staffName} (Izin), alasan: ${sh.ALASAN || 'Sakit'}.\n`;
          });
          text += `    - Sisanya hadir.\n`;
        } else {
          text += `    - Semua pegawai hadir.\n`;
        }
      } else {
        text += `    - Toko Libur / Tutup.\n`;
      }
    });

    return text;
  };

  const handleCopyToClipboard = () => {
    const reportStr = generateReportText();
    navigator.clipboard.writeText(reportStr)
      .then(() => showToast("Rekap berhasil disalin ke papan klip!"))
      .catch(() => showToast("Gagal menyalin rekap."));
  };

  const handleShareWhatsApp = () => {
    const reportStr = generateReportText();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(reportStr)}`;
    window.open(url, '_blank');
    showToast("Membuka WhatsApp untuk berbagi...");
  };

  const handleExportPDF = () => {
    showToast("Fitur ekspor PDF sedang dikembangkan.");
  };

  // Pagination Logic
  const getPaginationMonths = () => {
    const months = [];
    if (filterPeriode === 'KUARTAL') {
      const start = selectedKuartal * 3;
      for (let i = 0; i < 3; i++) months.push(start + i);
    } else if (filterPeriode === 'SEMESTER') {
      const start = selectedSemester * 6;
      for (let i = 0; i < 6; i++) months.push(start + i);
    } else if (filterPeriode === 'TAHUNAN') {
      for (let i = 0; i < 12; i++) months.push(i);
    }
    return months;
  };

  const paginationMonths = getPaginationMonths();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  return (
    <div style={{ zIndex: 100 }} className="fixed inset-0 bg-neutral-50 flex flex-col overflow-hidden animate-in fade-in duration-150">
      
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000000] animate-in slide-in-from-top-8 duration-300 w-full max-w-sm px-4">
          <div className="px-5 py-3.5 rounded-[24px] bg-zinc-950 text-white flex items-center justify-center gap-3 shadow-2xl border border-zinc-800/80">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shrink-0">
              <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-100">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ADMIN PANEL STICKY HEADER */}
      <div className="bg-white border-b border-zinc-200/80 px-4 py-3.5 flex items-center justify-between shadow-sm shrink-0 h-16 relative z-50">
        <div className="flex items-center justify-between w-full animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-zinc-100 text-zinc-600 transition cursor-pointer active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Operasional</h2>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{metrics.daysOpen} hari buka tercatat</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
               <button 
                 onClick={() => setShowShareMenu(!showShareMenu)}
                 disabled={loading}
                 className="p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition cursor-pointer active:scale-95 disabled:opacity-50"
               >
                 <Share2 className="h-4 w-4" />
               </button>
               {showShareMenu && (
                 <>
                   <div className="fixed inset-0 z-[100]" onClick={() => setShowShareMenu(false)}></div>
                   <div className="absolute top-full right-0 mt-2 w-48 sm:w-56 bg-white rounded-xl shadow-xl border border-zinc-200 py-1.5 z-[101] animate-in fade-in zoom-in-95 origin-top-right">
                     <button 
                       onClick={() => { handleCopyToClipboard(); setShowShareMenu(false); }}
                       className="w-full text-left px-4 py-2.5 text-[10px] sm:text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition"
                     >
                       <Copy className="h-4 w-4 text-zinc-400" /> Salin Teks
                     </button>
                     <button 
                       onClick={() => { handleShareWhatsApp(); setShowShareMenu(false); }}
                       className="w-full text-left px-4 py-2.5 text-[10px] sm:text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition"
                     >
                       <Share2 className="h-4 w-4 text-green-500" /> Bagikan WhatsApp
                     </button>
                     <button 
                       onClick={() => { handleExportPDF(); setShowShareMenu(false); }}
                       className="w-full text-left px-4 py-2.5 text-[10px] sm:text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition"
                     >
                       <FileDown className="h-4 w-4 text-red-500" /> Simpan PDF
                     </button>
                   </div>
                 </>
               )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-safe">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          
          {/* FILTER CARD */}
          <div className="bg-white rounded-[24px] border border-zinc-200/80 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Cabang Toko</label>
                <CustomSelect
                  value={selectedBranch}
                  options={branchOptions}
                  onChange={setSelectedBranch}
                  className="w-full text-[10px] sm:text-xs font-bold"
                />
              </div>
              
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Periode</label>
                <CustomSelect
                  value={filterPeriode}
                  options={[
                    { value: 'HARIAN', label: 'HARIAN' },
                    { value: 'BULANAN', label: 'BULANAN' },
                    { value: 'KUARTAL', label: 'KUARTAL (3 BLN)' },
                    { value: 'SEMESTER', label: 'SEMESTER (6 BLN)' },
                    { value: 'TAHUNAN', label: 'TAHUNAN' }
                  ]}
                  onChange={(val) => setFilterPeriode(val as ReportPeriod)}
                  className="w-full text-[10px] sm:text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 pt-2">
              {filterPeriode === 'HARIAN' && (
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Pilih Tanggal</label>
                  <input 
                    type="date"
                    className="w-full text-[10px] sm:text-xs font-bold bg-white border border-zinc-200/80 rounded-xl px-3 py-2.5 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
              )}

              {filterPeriode !== 'HARIAN' && (
                <div className="flex-1 flex gap-2">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Tahun</label>
                    <CustomSelect 
                      className="w-full text-[10px] sm:text-xs font-bold"
                      value={String(selectedYear)}
                      options={Array.from({length: 5}).map((_, i) => {
                        const y = new Date().getFullYear() - i;
                        return { value: String(y), label: String(y) };
                      })}
                      onChange={(val) => setSelectedYear(Number(val))}
                    />
                  </div>
                  
                  {filterPeriode === 'KUARTAL' && (
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Kuartal</label>
                      <CustomSelect 
                        className="w-full text-[10px] sm:text-xs font-bold"
                        value={String(selectedKuartal)}
                        options={[
                          { value: '0', label: 'Q1 (Jan-Mar)' },
                          { value: '1', label: 'Q2 (Apr-Jun)' },
                          { value: '2', label: 'Q3 (Jul-Sep)' },
                          { value: '3', label: 'Q4 (Okt-Des)' }
                        ]}
                        onChange={(val) => setSelectedKuartal(Number(val))}
                      />
                    </div>
                  )}

                  {filterPeriode === 'SEMESTER' && (
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Semester</label>
                      <CustomSelect 
                        className="w-full text-[10px] sm:text-xs font-bold"
                        value={String(selectedSemester)}
                        options={[
                          { value: '0', label: 'S1 (Jan-Jun)' },
                          { value: '1', label: 'S2 (Jul-Des)' }
                        ]}
                        onChange={(val) => setSelectedSemester(Number(val))}
                      />
                    </div>
                  )}

                  {filterPeriode === 'BULANAN' && (
                    <div className="flex-[2] space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Bulan</label>
                      <CustomSelect 
                        className="w-full text-[10px] sm:text-xs font-bold"
                        value={String(selectedMonth)}
                        options={monthNames.map((m, i) => ({ value: String(i), label: m }))}
                        onChange={(val) => setSelectedMonth(Number(val))}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedBranch !== 'ALL' && (
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Pegawai Terkait</label>
                  <CustomSelect
                    value={selectedStaff}
                    options={staffOptions}
                    onChange={setSelectedStaff}
                    className="w-full text-[10px] sm:text-xs font-bold"
                  />
                </div>
              )}
            </div>

            {/* MONTH PAGINATION (Only if Kuartal, Semester, Tahunan) */}
            {paginationMonths.length > 0 && (
              <div className="pt-4 border-t border-zinc-100">
                <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                  {paginationMonths.map(m => {
                    const isActive = m === activePaginationMonth;
                    return (
                      <button
                        key={m}
                        onClick={() => setActivePaginationMonth(m)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition cursor-pointer shrink-0 ${isActive ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-zinc-50 text-zinc-500 border border-zinc-200 hover:bg-zinc-100'}`}
                      >
                        {monthNames[m]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* MAIN CONTENT */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="h-8 w-8 text-red-750 animate-spin" />
              <p className="text-xs text-zinc-500 font-extrabold uppercase tracking-widest">Sedang Menyinkronkan Data...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex flex-col items-center text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-red-750" />
              <h3 className="text-sm font-black text-red-950 uppercase">Koneksi Bermasalah</h3>
              <p className="text-xs text-red-900 max-w-md font-medium leading-relaxed">{error}</p>
              <button 
                onClick={loadAllOperationalData}
                className="mt-2 bg-red-800 hover:bg-red-900 text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition shadow-md active:scale-95"
              >
                Coba Sinkronisasi Ulang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* TIMELINE LIST */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    Rincian Harian
                  </h3>
                  <span className="text-[10px] bg-red-100 text-red-900 px-2 py-0.5 rounded-full font-black border border-red-200/50 uppercase">
                    {filterPeriode === 'HARIAN' ? selectedDate : monthNames[activePaginationMonth]}
                  </span>
                </div>

                {processedDays.length === 0 ? (
                  <div className="bg-white border border-zinc-200/80 rounded-[24px] p-10 text-center space-y-2 shadow-sm">
                    <Calendar className="h-8 w-8 text-zinc-300 mx-auto" />
                    <h4 className="text-xs font-black uppercase text-zinc-700">Tidak Ada Data</h4>
                    <p className="text-xs text-zinc-400 font-medium">Tidak ada rincian operasional pada periode terpilih.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {processedDays.map(day => {
                      const isExpanded = expandedDay === day.dateStr;
                      const statusBg = day.isOpen ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-zinc-50 border-zinc-200 text-zinc-500';
                      
                      return (
                        <div 
                          key={day.dateStr}
                          className="bg-white rounded-[20px] border border-zinc-200/80 overflow-hidden shadow-sm transition hover:border-zinc-300"
                        >
                          <button
                            onClick={() => toggleDayExpansion(day.dateStr)}
                            className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50/50 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex flex-col items-center justify-center border ${statusBg}`}>
                                <span className="text-[10px] sm:text-xs font-black leading-none">{day.dayDate.getDate()}</span>
                                <span className="text-[8px] sm:text-[9px] font-bold uppercase mt-0.5 opacity-80">{day.dayDate.toLocaleDateString('id-ID', { month: 'short' })}</span>
                              </div>
                              <div>
                                <h4 className="text-xs sm:text-sm font-black text-zinc-900 flex items-center gap-2">
                                  {day.dayName}
                                  {day.isOpen ? (
                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase border border-emerald-200">Buka</span>
                                  ) : (
                                    <span className="text-[9px] bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded font-bold uppercase border border-zinc-300">Tutup</span>
                                  )}
                                </h4>
                                <p className="text-[10px] sm:text-xs text-zinc-500 font-medium mt-1">
                                  {day.isOpen ? (
                                    `Terdapat ${day.ordersCount} pesanan tercatat`
                                  ) : (
                                    "Tidak ada pesanan tercatat"
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="text-zinc-400">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>
                          </button>

                          {/* EXPANDED DETAILS */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-zinc-100 bg-zinc-50/30">
                              {selectedBranch === 'ALL' ? (
                                // ALL BRANCHES SEPARATED VIEW
                                <div className="space-y-4 pt-3">
                                  {cabangList.map(cabang => {
                                    const bd = day.branchBreakdown?.[cabang.ID_CABANG] || { orders: 0, cashIn: 0, cashOut: 0, shifts: [] };
                                    
                                    return (
                                      <div key={cabang.ID_CABANG} className="bg-white border border-zinc-200/80 rounded-2xl p-4 space-y-4">
                                        <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
                                          <Building2 className="h-4 w-4 text-sky-600" />
                                          <h5 className="text-[11px] font-black text-zinc-900 uppercase tracking-widest">{cabang.NAMA_CABANG}</h5>
                                        </div>
                                        <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
                                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Total Pesanan</p>
                                          <p className="text-xs sm:text-sm font-black text-zinc-800">{bd.orders} Pesanan</p>
                                        </div>
                                        {bd.shifts.length > 0 ? (
                                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                            <p className="text-[9px] text-amber-700 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"><UserCheck className="h-3 w-3" /> Kehadiran</p>
                                            <ul className="space-y-1.5">
                                              {bd.shifts.map((sh, idx) => (
                                                <li key={idx} className="text-[10px] sm:text-xs text-amber-900 font-medium flex gap-2">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0" />
                                                  <span><span className="font-bold">{sh.NAMA_STAFF || getPegawaiName(sh.ID_PEGAWAI) || 'Unknown'}</span> (Izin: {sh.ALASAN || '-'})</span>
                                                </li>
                                              ))}
                                            </ul>
                                            <p className="text-[10px] sm:text-xs text-emerald-700 font-bold mt-2 pt-2 border-t border-amber-200/50 flex items-center gap-1.5">
                                              <CheckCircle2 className="h-3 w-3" /> Sisanya hadir
                                            </p>
                                          </div>
                                        ) : (bd.orders > 0) ? (
                                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            <p className="text-[10px] sm:text-xs text-emerald-800 font-bold">Semua staff hadir</p>
                                          </div>
                                        ) : (
                                          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2">
                                            <XCircle className="h-4 w-4 text-red-600" />
                                            <p className="text-[10px] sm:text-xs text-red-800 font-bold">Tidak ada jadwal hadir</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                // SINGLE BRANCH VIEW
                                <div className="space-y-3 pt-3">
                                  <div className="bg-white border border-zinc-200/80 rounded-xl p-3 shadow-sm">
                                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Pesanan Tercatat</p>
                                    <p className="text-xs sm:text-sm font-black text-zinc-800">{day.ordersCount} Pesanan</p>
                                  </div>
                                  <div className="bg-white border border-zinc-200/80 rounded-xl p-4 shadow-sm">
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5"><UserCheck className="h-4 w-4" /> Catatan Kehadiran</p>
                                    {day.shifts.length > 0 ? (
                                      <ul className="space-y-2">
                                        {day.shifts.map((sh, idx) => (
                                          <li key={idx} className="text-[10px] sm:text-xs text-zinc-700 font-medium flex gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0" />
                                            <span><span className="font-bold text-zinc-900">{sh.NAMA_STAFF || getPegawaiName(sh.ID_PEGAWAI) || 'Unknown'}</span> sedang izin. Alasan: {sh.ALASAN || '-'}</span>
                                          </li>
                                        ))}
                                        <li className="text-[10px] sm:text-xs text-emerald-700 font-bold mt-2 pt-2 border-t border-zinc-100 flex items-center gap-1.5">
                                          <CheckCircle2 className="h-3 w-3" /> Sisanya hadir
                                        </li>
                                      </ul>
                                    ) : (day.ordersCount > 0) ? (
                                      <p className="text-[10px] sm:text-xs text-emerald-700 font-bold flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" /> Semua staff terjadwal hadir.
                                      </p>
                                    ) : (
                                      <p className="text-[10px] sm:text-xs text-red-700 font-bold flex items-center gap-2">
                                        <XCircle className="h-4 w-4" /> Tidak ada jadwal hadir.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SUMMARY CARD */}
              <div className="space-y-6 relative">
                <div className="bg-white rounded-[24px] border border-zinc-200/80 p-5 sm:p-6 shadow-sm sticky top-6">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 border-b border-zinc-100 pb-3 mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-red-600" />
                    Sintesis Rekap
                  </h3>
                  
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-zinc-50 pb-2">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">Cabang</span>
                      <span className="text-[10px] font-black text-zinc-800 uppercase">{selectedBranch === 'ALL' ? 'Semua Cabang' : getCabangName(selectedBranch)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-50 pb-2">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">Hari Buka</span>
                      <span className="text-[10px] font-black text-zinc-900">{metrics.daysOpen}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-zinc-50 pb-2">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">Total Transaksi</span>
                      <span className="text-[10px] font-black text-zinc-900">{metrics.totalOrders}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">Total Izin</span>
                      <span className="text-[10px] font-black text-amber-700">{metrics.totalPermissions}</span>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
