// @ts-nocheck
import ReceiptPrinterEncoder from 'thermal-printer-encoder';
import { Transaction } from '../types';
import { getFormattedMenuDisplay } from './formatter';
import { getMasterData } from './db';

export const connectThermalPrinter = (): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    // For Capacitor/Cordova Android
    if (window.bluetoothSerial) {
      window.bluetoothSerial.isEnabled(
        () => {
          window.bluetoothSerial.list((devices: any[]) => {
            if (devices.length === 0) {
              alert("Tidak ada perangkat Bluetooth yang dipasangkan. Pasangkan printer Anda di Pengaturan Bluetooth HP terlebih dahulu.");
              resolve(null);
              return;
            }
            
            // Build simple UI overlay for printer selection
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0'; overlay.style.left = '0'; overlay.style.width = '100%'; overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
            overlay.style.zIndex = '999999';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.fontFamily = 'sans-serif';
            
            const modal = document.createElement('div');
            modal.style.backgroundColor = '#fff';
            modal.style.padding = '20px';
            modal.style.borderRadius = '24px';
            modal.style.width = '85%';
            modal.style.maxWidth = '320px';
            modal.style.maxHeight = '80vh';
            modal.style.overflowY = 'auto';
            modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
            
            const title = document.createElement('h3');
            title.innerText = 'Pilih Printer (Android)';
            title.style.margin = '0 0 15px 0';
            title.style.fontWeight = '900';
            title.style.color = '#18181b';
            title.style.textAlign = 'center';
            modal.appendChild(title);
            
            devices.forEach(device => {
              const btn = document.createElement('button');
              btn.innerText = device.name || device.address;
              btn.style.display = 'block';
              btn.style.width = '100%';
              btn.style.padding = '12px 16px';
              btn.style.marginBottom = '8px';
              btn.style.backgroundColor = '#f4f4f5';
              btn.style.color = '#18181b';
              btn.style.border = '1px solid #e4e4e7';
              btn.style.borderRadius = '12px';
              btn.style.fontWeight = 'bold';
              btn.style.textAlign = 'left';
              btn.onclick = () => {
                btn.innerText = 'Menghubungkan...';
                btn.style.opacity = '0.5';
                
                window.bluetoothSerial.connect(device.address, 
                  () => {
                    document.body.removeChild(overlay);
                    resolve({ name: device.name, address: device.address, isSerial: true });
                  },
                  (err: any) => {
                    document.body.removeChild(overlay);
                    alert('Gagal menghubungkan ke printer: ' + err);
                    resolve(null);
                  }
                );
              };
              modal.appendChild(btn);
            });
            
            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Batal';
            cancelBtn.style.display = 'block';
            cancelBtn.style.width = '100%';
            cancelBtn.style.padding = '12px 16px';
            cancelBtn.style.marginTop = '15px';
            cancelBtn.style.backgroundColor = '#fee2e2';
            cancelBtn.style.color = '#991b1b';
            cancelBtn.style.border = 'none';
            cancelBtn.style.borderRadius = '12px';
            cancelBtn.style.fontWeight = 'bold';
            cancelBtn.onclick = () => {
              document.body.removeChild(overlay);
              resolve(null);
            };
            modal.appendChild(cancelBtn);
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
          }, reject);
        },
        () => {
          alert('Bluetooth mati. Harap hidupkan Bluetooth pada HP Android Anda terlebih dahulu.');
          resolve(null);
        }
      );
      return;
    }

    // For Chrome Browser (PC/Android Web)
    try {
      if (!navigator.bluetooth) {
        alert("Akses Bluetooth tidak didukung di perangkat/browser ini.\n\nJika di aplikasi Android, pastikan instalasi berhasil.");
        resolve(null);
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      if (device) {
        console.log("Printer connected:", device.name);
        resolve(device);
      }
    } catch (error: any) {
      console.error("Bluetooth Connection Error:", error);
      if (error.message && !error.message.includes('User cancelled')) {
         alert(`Gagal konek: ${error.message}`);
      }
      resolve(null);
    }
  });
};

export const printThermalReceipt = async (device: BluetoothDevice | null, tx: Transaction, cabangName: string) => {
  const masterData = await getMasterData().catch(() => null);
  const branchObj = masterData?.cabang?.find((c: any) => String(c.ID_CABANG) === String(tx.cabang));
  const finalBranchLocation = branchObj?.LOKASI || 'Jl. R Suprapto, Taman Sari, Mataram';

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
    .text(finalBranchLocation)
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
    .newline();

  if (tx.pesanan?.JENIS_PESANAN === 'Compliment') {
    receipt.text('Status: COMPLIMENT')
      .newline();
  }

  receipt.text(`Metode: ${tx.pesanan?.JENIS_PESANAN === 'Compliment' ? 'GRATIS' : tx.paymentMethod.toUpperCase()}`)
    .newline();

  receipt.align('center')
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
    .newline();

  if (tx.pesanan?.CATATAN) {
    receipt.align('left')
      .bold(true)
      .text('Catatan:')
      .bold(false)
      .newline()
      .text(tx.pesanan.CATATAN)
      .newline()
      .newline();
  }

  receipt.align('center')
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

  if (device && (device as any).isSerial) {
    if ((window as any).bluetoothSerial) {
      (window as any).bluetoothSerial.write(resultBytes, () => {
        console.log("Successfully sent ESC/POS bytes via Bluetooth Serial!");
      }, (err: any) => {
        alert("Gagal mencetak via Bluetooth Android: " + err);
      });
    }
  } else if (device && device.gatt) {
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
