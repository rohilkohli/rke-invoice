import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateCompanySettings } from "@/lib/bootstrap";
import { SettingsForm } from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const company = await getOrCreateCompanySettings(user.id);

  return (
    <SettingsForm
      initial={{
        id: company.id,
        companyName: company.companyName,
        gstin: company.gstin,
        address: company.address,
        email: company.email,
        phone: company.phone,
        bankName: company.bankName,
        branch: company.branch,
        accountNo: company.accountNo,
        ifsc: company.ifsc,
        upiId: company.upiId,
        logoUrl: company.logoUrl,
        signatureUrl: company.signatureUrl,
        invoicePrefix: company.invoicePrefix,
        defaultCgstRate: Number(company.defaultCgstRate),
        defaultSgstRate: Number(company.defaultSgstRate),
        defaultIgstRate: Number(company.defaultIgstRate),
        termsAndConditions: company.termsAndConditions,
        gdriveWebhookUrl: company.gdriveWebhookUrl,
      }}
    />
  );
}
