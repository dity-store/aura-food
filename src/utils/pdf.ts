import { formatToIDDateTime } from "./date";
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { Transaction } from '../types';
import { getFormattedMenuDisplay } from './formatter';
import { getGASConfig, getMasterData } from './db';

/**
 * Generates a clean, professional PDF using text-based commands (selectable text)
 * and uploads it to Google Drive via GAS.
 */
export const generateAndUploadReceipt = async (tx: Transaction, activeBranch: string) => {
  try {
    const branchName = tx.cabang || tx.pesanan?.ID_CABANG || activeBranch || 'MATARAM';
    const isPraya = branchName === 'PRAYA' || tx.pesanan?.ID_CABANG === '1' || activeBranch === '1';
    const finalBranchLocation = isPraya 
      ? "Jl. Raya Praya Mantang, Ujan Rintis, Praya"
      : "Jl. R Suprapto, Taman Sari, Mataram";

    // PDF Size: 80mm width (thermal), dynamic height
    // We estimate height based on items
    const itemHeight = 8;
    const baseHeight = 150; // Increased base height to ensure barcode and ID are included
    const calculatedHeight = baseHeight + (tx.detail.length * itemHeight);
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, calculatedHeight]
    });

    // Set Font
    pdf.setFont('courier', 'bold');
    
    let y = 10;
    const centerX = 40;

    // Header
    pdf.setFontSize(14);
    pdf.text('AURA FOOD', centerX, y, { align: 'center' });
    y += 6;
    
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(8);
    pdf.text(finalBranchLocation, centerX, y, { align: 'center' });
    y += 4;
    pdf.text('Telp: 0821 4752 1751', centerX, y, { align: 'center' });
    y += 4;
    pdf.text('FB: AuraFood • IG: @aura_food22', centerX, y, { align: 'center' });
    y += 5;

    // Separator
    pdf.text('------------------------------------------', centerX, y, { align: 'center' });
    y += 5;

    // Info Table
    pdf.setFontSize(8);
    const labelX = 5;
    const valueX = 22;
    
    pdf.text('No.', labelX, y); pdf.text(`: ${tx.id}`, valueX, y); y += 4;
    pdf.text('Tgl.', labelX, y); pdf.text(`: ${formatToIDDateTime(tx.timestamp)}`, valueX, y); y += 4;
    pdf.text('Cabang', labelX, y); pdf.text(`: ${branchName}`, valueX, y); y += 4;
    pdf.text('Metode', labelX, y); pdf.text(`: ${tx.pesanan?.JENIS_PESANAN === 'Compliment' ? 'GRATIS' : tx.paymentMethod.toUpperCase()}`, valueX, y); y += 4;
    
    if (tx.pesanan?.JENIS_PESANAN === 'Compliment') {
      pdf.text('Status', labelX, y); pdf.text(': COMPLIMENT', valueX, y); y += 4;
    }
    y += 1;

    // Separator
    pdf.text('------------------------------------------', centerX, y, { align: 'center' });
    y += 5;

    // Items Header
    pdf.setFont('courier', 'bold');
    pdf.text('ITEM', 5, y);
    pdf.text('QTY', 45, y, { align: 'right' });
    pdf.text('JUMLAH', 75, y, { align: 'right' });
    y += 4;
    
    pdf.setFont('courier', 'normal');
    pdf.text('------------------------------------------', centerX, y, { align: 'center' });
    y += 6;

    // Items
    tx.detail.forEach((item) => {
      // Skip system items that are handled separately as promos/charges
      if (item.ID_MENU === 'PROMO' || item.HARGA_SATUAN < 0 || item.ID_MENU === 'CHARGE') return;
      
      pdf.setFont('courier', 'bold');
      const menuName = getFormattedMenuDisplay(item.NAMA_MENU, item.VARIAN);
      const splitName = pdf.splitTextToSize(menuName, 35);
      const displayLines = splitName.slice(0, 2);
      
      pdf.text(displayLines, 5, y);
      pdf.text(String(item.QTY), 45, y, { align: 'right' });
      pdf.text(`Rp${item.SUBTOTAL.toLocaleString('id-ID')}`, 75, y, { align: 'right' });
      
      y += (displayLines.length * 4);
      
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(7);
      pdf.text(`@ Rp${item.HARGA_SATUAN.toLocaleString('id-ID')}`, 5, y - 1);
      pdf.setFontSize(8);
      y += 5;
    });

    // Promos & Charges Section (Itemized)
    const fullCatatan = tx.pesanan?.CATATAN || '';
    const parts = fullCatatan.split('|');
    const promos: { name: string, amount: number }[] = [];
    const charges: { name: string, amount: number }[] = [];

    // From structured metadata
    if (tx.pesanan?.PROMOS) {
      tx.pesanan.PROMOS.forEach(p => {
        const price = p.discountedPrice !== undefined ? p.discountedPrice : p.varian.HARGA;
        promos.push({ name: p.menu.NAMA_MENU, amount: price * p.quantity });
      });
    }
    if (tx.pesanan?.ADDITIONAL_CHARGES) {
      tx.pesanan.ADDITIONAL_CHARGES.forEach(c => {
        charges.push({ name: c.name, amount: c.price * c.qty });
      });
    }

    // Fallback: Parse from string
    if (promos.length === 0 && parts.length >= 1 && parts[0].trim() && parts[0].trim() !== 'Promo/Potongan') {
      parts[0].trim().split(', ').forEach(item => {
        const match = item.match(/(.*) \(-Rp([\d.]+)\)/);
        if (match) promos.push({ name: match[1], amount: -Number(match[2].replace(/\./g, '')) });
      });
    }
    if (charges.length === 0 && parts.length >= 2 && parts[1].trim()) {
      parts[1].trim().split(', ').forEach(item => {
        const match = item.match(/(.*) \(Rp([\d.]+)\)/);
        if (match) charges.push({ name: match[1], amount: Number(match[2].replace(/\./g, '')) });
      });
    }

    if (promos.length > 0 || charges.length > 0) {
      pdf.text('-'.repeat(45), centerX, y, { align: 'center' });
      y += 4;
      
      promos.forEach(p => {
        pdf.setFont('courier', 'bold');
        pdf.text(p.name.replace('[PROMO] ', ''), 5, y);
        pdf.setFont('courier', 'normal');
        pdf.text('1', 45, y, { align: 'right' });
        pdf.text(`-Rp${Math.abs(p.amount).toLocaleString('id-ID')}`, 75, y, { align: 'right' });
        y += 5;
      });

      charges.forEach(c => {
        pdf.setFont('courier', 'bold');
        pdf.text(c.name, 5, y);
        pdf.setFont('courier', 'normal');
        pdf.text('1', 45, y, { align: 'right' });
        pdf.text(`Rp${c.amount.toLocaleString('id-ID')}`, 75, y, { align: 'right' });
        y += 5;
      });
    }

    // Subtotal Separator
    pdf.text('==========================================', centerX, y, { align: 'center' });
    y += 6;

    // Total
    pdf.setFontSize(10);
    pdf.setFont('courier', 'bold');
    pdf.text('TOTAL', 5, y);
    pdf.text(`Rp${tx.totalAmount.toLocaleString('id-ID')}`, 75, y, { align: 'right' });
    y += 10;

    if (tx.pesanan?.CATATAN) {
      const displayNote = parts.length >= 3 ? parts[2].trim() : (fullCatatan.includes('|') ? '' : fullCatatan.trim());
      if (displayNote) {
        pdf.setFontSize(8);
        pdf.setFont('courier', 'bold');
        pdf.text('Catatan:', 5, y);
        y += 4;
        pdf.setFont('courier', 'normal');
        const splitCatatan = pdf.splitTextToSize(displayNote, 70);
        pdf.text(splitCatatan, 5, y);
        y += (splitCatatan.length * 4) + 4;
      }
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setFont('courier', 'bold');
    pdf.text('TERIMA KASIH', centerX, y, { align: 'center' });
    y += 6;
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(7);
    pdf.text('Barang yang sudah dibeli', centerX, y, { align: 'center' }); y += 4;
    pdf.text('tidak dapat ditukar / dikembalikan', centerX, y, { align: 'center' }); y += 6;

    // Barcode Generation
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, tx.id, {
        format: "CODE128",
        width: 1.5,
        height: 40,
        displayValue: false,
        margin: 0,
        background: "#ffffff"
      });
      const barcodeData = canvas.toDataURL("image/png");
      pdf.addImage(barcodeData, 'PNG', 20, y, 40, 8); 
      y += 10;
    } catch (e) {
      console.warn("Barcode gen failed", e);
    }

    // Barcode Text (Centered ID)
    pdf.setFontSize(7);
    pdf.setFont('courier', 'bold');
    pdf.text(tx.id, centerX, y, { align: 'center' });

    // Output base64 string
    const base64Uri = pdf.output('datauristring');
    const base64Pdf = base64Uri.split(',')[1];

    // Determine Filename (ID | Branch) as requested: "di nama file itu, bukan di id nya"
    const customFilename = `${tx.id}-${activeBranch.toUpperCase()}`;

    // 3. Send to GAS API
    const config = getGASConfig();
    if (config?.webAppUrl && navigator.onLine) {
      // We use idPesanan as the filename base
      fetch(config.webAppUrl, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'UPLOAD_RECEIPT',
          idPesanan: customFilename, 
          totalTagihan: tx.totalAmount,
          idCabang: activeBranch,
          pdfBase64: base64Pdf
        }),
        headers: {
           'Content-Type': 'text/plain;charset=utf-8',
        }
      }).catch(err => console.warn('Upload error:', err));
    }
  } catch (err) {
    console.warn("Error generating text-based PDF:", err);
  }
};

export const printReceipt = async (tx: Transaction, activeBranch: string) => {
  window.print();
  return generateAndUploadReceipt(tx, activeBranch);
};
