/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Menu, LogOut } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

export async function AppShell(props: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-background dark:bg-neutral-950 text-foreground">
        {props.children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-neutral-950 text-foreground">
      <div className="flex min-h-screen">
        {/* Collapsible Sidebar Shell */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center gap-3 px-4">
              <Sheet>
                <SheetTrigger
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "cursor-pointer"
                  )}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </SheetTrigger>

                <SheetContent side="left" className="w-72 p-0 flex flex-col justify-between h-full">
                  <div className="flex flex-col">
                    <div className="border-b px-4 py-4">
                      <div className="flex items-center">
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-2.5 font-semibold tracking-tight"
                        >
                          <img
                            src="/RKE logo.png"
                            alt="RKE logo"
                            className="h-7 w-auto object-contain rounded bg-white p-0.5 border border-neutral-200 dark:border-neutral-800"
                          />
                          <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300">
                            RKE Invoice
                          </span>
                        </Link>
                      </div>
                    </div>
                    <div className="px-3 py-4">
                      <SidebarNav />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">
                  GST Tax Invoice Generator
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ThemeToggle />

                {/* Profile Icon */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-bold text-white text-sm shadow-sm select-none">
                  {(user.name || user.email || "U").substring(0, 1).toUpperCase()}
                </div>

                {/* Sign Out Icon Button */}
                <form action={signOut} className="flex items-center">
                  <button
                    type="submit"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors shadow-sm cursor-pointer"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8">{props.children}</main>
        </div>
      </div>
    </div>
  );
}
