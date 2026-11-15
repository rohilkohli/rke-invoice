import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  REQUIRED_SCRIPT_VERSION,
  driveFileName,
  driveYear,
  isAllowedWebhookUrl,
  parseWebhookReply,
  planDriveCleanup,
  scriptVersionWarning,
} from "../lib/gdriveCore";
import { renderGDriveScript } from "../lib/gdriveScript";

test("only a deployed Google Apps Script address is accepted", () => {
  for (const ok of [
    "https://script.google.com/macros/s/AKfycbxyz123/exec",
    "  https://script.google.com/macros/s/AKfycbxyz123/exec  ",
    "https://script.google.com/a/macros/example.com/s/AKfy/exec",
  ]) {
    assert.equal(isAllowedWebhookUrl(ok), true, ok);
  }
  for (const bad of [
    "",
    null,
    undefined,
    "not a url",
    "http://script.google.com/macros/s/x/exec",
    "https://script.google.com.evil.com/macros/s/x/exec",
    "https://evil.com/?u=https://script.google.com/macros/s/x/exec",
    "https://user:pw@script.google.com/macros/s/x/exec",
    "https://script.google.com:8443/macros/s/x/exec",
    "https://script.google.com/other/path",
    "http://127.0.0.1:9911/hook",
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost/macros/",
  ]) {
    assert.equal(isAllowedWebhookUrl(bad), false, String(bad));
  }
});

test("the Drive file name always comes from the invoice number", () => {
  assert.equal(driveFileName("RKE/26-27/003"), "RKE_26-27_003.pdf");
  assert.equal(driveFileName("  INV 7 "), "INV_7.pdf");
  assert.equal(driveFileName("///"), "invoice.pdf");
  assert.equal(driveFileName("x".repeat(300)).length, 104);
  assert.equal(driveYear(new Date("2026-12-31T23:59:59Z")), "2026");
});

test("cleanup: nothing when nothing changed, the old file when it moved, the old row when the number changed", () => {
  const same = { no: "A-1", year: "2026", file: "A-1.pdf" };
  assert.deepEqual(planDriveCleanup(same, same), { trash: null, deleteRowOf: null });
  assert.deepEqual(planDriveCleanup({ no: null, year: null, file: null }, same), { trash: null, deleteRowOf: null });
  assert.deepEqual(planDriveCleanup(same, { no: "A-1", year: "2027", file: "A-1.pdf" }), {
    trash: { year: "2026", file: "A-1.pdf" },
    deleteRowOf: null,
  });
  assert.deepEqual(planDriveCleanup(same, { no: "A-2", year: "2026", file: "A-2.pdf" }), {
    trash: { year: "2026", file: "A-1.pdf" },
    deleteRowOf: "A-1",
  });
});

test("Google's answers become messages a person can act on", () => {
  assert.deepEqual(parseWebhookReply(200, "OK", '{"status":"SUCCESS","version":2,"message":"hi"}'), {
    ok: true,
    message: "hi",
    version: 2,
  });
  assert.equal(parseWebhookReply(200, "OK", '{"status":"SUCCESS"}').version, undefined);
  assert.match(parseWebhookReply(200, "OK", '{"status":"ERROR","error":"Wrong or missing private key"}').error ?? "", /private key/);
  assert.match(parseWebhookReply(403, "Forbidden", "").error ?? "", /Anyone/);
  assert.match(parseWebhookReply(500, "Server Error", "").error ?? "", /HTTP 500/);
  assert.match(parseWebhookReply(200, "OK", "<html>login</html>").error ?? "", /ending in \/exec/);
});

test("an out-of-date script is warned about, a current one is not", () => {
  assert.ok(scriptVersionWarning(undefined));
  assert.ok(scriptVersionWarning(1));
  assert.equal(scriptVersionWarning(REQUIRED_SCRIPT_VERSION), undefined);
});

// ---------------------------------------------------------------------------
// The Apps Script itself, run against stand-ins for Google's services
// ---------------------------------------------------------------------------

function runScript(secretInScript: string) {
  const created: string[] = [];
  const trashed: string[] = [];
  const folder = {
    getId: () => "root-folder",
    getFoldersByName: () => ({ hasNext: () => false }),
    createFolder: () => folder,
    getFilesByName: (name: string) => ({
      hasNext: (() => {
        let given = false;
        return () => (given ? false : ((given = true), name === "old.pdf"));
      })(),
      next: () => ({ setTrashed: () => trashed.push(name) }),
    }),
    createFile: (blob: { name: string }) => created.push(blob.name),
  };
  const sandbox = {
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }),
    },
    DriveApp: { getRootFolder: () => folder },
    Utilities: {
      base64Decode: (s: string) => s,
      newBlob: (_bytes: unknown, _type: string, name: string) => ({ name }),
    },
    SpreadsheetApp: {},
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(renderGDriveScript(secretInScript), context);
  const call = (payload: Record<string, unknown>) =>
    JSON.parse(
      (context as unknown as { doPost: (e: unknown) => { text: string } }).doPost({
        postData: { contents: JSON.stringify(payload) },
      }).text,
    );
  return { call, created, trashed };
}

test("the script has no placeholders left and is valid code", () => {
  const script = renderGDriveScript("abc123secret");
  assert.ok(!script.includes("__RKE_SECRET__"));
  assert.ok(!script.includes("__RKE_VERSION__"));
  assert.ok(script.includes('var SECRET = "abc123secret";'));
  assert.ok(script.includes(`var SCRIPT_VERSION = ${REQUIRED_SCRIPT_VERSION};`));
  assert.doesNotThrow(() => new vm.Script(script));
});

test("the script answers only a request that carries its private key", () => {
  const { call } = runScript("right-key");

  const ping = call({ action: "PING", secret: "right-key" });
  assert.equal(ping.status, "SUCCESS");
  assert.equal(ping.version, REQUIRED_SCRIPT_VERSION);

  assert.equal(call({ action: "PING" }).status, "ERROR");
  assert.match(call({ action: "PING", secret: "wrong" }).error, /private key/);
  assert.match(call({ action: "UPLOAD_INVOICE_PDF", pdfBase64: "x", filename: "a.pdf" }).error, /private key/);
  assert.match(call({ action: "NOPE", secret: "right-key" }).error, /Unknown action/);
});

test("a script that was never given a key refuses everything, even a request echoing the placeholder", () => {
  const { call } = runScript("__RKE_SECRET__");
  assert.match(call({ action: "PING", secret: "__RKE_SECRET__" }).error, /no private key yet/);
});

test("uploading replaces an earlier file and trashing removes one", () => {
  const { call, created, trashed } = runScript("k");
  assert.equal(call({ action: "UPLOAD_INVOICE_PDF", secret: "k", year: "2026", filename: "old.pdf", pdfBase64: "QQ==" }).status, "SUCCESS");
  assert.deepEqual(created, ["old.pdf"]);
  assert.deepEqual(trashed, ["old.pdf"]);

  const second = runScript("k");
  assert.equal(second.call({ action: "TRASH_INVOICE_FILE", secret: "k", year: "2026", filename: "old.pdf" }).status, "SUCCESS");
  assert.deepEqual(second.trashed, ["old.pdf"]);
});
