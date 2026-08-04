/**
 * RKE Invoice Generator - Google Apps Script Webhook
 * 
 * Instructions:
 * 1. Open https://script.google.com and click "+ New project" (or edit your existing project).
 * 2. Paste this entire script into Code.gs (replacing all code).
 * 3. Click "Deploy" -> "Manage deployments" -> edit icon -> Select "New version" -> Click "Deploy".
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "ERROR", error: "Empty request payload" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var rootFolder = getOrCreateFolder("RKE_Invoices_And_Data");

    // Ping test
    if (data.action === "PING") {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "SUCCESS", 
        message: "Google Drive Webhook Connected Successfully!",
        folderId: rootFolder.getId()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle PDF File Upload
    if (data.action === "UPLOAD_INVOICE_PDF" && data.pdfBase64) {
      var yearFolder = getOrCreateFolder(data.year || "2026", rootFolder);
      var decoded = Utilities.base64Decode(data.pdfBase64);
      var filename = data.filename || "Invoice.pdf";
      var blob = Utilities.newBlob(decoded, "application/pdf", filename);

      // Delete/trash previous version if it exists to replace cleanly
      var existingFiles = yearFolder.getFilesByName(filename);
      while (existingFiles.hasNext()) {
        existingFiles.next().setTrashed(true);
      }
      yearFolder.createFile(blob);
    }

    // Handle Invoice Deletion (Trash PDF & Delete Row from Sheet)
    if (data.action === "DELETE_INVOICE") {
      if (data.filename && data.year) {
        var yearFolder = getOrCreateFolder(data.year, rootFolder);
        var files = yearFolder.getFilesByName(data.filename);
        while (files.hasNext()) {
          files.next().setTrashed(true);
        }
      }
      if (data.invoiceNo) {
        deleteInvoiceRowFromSheet(rootFolder, data.invoiceNo);
      }
    }

    // Handle Full Database Backup JSON
    if (data.action === "UPLOAD_DB_BACKUP" && data.backupJson) {
      var backupFolder = getOrCreateFolder("Backups", rootFolder);
      var backupName = "rke_database_backup.json";
      var bFiles = backupFolder.getFilesByName(backupName);
      if (bFiles.hasNext()) {
        bFiles.next().setContent(data.backupJson);
      } else {
        backupFolder.createFile(backupName, data.backupJson, "application/json");
      }
    }

    // Log Summary to Google Sheet Ledger
    if (data.action === "LOG_TO_SHEET" && data.invoiceSummary) {
      logToGoogleSheet(rootFolder, data.invoiceSummary);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "ERROR", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateFolder(folderName, parent) {
  var parentFolder = parent || DriveApp.getRootFolder();
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

function logToGoogleSheet(rootFolder, inv) {
  var files = rootFolder.getFilesByName("RKE_Invoice_Ledger");
  var ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create("RKE_Invoice_Ledger");
    DriveApp.getFileById(ss.getId()).moveTo(rootFolder);
    var sheet = ss.getActiveSheet();
    sheet.appendRow(["Invoice No", "Date", "Client Name", "Total Amount (INR)", "Status", "Last Updated"]);
  }
  var sheet = ss.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === inv.invoiceNo) {
      rowIndex = i + 1;
      break;
    }
  }

  var rowValues = [
    inv.invoiceNo || "N/A",
    inv.date || new Date().toLocaleDateString(),
    inv.clientName || "N/A",
    inv.grandTotal || 0,
    inv.status || "DRAFT",
    new Date().toISOString()
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function deleteInvoiceRowFromSheet(rootFolder, invoiceNo) {
  var files = rootFolder.getFilesByName("RKE_Invoice_Ledger");
  if (!files.hasNext()) return;
  var ss = SpreadsheetApp.open(files.next());
  var sheet = ss.getActiveSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === invoiceNo) {
      sheet.deleteRow(i + 1);
    }
  }
}
