import { REQUIRED_SCRIPT_VERSION } from "@/lib/gdriveCore";

/** Stands in for the private key in the template until the app fills it in for the account. */
export const SCRIPT_SECRET_TOKEN = "__RKE_SECRET__";

// ES5 only, and no backticks or template placeholders: Apps Script runs this text as written.
const TEMPLATE = `/**
 * RKE Invoice Generator - Google Apps Script webhook (version __RKE_VERSION__)
 *
 * 1. Open https://script.google.com, create a project and paste this whole file into Code.gs
 *    (replace everything that is there).
 * 2. First time: Deploy > New deployment > type: Web app, Execute as: Me,
 *    Who has access: Anyone. Copy the Web app address into the app's Settings page.
 *    Updating an existing deployment: Deploy > Manage deployments > pencil icon >
 *    Version: New version > Deploy.
 *
 * Every request must carry the private key below, which was made for your account.
 * Do not share this script or post it anywhere public.
 */
var SECRET = "__RKE_SECRET__";
var SCRIPT_VERSION = __RKE_VERSION__;
var ROOT_FOLDER = "RKE_Invoices_And_Data";
var LEDGER_FILE = "RKE_Invoice_Ledger";

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return reply({ status: "ERROR", error: "Empty request payload" });
    }
    var data = JSON.parse(e.postData.contents);

    if (SECRET.indexOf("__RKE") === 0) {
      return reply({
        status: "ERROR",
        error: "This script has no private key yet. Copy it again from the app's Settings page."
      });
    }
    if (!data.secret || data.secret !== SECRET) {
      return reply({
        status: "ERROR",
        error: "Wrong or missing private key. Copy the script again from the app's Settings page and redeploy it."
      });
    }

    var rootFolder = getOrCreateFolder(ROOT_FOLDER);

    if (data.action === "PING") {
      return reply({
        status: "SUCCESS",
        version: SCRIPT_VERSION,
        message: "Google Drive Webhook Connected Successfully!",
        folderId: rootFolder.getId()
      });
    }

    if (data.action === "UPLOAD_INVOICE_PDF") {
      if (!data.pdfBase64) {
        return reply({ status: "ERROR", error: "No PDF in the request" });
      }
      var yearFolder = getOrCreateFolder(data.year || "Unsorted", rootFolder);
      var filename = data.filename || "Invoice.pdf";
      var blob = Utilities.newBlob(Utilities.base64Decode(data.pdfBase64), "application/pdf", filename);
      trashByName(yearFolder, filename);
      yearFolder.createFile(blob);
      return reply({ status: "SUCCESS", version: SCRIPT_VERSION });
    }

    if (data.action === "TRASH_INVOICE_FILE") {
      if (data.year && data.filename) {
        trashByName(getOrCreateFolder(data.year, rootFolder), data.filename);
      }
      return reply({ status: "SUCCESS", version: SCRIPT_VERSION });
    }

    if (data.action === "DELETE_INVOICE") {
      if (data.year && data.filename) {
        trashByName(getOrCreateFolder(data.year, rootFolder), data.filename);
      }
      if (data.invoiceNo) {
        deleteInvoiceRowFromSheet(rootFolder, data.invoiceNo);
      }
      return reply({ status: "SUCCESS", version: SCRIPT_VERSION });
    }

    if (data.action === "UPLOAD_DB_BACKUP") {
      if (!data.backupJson) {
        return reply({ status: "ERROR", error: "No backup in the request" });
      }
      var backupFolder = getOrCreateFolder("Backups", rootFolder);
      var backupName = "rke_database_backup.json";
      var existing = backupFolder.getFilesByName(backupName);
      if (existing.hasNext()) {
        existing.next().setContent(data.backupJson);
      } else {
        backupFolder.createFile(backupName, data.backupJson, "application/json");
      }
      return reply({ status: "SUCCESS", version: SCRIPT_VERSION });
    }

    if (data.action === "LOG_TO_SHEET") {
      if (!data.invoiceSummary) {
        return reply({ status: "ERROR", error: "No invoice summary in the request" });
      }
      logToGoogleSheet(rootFolder, data.invoiceSummary);
      return reply({ status: "SUCCESS", version: SCRIPT_VERSION });
    }

    return reply({ status: "ERROR", error: "Unknown action: " + data.action });
  } catch (err) {
    return reply({ status: "ERROR", error: err.toString() });
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

function trashByName(folder, name) {
  var files = folder.getFilesByName(name);
  while (files.hasNext()) {
    files.next().setTrashed(true);
  }
}

function logToGoogleSheet(rootFolder, inv) {
  var files = rootFolder.getFilesByName(LEDGER_FILE);
  var ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(LEDGER_FILE);
    DriveApp.getFileById(ss.getId()).moveTo(rootFolder);
    ss.getActiveSheet().appendRow(["Invoice No", "Date", "Client Name", "Total Amount (INR)", "Status", "Last Updated"]);
  }
  var sheet = ss.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(inv.invoiceNo)) {
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
  var files = rootFolder.getFilesByName(LEDGER_FILE);
  if (!files.hasNext()) return;
  var sheet = SpreadsheetApp.open(files.next()).getActiveSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(invoiceNo)) {
      sheet.deleteRow(i + 1);
    }
  }
}
`;

/** The Apps Script to paste into Google, with this account's private key filled in. */
export function renderGDriveScript(secret: string): string {
  return TEMPLATE.replace("var SECRET = \"" + SCRIPT_SECRET_TOKEN + "\";", () => `var SECRET = "${secret}";`).replace(
    /__RKE_VERSION__/g,
    String(REQUIRED_SCRIPT_VERSION),
  );
}
