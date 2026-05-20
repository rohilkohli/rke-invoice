import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginClientPage from "./LoginClientPage";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }

  return <LoginClientPage />;
}
