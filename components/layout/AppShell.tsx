/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Menu, LogOut } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { TopNav } from "@/components/layout/TopNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

export async function AppShell(props: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {props.children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-14 items-center gap-4 px-5 md:px-8">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "md:hidden cursor-pointer shrink-0"
              )}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>

            <SheetContent side="left" className="w-72 p-0 flex flex-col h-full">
              <div className="flex flex-col">
                <div className="border-b px-4 py-4">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2.5 font-semibold tracking-tight"
                  >
                    <img
                      src="/RKE logo.png"
                      alt="RKE logo"
                      className="h-8 w-8 object-contain rounded-lg bg-white p-1 border border-border shadow-sm"
                    />
                    <span className="text-base font-bold text-foreground">
                      RKE Invoice
                    </span>
                  </Link>
                </div>
                <div className="px-3 py-4">
                  <SidebarNav />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-semibold tracking-tight shrink-0"
          >
            <img
              src="/RKE logo.png"
              alt="RKE logo"
              className="h-8 w-8 object-contain rounded-lg bg-white p-1 border border-border shadow-sm"
            />
            <span className="text-base font-bold text-foreground hidden sm:inline">
              RKE Invoice
            </span>
          </Link>

          {/* Desktop navigation links */}
          <nav className="hidden md:flex items-center gap-1 ml-6">
            <TopNav />
          </nav>

          <div className="flex-1" />

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xs shadow-sm select-none">
              {(user.name || user.email || "U").substring(0, 1).toUpperCase()}
            </div>

            <form action={signOut} className="flex items-center">
              <button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 py-6 md:px-8 md:py-8 w-full">
        {props.children}
      </main>
    </div>
  );
}
