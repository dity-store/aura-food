function doGet(e) {
  const ZONA_WAKTU = "Asia/Makassar";
  const ROOT_FOLDER_ID = "1YzbiIG_bQzjQnLiVhx0UrzAmJXrQcdU1"; 

  try {
    const action = e.parameter.action;
    console.log("Menerima GET Request Action:", action);
    console.log("Parameter GET:", JSON.stringify(e.parameter));

    // ==========================================
    // 1. GET KATALOG LENGKAP
    // ==========================================
    if (action === 'get_katalog_lengkap') {
      const kategori = getSheetDataAsJSON("Master_Kategori");
      const menu = getSheetDataAsJSON("Master_Menu");
      const varian = getSheetDataAsJSON("Master_Varian");
      
      const dataKatalog = kategori.map(k => ({
        ...k,
        menus: menu
          .filter(m => isSameId(m.ID_KATEGORI, k.ID_KATEGORI))
          .map(m => ({ ...m, varians: varian.filter(v => isSameId(v.ID_MENU, m.ID_MENU)) }))
      }));
      return jsonResponse({status: "success", data: dataKatalog});
    }

    // ==========================================
    // 2. GET INFO HARI INI
    // ==========================================
    if (action === 'get_info_hari_ini') {
      const idCabang = e.parameter.id_cabang;
      if (!idCabang) throw new Error("ID Cabang diperlukan.");
      
      const master = getSheetDataAsJSON("Master_Cabang");
      const cabangData = master.find(x => isSameId(x.ID_CABANG, idCabang));
      if (!cabangData) throw new Error("Cabang tidak ditemukan.");

      const dNow = new Date();
      const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const dN = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const namaHariTgl = `${dN[dNow.getDay()]}, ${Utilities.formatDate(dNow, ZONA_WAKTU, "dd")} ${mN[dNow.getMonth()]} ${Utilities.formatDate(dNow, ZONA_WAKTU, "yyyy")}`;
      
      const root = getOrCreateFolder(DriveApp.getFolderById(ROOT_FOLDER_ID), "Invoice & Struk");
      const fThn = getOrCreateFolder(root, Utilities.formatDate(dNow, ZONA_WAKTU, "yyyy"));
      const fBln = getOrCreateFolder(fThn, mN[dNow.getMonth()]);
      const fCab = getOrCreateFolder(fBln, cabangData.NAMA_CABANG);
      const fStruk = getOrCreateFolder(fCab, "Struk " + mN[dNow.getMonth()]);
      const fHari = getOrCreateFolder(fStruk, namaHariTgl);
      
      return jsonResponse({
        status: "success",
        data: {
          folder_url: fHari.getUrl(),
          kontak_wa: cabangData.KONTAK || "",
          nama_cabang: cabangData.NAMA_CABANG
        }
      });
    }

    // ==========================================
    // 3. GET ALL TRANSACTIONS (Riwayat Pesanan dgn Filter)
    // ==========================================
    if (action === 'get_all_transactions') {
      const idCabang = e.parameter.id_cabang;
      const paramTanggal = e.parameter.tanggal; // format: dd/MM/yyyy
      
      let pesanan = getSheetDataAsJSON("Data_Pesanan");
      
      // Filter Cabang
      if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
        pesanan = pesanan.filter(x => isSameId(x.ID_CABANG, idCabang));
      }

      // Filter Tanggal
      if (paramTanggal) {
         pesanan = pesanan.filter(x => {
            const dInfo = parseDateToInfo(x.TANGGAL_WAKTU, ZONA_WAKTU);
            return dInfo && dInfo.tglStr === paramTanggal;
         });
      }
      
      const detail = getSheetDataAsJSON("Detail_Pesanan");
      const dataLengkap = pesanan.map(p => ({ 
        ...p, 
        detail: detail.filter(d => isSameId(d.ID_PESANAN, p.ID_PESANAN)) 
      }));
      
      console.log("Total transaksi ditemukan:", dataLengkap.length);
      return jsonResponse({status: "success", data: dataLengkap});
    }

    // ==========================================
    // 4. GET TRANSACTION BY ID
    // ==========================================
    if (action === 'get_transaction_by_id') {
      const idPesanan = e.parameter.id_pesanan;
      const idCabang = e.parameter.id_cabang;
      
      let pesanan = getSheetDataAsJSON("Data_Pesanan").find(x => isSameId(x.ID_PESANAN, idPesanan));
      if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
         if (pesanan && !isSameId(pesanan.ID_CABANG, idCabang)) pesanan = null;
      }

      if (!pesanan) throw new Error("Transaksi tidak ditemukan.");
      const detail = getSheetDataAsJSON("Detail_Pesanan").filter(x => isSameId(x.ID_PESANAN, idPesanan));
      return jsonResponse({status: "success", data: {pesanan: pesanan, detail: detail}});
    }

    // ==========================================
    // 5. GET DATA MASTER (All Raw)
    // ==========================================
    if (action === 'getMasterData') {
      return jsonResponse({
        status: "success",
        data: {
          cabang: getSheetDataAsJSON("Master_Cabang"),
          kategori: getSheetDataAsJSON("Master_Kategori"),
          menu: getSheetDataAsJSON("Master_Menu"),
          varian: getSheetDataAsJSON("Master_Varian")
        }
      });
    }

    // ==========================================
    // 6. GET DATA UNIVERSAL (Baca Sheet Apapun)
    // ==========================================
    if (action === 'get_data_sheet') {
      const sheetName = e.parameter.sheet_name;
      if (!sheetName) throw new Error("Parameter sheet_name diperlukan.");
      console.log("Tarik data dari sheet:", sheetName);
      return jsonResponse({status: "success", data: getSheetDataAsJSON(sheetName)});
    }

    // ==========================================
    // 7. GET ADMIN DASHBOARD
    // ==========================================
    if (action === 'get_admin_dashboard') {
      const idCabang = e.parameter.id_cabang;
      let pesanan = getSheetDataAsJSON("Data_Pesanan");
      const detail = getSheetDataAsJSON("Detail_Pesanan");

      if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
        pesanan = pesanan.filter(x => isSameId(x.ID_CABANG, idCabang));
      }

      let totalRevenue = 0;
      let mak = 0, min = 0, pas = 0, spe = 0;
      
      pesanan.forEach(p => {
        totalRevenue += Number(p.TOTAL_TAGIHAN || 0);
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

      const sortedPesanan = [...pesanan].reverse().slice(0, 5).map(p => ({
        ...p,
        detail: detail.filter(d => isSameId(d.ID_PESANAN, p.ID_PESANAN))
      }));

      return jsonResponse({
        status: "success",
        data: {
          totalRevenue: totalRevenue,
          totalTransactions: pesanan.length,
          averageTransactionValue: pesanan.length > 0 ? Math.round(totalRevenue / pesanan.length) : 0,
          categorySales: { Makanan: mak, Minuman: min, Pasta: pas, Special: spe },
          recentTransactions: sortedPesanan
        }
      });
    }

    // ==========================================
    // 8. GET ADMIN REPORTS (FILTER SUPER LENGKAP)
    // ==========================================
    if (action === 'get_admin_reports') {
      const idCabang = e.parameter.id_cabang;
      const periode = String(e.parameter.periode || '').toUpperCase();
      const jenisData = String(e.parameter.jenis_data || '').toUpperCase();
      
      const paramTanggal = e.parameter.tanggal; // 22/10/2026
      const paramBulan = Number(e.parameter.bulan); // 6
      const paramTahun = Number(e.parameter.tahun); // 2026
      const paramKuartal = String(e.parameter.kuartal || '').toUpperCase(); // Q1
      const paramSemester = String(e.parameter.semester || '').toUpperCase(); // S1

      console.log(`Report Filters -> Cabang:${idCabang}, Periode:${periode}, Jenis:${jenisData}, Tgl:${paramTanggal}, Bln:${paramBulan}, Thn:${paramTahun}, Q:${paramKuartal}, S:${paramSemester}`);

      let trans = getSheetDataAsJSON("Transaksi");
      let filteredTrans = [];

      let totalMasuk = 0;
      let totalKeluar = 0;

      trans.forEach(t => {
        // 1. Filter Cabang
        let passCabang = true;
        if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
          passCabang = isSameId(t.CABANG || t.ID_CABANG || t["ID CABANG"], idCabang);
        }

        // 2. Filter Tanggal & Periode Lanjutan
        let passPeriode = true;
        if (periode) {
           const dInfo = parseDateToInfo(t.TANGGAL, ZONA_WAKTU);
           if (!dInfo) {
              passPeriode = false; // Baris kotor, abaikan
           } else {
              if (periode === 'HARIAN' && paramTanggal) {
                 passPeriode = (dInfo.tglStr === paramTanggal);
              } 
              else if (periode === 'BULANAN' && paramTahun && paramBulan) {
                 passPeriode = (dInfo.tahun === paramTahun && dInfo.bulan === paramBulan);
              }
              else if (periode === 'KUARTAL' && paramTahun && paramKuartal) {
                 passPeriode = false;
                 if (dInfo.tahun === paramTahun) {
                    if (paramKuartal === 'Q1' && dInfo.bulan >= 1 && dInfo.bulan <= 3) passPeriode = true;
                    if (paramKuartal === 'Q2' && dInfo.bulan >= 4 && dInfo.bulan <= 6) passPeriode = true;
                    if (paramKuartal === 'Q3' && dInfo.bulan >= 7 && dInfo.bulan <= 9) passPeriode = true;
                    if (paramKuartal === 'Q4' && dInfo.bulan >= 10 && dInfo.bulan <= 12) passPeriode = true;
                 }
              }
              else if (periode === 'SEMESTER' && paramTahun && paramSemester) {
                 passPeriode = false;
                 if (dInfo.tahun === paramTahun) {
                    if (paramSemester === 'S1' && dInfo.bulan >= 1 && dInfo.bulan <= 6) passPeriode = true;
                    if (paramSemester === 'S2' && dInfo.bulan >= 7 && dInfo.bulan <= 12) passPeriode = true;
                 }
              }
              else if (periode === 'TAHUNAN' && paramTahun) {
                 passPeriode = (dInfo.tahun === paramTahun);
              }
           }
        }

        // 3. Filter Jenis Data
        let masuk = Number(t.DEBIT || t.Masuk || t["UANG MASUK"] || 0);
        let keluar = Number(t.KREDIT || t.Keluar || t["UANG KELUAR"] || 0);
        let passJenis = true;

        if (jenisData === 'PEMASUKAN' && masuk === 0) passJenis = false;
        if (jenisData === 'PENGELUARAN' && keluar === 0) passJenis = false;
        // Jika PEMASUKAN & PENGELUARAN atau kosong, ambil semua

        // Jika lolos semua filter
        if (passCabang && passPeriode && passJenis) {
           filteredTrans.push(t);
           totalMasuk += masuk;
           totalKeluar += keluar;
        }
      });

      console.log(`Ditemukan ${filteredTrans.length} data setelah filter`);

      return jsonResponse({
        status: "success",
        data: {
          pemasukan: totalMasuk,
          pengeluaran: totalKeluar,
          saldoBersih: totalMasuk - totalKeluar,
          transaksi: filteredTrans
        }
      });
    }

    throw new Error("Action tidak valid.");
  } catch (err) {
    console.error("GET Error:", err.message);
    return jsonResponse({status: "error", message: err.message});
  }
}

function doPost(e) {
  const ZONA_WAKTU = "Asia/Makassar";
  const ROOT_FOLDER_ID = "1YzbiIG_bQzjQnLiVhx0UrzAmJXrQcdU1";

  try {
    const payload = JSON.parse(e.postData.contents);
    console.log("Menerima POST Payload Mode:", payload.mode);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ==========================================
    // 1. SISTEM LOGIN PINTAR
    // ==========================================
    if (payload.mode === "LOGIN") {
      const inputNamaCabang = String(payload.namaCabang).trim().toLowerCase();
      const inputPassword = String(payload.password).trim();
      const dataCabang = getSheetDataAsJSON("Master_Cabang");
      
      const user = dataCabang.find(c => String(c.NAMA_CABANG).trim().toLowerCase() === inputNamaCabang);
      if (!user) {
        return jsonResponse({status: "error", message: "Oops! Nama cabang tersebut belum terdaftar. Pastikan ejaannya sudah benar ya."});
      }
      if (String(user.PASSWORD).trim() !== inputPassword) {
        return jsonResponse({status: "error", message: "Kata sandi yang dimasukkan kurang tepat. Cek lagi ya, perhatikan huruf besar dan kecilnya!"});
      }
      return jsonResponse({status: "success", data: user});
    }

    // ==========================================
    // 2. TRANSAKSI POS
    // ==========================================
    if (payload.mode === "POST_TRANSACTION") {
      const p = payload.payload.pesanan;
      let rawDate = new Date(p.TANGGAL_WAKTU);
      if (isNaN(rawDate.getTime())) rawDate = new Date(); 
      let tglFormatted = Utilities.formatDate(rawDate, ZONA_WAKTU, "dd/MM/yyyy HH:mm:ss");

      ss.getSheetByName("Data_Pesanan").appendRow([
        p.ID_PESANAN, tglFormatted, p.ID_CABANG, p.TOTAL_TAGIHAN, p.METODE_BAYAR, "Sukses"
      ]);
      
      payload.payload.detail.forEach((i, idx) => {
        ss.getSheetByName("Detail_Pesanan").appendRow([
          `${p.ID_PESANAN}-${idx + 1}`, p.ID_PESANAN, i.NAMA_MENU, i.VARIAN, i.HARGA_SATUAN, i.QTY, i.SUBTOTAL
        ]);
      });
      return jsonResponse({status: "success"});
    }

    // ==========================================
    // 3. SISTEM MANAJEMEN DATA (CRUD UNIVERSAL)
    // ==========================================
    if (payload.mode === "INSERT_DATA") {
      const { sheetName, data } = payload;
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error(`Sheet ${sheetName} tidak ditemukan`);
      
      const headers = sheet.getDataRange().getValues()[0];
      const newRow = headers.map(header => data[header] !== undefined ? data[header] : "");
      
      sheet.appendRow(newRow);
      const dateColIndex = headers.indexOf("TANGGAL");
      if (dateColIndex !== -1) {
         sheet.getRange(sheet.getLastRow(), dateColIndex + 1).setNumberFormat("dd/MM/yyyy");
      }
      return jsonResponse({status: "success", message: `Data berhasil ditambahkan ke ${sheetName}`});
    }

    if (payload.mode === "UPDATE_DATA") {
      const { sheetName, idColumn, idValue, data } = payload;
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error(`Sheet ${sheetName} tidak ditemukan`);
      
      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      const idColIdx = headers.indexOf(idColumn);
      if (idColIdx === -1) throw new Error(`Kolom ${idColumn} tidak ditemukan`);

      let rowIndex = -1;
      for (let i = 1; i < values.length; i++) {
        if (isSameId(values[i][idColIdx], idValue)) {
          rowIndex = i + 1;
          break;
        }
      }
      if (rowIndex === -1) throw new Error("Data dengan ID tersebut tidak ditemukan");

      Object.keys(data).forEach(key => {
        const colIdx = headers.indexOf(key);
        if (colIdx !== -1) sheet.getRange(rowIndex, colIdx + 1).setValue(data[key]);
      });
      return jsonResponse({status: "success", message: "Data berhasil diperbarui"});
    }

    if (payload.mode === "DELETE_DATA") {
      const { sheetName, idColumn } = payload;
      // Mendukung array idValues atau single idValue
      const idValues = payload.idValues || (payload.idValue ? [payload.idValue] : []);
      if (idValues.length === 0) throw new Error("ID yang akan dihapus tidak diberikan");

      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error("Sheet tidak ditemukan");
      
      const values = sheet.getDataRange().getValues();
      const idColIdx = values[0].indexOf(idColumn);
      if (idColIdx === -1) throw new Error("Kolom ID tidak ditemukan");

      let rowsToDelete = [];
      
      // Cari semua baris yang cocok
      for (let i = 1; i < values.length; i++) {
        let currentId = values[i][idColIdx];
        if (idValues.some(val => isSameId(currentId, val))) {
          rowsToDelete.push(i + 1); // +1 karena index array mulai dari 0, row sheet mulai dari 1
        }
      }

      if (rowsToDelete.length === 0) throw new Error("Data tidak ditemukan untuk dihapus");

      // HAPUS DARI BAWAH KE ATAS agar index baris di atasnya tidak meleset
      rowsToDelete.sort((a, b) => b - a);
      rowsToDelete.forEach(rowIdx => sheet.deleteRow(rowIdx));

      console.log(`Berhasil menghapus ${rowsToDelete.length} baris dari ${sheetName}`);
      return jsonResponse({status: "success", message: `${rowsToDelete.length} Data berhasil dihapus`});
    }

    if (payload.mode === "DELETE_DATA_MATCH") {
      const { sheetName, matchData } = payload;
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error("Sheet tidak ditemukan");
      
      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      let rowsToDelete = [];
      
      for (let i = 1; i < values.length; i++) {
        let isMatch = true;
        Object.keys(matchData).forEach(key => {
          const colIdx = headers.indexOf(key);
          if (colIdx !== -1) {
             let sheetVal = values[i][colIdx];
             if (sheetVal instanceof Date) {
               sheetVal = Utilities.formatDate(sheetVal, ZONA_WAKTU, "yyyy-MM-dd");
               let matchVal = matchData[key];
               if (String(matchVal).includes('T')) matchVal = matchVal.split('T')[0];
               if (!isSameId(sheetVal, matchVal)) isMatch = false;
             } else {
               if (!isSameId(sheetVal, matchData[key])) isMatch = false;
             }
          }
        });
        if (isMatch) rowsToDelete.push(i + 1);
      }

      if (rowsToDelete.length === 0) throw new Error("Data match tidak ditemukan untuk dihapus");
      
      // Hapus hanya 1 baris yang paling cocok (paling awal ditemukan dari atas/bawah)
      // Karena kita hanya mau update/delete 1 transaksi, hapus 1 saja
      const rowToDelete = rowsToDelete[rowsToDelete.length - 1]; // ambil yang terbaru bawah
      sheet.deleteRow(rowToDelete);
      
      console.log(`Berhasil menghapus 1 baris dari ${sheetName} dg match`);
      return jsonResponse({status: "success", message: `Data berhasil dihapus`});
    }

    if (payload.mode === "UPDATE_DATA_MATCH") {
      const { sheetName, matchData, data } = payload;
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error("Sheet tidak ditemukan");
      
      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      let rowIndex = -1;
      
      for (let i = values.length - 1; i >= 1; i--) {
        let isMatch = true;
        Object.keys(matchData).forEach(key => {
          const colIdx = headers.indexOf(key);
          if (colIdx !== -1) {
             let sheetVal = values[i][colIdx];
             if (sheetVal instanceof Date) {
               sheetVal = Utilities.formatDate(sheetVal, ZONA_WAKTU, "yyyy-MM-dd");
               let matchVal = matchData[key];
               if (String(matchVal).includes('T')) matchVal = matchVal.split('T')[0];
               if (!isSameId(sheetVal, matchVal)) isMatch = false;
             } else {
               if (!isSameId(sheetVal, matchData[key])) isMatch = false;
             }
          }
        });
        if (isMatch) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) throw new Error("Data match tidak ditemukan untuk diupdate");
      
      Object.keys(data).forEach(key => {
        const colIdx = headers.indexOf(key);
        if (colIdx !== -1) sheet.getRange(rowIndex, colIdx + 1).setValue(data[key]);
      });
      return jsonResponse({status: "success", message: "Data berhasil diperbarui"});
    }

    if (payload.mode === "TRIGGER_REKAP") {
      const tanggalTarget = payload.tanggal || Utilities.formatDate(new Date(), ZONA_WAKTU, "dd/MM/yyyy");
      prosesRekapPendapatanHarian(ss, ZONA_WAKTU, tanggalTarget);
      return jsonResponse({status: "success", message: `Rekap untuk tanggal ${tanggalTarget} selesai`});
    }

    // ==========================================
    // 5. UPLOAD DRIVE (STRUK & PDF LAPORAN)
    // ==========================================
    if (payload.mode === "UPLOAD_RECEIPT") {
      const { idPesanan, totalTagihan, idCabang, pdfBase64, tanggalWaktu } = payload;
      let namaC = idCabang;
      const c = getSheetDataAsJSON("Master_Cabang").find(x => isSameId(x.ID_CABANG, idCabang));
      if(c) namaC = c.NAMA_CABANG;

      let dTarget = new Date(); 
      if (tanggalWaktu) dTarget = new Date(tanggalWaktu);
      if (isNaN(dTarget.getTime())) dTarget = new Date(); 

      const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const dN = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const namaHariTgl = `${dN[dTarget.getDay()]}, ${Utilities.formatDate(dTarget, ZONA_WAKTU, "dd")} ${mN[dTarget.getMonth()]} ${Utilities.formatDate(dTarget, ZONA_WAKTU, "yyyy")}`;

      const root = getOrCreateFolder(DriveApp.getFolderById(ROOT_FOLDER_ID), "Invoice & Struk");
      const fThn = getOrCreateFolder(root, Utilities.formatDate(dTarget, ZONA_WAKTU, "yyyy"));
      const fBln = getOrCreateFolder(fThn, mN[dTarget.getMonth()]);
      const fCab = getOrCreateFolder(fBln, namaC);
      const fStruk = getOrCreateFolder(fCab, "Struk " + mN[dTarget.getMonth()]);
      const fHari = getOrCreateFolder(fStruk, namaHariTgl);

      const fileName = `${idPesanan} | ${totalTagihan}.pdf`;
      if (fHari.getFilesByName(fileName).hasNext()) {
        return jsonResponse({status: "success", message: "File sudah ada, dilewati", url: fHari.getFilesByName(fileName).next().getUrl()});
      }
      const file = fHari.createFile(Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', fileName));
      return jsonResponse({status: "success", url: file.getUrl()});
    }

    if (payload.mode === "UPLOAD_LAPORAN") {
      const { pdfBase64, idCabang, periode, tipe, tanggalLaporan } = payload;
      let namaC = "Semua";
      if (idCabang !== "ALL" && idCabang !== "ADMIN") {
        const c = getSheetDataAsJSON("Master_Cabang").find(x => isSameId(x.ID_CABANG, idCabang));
        if(c) namaC = c.NAMA_CABANG;
      }

      let dTarget = new Date();
      if (tanggalLaporan) {
         // Coba parse jika formatnya "dd/MM/yyyy" dari request React
         if(tanggalLaporan.includes("/")) {
            let p = tanggalLaporan.split("/");
            dTarget = new Date(p[2], p[1]-1, p[0]);
         } else {
            dTarget = new Date(tanggalLaporan);
         }
      }
      if (isNaN(dTarget.getTime())) dTarget = new Date();

      const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      
      const root = getOrCreateFolder(DriveApp.getFolderById(ROOT_FOLDER_ID), "Laporan");
      const fThn = getOrCreateFolder(root, Utilities.formatDate(dTarget, ZONA_WAKTU, "yyyy"));
      const fBln = getOrCreateFolder(fThn, mN[dTarget.getMonth()]);
      const periodeStr = periode === "HARIAN" ? "Harian" : periode.replace(/\//g, "_");
      const fPeriode = getOrCreateFolder(fBln, periodeStr);
      const fCabang = getOrCreateFolder(fPeriode, namaC);

      let labelTipeJudul = tipe === "GABUNGAN" ? "REKAPITULASI KEUANGAN" : (tipe === "PEMASUKAN" ? "PEMASUKAN" : (tipe === "PENGELUARAN" ? "PENGELUARAN" : "LABA RUGI BERSIH"));
      // Nama PDF akan mengikuti tanggal kejadian (dTarget)
      let tglLabel = (periode === "HARIAN") ? Utilities.formatDate(dTarget, ZONA_WAKTU, "dd_MM_yyyy") : periodeStr;
      const fileName = `[${namaC.toUpperCase()}] ${labelTipeJudul}_${tglLabel}.pdf`;

      if (fCabang.getFilesByName(fileName).hasNext()) {
         return jsonResponse({status: "success", message: "Laporan sudah ada", url: fCabang.getFilesByName(fileName).next().getUrl()});
      }

      const file = fCabang.createFile(Utilities.newBlob(Utilities.base64Decode(pdfBase64), 'application/pdf', fileName));
      console.log("PDF Laporan Berhasil Dibuat:", fileName);
      return jsonResponse({status: "success", url: file.getUrl()});
    }

  } catch (err) {
    console.error("POST Error:", err.message);
    return jsonResponse({status: "error", message: err.message});
  }
}

// ====================================================================================
// CORE: FUNGSI REKAPITULASI HARIAN (Kebal Duplikat & Pintar Update)
// ====================================================================================
function prosesRekapPendapatanHarian(ss, zonaWaktu, tanggalTarget) {
  const sheetPesanan = ss.getSheetByName("Data_Pesanan");
  const data = sheetPesanan.getDataRange().getValues();
  let rekap = {};
  
  for(let i=1; i<data.length; i++) {
    const dInfo = parseDateToInfo(data[i][1], zonaWaktu);
    if(dInfo && dInfo.tglStr === tanggalTarget) {
      let id = String(data[i][2]).trim(); 
      rekap[id] = (rekap[id] || 0) + Number(data[i][3]);
    }
  }

  const trans = ss.getSheetByName("Transaksi");
  const transData = trans.getDataRange().getValues();
  
  Object.keys(rekap).forEach(id => {
    let totalTarget = rekap[id];
    if (totalTarget <= 0) return; 

    let found = false; 
    for(let r=1; r<transData.length; r++) {
      const dInfo = parseDateToInfo(transData[r][0], zonaWaktu);
      
      if(dInfo && dInfo.tglStr === tanggalTarget && isSameId(transData[r][1], id) && String(transData[r][3]).includes("Pendapatan Harian Usaha")) {
        let nominalLama = Number(transData[r][4]); 
        
        if (nominalLama !== totalTarget) {
          trans.getRange(r+1, 5).setValue(totalTarget); 
          console.log(`Update Rekap: Cabang ${id} dari ${nominalLama} menjadi ${totalTarget}`);
        }
        found = true; 
        break;
      }
    }
    
    if(!found) {
      let dateParts = tanggalTarget.split("/");
      let dateIso = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`; 
      trans.appendRow([dateIso, id, "Pendapatan Usaha", "Pendapatan Harian Usaha", totalTarget, 0]);
      trans.getRange(trans.getLastRow(), 1).setNumberFormat("dd/MM/yyyy");
      console.log(`Insert Rekap Baru: Cabang ${id} nominal ${totalTarget}`);
    }
  });
}

// ====================================================================================
// FUNGSI HELPER
// ====================================================================================
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheetDataAsJSON(n) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
  if(!s) return [];
  const d = s.getDataRange().getValues();
  if (d.length <= 1) return [];
  const h = d[0]; return d.slice(1).map(r => { let o = {}; h.forEach((f, i) => o[f] = r[i]); return o; });
}

function getOrCreateFolder(p, n) { 
  const f = p.getFoldersByName(n); 
  return f.hasNext() ? f.next() : p.createFolder(n); 
}

function isSameId(id1, id2) {
  const s1 = String(id1).trim();
  const s2 = String(id2).trim();
  if (s1 === s2) return true;
  if (!isNaN(s1) && !isNaN(s2) && Number(s1) === Number(s2)) return true;
  return false;
}

// FUNGSI SUPER PENTING: Untuk mengatasi kebingungan Date Object vs String Date di Google Sheets
function parseDateToInfo(cellValue, zonaWaktu) {
  if (!cellValue) return null;
  let d;
  
  if (cellValue instanceof Date) {
    d = cellValue;
  } else {
    let str = String(cellValue).trim().substring(0, 10);
    if (str.includes('/')) { 
       let p = str.split('/'); 
       d = new Date(p[2], p[1]-1, p[0]); 
    } else if (str.includes('-')) { 
       let p = str.split('-'); 
       d = new Date(p[0], p[1]-1, p[2]); 
    } else {
       d = new Date(cellValue);
    }
  }

  if (isNaN(d.getTime())) return null;

  return {
    obj: d,
    tglStr: Utilities.formatDate(d, zonaWaktu, "dd/MM/yyyy"), // Output: 08/06/2026
    bulan: d.getMonth() + 1, // Output: 1 - 12
    tahun: d.getFullYear()   // Output: 2026
  };
}
