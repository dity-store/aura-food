const ZONA_WAKTU = "Asia/Makassar";
const ROOT_FOLDER_ID = "1YzbiIG_bQzjQnLiVhx0UrzAmJXrQcdU1"; 

function doGet(e) {
  try {
    if (e.parameter.action === 'getMasterData') {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: {
          cabang: getSheetDataAsJSON("Master_Cabang"),
          kategori: getSheetDataAsJSON("Master_Kategori"),
          menu: getSheetDataAsJSON("Master_Menu"),
          varian: getSheetDataAsJSON("Master_Varian"),
          promo: getSheetDataAsJSON("Master_Promo"),
          pegawai: getSheetDataAsJSON("Master_Pegawai") || getSheetDataAsJSON("pegawai")
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (e.parameter.action === 'get_receipt') {
      const idPesanan = e.parameter.id_pesanan;
      const p = getSheetDataAsJSON("Data_Pesanan").find(x => x.ID_PESANAN === idPesanan);
      const d = getSheetDataAsJSON("Detail_Pesanan").filter(x => x.ID_PESANAN === idPesanan);
      return ContentService.createTextOutput(JSON.stringify({status: "success", data: {pesanan: p, detail: d}})).setMimeType(ContentService.MimeType.JSON);
    }
    throw new Error("Action tidak valid.");
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. FITUR LOGIN
    if (payload.mode === "LOGIN") {
      const { namaCabang, password } = payload;
      const dataCabang = getSheetDataAsJSON("Master_Cabang");
      const user = dataCabang.find(c => 
        String(c.NAMA_CABANG).trim().toLowerCase() === String(namaCabang).trim().toLowerCase() && 
        String(c.PASSWORD).trim() === String(password).trim()
      );
      
      if (user) {
        return ContentService.createTextOutput(JSON.stringify({status: "success", data: user})).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Nama Cabang atau Password salah"})).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 2. FITUR UPLOAD PDF
    if (payload.mode === "UPLOAD_RECEIPT") {
      const { idPesanan, totalTagihan, idCabang, pdfBase64 } = payload;
      const master = getSheetDataAsJSON("Master_Cabang");
      let namaC = idCabang;
      const c = master.find(x => String(x.ID_CABANG).trim() === String(idCabang).trim());
      if(c) namaC = c.NAMA_CABANG;

      const dNow = new Date();
      const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const dN = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const namaHariTgl = `${dN[dNow.getDay()]}, ${Utilities.formatDate(dNow, ZONA_WAKTU, "dd")} ${mN[dNow.getMonth()]} ${Utilities.formatDate(dNow, ZONA_WAKTU, "yyyy")}`;

      const root = getSafeRootFolder("Invoice & Struk");
      const fThn = getOrCreateFolder(root, Utilities.formatDate(dNow, ZONA_WAKTU, "yyyy"));
      const fBln = getOrCreateFolder(fThn, mN[dNow.getMonth()]);
      const fCab = getOrCreateFolder(fBln, namaC);
      const fStruk = getOrCreateFolder(fCab, "Struk " + mN[dNow.getMonth()]);
      const fHari = getOrCreateFolder(fStruk, namaHariTgl);

      const blob = Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', `${idPesanan} | ${totalTagihan}.pdf`);
      fHari.createFile(blob);
      return ContentService.createTextOutput(JSON.stringify({status: "success", url: fHari.getUrl()})).setMimeType(ContentService.MimeType.JSON);
    }

    // 2b. FITUR UPLOAD FOTO BUKTI KAS
    if (payload.mode === "UPLOAD_BUKTI_KAS") {
      const { base64Data, filename, mimeType } = payload;
      const root = getSafeRootFolder("Bukti_Buku_Kas");
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
      const file = root.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", 
        url: file.getUrl(),
        downloadUrl: "https://docs.google.com/uc?export=view&id=" + file.getId()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. FITUR POST TRANSAKSI
    if (payload.mode === "POST_TRANSACTION") {
      const p = payload.payload.pesanan;
      ss.getSheetByName("Data_Pesanan").appendRow([
        p.ID_PESANAN, 
        p.TANGGAL_WAKTU, 
        p.ID_CABANG, 
        p.TOTAL_TAGIHAN, 
        p.METODE_BAYAR, 
        "Sukses", 
        p.JENIS_PESANAN || "Normal", 
        p.CATATAN || ""
      ]);
      payload.payload.detail.forEach(i => {
        ss.getSheetByName("Detail_Pesanan").appendRow([i.ID_DETAIL, p.ID_PESANAN, i.NAMA_MENU, i.VARIAN, i.HARGA_SATUAN, i.QTY, i.SUBTOTAL]);
      });
      return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 4. UNIVERSAL DATA OPERATIONS (INSERT/UPDATE/DELETE)
    if (payload.mode === "INSERT_DATA" || payload.mode === "UPDATE_DATA" || payload.mode === "UPDATE_DATA_MATCH") {
       const sheet = ss.getSheetByName(payload.sheetName);
       if (!sheet) throw new Error("Sheet " + payload.sheetName + " tidak ditemukan.");
       const headers = sheet.getDataRange().getValues()[0];
       
       if (payload.mode === "INSERT_DATA") {
         const newRow = headers.map(h => payload.data[h] || "");
         sheet.appendRow(newRow);
       } else if (payload.mode === "UPDATE_DATA_MATCH") {
         const data = sheet.getDataRange().getValues();
         const match = payload.matchData;
         for (let i = 1; i < data.length; i++) {
           let isMatch = true;
           Object.keys(match).forEach(k => {
             const hIdx = headers.indexOf(k);
             if (hIdx === -1 || String(data[i][hIdx]) !== String(match[k])) isMatch = false;
           });
           if (isMatch) {
             headers.forEach((h, hIdx) => {
               if (payload.data[h] !== undefined) sheet.getRange(i + 1, hIdx + 1).setValue(payload.data[h]);
             });
             break;
           }
         }
       }
       return ContentService.createTextOutput(JSON.stringify({status: "success"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 5. REPORTING & DASHBOARD
    if (payload.mode === "GET_ADMIN_REPORTS" || payload.mode === "GET_ADMIN_DASHBOARD") {
        const idCabang = payload.id_cabang;
        const periode = String(payload.periode || '').toUpperCase();
        const jenisData = String(payload.jenis_data || '').toUpperCase();
        const paramTanggal = payload.tanggal, paramBulan = Number(payload.bulan), paramTahun = Number(payload.tahun);
        const paramKuartal = String(payload.kuartal || '').toUpperCase(), paramSemester = String(payload.semester || '').toUpperCase();

        if (payload.mode === "GET_ADMIN_DASHBOARD") {
            let pesanan = getSheetDataAsJSON("Data_Pesanan");
            const detail = getSheetDataAsJSON("Detail_Pesanan");
            if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
              pesanan = pesanan.filter(x => isSameId(x.ID_CABANG, idCabang));
            }
            let totalRevenue = 0, mak = 0, min = 0, pas = 0, spe = 0;
            let totalCash = 0, totalTransfer = 0;
            pesanan.forEach(p => {
              let jenisPesanan = String(p.JENIS_PESANAN || "").toUpperCase();
              if (jenisPesanan !== "COMPLIMENT" && jenisPesanan !== "ENDORSE") {
                let total = Number(p.TOTAL_TAGIHAN || 0);
                totalRevenue += total;
                let metode = String(p.METODE_BAYAR || "").toUpperCase();
                if (metode === 'TRANSFER') totalTransfer += total;
                else totalCash += total;
              }
              const subDetails = detail.filter(d => isSameId(d.ID_PESANAN, p.ID_PESANAN));
              subDetails.forEach(d => {
                const nm = String(d.NAMA_MENU).toLowerCase();
                const qty = Number(d.QTY || 0);
                if (nm.includes('pasta') || nm.includes('spaghetti') || nm.includes('macaroni')) pas += qty;
                else if (nm.includes('special') || nm.includes("aura's") || nm.includes('auras')) spe += qty;
                else if (nm.includes('es ') || nm.includes('kopi') || nm.includes('mojito') || nm.includes('air') || nm.includes('teh')) min += qty;
                else mak += qty;
              });
            });
            const sortedPesanan = [...pesanan].reverse().slice(0, 5).map(p => ({ ...p, detail: detail.filter(d => isSameId(d.ID_PESANAN, p.ID_PESANAN)) }));
            return ContentService.createTextOutput(JSON.stringify({
              status: "success",
              data: { totalRevenue: totalRevenue, totalCash: totalCash, totalTransfer: totalTransfer, totalTransactions: pesanan.length, categorySales: { Makanan: mak, Minuman: min, Pasta: pas, Special: spe }, recentTransactions: sortedPesanan }
            })).setMimeType(ContentService.MimeType.JSON);
        } else {
            // GET_ADMIN_REPORTS logic
            let namaCabangLaporan = "SEMUA CABANG";
            if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
              const masterCabang = getSheetDataAsJSON("Master_Cabang");
              const cInfo = masterCabang.find(x => isSameId(x.ID_CABANG, idCabang));
              if (cInfo) namaCabangLaporan = String(cInfo.NAMA_CABANG).toUpperCase();
            }

            let trans = getSheetDataAsJSON("Transaksi");
            let filteredTrans = [];
            let totalMasuk = 0, totalKeluar = 0, saldoAwal = 0, sumCash = 0, sumTransfer = 0;
            let targetStartDateObj = null;

            if (periode === 'HARIAN' && paramTanggal) {
              let pt = paramTanggal.split('/');
              targetStartDateObj = new Date(pt[2], pt[1] - 1, pt[0]);
              targetStartDateObj.setHours(0, 0, 0, 0);
            }

            trans.forEach(t => {
              let passCabang = true;
              if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
                passCabang = isSameId(t.CABANG || t.ID_CABANG || t["ID CABANG"], idCabang);
              }
              if (!passCabang) return;

              const dInfo = parseDateToInfo(t.TANGGAL, ZONA_WAKTU);
              if (!dInfo) return;

              let masuk = Number(t.DEBIT || t.MASUK || t["UANG MASUK"] || 0);
              let keluar = Number(t.KREDIT || t.KELUAR || t["UANG KELUAR"] || 0);
              let valCash = Number(t.TOTAL_CASH || 0);
              let valTransfer = Number(t.TOTAL_TRANSFER || 0);

              let isBefore = false;
              let isWithin = false;

              if (periode === 'HARIAN' && targetStartDateObj) {
                if (dInfo.obj.getTime() < targetStartDateObj.getTime()) isBefore = true;
                else if (dInfo.tglStr === paramTanggal) isWithin = true;
              } 
              else if (periode === 'BULANAN' && paramBulan && paramTahun) {
                if (dInfo.tahun < paramTahun || (dInfo.tahun === paramTahun && dInfo.bulan < paramBulan)) isBefore = true;
                else if (dInfo.tahun === paramTahun && dInfo.bulan === paramBulan) isWithin = true;
              } 
              else if (periode === 'KUARTAL' && paramKuartal && paramTahun) {
                let startMonth = paramKuartal === 'Q1' ? 1 : paramKuartal === 'Q2' ? 4 : paramKuartal === 'Q3' ? 7 : 10;
                let endMonth = startMonth + 2;
                if (dInfo.tahun < paramTahun || (dInfo.tahun === paramTahun && dInfo.bulan < startMonth)) isBefore = true;
                else if (dInfo.tahun === paramTahun && dInfo.bulan >= startMonth && dInfo.bulan <= endMonth) isWithin = true;
              } 
              else if (periode === 'SEMESTER' && paramTahun && paramSemester) {
                let startMonth = paramSemester === 'S1' ? 1 : 7;
                let endMonth = startMonth + 5;
                if (dInfo.tahun < paramTahun || (dInfo.tahun === paramTahun && dInfo.bulan < startMonth)) isBefore = true;
                else if (dInfo.tahun === paramTahun && dInfo.bulan >= startMonth && dInfo.bulan <= endMonth) isWithin = true;
              } 
              else if (periode === 'TAHUNAN' && paramTahun) {
                if (dInfo.tahun < paramTahun) isBefore = true;
                else if (dInfo.tahun === paramTahun) isWithin = true;
              }

              if (isBefore) saldoAwal += (masuk - keluar);
              if (isWithin) {
                let passJenis = true;
                if (jenisData === 'PEMASUKAN' && masuk === 0) passJenis = false;
                if (jenisData === 'PENGELUARAN' && keluar === 0) passJenis = false;
                if (passJenis) {
                  filteredTrans.push(t);
                  totalMasuk += masuk;
                  totalKeluar += keluar;
                  if (keluar === 0) {
                    sumCash += valCash;
                    sumTransfer += valTransfer;
                  }
                }
              }
            });

            let judulTanggal = (periode === 'HARIAN' && paramTanggal) ? paramTanggal : (periode === 'BULANAN' ? `${paramBulan}/${paramTahun}` : (periode === 'KUARTAL' ? `${paramKuartal} ${paramTahun}` : paramTahun));
            let saldoBersihHariIni = totalMasuk - totalKeluar;
            let totalSaldoAkhir = saldoAwal + saldoBersihHariIni;

            let textLaporan = `📃*LAPORAN REKAPITULASI AURA FOOD (${judulTanggal})*\n\n`;
            textLaporan += `🗓️ *Periode:* ${periode}\n`;
            textLaporan += `🏢 *Cabang:* ${namaCabangLaporan}\n\n`;
            textLaporan += `✅ *Saldo Awal:* ${formatRp(saldoAwal)}\n\n`;
            textLaporan += `📈 *Total Omset (Pemasukan):* ${formatRp(totalMasuk)}\n`;
            textLaporan += `   💵 *Total Cash:* ${formatRp(sumCash)}\n`;
            textLaporan += `   💳 *Total Transfer:* ${formatRp(sumTransfer)}\n\n`;
            textLaporan += `📉 *Total Pengeluaran:* ${formatRp(totalKeluar)}\n\n`;
            textLaporan += `💰 *Saldo Bersih:* ${formatRp(saldoBersihHariIni)}\n\n`;
            
            return ContentService.createTextOutput(JSON.stringify({ 
              status: "success", 
              data: { namaCabang: namaCabangLaporan, saldoAwal: saldoAwal, pemasukan: totalMasuk, pengeluaran: totalKeluar, totalCash: sumCash, totalTransfer: sumTransfer, saldoBersih: saldoBersihHariIni, totalSaldoAkhir: totalSaldoAkhir, transaksi: filteredTrans, textLaporan: textLaporan } 
            })).setMimeType(ContentService.MimeType.JSON);
        }
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSafeRootFolder(targetName) {
  try {
    if (ROOT_FOLDER_ID && ROOT_FOLDER_ID.length > 10) {
       const f = DriveApp.getFolderById(ROOT_FOLDER_ID);
       return getOrCreateFolder(f, targetName);
    }
  } catch (e) {
    console.warn("ROOT_FOLDER_ID invalid, using Spreadsheet folder");
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const parents = DriveApp.getFileById(ss.getId()).getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  return getOrCreateFolder(parent, targetName);
}

function getSheetDataAsJSON(n) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
  if(!s) return [];
  const d = s.getDataRange().getValues();
  if (d.length <= 1) return [];
  const h = d[0]; return d.slice(1).map(r => { let o = {}; h.forEach((f, i) => o[f] = r[i]); return o; });
}
function getOrCreateFolder(p, n) { const f = p.getFoldersByName(n); return f.hasNext() ? f.next() : p.createFolder(n); }
function isSameId(a, b) { return String(a).trim().toUpperCase() === String(b).trim().toUpperCase(); }
function formatRp(v) { return "Rp" + Number(v).toLocaleString("id-ID"); }
function parseDateToInfo(val, tz) {
  if (!val) return null;
  let d = new Date(val);
  if (isNaN(d.getTime())) {
    if (typeof val === 'string' && val.includes('/')) {
      let p = val.split(' ')[0].split('/');
      d = new Date(p[2], p[1] - 1, p[0]);
    } else return null;
  }
  return {
    obj: d,
    tglStr: Utilities.formatDate(d, tz, "dd/MM/yyyy"),
    bulan: d.getMonth() + 1,
    tahun: d.getFullYear()
  };
}
