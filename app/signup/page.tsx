import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SignupClientPage from "./SignupClientPage";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  // Closed unless the owner has set an invite code (see SIGNUP_INVITE_CODE).
  const open = Boolean(process.env.SIGNUP_INVITE_CODE?.trim());

  return <SignupClientPage open={open} />;
}
