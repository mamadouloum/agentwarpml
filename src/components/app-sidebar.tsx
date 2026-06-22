import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, GraduationCap, ClipboardCheck, Wallet,
  CalendarDays, MessageSquare, Building2, Settings, BookOpen, Calculator, Crown, Shield, Palette, FileText,
  UtensilsCrossed, Bus, Library, BookMarked, Megaphone, LayoutGrid, Home, CalendarRange, IdCard,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useIsSuperAdmin } from "@/lib/super-admin";
import { SchoolLogo, useSchoolBranding } from "@/lib/branding";

const mainItems = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
  { title: "Élèves", url: "/students", icon: Users },
  { title: "Classes", url: "/classes", icon: BookOpen },
  { title: "Notes", url: "/grades", icon: GraduationCap },
  { title: "Bulletins", url: "/report-cards", icon: FileText },
  { title: "Cartes scolaires", url: "/id-cards", icon: IdCard },
  { title: "Présences", url: "/attendance", icon: ClipboardCheck },
  { title: "Paiements", url: "/payments", icon: Wallet },
  { title: "Comptabilité", url: "/accounting", icon: Calculator },
  { title: "Planning", url: "/schedule", icon: CalendarDays },
  { title: "Plan de classe", url: "/seating", icon: LayoutGrid },
  { title: "Devoirs", url: "/homework", icon: BookMarked },
  { title: "Cantine", url: "/cantine", icon: UtensilsCrossed },
  { title: "Transport", url: "/transport", icon: Bus },
  { title: "Bibliothèque", url: "/library", icon: Library },
  { title: "Annonces", url: "/events", icon: Megaphone },
  { title: "Messagerie", url: "/messages", icon: MessageSquare },
  { title: "Portail famille", url: "/portal", icon: Home },
];

const adminItems = [
  { title: "Mon école", url: "/school", icon: Building2 },
  { title: "Équipe & rôles", url: "/team", icon: Shield },
  { title: "Enseignants", url: "/teachers", icon: GraduationCap },
  { title: "Années scolaires", url: "/academic-years", icon: CalendarRange },
  { title: "Identité visuelle", url: "/branding", icon: Palette },
  { title: "Abonnement", url: "/billing", icon: Crown },
  { title: "Paramètres", url: "/settings", icon: Settings },
];

const superAdminItems = [
  { title: "Plateforme", url: "/admin", icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { data: branding } = useSchoolBranding();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
          <SchoolLogo className="h-8 w-8 shrink-0" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display font-bold text-sidebar-foreground text-sm">ML2 EduManager</span>
              <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">{branding?.motto || "ML2 GROUP"}</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestion</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Super Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
