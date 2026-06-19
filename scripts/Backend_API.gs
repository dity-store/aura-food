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
          varian: getSheetDataAsJSON("Master_Varian")
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

    // 1. FITUR LOGIN (Revisi: Menggunakan NAMA_CABANG)
    if (payload.mode === "LOGIN") {
      const { namaCabang, password } = payload;
      const dataCabang = getSheetDataAsJSON("Master_Cabang");
      // Validasi berdasarkan Nama Cabang
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

      const root = getOrCreateFolder(DriveApp.getFolderById(ROOT_FOLDER_ID), "Invoice & Struk");
      const fThn = getOrCreateFolder(root, Utilities.formatDate(dNow, ZONA_WAKTU, "yyyy"));
      const fBln = getOrCreateFolder(fThn, mN[dNow.getMonth()]);
      const fCab = getOrCreateFolder(fBln, namaC);
      const fStruk = getOrCreateFolder(fCab, "Struk " + mN[dNow.getMonth()]);
      const fHari = getOrCreateFolder(fStruk, namaHariTgl);

      const blob = Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', `${idPesanan} | ${totalTagihan}.pdf`);
      fHari.createFile(blob);
      return ContentService.createTextOutput(JSON.stringify({status: "success", url: fHari.getUrl()})).setMimeType(ContentService.MimeType.JSON);
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
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function rekapPendapatanHarian() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hariIni = Utilities.formatDate(new Date(), ZONA_WAKTU, "dd/MM/yyyy");
  const data = ss.getSheetByName("Data_Pesanan").getDataRange().getValues();
  let rekap = {};
  for(let i=1; i<data.length; i++) {
    if(String(data[i][1]).substring(0,10) === hariIni) {
      let id = String(data[i][2]); rekap[id] = (rekap[id] || 0) + Number(data[i][3]);
    }
  }
  const trans = ss.getSheetByName("Transaksi");
  Object.keys(rekap).forEach(id => {
    let found = false; const rows = trans.getDataRange().getValues();
    for(let r=1; r<rows.length; r++) {
      if(Utilities.formatDate(rows[r][0], ZONA_WAKTU, "dd/MM/yyyy") === hariIni && String(rows[r][1]) === id) {
        trans.getRange(r+1, 5).setValue(rekap[id]); found = true; break;
      }
    }
    if(!found) trans.appendRow([Utilities.formatDate(new Date(), ZONA_WAKTU, "yyyy-MM-dd"), id, "Pendapatan Usaha", "Rekap Penjualan Harian (Aplikasi POS)", rekap[id], 0]);
  });
}

function getSheetDataAsJSON(n) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
  if(!s) return [];
  const d = s.getDataRange().getValues();
  if (d.length <= 1) return [];
  const h = d[0]; return d.slice(1).map(r => { let o = {}; h.forEach((f, i) => o[f] = r[i]); return o; });
}
function getOrCreateFolder(p, n) { const f = p.getFoldersByName(n); return f.hasNext() ? f.next() : p.createFolder(n); }
