import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { BrandingProvider } from "@/lib/branding";
import { RealtimeBridge } from "@/components/realtime-bridge";
import { SubscriptionGate } from "@/components/subscription-gate";
import { OnboardingBoundary } from "@/components/onboarding-gate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <BrandingProvider>
      <OnboardingBoundary>
        <SidebarProvider>
          <RealtimeBridge />
          <div className="min-h-screen flex w-full bg-secondary/30">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col">
              <header className="h-14 border-b border-border bg-background/80 backdrop-blur flex items-center px-4 gap-3 sticky top-0 z-30">
                <SidebarTrigger />
                <TopBar />
              </header>
              <main className="flex-1 p-6">
                <SubscriptionGate>
                  <Outlet />
                </SubscriptionGate>
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </OnboardingBoundary>
    </BrandingProvider>
  );
}
