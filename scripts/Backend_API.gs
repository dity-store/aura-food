function doGet(e) {
  const ZONA_WAKTU = "Asia/Makassar";
  const ROOT_FOLDER_ID = "1YzbiIG_bQzjQnLiVhx0UrzAmJXrQcdU1";
  try {
    const action = e.parameter.action;
    console.log("Menerima GET Request Action:", action);
    console.log("Parameter GET:", JSON.stringify(e.parameter));

    if (action === 'get_katalog_lengkap') {
      const kategori = getSheetDataAsJSON("Master_Kategori");
      const menu = getSheetDataAsJSON("Master_Menu");
      const varian = getSheetDataAsJSON("Master_Varian");
      const dataKatalog = kategori.map(k => ({
        ...k, menus: menu.filter(m => isSameId(m.ID_KATEGORI, k.ID_KATEGORI)).map(m => ({ ...m, varians: varian.filter(v => isSameId(v.ID_MENU, m.ID_MENU)) }))
      }));
      return jsonResponse({ status: "success", data: dataKatalog });
    }

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
      const root = getOrCreateFolder(safeGetFolder(ROOT_FOLDER_ID), "Invoice & Struk");
      const fThn = getOrCreateFolder(root, Utilities.formatDate(dNow, ZONA_WAKTU, "yyyy"));
      const fBln = getOrCreateFolder(fThn, mN[dNow.getMonth()]);
      const fCab = getOrCreateFolder(fBln, cabangData.NAMA_CABANG);
      const fStruk = getOrCreateFolder(fCab, "Struk " + mN[dNow.getMonth()]);
      const fHari = getOrCreateFolder(fStruk, namaHariTgl);
      return jsonResponse({ status: "success", data: { folder_url: fHari.getUrl(), kontak_wa: cabangData.KONTAK || "", nama_cabang: cabangData.NAMA_CABANG } });
    }

    if (action === 'get_all_transactions') {
      const idCabang = e.parameter.id_cabang;
      const paramTanggal = e.parameter.tanggal;
      let pesanan = getSheetDataAsJSON("Data_Pesanan");
      if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
        pesanan = pesanan.filter(x => isSameId(x.ID_CABANG, idCabang));
      }
      if (paramTanggal) {
        let targetTgl = paramTanggal;
        if (targetTgl.includes('/')) {
          let pt = targetTgl.split('/');
          targetTgl = `${pt[0].padStart(2, '0')}/${pt[1].padStart(2, '0')}/${pt[2]}`;
        }
        pesanan = pesanan.filter(x => {
          let cellVal = x.TANGGAL_WAKTU || x.TANGGAL || x["TANGGAL WAKTU"];
          const dInfo = parseDateToInfo(cellVal, ZONA_WAKTU);
          return dInfo && dInfo.tglStr === targetTgl;
        });
      }
      const detail = getSheetDataAsJSON("Detail_Pesanan");
      const dataLengkap = pesanan.map(p => ({ ...p, detail: detail.filter(d => isSameId(d.ID_PESANAN, p.ID_PESANAN)) }));
      return jsonResponse({ status: "success", data: dataLengkap });
    }

    if (action === 'get_transaction_by_id') {
      const idPesanan = e.parameter.id_pesanan;
      const idCabang = e.parameter.id_cabang;
      let pesanan = getSheetDataAsJSON("Data_Pesanan").find(x => isSameId(x.ID_PESANAN, idPesanan));
      if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
        if (pesanan && !isSameId(pesanan.ID_CABANG, idCabang)) pesanan = null;
      }
      if (!pesanan) throw new Error("Transaksi tidak ditemukan.");
      const detail = getSheetDataAsJSON("Detail_Pesanan").filter(x => isSameId(x.ID_PESANAN, idPesanan));
      return jsonResponse({ status: "success", data: { pesanan: pesanan, detail: detail } });
    }

    if (action === 'getMasterData') {
      return jsonResponse({
        status: "success",
        data: {
          cabang: getSheetDataAsJSON("Master_Cabang"), kategori: getSheetDataAsJSON("Master_Kategori"), menu: getSheetDataAsJSON("Master_Menu"),
          varian: getSheetDataAsJSON("Master_Varian"), promo: getSheetDataAsJSON("Master_Promo"), pegawai: getSheetDataAsJSON("Master_Pegawai")
        }
      });
    }

    if (action === 'get_data_sheet') {
      const sheetName = e.parameter.sheet_name;
      if (!sheetName) throw new Error("Parameter sheet_name diperlukan.");
      const dataSheet = getSheetDataAsJSON(sheetName);
      let summaryData = null;
      if (sheetName === "Transaksi" || sheetName === "Buku_Kas") {
        let tCash = 0, tTransfer = 0, tKredit = 0, tDebit = 0;
        dataSheet.forEach(r => {
          tCash += Number(r.TOTAL_CASH || 0);
          tTransfer += Number(r.TOTAL_TRANSFER || 0);
          tKredit += Number(r.KREDIT || r.KELUAR || 0);
          tDebit += Number(r.DEBIT || r.MASUK || 0);
        });
        summaryData = { totalDebit: tDebit, totalKredit: tKredit, totalCash: tCash, totalTransfer: tTransfer };
      }
      return jsonResponse({ status: "success", data: dataSheet, summary: summaryData });
    }

    if (action === 'get_admin_dashboard') {
      const idCabang = e.parameter.id_cabang || e.parameter.idCabang;
      let selectedDate = e.parameter.selected_date || e.parameter.selectedDate; // YYYY-MM-DD
      
      if (!selectedDate) {
        selectedDate = Utilities.formatDate(new Date(), ZONA_WAKTU, "yyyy-MM-dd");
      }
      
      console.log("Fetching Admin Dashboard for Branch:", idCabang, "Date:", selectedDate);
      
      let pesananAll = getSheetDataAsJSON("Data_Pesanan");
      const detail = getSheetDataAsJSON("Detail_Pesanan");
      
      // Strict Daily Filter
      const targetTglISO = String(selectedDate || '').trim(); // YYYY-MM-DD
      console.log("Filtering Data_Pesanan for strictly:", targetTglISO);
      
      let debugDates = [];
      let pesanan = pesananAll.filter(x => {
        // Apply branch filter first if not ALL
        if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN' && String(idCabang).toUpperCase() !== 'SEMUA') {
          if (!isSameId(x.ID_CABANG, idCabang)) return false;
        }

        let cellVal = x.TANGGAL_WAKTU || x.TANGGAL || x["TANGGAL WAKTU"] || x.TANGGAL_TRANSAKSI;
        if (!cellVal) return false;
        
        let dInfo = parseDateToInfo(cellVal, ZONA_WAKTU);
        if (!dInfo) return false;
        
        if (debugDates.length < 5) debugDates.push({ cellVal: String(cellVal), isoDate: dInfo.isoDate, target: targetTglISO });
        
        return dInfo.isoDate === targetTglISO;
      });

      console.log("Found", pesanan.length, "transactions for", targetTglISO);

      let totalRevenue = 0, mak = 0, min = 0, pas = 0, spe = 0;
      let totalCash = 0, totalTransfer = 0;
      
      pesanan.forEach(p => {
        let jenisPesanan = String(p.JENIS_PESANAN || "").toUpperCase();
        if (jenisPesanan !== "COMPLIMENT" && jenisPesanan !== "ENDORSE") {
          const tagihan = Number(p.TOTAL_TAGIHAN || 0);
          totalRevenue += tagihan;
          
          const method = String(p.METODE_BAYAR || "").toUpperCase();
          if (method === "CASH" || method === "TUNAI") {
            totalCash += tagihan;
          } else {
            totalTransfer += tagihan;
          }
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
      // Return ALL filtered transactions for the day
      const dailyTransactions = [...pesanan].reverse().map(p => ({ 
        ...p, 
        id: p.ID_PESANAN || p[0],
        timestamp: p.TANGGAL_WAKTU || p.TANGGAL || p[1],
        paymentMethod: p.METODE_BAYAR || p[4],
        totalAmount: Number(p.TOTAL_TAGIHAN || p.Total || p[3] || 0),
        cabang: p.ID_CABANG || p[2],
        detail: detail.filter(d => isSameId(d.ID_PESANAN, p.ID_PESANAN)) 
      }));
      
      // Calculate yesterday revenue for growth indicator
      let yesterdayRevenue = 0;
      if (selectedDate) {
        const dTarget = new Date(selectedDate);
        dTarget.setDate(dTarget.getDate() - 1);
        const yestDateISO = Utilities.formatDate(dTarget, ZONA_WAKTU, "yyyy-MM-dd");
        
        let allPesanan = getSheetDataAsJSON("Data_Pesanan");
        if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN' && String(idCabang).toUpperCase() !== 'SEMUA') {
          allPesanan = allPesanan.filter(x => isSameId(x.ID_CABANG, idCabang));
        }
        
        allPesanan.forEach(p => {
          let cellVal = p.TANGGAL_WAKTU || p.TANGGAL || p["TANGGAL WAKTU"];
          const dInfo = parseDateToInfo(cellVal, ZONA_WAKTU);
          if (dInfo && dInfo.isoDate === yestDateISO) {
            let jenisPesanan = String(p.JENIS_PESANAN || "").toUpperCase();
            if (jenisPesanan !== "COMPLIMENT" && jenisPesanan !== "ENDORSE") {
              yesterdayRevenue += Number(p.TOTAL_TAGIHAN || 0);
            }
          }
        });
      }

      return jsonResponse({
        status: "success",
        data: { 
          totalRevenue: totalRevenue, 
          totalTransactions: pesanan.length, 
          totalCash: totalCash,
          totalTransfer: totalTransfer,
          yesterdayRevenue: yesterdayRevenue,
          averageTransactionValue: pesanan.length > 0 ? totalRevenue / pesanan.length : 0,
          categorySales: { Makanan: mak, Minuman: min, Pasta: pas, Special: spe }, 
          recentTransactions: dailyTransactions,
          debugDates: debugDates
        }
      });
    }

    if (action === 'get_admin_reports') {
      const idCabang = e.parameter.id_cabang;
      const periode = String(e.parameter.periode || '').toUpperCase();
      const jenisData = String(e.parameter.jenis_data || '').toUpperCase();
      const paramTanggal = e.parameter.tanggal, paramBulan = Number(e.parameter.bulan), paramTahun = Number(e.parameter.tahun);
      const paramKuartal = String(e.parameter.kuartal || '').toUpperCase(), paramSemester = String(e.parameter.semester || '').toUpperCase();
      
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
            sumCash += valCash;
            sumTransfer += valTransfer;
          }
        }
      });

      // ==========================================
      // LOGIKA REKAPITULASI OPERASIONAL PEGAWAI
      // ==========================================
      const masterPegawai = getSheetDataAsJSON("Master_Pegawai");
      const dataIzin = getSheetDataAsJSON("Data_Izin_Shift");
      
      let pegawaiCabang = masterPegawai;
      if (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') {
        pegawaiCabang = masterPegawai.filter(p => isSameId(p.ID_CABANG, idCabang));
      }
      let totalPegawai = pegawaiCabang.length;
      
      let dateList = [];
      const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const dN = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

      if (periode === 'HARIAN' && targetStartDateObj) {
        dateList.push(targetStartDateObj);
      } else if (periode === 'BULANAN' && paramBulan && paramTahun) {
        let maxDays = new Date(paramTahun, paramBulan, 0).getDate();
        for (let i = 1; i <= maxDays; i++) dateList.push(new Date(paramTahun, paramBulan - 1, i));
      }

      let totalBuka = 0, totalLibur = 0, totalIzinCount = 0;
      let rekapIzinPegawai = {};
      pegawaiCabang.forEach(p => rekapIzinPegawai[p.NAMA_PEGAWAI] = 0);
      let textRincianOperasional = "";

      dateList.forEach((dt, idx) => {
        let tglStr = Utilities.formatDate(dt, ZONA_WAKTU, "dd/MM/yyyy");
        let namaHari = dN[dt.getDay()];
        let tglFormatIndo = `${Utilities.formatDate(dt, ZONA_WAKTU, "dd")} ${mN[dt.getMonth()]} ${Utilities.formatDate(dt, ZONA_WAKTU, "yyyy")}`;
        
        let isBuka = trans.some(t => {
          let checkCabang = (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') ? isSameId(t.CABANG || t.ID_CABANG, idCabang) : true;
          let dtInfo = parseDateToInfo(t.TANGGAL, ZONA_WAKTU);
          return checkCabang && dtInfo && dtInfo.tglStr === tglStr;
        });

        if (isBuka) totalBuka++; else totalLibur++;

        let rincianHariIni = `${idx + 1}. [${namaHari}, ${tglFormatIndo}] (${isBuka ? "Buka" : "Libur"}): `;
        
        if (!isBuka) {
          rincianHariIni += `Operasional tutup.\n`;
        } else {
          let izinHariIni = dataIzin.filter(i => {
            let checkCabang = (idCabang && String(idCabang).toUpperCase() !== 'ALL' && String(idCabang).toUpperCase() !== 'ADMIN') ? isSameId(i.ID_CABANG, idCabang) : true;
            let dIzin = parseDateToInfo(i.TANGGAL || i.TANGGAL_WAKTU, ZONA_WAKTU);
            return checkCabang && dIzin && dIzin.tglStr === tglStr;
          });

          if (izinHariIni.length === 0) {
            rincianHariIni += `Semua pegawai hadir.\n`;
          } else {
            rincianHariIni += `\n`;
            izinHariIni.forEach(iz => {
              let pDetail = pegawaiCabang.find(p => isSameId(p.ID_PEGAWAI, iz.ID_PEGAWAI));
              let nm = pDetail ? pDetail.NAMA_PEGAWAI : iz.NAMA_PEGAWAI || iz.ID_PEGAWAI;
              if (rekapIzinPegawai[nm] !== undefined) rekapIzinPegawai[nm]++;
              totalIzinCount++;
              rincianHariIni += `    - ${nm} (Izin), alasan: ${iz.ALASAN || "Tidak ada keterangan"}\n`;
            });
            rincianHariIni += `    - Sisanya hadir.\n`;
          }
        }
        textRincianOperasional += rincianHariIni;
      });

      let textOperasionalLengkap = `*🛎️ LAPORAN REKAPITULASI OPERASIONAL AURA FOOD*\n\n`;
      let perJudul = (periode === 'HARIAN' && paramTanggal) ? paramTanggal : (periode === 'BULANAN' ? `${mN[paramBulan - 1]} ${paramTahun}` : `${periode}`);
      textOperasionalLengkap += `Periode: ${perJudul}\nCabang: ${namaCabangLaporan}\n\n`;
      textOperasionalLengkap += `*📊 RINGKASAN OPERASIONAL:*\n`;
      textOperasionalLengkap += `🔓 Total Hari Buka: ${totalBuka} Hari\n`;
      textOperasionalLengkap += `🚫 Total Hari Libur: ${totalLibur} Hari\n`;
      textOperasionalLengkap += `👥 Total Pegawai: ${totalPegawai} Orang\n`;
      textOperasionalLengkap += `📝 Total Izin: ${totalIzinCount} Izin\n`;
      Object.keys(rekapIzinPegawai).forEach(nama => {
        let jml = rekapIzinPegawai[nama];
        textOperasionalLengkap += `			- ${nama}: ${jml}x izin ${jml === 0 ? "(full)" : ""}\n`;
      });
      textOperasionalLengkap += `⛔ Total Tidak Hadir: 0 Alpa\n\n`; 
      textOperasionalLengkap += `*🗓️ RINCIAN OPERASIONAL HARIAN:*\n${textRincianOperasional}`;

      // ==========================================
      // TEXT LAPORAN KEUANGAN
      // ==========================================
      let judulTanggal = (periode === 'HARIAN' && paramTanggal) ? paramTanggal : (periode === 'BULANAN' ? `${paramBulan}/${paramTahun}` : (periode === 'KUARTAL' ? `${paramKuartal} ${paramTahun}` : paramTahun));
      let saldoBersihHariIni = totalMasuk - totalKeluar;
      let totalSaldoAkhir = saldoAwal + saldoBersihHariIni;

      let textLaporan = `📃*LAPORAN REKAPITULASI KEUANGAN AURA FOOD (${judulTanggal})*\n\n`;
      textLaporan += `🗓️ *Periode:* ${periode}\n`;
      textLaporan += `🏢 *Cabang:* ${namaCabangLaporan}\n\n`;
      textLaporan += `✅ *Saldo Awal:* ${formatRp(saldoAwal)}\n`;
      textLaporan += `💰 *Saldo Bersih:* ${formatRp(saldoBersihHariIni)}\n`;
      textLaporan += `📈 *Total Omset (Pemasukan):* ${formatRp(totalMasuk)}\n`;
      textLaporan += `📉 *Total Pengeluaran:* ${formatRp(totalKeluar)}\n\n`;
      textLaporan += `Rincian Aliran Transaksi Kas:\n`;
      if (filteredTrans.length === 0) {
        textLaporan += `- Tidak ada transaksi di periode ini -\n`;
      } else {
        filteredTrans.forEach((ft, i) => {
          let m = Number(ft.DEBIT || ft.MASUK || 0), k = Number(ft.KREDIT || ft.KELUAR || 0);
          let rpStr = m > 0 ? `+${formatRp(m)}` : `-${formatRp(k)}`;
          let tglStr = ft.TANGGAL;
          let dInfo = parseDateToInfo(ft.TANGGAL, ZONA_WAKTU);
          if (dInfo) tglStr = dInfo.tglStr;
          textLaporan += `${i + 1}. [${tglStr}] ${ft.KETERANGAN || ft.JENIS_TRANSAKSI || "Transaksi"}: ${rpStr}\n`;
        });
      }

      return jsonResponse({ 
        status: "success", 
        data: { 
          namaCabang: namaCabangLaporan, saldoAwal: saldoAwal, pemasukan: totalMasuk, pengeluaran: totalKeluar, 
          totalCash: sumCash, totalTransfer: sumTransfer, saldoBersih: saldoBersihHariIni, totalSaldoAkhir: totalSaldoAkhir, 
          transaksi: filteredTrans, textLaporan: textLaporan, textOperasional: textOperasionalLengkap 
        } 
      });
    }
    throw new Error("Action tidak valid.");
  } catch (err) { return jsonResponse({ status: "error", message: err.message }); }
}

function doPost(e) {
  const ZONA_WAKTU = "Asia/Makassar";
  const ROOT_FOLDER_ID = "1YzbiIG_bQzjQnLiVhx0UrzAmJXrQcdU1";
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (payload.mode === "LOGIN") {
      const inputNamaCabang = String(payload.namaCabang).trim().toLowerCase();
      const inputPassword = String(payload.password).trim();
      const dataCabang = getSheetDataAsJSON("Master_Cabang");
      const user = dataCabang.find(c => String(c.NAMA_CABANG).trim().toLowerCase() === inputNamaCabang);
      if (!user) return jsonResponse({ status: "error", message: "Oops! Nama cabang tersebut belum terdaftar." });
      if (String(user.PASSWORD).trim() !== inputPassword) return jsonResponse({ status: "error", message: "Kata sandi yang dimasukkan kurang tepat." });
      return jsonResponse({ status: "success", data: user });
    }

    if (payload.mode === "POST_TRANSACTION") {
      const p = payload.payload.pesanan;
      let rawDate = new Date(p.TANGGAL_WAKTU);
      if (isNaN(rawDate.getTime())) rawDate = new Date();
      let tglFormatted = Utilities.formatDate(rawDate, ZONA_WAKTU, "dd/MM/yyyy HH:mm:ss");
      const sheetPesanan = ss.getSheetByName("Data_Pesanan");
      const headersPesanan = sheetPesanan.getDataRange().getValues()[0].map(h => String(h).trim().toUpperCase());
      let rowDataPesanan = new Array(headersPesanan.length).fill("");
      const mapPesanan = {
        "ID_PESANAN": p.ID_PESANAN, "TANGGAL_WAKTU": tglFormatted, "ID_CABANG": p.ID_CABANG,
        "TOTAL_TAGIHAN": p.TOTAL_TAGIHAN, "METODE_BAYAR": p.METODE_BAYAR, "STATUS_SYNC": "Sukses",
        "JENIS_PESANAN": p.JENIS_PESANAN || "Normal", "CATATAN": p.CATATAN || ""
      };
      Object.keys(mapPesanan).forEach(key => {
        let idx = headersPesanan.indexOf(key);
        if (idx !== -1) rowDataPesanan[idx] = mapPesanan[key];
      });
      if (headersPesanan.indexOf("ID_PESANAN") === -1) {
        rowDataPesanan = [p.ID_PESANAN, tglFormatted, p.ID_CABANG, p.TOTAL_TAGIHAN, p.METODE_BAYAR, "Sukses", p.JENIS_PESANAN || "Normal", p.CATATAN || ""];
      }
      sheetPesanan.appendRow(rowDataPesanan);
      
      const sheetDetail = ss.getSheetByName("Detail_Pesanan");
      const headersDetail = sheetDetail.getDataRange().getValues()[0].map(h => String(h).trim().toUpperCase());
      payload.payload.detail.forEach((i, idx) => {
        let rowDataDet = new Array(headersDetail.length).fill("");
        const mapDet = {
          "ID_DETAIL": `${p.ID_PESANAN}-${idx + 1}`, "ID_PESANAN": p.ID_PESANAN, "NAMA_MENU": i.NAMA_MENU,
          "VARIAN": i.VARIAN, "HARGA_SATUAN": i.HARGA_SATUAN, "QTY": i.QTY, "SUBTOTAL": i.SUBTOTAL
        };
        Object.keys(mapDet).forEach(key => {
          let colIdx = headersDetail.indexOf(key);
          if (colIdx !== -1) rowDataDet[colIdx] = mapDet[key];
        });
        if (headersDetail.indexOf("ID_DETAIL") === -1) {
          rowDataDet = [`${p.ID_PESANAN}-${idx + 1}`, p.ID_PESANAN, i.NAMA_MENU, i.VARIAN, i.HARGA_SATUAN, i.QTY, i.SUBTOTAL];
        }
        sheetDetail.appendRow(rowDataDet);
      });
      return jsonResponse({ status: "success" });
    }

    if (payload.mode === "INSERT_DATA") {
      const { sheetName, data } = payload;
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error(`Sheet ${sheetName} tidak ditemukan`);
      const values = sheet.getDataRange().getValues();
      const headers = values[0].map(h => String(h).trim().toUpperCase());
      const primaryKeyHeader = headers[0];
      if (data[primaryKeyHeader] === undefined || String(data[primaryKeyHeader]).trim() === "") {
        let lastId = values.length > 1 ? values[values.length - 1][0] : null;
        data[primaryKeyHeader] = generateAutoId(sheetName, lastId);
      }
      const newRow = values[0].map(header => {
        let normalizedKey = String(header).trim().toUpperCase();
        // Look for the key in data (try exact match, then try normalized uppercase match)
        if (data[normalizedKey] !== undefined) return data[normalizedKey];
        
        // Fallback: look through all keys in data to see if any match the header normalized
        const dataKeys = Object.keys(data);
        for (const dk of dataKeys) {
           if (String(dk).trim().toUpperCase() === normalizedKey) {
              return data[dk];
           }
        }
        return "";
      });
      sheet.appendRow(newRow);
      
      const lastRowIdx = sheet.getLastRow();
      const dateColIndex = headers.indexOf("TANGGAL");
      const dateTimeColIndex = headers.indexOf("TANGGAL_WAKTU");
      if (sheetName === "Data_Izin_Shift") {
        if (dateColIndex !== -1) sheet.getRange(lastRowIdx, dateColIndex + 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
        if (dateTimeColIndex !== -1) sheet.getRange(lastRowIdx, dateTimeColIndex + 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
      } else {
        if (dateColIndex !== -1) sheet.getRange(lastRowIdx, dateColIndex + 1).setNumberFormat("dd/MM/yyyy");
        if (dateTimeColIndex !== -1) sheet.getRange(lastRowIdx, dateTimeColIndex + 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
      }
      return jsonResponse({ status: "success", message: `Data berhasil ditambahkan ke ${sheetName}`, generatedId: data[primaryKeyHeader] });
    }

    if (payload.mode === "UPDATE_DATA") {
      const { sheetName, idColumn, idValue, data } = payload;
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error(`Sheet ${sheetName} tidak ditemukan`);
      const values = sheet.getDataRange().getValues();
      const headers = values[0].map(h => String(h).trim().toUpperCase());
      const idColIdx = headers.indexOf(String(idColumn).trim().toUpperCase());
      if (idColIdx === -1) throw new Error(`Kolom ${idColumn} tidak ditemukan`);
      let rowIndex = -1;
      for (let i = 1; i < values.length; i++) {
        if (isSameId(values[i][idColIdx], idValue)) { rowIndex = i + 1; break; }
      }
      if (rowIndex === -1) throw new Error("Data dengan ID tersebut tidak ditemukan");
      Object.keys(data).forEach(key => {
        const colIdx = headers.indexOf(String(key).trim().toUpperCase());
        if (colIdx !== -1) sheet.getRange(rowIndex, colIdx + 1).setValue(data[key]);
      });
      return jsonResponse({ status: "success", message: "Data berhasil diperbarui" });
    }

    if (payload.mode === "UPDATE_DATA_MATCH") {
      const { sheetName, matchData, data } = payload;
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error(`Sheet ${sheetName} tidak ditemukan`);
      const values = sheet.getDataRange().getValues();
      const headers = values[0].map(h => String(h).trim().toUpperCase());
      
      let rowIndex = -1;
      for (let i = 1; i < values.length; i++) {
        let isMatch = true;
        for (let key in matchData) {
          let colIdx = headers.indexOf(String(key).trim().toUpperCase());
          if (colIdx !== -1) {
            let valA = String(values[i][colIdx]).trim();
            let valB = String(matchData[key]).trim();
            // Handle date comparison if needed
            if (key.toUpperCase().includes("TANGGAL")) {
               const d1 = parseDateToInfo(values[i][colIdx], ZONA_WAKTU);
               const d2 = parseDateToInfo(matchData[key], ZONA_WAKTU);
               if (d1 && d2) {
                 if (d1.tglStr !== d2.tglStr) { isMatch = false; break; }
               } else if (valA !== valB) { isMatch = false; break; }
            } else if (valA !== valB) {
              isMatch = false;
              break;
            }
          }
        }
        if (isMatch) { rowIndex = i + 1; break; }
      }
      
      if (rowIndex === -1) throw new Error("Data yang cocok untuk diperbarui tidak ditemukan");
      
      Object.keys(data).forEach(key => {
        const colIdx = headers.indexOf(String(key).trim().toUpperCase());
        if (colIdx !== -1) {
           let val = data[key];
           sheet.getRange(rowIndex, colIdx + 1).setValue(val);
        }
      });
      return jsonResponse({ status: "success", message: "Data berhasil diperbarui berdasarkan kecocokan" });
    }

    if (payload.mode === "DELETE_DATA") {
      const { sheetName, idColumn } = payload;
      const idValues = payload.idValues || (payload.idValue ? [payload.idValue] : []);
      if (idValues.length === 0) throw new Error("ID yang akan dihapus tidak diberikan");
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error("Sheet tidak ditemukan");
      const values = sheet.getDataRange().getValues();
      const idColIdx = values[0].map(h => String(h).trim().toUpperCase()).indexOf(String(idColumn).trim().toUpperCase());
      if (idColIdx === -1) throw new Error("Kolom ID tidak ditemukan");
      let rowsToDelete = [];
      for (let i = 1; i < values.length; i++) {
        let currentId = values[i][idColIdx];
        if (idValues.some(val => isSameId(currentId, val))) rowsToDelete.push(i + 1);
      }
      if (rowsToDelete.length === 0) throw new Error("Data tidak ditemukan untuk dihapus");
      rowsToDelete.sort((a, b) => b - a);
      rowsToDelete.forEach(rowIdx => sheet.deleteRow(rowIdx));
      return jsonResponse({ status: "success", message: "Data berhasil dihapus" });
    }

    if (payload.mode === "TRIGGER_REKAP") {
      const tanggalTarget = payload.tanggal || Utilities.formatDate(new Date(), ZONA_WAKTU, "dd/MM/yyyy");
      prosesRekapPendapatanHarian(ss, ZONA_WAKTU, tanggalTarget);
      return jsonResponse({ status: "success", message: `Rekap untuk tanggal ${tanggalTarget} selesai` });
    }

    if (payload.mode === "UPLOAD_BUKTI_TRANSAKSI" || payload.mode === "UPLOAD_BUKTI_KAS") {
      const { base64Data, idCabang, idTransaksi, jenisTransaksi, ekstensiFile, filename, mimeType } = payload;
      let namaC = "Semua";
      if (idCabang !== "ALL" && idCabang !== "ADMIN") {
        const c = getSheetDataAsJSON("Master_Cabang").find(x => isSameId(x.ID_CABANG, idCabang));
        if (c) namaC = c.NAMA_CABANG;
      }
      const dNow = new Date();
      const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const dN = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
      const namaHari = dN[dNow.getDay()];
      
      const root = getOrCreateFolder(safeGetFolder(ROOT_FOLDER_ID), "Invoice & Struk");
      const fThn = getOrCreateFolder(root, Utilities.formatDate(dNow, ZONA_WAKTU, "yyyy"));
      const fBln = getOrCreateFolder(fThn, mN[dNow.getMonth()]);
      const fCab = getOrCreateFolder(fBln, namaC);
      
      let targetFolder = fCab;
      let targetJenis = jenisTransaksi || (payload.mode === "UPLOAD_BUKTI_KAS" ? "Buku Kas" : "Bukti Transaksi Umum");
      if (String(targetJenis).toUpperCase() === "PENDAPATAN HARIAN USAHA") {
        targetFolder = getOrCreateFolder(fCab, "Struk " + mN[dNow.getMonth()]);
      } else {
        targetFolder = getOrCreateFolder(fCab, targetJenis);
      }

      let formatTanggal = Utilities.formatDate(dNow, ZONA_WAKTU, "ddMMyyyy_HHmm");
      let targetId = idTransaksi || filename || "DOC";
      let ext = ekstensiFile || (mimeType ? mimeType.split('/')[1] : 'jpg');
      const fileName = `${formatTanggal}_${targetId}_${namaHari}.${ext}`;
      
      let mimeTypeTarget = ext === 'pdf' ? 'application/pdf' : (ext === 'png' ? 'image/png' : 'image/jpeg');

      // PEMBERSIH BASE64:
      let cleanBase64 = String(base64Data);
      if (cleanBase64.indexOf("base64,") !== -1) cleanBase64 = cleanBase64.split("base64,")[1];
      else if (cleanBase64.indexOf(",") !== -1) cleanBase64 = cleanBase64.split(",")[1];

      const file = targetFolder.createFile(Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeTypeTarget, fileName));
      const fileUrl = file.getUrl();

      // Update URL ke Sheet Transaksi jika ada idTransaksi
      if (idTransaksi) {
        const sheetTrans = ss.getSheetByName("Transaksi");
        if (sheetTrans) {
          const dataTrans = sheetTrans.getDataRange().getValues();
          const headers = dataTrans[0].map(h => String(h).trim().toUpperCase());
          let idCol = headers.indexOf("ID_TRANSAKSI") !== -1 ? headers.indexOf("ID_TRANSAKSI") : (headers.indexOf("ID TRANSAKSI") !== -1 ? headers.indexOf("ID TRANSAKSI") : 1);
          let linkCol = headers.indexOf("BUKTI_NOTA");
          if (linkCol === -1) linkCol = headers.indexOf("LINK_DRIVE");
          
          if (linkCol !== -1) {
            for (let i = 1; i < dataTrans.length; i++) {
              if (isSameId(dataTrans[i][idCol], idTransaksi)) {
                sheetTrans.getRange(i + 1, linkCol + 1).setValue(fileUrl);
                break;
              }
            }
          }
        }
      }
      return jsonResponse({ status: "success", url: fileUrl });
    }

    if (payload.mode === "UPLOAD_RECEIPT") {
      const { idPesanan, totalTagihan, idCabang, pdfBase64, tanggalWaktu } = payload;
      let namaC = idCabang;
      const c = getSheetDataAsJSON("Master_Cabang").find(x => isSameId(x.ID_CABANG, idCabang));
      if (c) namaC = c.NAMA_CABANG;
      let dTarget = new Date();
      if (tanggalWaktu) dTarget = new Date(tanggalWaktu);
      if (isNaN(dTarget.getTime())) dTarget = new Date();
      const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const dN = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const namaHariTgl = `${dN[dTarget.getDay()]}, ${Utilities.formatDate(dTarget, ZONA_WAKTU, "dd")} ${mN[dTarget.getMonth()]} ${Utilities.formatDate(dTarget, ZONA_WAKTU, "yyyy")}`;
      
      const root = getOrCreateFolder(safeGetFolder(ROOT_FOLDER_ID), "Invoice & Struk");
      const fThn = getOrCreateFolder(root, Utilities.formatDate(dTarget, ZONA_WAKTU, "yyyy"));
      const fBln = getOrCreateFolder(fThn, mN[dTarget.getMonth()]);
      const fCab = getOrCreateFolder(fBln, namaC);
      const fStruk = getOrCreateFolder(fCab, "Struk " + mN[dTarget.getMonth()]);
      const fHari = getOrCreateFolder(fStruk, namaHariTgl);
      
      const fileName = `${idPesanan} | ${totalTagihan}.pdf`;
      
      // PEMBERSIH BASE64
      let cleanBase64 = String(pdfBase64);
      if (cleanBase64.indexOf("base64,") !== -1) cleanBase64 = cleanBase64.split("base64,")[1];
      else if (cleanBase64.indexOf(",") !== -1) cleanBase64 = cleanBase64.split(",")[1];

      let fileUrl = "";
      if (fHari.getFilesByName(fileName).hasNext()) {
        fileUrl = fHari.getFilesByName(fileName).next().getUrl();
      } else {
        const file = fHari.createFile(Utilities.newBlob(Utilities.base64Decode(cleanBase64), 'application/pdf', fileName));
        fileUrl = file.getUrl();
      }

      // Update URL ke Sheet Data_Pesanan
      const sheetPesanan = ss.getSheetByName("Data_Pesanan");
      if (sheetPesanan) {
        const dataPes = sheetPesanan.getDataRange().getValues();
        const headers = dataPes[0].map(h => String(h).trim().toUpperCase());
        let idCol = headers.indexOf("ID_PESANAN");
        let linkCol = headers.indexOf("BUKTI_NOTA");
        if (linkCol === -1) linkCol = headers.indexOf("LINK_DRIVE");
        
        if (linkCol !== -1 && idCol !== -1) {
          for (let i = 1; i < dataPes.length; i++) {
            if (isSameId(dataPes[i][idCol], idPesanan)) {
              sheetPesanan.getRange(i + 1, linkCol + 1).setValue(fileUrl);
              break;
            }
          }
        }
      }
      return jsonResponse({ status: "success", url: fileUrl });
    }

    if (payload.mode === "UPLOAD_LAPORAN") {
      const { pdfBase64, idCabang, periode, tipe, tanggalLaporan } = payload;
      let namaC = "Semua";
      if (idCabang !== "ALL" && idCabang !== "ADMIN") {
        const c = getSheetDataAsJSON("Master_Cabang").find(x => isSameId(x.ID_CABANG, idCabang));
        if (c) namaC = c.NAMA_CABANG;
      }
      let dTarget = new Date();
      if (tanggalLaporan) {
        if (tanggalLaporan.includes("/")) {
          let p = tanggalLaporan.split("/");
          dTarget = new Date(p[2], p[1] - 1, p[0]);
        } else {
          dTarget = new Date(tanggalLaporan);
        }
      }
      if (isNaN(dTarget.getTime())) dTarget = new Date();
      const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      
      const root = getOrCreateFolder(safeGetFolder(ROOT_FOLDER_ID), "Laporan");
      const fThn = getOrCreateFolder(root, Utilities.formatDate(dTarget, ZONA_WAKTU, "yyyy"));
      const fBln = getOrCreateFolder(fThn, mN[dTarget.getMonth()]);
      const fCabang = getOrCreateFolder(fBln, namaC === "Semua" ? "Semua" : namaC);
      
      let labelTipeJudul = tipe === "GABUNGAN" ? "REKAPITULASI KEUANGAN" : (tipe === "PEMASUKAN" ? "REKAPITULASI PEMASUKAN" : (tipe === "PENGELUARAN" ? "REKAPITULASI PENGELUARAN" : "LABA RUGI BERSIH"));
      let formatWaktuFile = Utilities.formatDate(dTarget, ZONA_WAKTU, "MM_yyyy");
      if (periode === "HARIAN") formatWaktuFile = Utilities.formatDate(dTarget, ZONA_WAKTU, "dd_MM_yyyy");

      const fileName = `[${namaC.toUpperCase()}] ${labelTipeJudul}_${formatWaktuFile}.pdf`;
      
      // PEMBERSIH BASE64
      let cleanBase64 = String(pdfBase64);
      if (cleanBase64.indexOf("base64,") !== -1) cleanBase64 = cleanBase64.split("base64,")[1];
      else if (cleanBase64.indexOf(",") !== -1) cleanBase64 = cleanBase64.split(",")[1];
      
      if (fCabang.getFilesByName(fileName).hasNext()) return jsonResponse({ status: "success", message: "Laporan sudah ada", url: fCabang.getFilesByName(fileName).next().getUrl() });
      const file = fCabang.createFile(Utilities.newBlob(Utilities.base64Decode(cleanBase64), 'application/pdf', fileName));
      return jsonResponse({ status: "success", url: file.getUrl() });
    }
  } catch (err) { return jsonResponse({ status: "error", message: err.message }); }
}

function prosesRekapPendapatanHarian(ss, zonaWaktu, tanggalTarget) {
  const sheetPesanan = ss.getSheetByName("Data_Pesanan");
  const data = sheetPesanan.getDataRange().getValues();
  let rekap = {};
  const headersPesanan = data[0].map(h => String(h).trim().toUpperCase());
  const idxTgl = headersPesanan.indexOf("TANGGAL_WAKTU") !== -1 ? headersPesanan.indexOf("TANGGAL_WAKTU") : 1;
  const idxCabang = headersPesanan.indexOf("ID_CABANG") !== -1 ? headersPesanan.indexOf("ID_CABANG") : 2;
  const idxTotal = headersPesanan.indexOf("TOTAL_TAGIHAN") !== -1 ? headersPesanan.indexOf("TOTAL_TAGIHAN") : 3;
  const idxMetode = headersPesanan.indexOf("METODE_BAYAR") !== -1 ? headersPesanan.indexOf("METODE_BAYAR") : 4;
  const idxJenis = headersPesanan.indexOf("JENIS_PESANAN");

  for (let i = 1; i < data.length; i++) {
    const dInfo = parseDateToInfo(data[i][idxTgl], zonaWaktu);
    if (dInfo && dInfo.tglStr === tanggalTarget) {
      let id = String(data[i][idxCabang]).trim();
      let total = Number(data[i][idxTotal]) || 0;
      let metode = String(data[i][idxMetode]).trim().toUpperCase();
      let jenisP = idxJenis !== -1 ? String(data[i][idxJenis]).trim().toUpperCase() : "NORMAL";
      
      if (!rekap[id]) rekap[id] = { totalDebit: 0, cash: 0, transfer: 0, compl: 0 };
      
      if (jenisP === "COMPLIMENT" || jenisP === "ENDORSE") {
        rekap[id].compl += total;
      } else {
        rekap[id].totalDebit += total;
        // PENGGABUNGAN TRANSFER DAN QRIS
        if (metode === "TRANSFER" || metode === "QRIS") rekap[id].transfer += total;
        else rekap[id].cash += total;
      }
    }
  }

  const trans = ss.getSheetByName("Transaksi");
  const transData = trans.getDataRange().getValues();
  const headersTrans = transData[0].map(h => String(h).trim().toUpperCase());
  const colDebit = headersTrans.indexOf("DEBIT") !== -1 ? headersTrans.indexOf("DEBIT") + 1 : 5;
  const colKredit = headersTrans.indexOf("KREDIT") !== -1 ? headersTrans.indexOf("KREDIT") + 1 : 6;
  const colCash = headersTrans.indexOf("TOTAL_CASH") !== -1 ? headersTrans.indexOf("TOTAL_CASH") + 1 : 7;
  const colTransfer = headersTrans.indexOf("TOTAL_TRANSFER") !== -1 ? headersTrans.indexOf("TOTAL_TRANSFER") + 1 : 8;
  const colCompliment = headersTrans.indexOf("TOTAL_COMPLIMENT") !== -1 ? headersTrans.indexOf("TOTAL_COMPLIMENT") + 1 : 9;
  
  // Mencari kolom LINK_DRIVE / BUKTI_NOTA
  let linkCol = headersTrans.indexOf("BUKTI_NOTA");
  if (linkCol === -1) linkCol = headersTrans.indexOf("LINK_DRIVE");

  // Generate URL Folder Struk Hari Ini
  let dSekarang = new Date();
  if (tanggalTarget) {
    let p = tanggalTarget.split("/");
    dSekarang = new Date(p[2], p[1] - 1, p[0]);
  }
  const mN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const dN = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const namaHariTgl = `${dN[dSekarang.getDay()]}, ${Utilities.formatDate(dSekarang, zonaWaktu, "dd")} ${mN[dSekarang.getMonth()]} ${Utilities.formatDate(dSekarang, zonaWaktu, "yyyy")}`;
  const root = getOrCreateFolder(safeGetFolder("1YzbiIG_bQzjQnLiVhx0UrzAmJXrQcdU1"), "Invoice & Struk");
  const fThn = getOrCreateFolder(root, Utilities.formatDate(dSekarang, zonaWaktu, "yyyy"));
  const fBln = getOrCreateFolder(fThn, mN[dSekarang.getMonth()]);

  const masterCabang = getSheetDataAsJSON("Master_Cabang");

  Object.keys(rekap).forEach(id => {
    let r = rekap[id];
    if (r.totalDebit <= 0 && r.compl <= 0) return;
    
    // Mendapatkan URL Folder Struk Spesifik Cabang
    let urlFolderStruk = "";
    let cabangData = masterCabang.find(c => isSameId(c.ID_CABANG, id));
    if (cabangData) {
      let fCab = getOrCreateFolder(fBln, cabangData.NAMA_CABANG);
      let fStruk = getOrCreateFolder(fCab, "Struk " + mN[dSekarang.getMonth()]);
      let fHari = getOrCreateFolder(fStruk, namaHariTgl);
      urlFolderStruk = fHari.getUrl();
    }

    let found = false;
    for (let row = 1; row < transData.length; row++) {
      const dInfo = parseDateToInfo(transData[row][0], zonaWaktu);
      if (dInfo && dInfo.tglStr === tanggalTarget && isSameId(transData[row][1], id) && String(transData[row][3]).includes("Pendapatan Harian Usaha")) {
        trans.getRange(row + 1, colDebit).setValue(r.totalDebit);
        trans.getRange(row + 1, colCash).setValue(r.cash);
        trans.getRange(row + 1, colTransfer).setValue(r.transfer);
        trans.getRange(row + 1, colCompliment).setValue(r.compl);
        if (linkCol !== -1 && urlFolderStruk !== "") trans.getRange(row + 1, linkCol + 1).setValue(urlFolderStruk);
        found = true;
        break;
      }
    }
    if (!found) {
      let dateParts = tanggalTarget.split("/");
      let dateIso = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      let finalRow = new Array(Math.max(headersTrans.length, linkCol !== -1 ? linkCol + 1 : 9)).fill("");
      finalRow[0] = dateIso; finalRow[1] = id; finalRow[2] = "Pendapatan Usaha"; finalRow[3] = "Pendapatan Harian Usaha";
      finalRow[colDebit - 1] = r.totalDebit;
      finalRow[colKredit - 1] = 0;
      finalRow[colCash - 1] = r.cash;
      finalRow[colTransfer - 1] = r.transfer;
      finalRow[colCompliment - 1] = r.compl;
      if (linkCol !== -1) finalRow[linkCol] = urlFolderStruk;
      
      trans.appendRow(finalRow);
      trans.getRange(trans.getLastRow(), 1).setNumberFormat("dd/MM/yyyy");
    }
  });
}

function cronJobRekapOtomatisMalamHari() {
  const ZONA_WAKTU = "Asia/Makassar";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hariIni = new Date();
  const tanggalTarget = Utilities.formatDate(hariIni, ZONA_WAKTU, "dd/MM/yyyy");
  console.log("Memulai Pemicu Waktu Rekap Otomatis untuk Tanggal:", tanggalTarget);
  try {
    prosesRekapPendapatanHarian(ss, ZONA_WAKTU, tanggalTarget);
    console.log("Sistem Cron Job Selesai Menjalankan Tugas.");
  } catch (e) { console.error("Gagal melakukan cron job malam:", e.message); }
}

function jsonResponse(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function safeGetFolder(folderId) {
  const targetId = folderId || "1YzbiIG_bQzjQnLiVhx0UrzAmJXrQcdU1";
  try {
    return DriveApp.getFolderById(targetId);
  } catch (err) {
    console.warn("Folder ID not found, falling back to root folder:", err);
    return DriveApp.getRootFolder();
  }
}

function getOrCreateFolder(p, n) {
  let parent = p;
  if (!parent) {
    parent = DriveApp.getRootFolder();
  }
  try {
    const f = parent.getFoldersByName(n);
    return f.hasNext() ? f.next() : parent.createFolder(n);
  } catch (err) {
    console.warn("Gagal mengakses/membuat folder " + n + ", mencoba di Root Drive:", err);
    const root = DriveApp.getRootFolder();
    const f = root.getFoldersByName(n);
    return f.hasNext() ? f.next() : root.createFolder(n);
  }
}
function isSameId(id1, id2) { return String(id1).trim() === String(id2).trim(); }

function formatRp(angka) {
  if (isNaN(angka)) return "Rp0";
  let isNeg = angka < 0;
  let absStr = Math.abs(angka).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (isNeg ? "-" : "") + "Rp" + absStr;
}

function getSheetDataAsJSON(n) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);
  if (!s) return [];
  const d = s.getDataRange().getValues();
  if (d.length <= 1) return [];
  const h = d[0].map(header => String(header).trim().toUpperCase());
  return d.slice(1).map(r => { let o = {}; h.forEach((f, i) => o[f] = r[i]); return o; });
}

function parseDateToInfo(cellValue, zonaWaktu) {
  if (!cellValue) return null;
  let dObj = null;
  
  if (cellValue instanceof Date) {
    dObj = cellValue;
  } else {
    let str = String(cellValue).trim();
    if (!str) return null;
    let tglAwal = str.split(' ')[0];
    let p = [];
    if (tglAwal.includes('/')) p = tglAwal.split('/');
    else if (tglAwal.includes('-')) p = tglAwal.split('-');
    
    if (p.length === 3) {
      let d, m, y;
      if (p[0].length === 4) { // YYYY-MM-DD
        y = parseInt(p[0], 10); m = parseInt(p[1], 10); d = parseInt(p[2], 10);
      } else { // DD/MM/YYYY
        d = parseInt(p[0], 10); m = parseInt(p[1], 10); y = parseInt(p[2], 10);
      }
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { 
          obj: new Date(y, m - 1, d), 
          tglStr: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`, 
          isoDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          bulan: m, 
          tahun: y 
        };
      }
    }
    dObj = new Date(cellValue);
  }

  if (dObj && !isNaN(dObj.getTime())) {
    return { 
      obj: dObj, 
      tglStr: Utilities.formatDate(dObj, zonaWaktu, "dd/MM/yyyy"), 
      isoDate: Utilities.formatDate(dObj, zonaWaktu, "yyyy-MM-dd"),
      bulan: dObj.getMonth() + 1, 
      tahun: dObj.getFullYear() 
    };
  }
  return null;
}

function generateAutoId(sheetName, lastId) {
  const prefixMap = { "Master_Cabang": "CAB-", "Master_Kategori": "KAT-", "Master_Menu": "MNU-", "Master_Varian": "VAR-", "Data_Inventaris": "INV-", "Data_Izin_Shift": "SFT-", "Master_Promo": "PRM-", "Master_Pegawai": "PGW-", "Master_Operasional": "OPR-" };
  let prefix = prefixMap[sheetName] || "ID-";
  if (!lastId || String(lastId).trim() === "" || String(lastId) === "undefined") return prefix + "001";
  let match = String(lastId).match(/\d+$/);
  if (match) {
    let num = parseInt(match[0], 10) + 1;
    let paddedNum = String(num).padStart(match[0].length, '0');
    return String(lastId).replace(/\d+$/, paddedNum);
  } else {
    return prefix + new Date().getTime().toString().slice(-4);
  }
}
