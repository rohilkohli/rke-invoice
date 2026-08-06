"use client";

import { useState, useTransition } from "react";
import { 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  FileCode,
  FolderCheck
} from "lucide-react";
import { toast } from "sonner";
import { saveGDriveWebhookAction, testGDriveConnectionAction, syncAllDataAction } from "@/app/actions/gdrive";

interface GDriveSettingsCardProps {
  initialWebhookUrl?: string | null;
}

export function GDriveSettingsCard({ initialWebhookUrl }: GDriveSettingsCardProps) {
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl || "");
  const [showScript, setShowScript] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isSyncing, startSyncing] = useTransition();

  const handleSave = () => {
    startSaving(async () => {
      setStatusMessage(null);
      const res = await saveGDriveWebhookAction(webhookUrl);
      if (res.success) {
        toast.success("Google Drive Webhook URL saved!");
        setStatusMessage({ type: "success", text: "Webhook URL saved successfully." });
      } else {
        toast.error(res.error || "Failed to save Webhook URL");
        setStatusMessage({ type: "error", text: res.error || "Failed to save." });
      }
    });
  };

  const handleTest = () => {
    if (!webhookUrl.trim()) {
      toast.error("Please enter a Google Apps Script Webhook URL first.");
      return;
    }

    startTesting(async () => {
      setStatusMessage(null);
      const res = await testGDriveConnectionAction(webhookUrl);
      if (res.success) {
        toast.success(res.message || "Connected to Google Drive!");
        setStatusMessage({ type: "success", text: res.message || "Connected to Google Drive Webhook!" });
      } else {
        toast.error(res.error || "Connection test failed.");
        setStatusMessage({ type: "error", text: res.error || "Could not connect to Webhook." });
      }
    });
  };

  const handleSyncAll = () => {
    startSyncing(async () => {
      setStatusMessage(null);
      toast.info("Starting full sync to Google Drive...");
      const res = await syncAllDataAction();
      if (res.success) {
        toast.success(res.message || "Sync completed!");
        setStatusMessage({ type: "success", text: res.message || "All invoices & data backed up to Google Drive!" });
      } else {
        toast.error(res.error || "Sync failed.");
        setStatusMessage({ type: "error", text: res.error || "Sync failed." });
      }
    });
  };

  const copyScript = async () => {
    try {
      const scriptRes = await fetch("/rke-gdrive-script.gs");
      const text = await scriptRes.text();
      await navigator.clipboard.writeText(text);
      toast.success("Google Apps Script code copied to clipboard!");
    } catch {
      toast.error("Failed to copy script.");
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Google Drive Auto-Sync</h3>
            <p className="text-sm text-muted-foreground">
              Automatically store all generated PDF invoices and database backups in your Google Drive.
            </p>
          </div>
        </div>
        <a
          href="https://script.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline gap-1"
        >
          Open Apps Script <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">
          Google Apps Script Webhook URL
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="flex-1 px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || isTesting || isSyncing}
              className="px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
            <button
              onClick={handleTest}
              disabled={isTesting || !webhookUrl.trim()}
              className="px-4 py-2.5 bg-secondary text-secondary-foreground font-medium rounded-lg text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                : statusMessage.type === "error"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FolderCheck className="w-4 h-4 text-emerald-500" />
          <span>Saves PDFs to <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">Google Drive/RKE_Invoices_And_Data/</code></span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowScript(!showScript)}
            className="flex-1 sm:flex-initial px-3 py-2 border border-input rounded-lg text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <FileCode className="w-3.5 h-3.5" />
            {showScript ? "Hide Script Code" : "Get Google Script"}
          </button>

          <button
            onClick={handleSyncAll}
            disabled={isSyncing || !webhookUrl.trim()}
            className="flex-1 sm:flex-initial px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync All to Drive Now
          </button>
        </div>
      </div>

      {showScript && (
        <div className="p-4 bg-muted/60 rounded-xl border border-border space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-blue-500" /> Google Apps Script Setup Code
            </h4>
            <button
              onClick={copyScript}
              className="px-2.5 py-1 bg-background border border-input rounded hover:bg-accent text-foreground transition-colors flex items-center gap-1 text-xs font-medium"
            >
              <Copy className="w-3 h-3" /> Copy Script
            </button>
          </div>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-[11px] leading-relaxed">
            <li>Open <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">script.google.com</a> and click <strong>+ New project</strong>.</li>
            <li>Paste this script into <strong>Code.gs</strong> (replacing existing code).</li>
            <li>Click <strong>Deploy</strong> &rarr; <strong>New deployment</strong> &rarr; Select <strong>Web app</strong> (gear icon).</li>
            <li>Set <em>Execute as: Me</em> and <em>Who has access: Anyone</em>, then click <strong>Deploy</strong>.</li>
            <li>Copy the Web App URL and paste it into the input box above!</li>
          </ol>
        </div>
      )}
    </div>
  );
}
