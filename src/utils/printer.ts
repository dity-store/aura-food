// @ts-nocheck
import ReceiptPrinterEncoder from 'thermal-printer-encoder';
import { Transaction } from '../types';
import { getFormattedMenuDisplay } from './formatter';

export const connectThermalPrinter = async (): Promise<BluetoothDevice | null> => {
  try {
    if (!navigator.bluetooth) {
      alert("Browser Anda tidak mendukung Web Bluetooth API. Gunakan peramban Chrome untuk Android atau PC.");
      return null;
    }

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    });

    if (device) {
      console.log("Printer connected:", device.name);
      return device;
    }
  } catch (error: any) {
    console.error("Bluetooth Connection Error:", error);
    if (error.message && !error.message.includes('User cancelled')) {
       alert(`Gagal konek: ${error.message}`);
    }
  }
  return null;
};

export const printThermalReceipt = async (device: BluetoothDevice | null, tx: Transaction, cabangName: string) => {
  // Use thermal-printer-encoder to generate exactly matching bytes as the PDF
  const encoder = new ReceiptPrinterEncoder({
      language: 'esc-pos'
  });

  // Calculate spaces for formatting
  const line = '--------------------------------';
  const lineEqual = '================================';

  let receipt = encoder.initialize()
    .codepage('cp858')
    .align('center')
    .bold(true)
    .text('AURA FOOD')
    .bold(false)
    .newline()
    .text('Jl. R Suprapto, Taman Sari, Mataram')
    .newline()
    .text('Telp: 0821 4752 1751')
    .newline()
    .text('FB: AuraFood * IG: @aura_food22')
    .newline()
    .text(line)
    .newline()
    .align('left')
    .text(`No.   : ${tx.id}`)
    .newline()
    .text(`Tgl.  : ${new Date(tx.timestamp).toLocaleString('id-ID')}`)
    .newline()
    .text(`Cabang: ${cabangName.toUpperCase()}`)
    .newline()
    .text(`Kasir : REGULER`)
    .newline()
    .text(`Bayar : ${tx.paymentMethod.toUpperCase()}`)
    .newline()
    .align('center')
    .text(line)
    .newline()
    // Manual text aligning for headers
    .align('left')
    .bold(true)
    .text('ITEM        QTY           JUMLAH')
    .bold(false)
    .newline()
    .align('center')
    .text(line)
    .newline()
    .align('left');

  if (tx.detail) {
    tx.detail.forEach((item: any) => {
      const menuName = getFormattedMenuDisplay(item.NAMA_MENU, item.VARIAN);
      
      receipt.bold(true)
        .text(menuName)
        .bold(false)
        .newline()
        // Create padding between QTY and SUBTOTAL
        .text(`${item.QTY}`)
        .text(`                Rp${item.SUBTOTAL.toLocaleString('id-ID')}`.slice(-20))
        .newline()
        .text(`@ Rp${item.HARGA_SATUAN.toLocaleString('id-ID')}`)
        .newline();
    });
  }

  receipt.align('center')
    .text(lineEqual)
    .newline()
    .align('left')
    .bold(true)
    .text('TOTAL')
    .text(`                    Rp${tx.totalAmount.toLocaleString('id-ID')}`.slice(-24))
    .bold(false)
    .newline()
    .newline()
    .align('center')
    .bold(true)
    .text('TERIMA KASIH')
    .bold(false)
    .newline()
    .text('Barang yang sudah dibeli')
    .newline()
    .text('tidak dapat ditukar / dikembalikan')
    .newline()
    .newline()
    .barcode(tx.id, 'code128')
    .newline()
    .text(tx.id)
    .newline()
    .newline()
    .newline();

  const resultBytes = receipt.encode();

  if (device && device.gatt) {
    try {
      const server = await device.gatt.connect();
      console.log("GATT Server connected", server);
      
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      
      // Sending in chunks if large
      const chunkSize = 512;
      for (let i = 0; i < resultBytes.length; i += chunkSize) {
          const chunk = resultBytes.slice(i, i + chunkSize);
          await characteristic.writeValue(chunk);
      }
      console.log("Successfully sent ESC/POS bytes to Thermal Printer!");
    } catch (err) {
      console.error("GATT write error / Not supported via WebBLE for this printer model:", err);
      // alert("Simulasi cetak ESC/POS berhasil di-generate. " + err.message);
    }
  } else {
    console.log("Printer not available, printing raw bytes to console.");
  }
};
