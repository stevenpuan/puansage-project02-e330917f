import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppLayout() {
  const { loading, session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        載入中…
      </div>
    );
  }
  if (!session) return null;

  if (profile && profile.status !== "active") {
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-xl font-semibold">帳號待審核</h1>
          <p className="text-sm text-muted-foreground">
            您的帳號狀態為「{profile.status}」，需管理員核准後才能進入系統。
          </p>
          <Button variant="outline" onClick={signOut}>
            登出
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:block fixed inset-y-0 left-0 z-30">
        <AppSidebar />
      </div>
      <header className="md:hidden sticky top-0 z-20 flex items-center gap-2 border-b bg-card px-3 h-12">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="開啟選單">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold text-primary">伯洸系統平台</span>
      </header>
      <main className="md:pl-64">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

