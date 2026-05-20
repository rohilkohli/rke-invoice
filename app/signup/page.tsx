import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SignupClientPage from "./SignupClientPage";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return <SignupClientPage />;
}
