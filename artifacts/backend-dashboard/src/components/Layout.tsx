import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ShoppingCart, Package, Store, Star, Users, UserCog, Truck,
  Tags, TicketPercent, Wallet, Bell, BarChart3, Shield, Settings, LogOut, Menu,
  ChevronDown, ChevronRight, Image, Activity, Server, Radio, AppWindow, LifeBuoy, Film, CheckCircle2
} from "lucide-react";
import { useBackendMe } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState, useMemo } from "react";
import { clearBackendSession } from "@/lib/session";

type NavItem = {
  href: string; label: string; icon: React.ElementType; roles?: string[];
  hidden?: boolean; badge?: "pending";
};

type NavGroup = { label: string; items: NavItem[]; };

const ADMIN_ROLES = ["super_admin", "admin", "manager"];

const navGroups: NavGroup[] = [
  {
    label: "Vue d'ensemble",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Opérations",
    items: [
      { href: "/orders", label: "Commandes", icon: ShoppingCart, badge: "pending" },
      { href: "/products", label: "Produits", icon: Package },
      { href: "/categories", label: "Catégories", icon: Tags, roles: ADMIN_ROLES },
      { href: "/shops", label: "Boutiques", icon: Store },
      { href: "/reviews", label: "Avis", icon: Star },
    ],
  },
  {
    label: "Personnes",
    items: [
      { href: "/customers", label: "Clients", icon: Users, roles: ADMIN_ROLES },
      { href: "/staff", label: "Staff", icon: UserCog, roles: ADMIN_ROLES },
      { href: "/deliverymen", label: "Livreurs", icon: Truck, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/promotions", label: "Promotions", icon: Tags },
      { href: "/recommendations", label: "Recommandations", icon: CheckCircle2, roles: ADMIN_ROLES },
      { href: "/banners", label: "Bannières", icon: Image, roles: ADMIN_ROLES },
      { href: "/shorts", label: "Shorts & Reels", icon: Film, roles: ADMIN_ROLES },
      { href: "/vouchers", label: "Codes promo", icon: TicketPercent },
      { href: "/notifications", label: "Notifications", icon: Bell, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/wallets", label: "Portefeuilles", icon: Wallet, roles: ADMIN_ROLES },
      { href: "/support", label: "Support", icon: LifeBuoy, roles: ADMIN_ROLES },
      { href: "/reports", label: "Rapports", icon: BarChart3 },
    ],
  },
  {
    label: "Système",
    items: [
      { href: "/live-tracking", label: "Suivi Live", icon: Radio, roles: ADMIN_ROLES },
      { href: "/app-config", label: "App Config", icon: AppWindow, roles: ADMIN_ROLES },
      { href: "/roles", label: "Rôles", icon: Shield, roles: ["super_admin"] },
      { href: "/audit", label: "Audit", icon: Activity, roles: ADMIN_ROLES },
      { href: "/monitoring", label: "Monitoring", icon: Server, roles: ADMIN_ROLES },
      { href: "/settings", label: "Paramètres", icon: Settings, roles: ADMIN_ROLES },
    ],
  },
];

const MERCHANT_NAV_GROUPS: NavGroup[] = [
  {
    label: "Mon portail",
    items: [
      { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/orders", label: "Mes commandes", icon: ShoppingCart, badge: "pending" },
      { href: "/products", label: "Mes produits", icon: Package },
      { href: "/shops", label: "Mon restaurant", icon: Store },
      { href: "/reviews", label: "Avis clients", icon: Star },
      { href: "/promotions", label: "Promotions", icon: Tags },
    ],
  },
];

function NavList({
  groups, location, showLabels = true, onNavigate, pendingCount, openGroups, onToggleGroup,
}: {
  groups: NavGroup[]; location: string; showLabels?: boolean; onNavigate?: () => void;
  pendingCount: number; openGroups: Record<string, boolean>; onToggleGroup: (label: string) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group, idx) => {
        const isOpen = openGroups[group.label] !== false;
        return (
          <div key={idx} className="space-y-1">
            {showLabels && (
              <button
                className="w-full flex items-center justify-between px-3 md:px-5 py-1 text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-widest hover:text-sidebar-foreground/80 transition-colors"
                onClick={() => onToggleGroup(group.label)}
              >
                {group.label}
                {isOpen ? <ChevronDown className="h-3 w-3 opacity-50" /> : <ChevronRight className="h-3 w-3 opacity-50" />}
              </button>
            )}
            {isOpen && (
              <div className="space-y-0.5 px-2 md:px-3">
                {group.items.map((item) => {
                  const isActive = location === item.href;
                  const badge = item.badge === "pending" && pendingCount > 0 ? pendingCount : 0;
                  return (
                    <Link key={item.href} href={item.href} className="block" onClick={onNavigate}>
                      <div
                        className={`relative flex items-center px-3 py-1.5 text-[13px] font-medium rounded-md transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
                        } ${!showLabels && "justify-center"}`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${showLabels ? "mr-3" : ""} ${isActive ? "opacity-100" : "opacity-70"}`} />
                        {showLabels && <span className="flex-1 truncate">{item.label}</span>}
                        {showLabels && badge > 0 && (
                          <span className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full text-[9px] font-bold px-1.5 ${
                            isActive ? "bg-primary-foreground text-primary" : "bg-destructive text-white"
                          }`}>
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: me } = useBackendMe();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("jatek_nav_groups") ?? "{}"); }
    catch { return {}; }
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: prev[label] === false ? true : false };
      localStorage.setItem("jatek_nav_groups", JSON.stringify(next));
      return next;
    });
  };

  const isOwner = me?.user.role === "restaurant_owner";
  const { data: ownerShops } = useQuery<{ id: number; name: string; logoUrl: string | null }[]>({
    queryKey: ["/api/backend/shops", "owner-branding"],
    queryFn: () => apiFetch("/api/backend/shops"),
    enabled: isOwner,
    staleTime: 5 * 60_000,
  });
  const ownerShop = ownerShops?.[0];

  const { data: pendingOrders } = useQuery<any[]>({
    queryKey: ["/api/backend/orders", "pending-badge"],
    queryFn: () => apiFetch("/api/backend/orders?status=pending&limit=50"),
    refetchInterval: 30_000,
    enabled: !!me,
    staleTime: 25_000,
  });
  const pendingCount = pendingOrders?.length ?? 0;

  const role = me?.user.role;
  const filteredGroups = useMemo(() => isOwner
    ? MERCHANT_NAV_GROUPS
    : navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.hidden && (!item.roles || (role != null && item.roles.includes(role))),
          )
        }))
        .filter((group) => group.items.length > 0), [isOwner, role]);

  const navListProps = { pendingCount, openGroups, onToggleGroup: toggleGroup };
  const sidebarTitle = isOwner ? (ownerShop?.name ?? "Mon restaurant") : "Jatek Admin";
  const sidebarShort = isOwner ? (ownerShop?.name?.charAt(0).toUpperCase() ?? "R") : "J";

  // Identify current page title
  const currentItem = useMemo(() => filteredGroups.flatMap((g) => g.items).find(i => i.href === location), [filteredGroups, location]);

  if (!me) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-[240px]" : "w-[68px]"} transition-all duration-300 border-r border-border bg-sidebar flex-col hidden md:flex shrink-0 z-20 shadow-sm relative`}>
        <div className="h-14 flex items-center justify-between px-3 border-b border-sidebar-border bg-sidebar">
          {sidebarOpen && (
            <div className="flex items-center gap-2.5 px-2 min-w-0">
              <div className="h-7 w-7 bg-primary rounded-[6px] flex items-center justify-center shrink-0 shadow-xs">
                {isOwner && ownerShop?.logoUrl ? (
                  <img src={ownerShop.logoUrl} alt={ownerShop.name} className="h-full w-full rounded-[6px] object-cover" />
                ) : (
                  <span className="text-[13px] font-black text-primary-foreground leading-none">J</span>
                )}
              </div>
              <span className="font-extrabold text-[15px] tracking-tight truncate text-sidebar-foreground">
                {sidebarTitle}
              </span>
            </div>
          )}
          {!sidebarOpen && (
            <div className="h-7 w-7 bg-primary mx-auto rounded-[6px] flex items-center justify-center shrink-0 shadow-xs">
              <span className="text-[13px] font-black text-primary-foreground leading-none">{sidebarShort}</span>
            </div>
          )}
        </div>

        {/* Toggle overlay button for desktop */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-16 h-6 w-6 border border-border bg-sidebar rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors z-50 shadow-sm"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className="flex-1 overflow-y-auto py-5 scrollbar-thin">
          <NavList groups={filteredGroups} location={location} showLabels={sidebarOpen} {...navListProps} />
        </div>

        {/* User mini profile at bottom of sidebar */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`w-full flex items-center gap-3 p-1.5 hover:bg-sidebar-accent/50 rounded-md transition-colors ${!sidebarOpen && "justify-center"}`}>
                <Avatar className="h-8 w-8 rounded-md shrink-0 border shadow-xs">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold rounded-md">
                    {me.user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <div className="flex flex-col items-start min-w-0 flex-1">
                    <span className="text-[13px] font-semibold truncate w-full text-left leading-tight text-sidebar-foreground">{me.user.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate w-full text-left leading-tight mt-0.5">{me.user.role.replace("_", " ")}</span>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={sidebarOpen ? "start" : "end"} side="right" className="w-56" sideOffset={16}>
              <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { clearBackendSession(); setLocation("/login"); }} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" /> <span>Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border flex flex-col">
          <SheetHeader className="h-14 shrink-0 flex flex-row items-center justify-start px-5 border-b border-sidebar-border space-y-0 gap-3">
            <div className="h-7 w-7 bg-primary rounded-md flex items-center justify-center shrink-0">
               {isOwner && ownerShop?.logoUrl ? (
                  <img src={ownerShop.logoUrl} alt={ownerShop.name} className="h-full w-full rounded-md object-cover" />
                ) : (
                  <span className="text-[13px] font-black text-primary-foreground leading-none">J</span>
                )}
            </div>
            <SheetTitle className="font-extrabold text-[15px] tracking-tight text-left truncate text-sidebar-foreground">
              {sidebarTitle}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto min-h-0 py-5">
            <NavList groups={filteredGroups} location={location} showLabels onNavigate={() => setMobileOpen(false)} {...navListProps} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <header className="h-14 shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-border bg-card shadow-xs z-10 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="md:hidden h-8 w-8 -ml-2 shrink-0">
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="font-bold text-sm md:text-base truncate tracking-tight text-foreground">
              {currentItem?.label ?? "Jatek Dashboard"}
            </h1>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex h-8 text-[11px] gap-2 rounded-full px-3 shadow-none border-dashed bg-muted/30">
              <Activity className="h-3.5 w-3.5 text-primary" />
              Système actif
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-muted/10 p-4 md:p-8">
          <div className="max-w-[1400px] mx-auto animate-in fade-in duration-300">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
