import React, { useRef, useState, useEffect } from 'react';
import { Transaction } from '../types';
import { getFormattedMenuDisplay } from '../utils/formatter';
import { Printer, Copy, Check, FileCode, AlertCircle, Share2, PrinterIcon } from 'lucide-react';
import Barcode from 'react-barcode';

interface ReceiptProps {
  transaction: Transaction;
  hideSimulatorFrame?: boolean;
  branchName?: string;
  branchLocation?: string;
}

export default function ReceiptThermal({ transaction, hideSimulatorFrame, branchName, branchLocation }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printStatus, setPrintStatus] = useState<'idle' | 'generating' | 'success'>('idle');
  const [dbBranchName, setDbBranchName] = useState<string>('');
  const [dbBranchLocation, setDbBranchLocation] = useState<string>('');

  useEffect(() => {
    let active = true;
    import('../utils/db').then(({ getMasterData }) => {
      getMasterData().then(data => {
        if (!active) return;
        const b = data?.cabang?.find((c: any) => String(c.ID_CABANG) === String(transaction.cabang));
        if (b) {
          setDbBranchName(b.NAMA_CABANG);
          setDbBranchLocation(b.LOKASI || '');
        }
      }).catch(err => console.error("Error loading master data in ReceiptThermal", err));
    });
    return () => { active = false; };
  }, [transaction.cabang]);

  const total = Number(transaction.totalAmount || 0);

  const handleSimulatePrint = () => {
    setPrintStatus('generating');
    setTimeout(() => {
      setPrintStatus('success');
      setTimeout(() => setPrintStatus('idle'), 3000);
    }, 1200);
  };
  
  const finalBranchName = branchName || dbBranchName || transaction.cabang || 'MATARAM';
  const finalBranchLocation = branchLocation || dbBranchLocation || 'Jl. R Suprapto, Taman Sari, Mataram';

  const content = (
    <div 
      ref={receiptRef}
      className="p-6 bg-white font-mono text-[11px] text-[#09090b] leading-relaxed tracking-tight select-none border-b border-dashed border-[#d4d4d8]"
      style={{ fontFamily: '"Courier New", Courier, monospace' }}
    >
      <div className="text-center mb-4">
        <p className="text-base font-black tracking-widest uppercase text-black">AURA FOOD</p>
        <p className="text-[10px] mt-1 text-black">{finalBranchLocation}</p>
        <p className="text-[10px] text-black">Telp: 0821 4752 1751</p>
        <p className="text-[9px] text-black mt-0.5"><span className="font-bold">FB:</span> AuraFood &bull; <span className="font-bold">IG:</span> @aura_food22</p>
        <p className="my-2 border-t border-dashed border-black"></p>
      </div>

      <table className="w-full text-[10px] mb-3 text-black">
        <tbody>
          <tr>
            <td>No.</td>
            <td className="text-right font-bold text-black">{transaction.id}</td>
          </tr>
          <tr>
            <td>Tgl.</td>
            <td className="text-right">{new Date(transaction.timestamp).toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td>Cabang</td>
            <td className="text-right font-bold uppercase text-black">{finalBranchName}</td>
          </tr>
          <tr>
            <td>Metode</td>
            <td className="text-right font-bold uppercase text-black">
              {transaction.pesanan?.JENIS_PESANAN === 'Compliment' ? '-' : transaction.paymentMethod}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="my-2 border-t border-dashed border-black"></p>

      <div className="grid grid-cols-12 font-bold mb-1 text-[10px] text-black">
        <span className="col-span-6">ITEM</span>
        <span className="col-span-2 text-right">QTY</span>
        <span className="col-span-4 text-right">JUMLAH</span>
      </div>

      <p className="my-1 border-t border-dashed border-black"></p>

      <div className="space-y-2 mt-2 mb-3 text-black">
        {transaction.detail.filter(item => !(item.VARIAN === 'Diskon/Promo' || item.HARGA_SATUAN < 0 || item.NAMA_MENU.includes('[PROMO]'))).map((item, index) => (
          <div key={index} className="grid grid-cols-12 leading-tight">
            <span className="col-span-6 font-bold leading-tight pr-1 line-clamp-2">{getFormattedMenuDisplay(item.NAMA_MENU, item.VARIAN)}</span>
            <span className="col-span-2 text-right">{item.QTY}</span>
            <span className="col-span-4 text-right font-bold">
              Rp{Number(item.SUBTOTAL || 0).toLocaleString('id-ID')}
            </span>
            <span className="col-span-12 text-[9px] text-black mt-0.5">
              @ Rp{Number(item.HARGA_SATUAN || 0).toLocaleString('id-ID')}
            </span>
          </div>
        ))}
      </div>

      {(() => {
        const promoItems = transaction.detail.filter(item => (item.VARIAN === 'Diskon/Promo' || item.HARGA_SATUAN < 0 || item.NAMA_MENU.includes('[PROMO]')));
        const totalDiskon = promoItems.reduce((acc, item) => acc + Math.abs(item.SUBTOTAL), 0);
        const hasNotes = !!transaction.pesanan?.CATATAN;
        const hasPromoOrNotes = totalDiskon > 0 || hasNotes;

        if (!hasPromoOrNotes) return null;

        return (
          <>
            <p className="my-2 border-t border-dashed border-black"></p>
            {totalDiskon > 0 && (
              <div className="flex justify-between items-center py-0.5 text-[10px] text-black mb-1.5">
                <span className="font-bold uppercase tracking-widest text-black">Diskon/Potongan</span>
                <span className="font-bold text-black">-Rp{totalDiskon.toLocaleString('id-ID')}</span>
              </div>
            )}
            {hasNotes && (
              <div className="text-left py-1 text-black text-[10px] leading-relaxed break-words px-1 mb-1.5">
                <span className="font-bold">Catatan:</span>
                <p className="mt-1 normal-case text-zinc-850">{transaction.pesanan?.CATATAN}</p>
              </div>
            )}
          </>
        );
      })()}

      <p className="my-2 border-t-2 border-dashed border-black"></p>

      <div className="flex justify-between items-center py-1">
        <span className="font-bold text-xs uppercase tracking-widest text-black">Total</span>
        <span className="font-black text-sm text-black">Rp{total.toLocaleString('id-ID')}</span>
      </div>

      <p className="my-3 border-t border-dashed border-black"></p>

      <div className="text-center space-y-1 mb-2">
        <p className="text-[11px] font-black tracking-widest uppercase text-black">TERIMA KASIH</p>
        <p className="text-[9px] text-black pt-1">Barang yang sudah dibeli<br/>tidak dapat ditukar / dikembalikan</p>
      </div>

      <div className="flex flex-col items-center justify-center mt-3 scale-90 origin-top">
        <Barcode value={transaction.id} width={1.2} height={35} fontSize={10} margin={0} displayValue={true} background="transparent" />
      </div>
    </div>
  );

  if (hideSimulatorFrame) {
    return content;
  }

  return (
    <div className="flex flex-col items-center justify-center py-2 grayscale" id="thermal-section">
      <div className="w-full max-w-[340px] bg-white border border-[#d4d4d8] shadow-xl rounded-2xl overflow-hidden relative">
        <div className="bg-[#f4f4f5] px-4 py-2 flex justify-between items-center border-b border-[#e4e4e7]">
          <span className="text-[10px] font-mono font-bold text-[#52525b] uppercase tracking-widest flex items-center gap-1.5">
            <PrinterIcon className="h-3 w-3" />
            Thermal 80mm
          </span>
          <span className="h-2 w-2 rounded-full bg-[#a1a1aa]"></span>
        </div>

        {content}

      </div>
    </div>
  );
}
