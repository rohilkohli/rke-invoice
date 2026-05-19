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

  return (
    <div className="min-h-screen bg-background dark:bg-neutral-950 text-foreground">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 border-r bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between h-screen sticky top-0">
          <div className="flex flex-col">
            <div className="flex h-16 items-center justify-between px-4">
              <Link href="/dashboard" className="font-semibold tracking-tight">
                RKE Invoice
              </Link>
              <ThemeToggle />
            </div>
            <div className="px-3 pb-6">
              <SidebarNav />
            </div>
          </div>

          {user && (
            <div className="border-t p-4 space-y-3 bg-neutral-50/50 dark:bg-neutral-950/20">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Signed in as
                </p>
                <p className="text-sm font-bold truncate text-neutral-800 dark:text-neutral-100 mt-0.5">
                  {user.name || user.email}
                </p>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-350 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors shadow-sm cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </form>
            </div>
          )}
        </aside>

        {/* Mobile Header / Main Shell */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center gap-3 px-4">
              <Sheet>
                <SheetTrigger
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "lg:hidden"
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
                          className="font-semibold tracking-tight"
                        >
                          RKE Invoice
                        </Link>
                      </div>
                    </div>
                    <div className="px-3 py-4">
                      <SidebarNav />
                    </div>
                  </div>

                  {user && (
                    <div className="border-t p-4 space-y-3 bg-neutral-50/50 dark:bg-neutral-950/20">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Signed in as
                        </p>
                        <p className="text-sm font-bold truncate text-neutral-800 dark:text-neutral-100 mt-0.5">
                          {user.name || user.email}
                        </p>
                      </div>
                      <form action={signOut}>
                        <button
                          type="submit"
                          className="w-full flex items-center justify-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-350 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors shadow-sm cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Sign Out
                        </button>
                      </form>
                    </div>
                  )}
                </SheetContent>
              </Sheet>

              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">
                  GST Tax Invoice Generator
                </div>
              </div>

              <div className="lg:hidden">
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8">{props.children}</main>
        </div>
      </div>
    </div>
  );
}
