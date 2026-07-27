// ============================================================
// Google Apps Script — doPost untuk Sistem Mutabaah Al-Qur'an
// Sheet: Log_Mutabaah
// Columns: ID_Log, Timestamp, Tanggal_Mutabaah, Email_Guru,
//          Nama_Guru, ID_Siswa, Nama_Siswa, Kehadiran,
//          Tahsin_Rujukan, Tahsin_Capaian_SuratBab, Tahsin_Capaian_Detail,
//          Tahsin_Nilai, Tahfidh_Jenis, Tahfidh_Surat, Tahfidh_Ayat,
//          Tahfidh_Nilai, Tajwid_Jenis, Tajwid_Capaian, Tajwid_Nilai, Catatan
//
// Actions: create (default), update, delete
// Deploy sebagai Web App → Execute as: Me → Access: Anyone
// ============================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log_Mutabaah");
    var data = JSON.parse(e.postData.contents);

    // === ACTION: UPDATE ===
    if (data._action === 'update') {
      var logId = data.ID_Log;
      var lastRow = sheet.getLastRow();
      if (lastRow < 1) return ContentService.createTextOutput("EMPTY");

      var ids = sheet.getRange(1, 1, lastRow, 1).getValues();
      var targetRow = -1;
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === logId) {
          targetRow = i + 1; // 1-indexed
          break;
        }
      }

      var row = [
        data.ID_Log || '',
        data.Timestamp || '',
        data.Tanggal_Mutabaah || '',
        data.Email_Guru || '',
        data.Nama_Guru || '',
        data.ID_Siswa || '',
        data.Nama_Siswa || '',
        data.Kehadiran || '',
        data.Tahsin_Rujukan || '',
        data.Tahsin_Capaian_SuratBab || '',
        data.Tahsin_Capaian_Detail || '',
        data.Tahsin_Nilai !== null && data.Tahsin_Nilai !== undefined ? data.Tahsin_Nilai : '',
        data.Tahfidh_Jenis || '',
        data.Tahfidh_Surat || '',
        data.Tahfidh_Ayat || '',
        data.Tahfidh_Nilai !== null && data.Tahfidh_Nilai !== undefined ? data.Tahfidh_Nilai : '',
        data.Tajwid_Jenis || '',
        data.Tajwid_Capaian || '',
        data.Tajwid_Nilai !== null && data.Tajwid_Nilai !== undefined ? data.Tajwid_Nilai : '',
        data.Catatan || ''
      ];

      if (targetRow > 0) {
        sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
      } else {
        sheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
      }
      return ContentService.createTextOutput("OK");
    }

    // === ACTION: DELETE ===
    if (data._action === 'delete') {
      var logId = data.ID_Log;
      var lastRow = sheet.getLastRow();
      if (lastRow < 1) return ContentService.createTextOutput("EMPTY");

      var ids = sheet.getRange(1, 1, lastRow, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === logId) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput("OK");
        }
      }
      return ContentService.createTextOutput("NOT_FOUND");
    }

    // === ACTION: CREATE (default, existing logic) ===
    var items = [];

    if (data.records && Array.isArray(data.records)) {
      items = data.records;
    } else if (Array.isArray(data)) {
      items = data;
    } else {
      items = [data];
    }

    var rows = items.map(function(item) {
      return [
        item.ID_Log || '',
        item.Timestamp || '',
        item.Tanggal_Mutabaah || '',
        item.Email_Guru || '',
        item.Nama_Guru || '',
        item.ID_Siswa || '',
        item.Nama_Siswa || '',
        item.Kehadiran || '',
        item.Tahsin_Rujukan || '',
        item.Tahsin_Capaian_SuratBab || '',
        item.Tahsin_Capaian_Detail || '',
        item.Tahsin_Nilai !== null && item.Tahsin_Nilai !== undefined ? item.Tahsin_Nilai : '',
        item.Tahfidh_Jenis || '',
        item.Tahfidh_Surat || '',
        item.Tahfidh_Ayat || '',
        item.Tahfidh_Nilai !== null && item.Tahfidh_Nilai !== undefined ? item.Tahfidh_Nilai : '',
        item.Tajwid_Jenis || '',
        item.Tajwid_Capaian || '',
        item.Tajwid_Nilai !== null && item.Tajwid_Nilai !== undefined ? item.Tajwid_Nilai : '',
        item.Catatan || ''
      ];
    });

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return ContentService.createTextOutput("OK");

  } catch (error) {
    return ContentService.createTextOutput("ERROR: " + error.message);
  }
}
