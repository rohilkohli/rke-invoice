"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Trash2, Upload } from "lucide-react";

import { updateCompanySettings } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const LOCAL_SIGNATURE_KEY = "rke_invoice_signature_v1";
type SettingsActionInput = Parameters<typeof updateCompanySettings>[0];

export type CompanySettingsFormData = {
  id: number;
  companyName: string;
  gstin: string;
  address: string;
  email?: string | null;
  phone?: string | null;
  bankName?: string | null;
  branch?: string | null;
  accountNo?: string | null;
  ifsc?: string | null;
  upiId?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  invoicePrefix?: string | null;
  defaultCgstRate: number;
  defaultSgstRate: number;
  defaultIgstRate: number;
  termsAndConditions?: string | null;
};

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function SettingsForm(props: { initial: CompanySettingsFormData }) {
  const [form, setForm] = useState<CompanySettingsFormData>(props.initial);
  const [saving, startTransition] = useTransition();
  const [localSig, setLocalSig] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SIGNATURE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.dataUrl ?? null;
    } catch {
      return null;
    }
  });

  const save = () => {
    startTransition(async () => {
      try {
        const payload: SettingsActionInput = {
          ...form,
          defaultCgstRate: Number(form.defaultCgstRate) || 0,
          defaultSgstRate: Number(form.defaultSgstRate) || 0,
          defaultIgstRate: Number(form.defaultIgstRate) || 0,
        };
        await updateCompanySettings(payload);
        toast.success("Settings saved");
      } catch (e) {
        toast.error("Failed to save settings");
        console.error(e);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">Settings</div>
          <div className="text-sm text-muted-foreground">
            Company profile, defaults, and invoice numbering
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>GSTIN</Label>
            <Input
              value={form.gstin}
              onChange={(e) => setForm((p) => ({ ...p, gstin: e.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <Textarea
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              className="min-h-20"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={form.email ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Logo (Upload)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await fileToDataUrl(file);
                setForm((p) => ({ ...p, logoUrl: dataUrl }));
              }}
            />
            {form.logoUrl ? (
              <div className="mt-2 h-16 rounded-lg border bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.logoUrl}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Default Signature Image (Optional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await fileToDataUrl(file);
                setForm((p) => ({ ...p, signatureUrl: dataUrl }));
              }}
            />
            {form.signatureUrl ? (
              <div className="mt-2 h-16 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-2 overflow-hidden shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.signatureUrl}
                  alt="Signature"
                  className="h-full w-full object-contain dark:invert"
                />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank & UPI</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input
              value={form.bankName ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Branch</Label>
            <Input
              value={form.branch ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Account No.</Label>
            <Input
              value={form.accountNo ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, accountNo: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>IFSC</Label>
            <Input
              value={form.ifsc ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, ifsc: e.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>UPI ID (VPA)</Label>
            <Input
              value={form.upiId ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, upiId: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>CGST %</Label>
            <Input
              inputMode="decimal"
              value={String(form.defaultCgstRate)}
              onChange={(e) =>
                setForm((p) => ({ ...p, defaultCgstRate: Number(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>SGST %</Label>
            <Input
              inputMode="decimal"
              value={String(form.defaultSgstRate)}
              onChange={(e) =>
                setForm((p) => ({ ...p, defaultSgstRate: Number(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>IGST %</Label>
            <Input
              inputMode="decimal"
              value={String(form.defaultIgstRate)}
              onChange={(e) =>
                setForm((p) => ({ ...p, defaultIgstRate: Number(e.target.value) }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label>Invoice Prefix / Format</Label>
            <Input
              value={form.invoicePrefix ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, invoicePrefix: e.target.value }))}
              placeholder="RKE-2026-"
            />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label>Terms & Conditions</Label>
            <Textarea
              value={form.termsAndConditions ?? ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, termsAndConditions: e.target.value }))
              }
              className="min-h-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved Signature (Local)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {localSig ? (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Local signature is saved</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem(LOCAL_SIGNATURE_KEY);
                    setLocalSig(null);
                    toast.success("Local signature cleared");
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
              <div className="mt-3 h-24 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-2 overflow-hidden shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localSig}
                  alt="Local signature"
                  className="h-full w-full object-contain dark:invert"
                />
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No local signature saved yet. Draw/Upload/Type a signature on an invoice and it will be stored automatically.
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            <Upload className="inline-block mr-2 h-3.5 w-3.5" />
            Tip: You can also set a default signature image above (stored in the database).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
