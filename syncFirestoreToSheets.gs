// ===================================================================================
// Google Apps Script — Penarik Otomatis Data dari Firebase Firestore ke Spreadsheet
// Pasang script ini di Google Spreadsheet: Extensions -> Apps Script
// ===================================================================================

var FIREBASE_PROJECT_ID = "mutabaah-alwildan29";
var SHEET_NAME = "Log_Mutabaah";

/**
 * Menambahkan menu khusus di atas Google Spreadsheet saat file dibuka
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Firebase Sync')
    .addItem('Tarik Data Terbaru dari Firebase', 'syncFromFirestoreToSheet')
    .addToUi();
}

/**
 * Fungsi utama untuk menarik data dari Firestore dan menambahkannya ke sheet Log_Mutabaah
 * Dapat di-trigger otomatis setiap 5 atau 10 menit via Triggers (Jam lonceng di Apps Script)
 */
function syncFromFirestoreToSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("Sheet " + SHEET_NAME + " tidak ditemukan!");
    return;
  }

  // 1. Kumpulkan ID_Log yang sudah ada di Sheet agar tidak duplikat
  var existingIds = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var idVals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var k = 0; k < idVals.length; k++) {
      if (idVals[k][0]) {
        existingIds[String(idVals[k][0]).trim()] = true;
      }
    }
  }

  // 2. Ambil dokumen dari koleksi 'log_mutabaah' di Firestore REST API
  var firestoreUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/log_mutabaah?pageSize=300";
  
  var response;
  try {
    response = UrlFetchApp.fetch(firestoreUrl, { muteHttpExceptions: true });
  } catch (err) {
    Logger.log("Gagal koneksi ke Firestore: " + err);
    return;
  }

  if (response.getResponseCode() !== 200) {
    Logger.log("Error Firestore: " + response.getContentText());
    return;
  }

  var data = JSON.parse(response.getContentText());
  var documents = data.documents || [];
  if (documents.length === 0) {
    Logger.log("Tidak ada data di Firestore.");
    return;
  }

  // Helper untuk membaca tipe data field dari Firestore JSON
  function getVal(field) {
    if (!field) return '';
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.integerValue !== undefined) return Number(field.integerValue);
    if (field.doubleValue !== undefined) return Number(field.doubleValue);
    if (field.booleanValue !== undefined) return field.booleanValue;
    return '';
  }

  // 3. Filter data baru yang belum ada di spreadsheet
  var rowsToAppend = [];
  for (var i = 0; i < documents.length; i++) {
    var fields = documents[i].fields || {};
    var idLog = getVal(fields.ID_Log);
    if (!idLog) {
      // Ambil ID dari nama dokumen jika ID_Log kosong
      var docParts = documents[i].name.split('/');
      idLog = docParts[docParts.length - 1];
    }

    if (existingIds[idLog]) {
      continue; // Sudah ada, lewati agar tidak dobel
    }

    existingIds[idLog] = true;

    rowsToAppend.push([
      idLog,
      getVal(fields.Timestamp),
      getVal(fields.Tanggal_Mutabaah),
      getVal(fields.Email_Guru),
      getVal(fields.Nama_Guru),
      getVal(fields.ID_Siswa),
      getVal(fields.Nama_Siswa),
      getVal(fields.Kehadiran),
      getVal(fields.Tahsin_Rujukan),
      getVal(fields.Tahsin_Capaian_SuratBab),
      getVal(fields.Tahsin_Capaian_Detail),
      getVal(fields.Tahsin_Nilai),
      getVal(fields.Tahfidh_Jenis),
      getVal(fields.Tahfidh_Surat),
      getVal(fields.Tahfidh_Ayat),
      getVal(fields.Tahfidh_Nilai),
      getVal(fields.Tajwid_Jenis),
      getVal(fields.Tajwid_Capaian),
      getVal(fields.Tajwid_Nilai),
      getVal(fields.Catatan)
    ]);
  }

  // 4. Batch append sekaligus ke Spreadsheet
  if (rowsToAppend.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    Logger.log("Berhasil menyinkronkan " + rowsToAppend.length + " data baru dari Firebase!");
  } else {
    Logger.log("Semua data Firebase sudah sinkron dengan Spreadsheet.");
  }
}
