import React, { useState } from 'react';
import { Copy, Check, FileText, Code2, GitMerge, ShieldAlert, FolderTree, AlertOctagon, HelpCircle } from 'lucide-react';

export default function ArchitectDashboard() {
  const [activeTab, setActiveTab] = useState<'flow' | 'repo' | 'gas' | 'cicd'>('flow');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Google Apps Script code
  const gasCode = `// =========================================================================
// GOOGLE APPS SCRIPT DATABASE INTEGRATION (code.gs)
// Hubungkan React Frontend POS (Offline-First) ke Google Sheets DB
// =========================================================================

const SPREADSHEET_ID = "ID_SPREADSHEET_GOOGLE_ANDA"; // Masukkan ID Google Sheet Anda
const SHEET_NAME = "Transactions";

function setupDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Setup Column Headers
    sheet.appendRow([
      "Timestamp_In_Local", 
      "Transaction_ID", 
      "Total_Amount", 
      "Payment_Method", 
      "Items_JSON", 
      "Sync_Timestamp_UTC", 
      "Client_IP"
    ]);
    
    // Format headers agar tebal dan rapi
    const range = sheet.getRange(1, 1, 1, 7);
    range.setFontWeight("bold");
    range.setBackground("#f3f4f6");
    sheet.setFrozenRows(1);
  }
}

// Handler HTTP GET - Mengembalikan daftar sisa stok produk atau record (Opsional)
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const row = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = data[i][j];
      }
      rows.push(row);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: rows
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*"); // Headroom CORS
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
  }
}

// Handler HTTP POST - Menerima sinkronisasi checkout POS
function doPost(e) {
  try {
    // 1. Memeriksa keberadaan postData
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Payload kosong atau tidak valid.");
    }
    
    // 2. Parsing JSON transaksi dari client
    // CATATAN PENTING: Untuk menghindari CORS Preflight (OPTIONS),
    // Client mengirim dengan Content-Type: 'text/plain', isi raw JSON string.
    const transaction = JSON.parse(e.postData.contents);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      setupDatabase();
      sheet = ss.getSheetByName(SHEET_NAME);
    }
    
    // Urutan kolom: 
    // [Local Timestamp, Transaction ID, Total Amount, Payment Method, Items JSON, Sync Timestamp, Client IP]
    const itemsJson = JSON.stringify(transaction.items.map(item => ({
      name: item.product.name,
      qty: item.quantity,
      price: item.product.price
    })));
    
    sheet.appendRow([
      transaction.timestamp,
      transaction.id,
      transaction.totalAmount,
      transaction.paymentMethod,
      itemsJson,
      new Date().toISOString(),
      "Cloud_Gateway"
    ]);
    
    // Mengembalikan response sukses berisi ID Transaksi yang berhasil disinkronisasi
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      syncedId: transaction.id,
      message: "Transaksi berhasil terekam ke Google Sheets"
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*"); // Pengembalian CORS Header di Redirect Target
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
  }
}`;

  // GitHub Actions workflow
  const githubWorkflow = `# =========================================================================
# GITHUB ACTIONS CI/CD AUTOMATION - Android Bundle (.github/workflows/android.yml)
# Membantu build React Web -> Capacitor Asset Compilation -> Gradle -> signed APK
# =========================================================================

name: Build Android Native App (APK)

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main ]

jobs:
  build-apk:
    name: Build & Package Android App
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout Repository
      uses: actions/checkout@v4

    - name: Set up Java Development Kit (JDK) 17
      uses: actions/setup-java@v4
      with:
        java-version: '17'
        distribution: 'zulu'
        cache: 'gradle'

    - name: Set up Node.js Environment
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install JS Dependencies
      run: npm ci

    - name: Compile React App (Vite Build)
      run: npm run build
      env:
        NODE_ENV: production

    # Menjamin kelengkapan CLI Capacitor lokal
    - name: Ensure Capacitor CLI & Android Setup
      run: |
        npx cap init "Kedai Kopi Ditya" "com.pos.mobile" --web-dir=dist --inline-manifesting
        npx cap add android || true

    - name: Sync Web Assets to Android Project
      run: npx cap sync android

    - name: Grant Execute Permissions for Gradlew
      run: chmod +x android/gradlew
      working-directory: android

    - name: Compile Native Android (Build Release APK via Gradle)
      run: ./gradlew assembleDebug --no-daemon
      working-directory: android

    - name: Upload Generated APK as Work Artifact
      uses: actions/upload-artifact@v4
      with:
        name: debug-android-app-apk
        path: android/app/build/outputs/apk/debug/app-debug.apk
        retention-days: 7
`;

  // Directory Structure Tree
  const dirStructure = `POS-Workspace-Root/
├── .github/              <-- Integrasi GitHub API & CI/CD pipeline
│   └── workflows/
│       └── android.yml    <-- GitHub Actions Build Script (APK generator)
├── android/              <-- Native Android Platform (di-generate oleh Capacitor)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/pos/mobile/
│   │   │   │   └── WebAppInterface.java  <-- Javascript Bridge Cetak Thermal
│   │   │   └── AndroidManifest.xml       <-- Manifest Permission (Internet, Print)
│   │   └── build.gradle
│   ├── build.gradle
│   └── gradlew           <-- Gradle wrapper wrapper script (CI target/auto-healed)
├── dist/                 <-- Hasil bundle frontend SPA statis (Vite build target)
├── src/                  <-- Source code modul POS React
│   ├── components/       <-- Modular UI (Simulator, Receipt, Specs)
│   ├── utils/            <-- Modul offline DB & sync manager
│   ├── App.tsx           <-- Main Layout
│   ├── types.ts          <-- Type checking & interfaces
│   └── index.css
├── capacitor.config.json <-- Konfigurasi bundle Capacitor Android
├── package.json          <-- Dependencies & script npm
├── vite.config.ts        <-- Konfigurasi build Vite
└── GoogleAppsScript_code.gs <-- File backup Google Apps Script backend`;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden" id="architect-section">
      <div className="bg-zinc-50 border-b border-zinc-100 p-5">
        <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <Code2 className="h-5 w-5 text-zinc-800" />
          Blueprint Arsitektur dari Lead Software Architect
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Eksklusif dibuat untuk pengembangan modular bernilai produksi tinggi melalui peramban HP (Mobile Browser-First).
        </p>

        {/* Tab Selector */}
        <div className="flex gap-1 overflow-x-auto mt-4 p-1 bg-zinc-100 rounded-xl max-w-max scrollbar-none">
          <button
            onClick={() => setActiveTab('flow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'flow' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            CORS & REST Flow
          </button>
          <button
            onClick={() => setActiveTab('repo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'repo' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Struktur Direktori
          </button>
          <button
            onClick={() => setActiveTab('gas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'gas' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Google Apps Script
          </button>
          <button
            onClick={() => setActiveTab('cicd')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'cicd' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            GitHub Actions (.yml)
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* TAB 1: CORS & FLOW */}
        {activeTab === 'flow' && (
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-sky-50 border border-sky-100">
              <ShieldAlert className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wide">
                  Solusi CORS & Redirect Google Apps Script (GAS)
                </h4>
                <p className="text-xs text-sky-700 leading-relaxed mt-1">
                  Bagaimana sistem POS lokal React meloloskan request POST data dengan aman di Google Apps Script tanpa terkena blokir kebijakan CORS?
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-600 leading-relaxed mt-2">
              <div className="space-y-3">
                <h5 className="font-bold text-zinc-900 border-l-2 border-zinc-700 pl-2">
                  Kenapa Terjadi CORS Error di GAS?
                </h5>
                <p>
                  Secara default, Google Apps Script Web App menghasilkan pengalihan <strong>HTTP 302 Found</strong> ke URL server sementara: <code>https://script.googleusercontent.com/...</code>.
                </p>
                <p>
                  Jika pengiriman request menggunakan header standar seperti <code>Content-Type: application/json</code>, browser akan otomatis mendeteksi hal ini sebagai operasi non-trivial dan memicu request pra-uji atau <strong>CORS OPTIONS Preflight</strong>. Karena mesin GAS tidak mendukung intercept <code>OPTIONS</code> tersebut, pengiriman akan langsung digagalkan oleh browser (CORS Error).
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-zinc-900 border-l-2 border-emerald-600 pl-2">
                  Solusi Pintar Meloloskan CORS (The &ldquo;text/plain&rdquo; Trick)
                </h5>
                <p>
                  Untuk memecahkan masalah ini secara jitu, React Frontend POS diprogram untuk melakukan <strong>POST dengan Header <code>Content-Type: text/plain</code></strong> berisi mentahan JSON ter-stringisasi:
                </p>
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 font-mono text-[10px] text-zinc-800">
                  {`fetch(gasUrl, {
  method: "POST",
  mode: "no-cors", // Opsional, atau lewati preflight
  headers: { "Content-Type": "text/plain" },
  body: JSON.stringify(transaction)
})`}
                </div>
                <p>
                  Format <code>text/plain</code> dianggap sebagai <strong>Simple Request</strong> oleh spesifikasi W3C CORS, sehingga browser **sama sekali tidak memicu preflight OPTIONS**. Pada mesin Google Apps Script, string mentah dibaca langsung via <code>e.postData.contents</code> dan diubah menjadi objek JSON menggunakan <code>JSON.parse()</code> dengan andal.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DIRECTORY */}
        {activeTab === 'repo' && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-600 leading-relaxed">
              Berikut susunan direktori repositori GitHub yang ideal untuk memuluskan build otomatis (CI/CD) Capacitor Android tanpa memerlukan komputer desktop lokal. Penyerahan kode ini langsung dibuild menjadi APK rilis via GitHub Actions:
            </p>
            <div className="relative bg-zinc-950 rounded-xl p-4 font-mono text-[11px] text-zinc-300 leading-relaxed max-h-[300px] overflow-y-auto border border-zinc-900 scrollbar-thin">
              <pre>{dirStructure}</pre>
            </div>
          </div>
        )}

        {/* TAB 3: GAS */}
        {activeTab === 'gas' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-zinc-600">
                Pilih dan salin kode Apps Script di bawah, lalu tempel pada editor naskah lembar sebar Google Sheets Anda (Ekstensi &gt; Apps Script):
              </p>
              <button
                onClick={() => handleCopy(gasCode, 'gas')}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shrink-0"
              >
                {copiedText === 'gas' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Salin Kode
                  </>
                )}
              </button>
            </div>
            <div className="relative bg-zinc-950 rounded-xl p-4 font-mono text-[10px] text-zinc-300 leading-relaxed max-h-[300px] overflow-y-auto border border-zinc-900 scrollbar-thin">
              <pre>{gasCode}</pre>
            </div>
          </div>
        )}

        {/* TAB 4: CICD */}
        {activeTab === 'cicd' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-zinc-600">
                Alur otomatisasi pembungkusan Android APK menggunakan GitHub Actions. Simpan file ini di repositori Anda pada path <code>.github/workflows/android.yml</code>:
              </p>
              <button
                onClick={() => handleCopy(githubWorkflow, 'cicd')}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shrink-0"
              >
                {copiedText === 'cicd' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Salin YAML
                  </>
                )}
              </button>
            </div>
            <div className="relative bg-zinc-950 rounded-xl p-4 font-mono text-[10px] text-zinc-300 leading-relaxed max-h-[300px] overflow-y-auto border border-zinc-900 scrollbar-thin">
              <pre>{githubWorkflow}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
