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
        {transaction.detail.filter(item => !(
          item.VARIAN === 'Diskon/Promo' || 
          item.HARGA_SATUAN < 0 || 
          item.NAMA_MENU.includes('[PROMO]') ||
          item.ID_MENU === 'CHARGE' ||
          item.ID_VARIAN === 'CHARGE'
        )).map((item, index) => (
          <div key={index} className="grid grid-cols-12 leading-tight">
            <span className="col-span-6 font-bold leading-tight pr-1 line-clamp-2">
              {getFormattedMenuDisplay(item.NAMA_MENU, item.VARIAN)}
              {item.PROMO_ID && <span className="ml-1 text-[8px] border border-black px-0.5 font-black">PROMO</span>}
            </span>
            <span className="col-span-2 text-right">{item.QTY}</span>
            <span className="col-span-4 text-right font-bold">
              {item.isCompliment ? 'GRATIS' : `Rp${Number(item.SUBTOTAL || 0).toLocaleString('id-ID')}`}
            </span>
            <span className="col-span-12 text-[9px] text-black mt-0.5 flex items-center gap-2">
              {item.isCompliment ? '@ Rp0 (COMPLIMENT)' : `@ Rp${Number(item.HARGA_SATUAN || 0).toLocaleString('id-ID')}`}
              {item.ORIGINAL_PRICE && item.ORIGINAL_PRICE > item.HARGA_SATUAN && !item.isCompliment && (
                <span className="line-through opacity-60 font-normal">Rp{Number(item.ORIGINAL_PRICE).toLocaleString('id-ID')}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {(() => {
        const fullCatatan = transaction.pesanan?.CATATAN || '';
        const parts = fullCatatan.split('|');
        
        // Find promos in detail (for older transactions) or metadata (for newer transactions)
        const promoItemsFromDetail = transaction.detail.filter(item => 
          item.ID_MENU === 'PROMO' || item.HARGA_SATUAN < 0 || (item.NAMA_MENU && String(item.NAMA_MENU).includes('[PROMO]'))
        );
        const promoItemsFromMeta = transaction.pesanan?.PROMOS || [];
        
        // Extract promos from Catatan string if meta is empty
        const promosFromCatatan: { name: string, subtotal: number }[] = [];
        if (promoItemsFromMeta.length === 0 && parts.length >= 1 && parts[0].trim() && parts[0].trim() !== 'Promo/Potongan') {
          const promoStr = parts[0].trim();
          // Example: "Promo Name (-Rp10.000), Other Promo (-Rp5.000)"
          const items = promoStr.split(', ');
          items.forEach(item => {
            const match = item.match(/(.*) \(-Rp([\d.]+)\)/);
            if (match) {
              promosFromCatatan.push({
                name: match[1],
                subtotal: -Number(match[2].replace(/\./g, ''))
              });
            }
          });
        }

        const chargesFromDetail = transaction.detail.filter(item => 
          item.ID_MENU === 'CHARGE' || item.ID_VARIAN === 'CHARGE' || item.NAMA_MENU === 'Parkir'
        );
        const chargesFromMeta = transaction.pesanan?.ADDITIONAL_CHARGES || [];
        
        // Extract charges from Catatan string if meta is empty
        const chargesFromCatatan: { name: string, subtotal: number }[] = [];
        if (chargesFromMeta.length === 0 && parts.length >= 2 && parts[1].trim()) {
          const chargeStr = parts[1].trim();
          // Example: "Parkir (Rp2.000), Admin (Rp1.000)"
          const items = chargeStr.split(', ');
          items.forEach(item => {
            const match = item.match(/(.*) \(Rp([\d.]+)\)/);
            if (match) {
              chargesFromCatatan.push({
                name: match[1],
                subtotal: Number(match[2].replace(/\./g, ''))
              });
            }
          });
        }

        const hasPromos = promoItemsFromDetail.length > 0 || promoItemsFromMeta.length > 0 || promosFromCatatan.length > 0;
        const hasCharges = chargesFromDetail.length > 0 || chargesFromMeta.length > 0 || chargesFromCatatan.length > 0;
        
        if (!hasPromos && !hasCharges) return null;

        return (
          <div className="mt-2 space-y-2 border-t border-dashed border-black pt-2">
            {/* Promos from Detail */}
            {promoItemsFromDetail.map((p, i) => (
              <div key={`pd-${i}`} className="grid grid-cols-12 leading-tight text-[10px] text-black">
                <span className="col-span-6 font-bold line-clamp-2">{String(p.NAMA_MENU).replace('[PROMO] ', '')}</span>
                <span className="col-span-2 text-right">{p.QTY}</span>
                <span className="col-span-4 text-right font-bold">-Rp{Math.abs(p.SUBTOTAL).toLocaleString('id-ID')}</span>
              </div>
            ))}
            {/* Promos from Meta */}
            {promoItemsFromMeta.map((p, i) => {
              const price = p.discountedPrice !== undefined ? p.discountedPrice : p.varian.HARGA;
              const subtotal = price * p.quantity;
              return (
                <div key={`pm-${i}`} className="grid grid-cols-12 leading-tight text-[10px] text-black">
                  <span className="col-span-6 font-bold line-clamp-2">{p.menu.NAMA_MENU.replace('[PROMO] ', '')}</span>
                  <span className="col-span-2 text-right">{p.quantity}</span>
                  <span className="col-span-4 text-right font-bold">-Rp{Math.abs(subtotal).toLocaleString('id-ID')}</span>
                </div>
              );
            })}
            {/* Promos from Catatan */}
            {promosFromCatatan.map((p, i) => (
              <div key={`pc-${i}`} className="grid grid-cols-12 leading-tight text-[10px] text-black">
                <span className="col-span-6 font-bold line-clamp-2">{p.name}</span>
                <span className="col-span-2 text-right">1</span>
                <span className="col-span-4 text-right font-bold">-Rp{Math.abs(p.subtotal).toLocaleString('id-ID')}</span>
              </div>
            ))}
            {/* Charges from Detail */}
            {chargesFromDetail.map((c, i) => (
              <div key={`cd-${i}`} className="grid grid-cols-12 leading-tight text-[10px] text-black">
                <span className="col-span-6 font-bold line-clamp-2">{c.NAMA_MENU}</span>
                <span className="col-span-2 text-right">{c.QTY}</span>
                <span className="col-span-4 text-right font-bold">Rp{c.SUBTOTAL.toLocaleString('id-ID')}</span>
              </div>
            ))}
            {/* Charges from Meta */}
            {chargesFromMeta.map((c, i) => (
              <div key={`cm-${i}`} className="grid grid-cols-12 leading-tight text-[10px] text-black">
                <span className="col-span-6 font-bold line-clamp-2">{c.name}</span>
                <span className="col-span-2 text-right">{c.qty}</span>
                <span className="col-span-4 text-right font-bold">Rp{(c.price * c.qty).toLocaleString('id-ID')}</span>
              </div>
            ))}
            {/* Charges from Catatan */}
            {chargesFromCatatan.map((c, i) => (
              <div key={`cc-${i}`} className="grid grid-cols-12 leading-tight text-[10px] text-black">
                <span className="col-span-6 font-bold line-clamp-2">{c.name}</span>
                <span className="col-span-2 text-right">1</span>
                <span className="col-span-4 text-right font-bold">Rp{c.subtotal.toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        );
      })()}

      <p className="mt-1 border-t-2 border-black border-double h-1"></p>

      <div className="flex justify-between items-center py-1 text-black">
        <span className="text-sm font-black uppercase tracking-tight">Total</span>
        <span className="text-sm font-black tracking-tight">Rp{transaction.pesanan?.TOTAL_TAGIHAN.toLocaleString('id-ID')}</span>
      </div>

      {(() => {
        const fullCatatan = transaction.pesanan?.CATATAN || '';
        if (!fullCatatan) return null;

        const parts = fullCatatan.split('|');
        let userNotePart = '';
        
        if (parts.length >= 3) {
          // New format
          userNotePart = parts[2].trim();
        } else if (fullCatatan.includes('|')) {
          // Partial pipe format, maybe only 1 or 2 parts? 
          // If there's a pipe, it's likely the new system. 
          // If the 3rd part is missing, it means there's no note.
          userNotePart = ''; 
        } else {
          // Old plain format
          userNotePart = fullCatatan.trim();
        }

        if (!userNotePart) return null;

        return (
          <div className="mt-2 pt-2 border-t border-dotted border-black/30">
            <div className="text-left">
              <p className="text-[8px] font-black uppercase text-black mb-0.5">Catatan:</p>
              <p className="text-[10px] leading-tight text-zinc-900 italic font-medium">"{userNotePart}"</p>
            </div>
          </div>
        );
      })()}

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
      <div className="w-full max-w-[340px] bg-white border border-[#d4d4d8] shadow-xl rounded-2xl overflow-hidden relative print:border-none print:shadow-none print:max-w-none">
        <div className="bg-[#f4f4f5] px-4 py-2 flex justify-between items-center border-b border-[#e4e4e7] print:hidden">
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
