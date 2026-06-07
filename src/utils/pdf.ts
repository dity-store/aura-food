import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { Transaction } from '../types';
import { getFormattedMenuDisplay } from './formatter';
import { getGASConfig } from './db';

/**
 * Generates a clean, professional PDF using text-based commands (selectable text)
 * and uploads it to Google Drive via GAS.
 */
export const generateAndUploadReceipt = async (tx: Transaction, activeBranch: string) => {
  try {
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
    pdf.text('Jl. R Suprapto, Taman Sari, Mataram', centerX, y, { align: 'center' });
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
    pdf.text('Tgl.', labelX, y); pdf.text(`: ${new Date(tx.timestamp).toLocaleString('id-ID')}`, valueX, y); y += 4;
    pdf.text('Cabang', labelX, y); pdf.text(`: ${activeBranch.toUpperCase()}`, valueX, y); y += 4;
    pdf.text('Kasir', labelX, y); pdf.text(`: REGULER`, valueX, y); y += 4;
    pdf.text('Bayar', labelX, y); pdf.text(`: ${tx.paymentMethod.toUpperCase()}`, valueX, y); y += 5;

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
      pdf.setFont('courier', 'bold');
      
      // Handle multi-line menu names (Max 2 lines as requested)
      const menuName = getFormattedMenuDisplay(item.NAMA_MENU, item.VARIAN);
      const splitName = pdf.splitTextToSize(menuName, 35);
      const displayLines = splitName.slice(0, 2); // Max 2 lines
      
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

    // Subtotal Separator
    pdf.text('==========================================', centerX, y, { align: 'center' });
    y += 6;

    // Total
    pdf.setFontSize(10);
    pdf.setFont('courier', 'bold');
    pdf.text('TOTAL', 5, y);
    pdf.text(`Rp${tx.totalAmount.toLocaleString('id-ID')}`, 75, y, { align: 'right' });
    y += 10;

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
    console.error("Error generating text-based PDF:", err);
  }
};

export const printReceipt = async (tx: Transaction, activeBranch: string) => {
  window.print();
  return generateAndUploadReceipt(tx, activeBranch);
};
