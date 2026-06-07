function doGet(e) {
  try {
    const action = e.parameter.action;
    const sheetName = e.parameter.sheetName || 'Data';
    
    if (action === 'getMasterData') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Sheet not found' })).setMimeType(ContentService.MimeType.JSON);
      }
      
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) {
         return ContentService.createTextOutput(JSON.stringify({ success: true, data: { cabang: [], kategori: [], menu: [], varian: [] } })).setMimeType(ContentService.MimeType.JSON);
      }

      const headers = data[0];
      const rows = data.slice(1);
      
      const cabang = [];
      const kategori = [];
      const menu = [];
      const varian = [];

      // Logic parsing: ini disesuaikan dengan skema kolom Spreadsheet.
      // Format Default Aura Food:
      // Tabel Cabang: ID_CABANG, NAMA_CABANG, PASSWORD, LOKASI
      // Tabel Kategori: ID_KATEGORI, NAMA_KATEGORI
      // Tabel Menu: ID_MENU, ID_KATEGORI, NAMA_MENU
      // Tabel Varian: ID_VARIAN, ID_KATEGORI, ID_MENU, NAMA_VARIAN, HARGA, STATUS
      
      // Implementasikan parsing khusus untuk membaca masing-masing tabel jika di sheet yang sama
      // Atau ubah struktur ini menyesuaikan multi-sheet jika lebih mudah

      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        data: { cabang: cabang, kategori: kategori, menu: menu, varian: varian } 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Unknown action' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  // Logic untuk menerima payload transaksi dan menyimpannya ke Spreadsheet
}
