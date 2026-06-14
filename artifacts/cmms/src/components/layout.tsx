import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  AlertTriangle, 
  PackageSearch, 
  ShoppingCart, 
  CalendarClock, 
  GraduationCap, 
  Activity, 
  CheckSquare, 
  ClipboardList,
  ArrowLeftRight,
  Users, 
  LogOut,
  Bell,
  Menu,
  X,
  Wrench,
  Palmtree,
  BellOff,
  Check,
  Cpu,
  ChevronRight,
  BarChart3,
  FileCheck2,
  Languages,
  QrCode,
  ShieldCheck,
  Smartphone,
  BookOpen,
  ScrollText,
  Settings2,
  LineChart,
  Factory,
  AlertOctagon,
  MonitorDot,
  Repeat2,
  Bot,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetNotifications, useMarkNotificationRead } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import i18n, { applyLangToDoc } from "@/i18n/index";
import { useFactoryConfig } from "@/contexts/factory-config-context";

const TYPE_ROUTE: Record<string, string> = {
  task:       "/tasks",
  pm:         "/pm",
  training:   "/training",
  production: "/production",
  general:    "/dashboard",
};

function NotificationsDropdown({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data: notifications, refetch } = useGetNotifications({
    query: { enabled: true }
  });
  const markRead = useMarkNotificationRead();

  const sorted = [...(notifications ?? [])].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  const handleClick = async (n: typeof sorted[0]) => {
    if (!n.isRead) {
      await markRead.mutateAsync({ id: n.id });
      refetch();
    }
    onClose();
    navigate(TYPE_ROUTE[n.type ?? "general"] ?? "/dashboard");
  };

  return (
    <div className="absolute end-0 top-full mt-2 w-[min(320px,calc(100vw-2rem))] bg-card border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-white">{t("nav.notifications")}</span>
        <span className="text-xs text-muted-foreground">{sorted.filter(n => !n.isRead).length} {t("nav.unread")}</span>
      </div>

      <div className="max-h-72 overflow-y-auto custom-scrollbar">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <BellOff className="w-8 h-8 opacity-40" />
            <p className="text-sm">{t("nav.noNotifications")}</p>
          </div>
        ) : (
          sorted.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-start px-4 py-3 border-b border-white/5 hover:bg-white/5 active:bg-white/10 transition-colors flex gap-3",
                !n.isRead && "bg-primary/5"
              )}
            >
              <div className="mt-1 flex-shrink-0">
                {n.isRead
                  ? <Check className="w-3.5 h-3.5 text-muted-foreground" />
                  : <span className="block w-2 h-2 rounded-full bg-primary mt-1" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium leading-tight", n.isRead ? "text-muted-foreground" : "text-white")}>
                  {n.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {n.createdAt ? new Date(n.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {sorted.some(n => !n.isRead) && (
        <div className="px-4 py-2 border-t border-white/10">
          <button
            onClick={async () => {
              await Promise.all(sorted.filter(n => !n.isRead).map(n => markRead.mutateAsync({ id: n.id })));
              refetch();
            }}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {t("nav.markAllRead")}
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, logout, isAdmin, isManager, isTeamLeader, isMaintenance, isInventory } = useAuth();
  const { config } = useFactoryConfig();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [navOrder, setNavOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("cmms_nav_order") || "[]") as string[]; }
    catch { return []; }
  });
  const notifRef = useRef<HTMLDivElement>(null);

  const orderedNavRef = React.useRef<any[]>([]);

  const saveNavOrder = (order: string[]) => {
    setNavOrder(order);
    localStorage.setItem("cmms_nav_order", JSON.stringify(order));
  };

  const moveNavItem = (href: string, dir: -1 | 1) => {
    const current = orderedNavRef.current.map((i: any) => i.href);
    const idx = current.indexOf(href);
    if (idx < 0) return;
    const next = [...current];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[target], next[idx]] = [next[idx], next[target]];
    saveNavOrder(next);
  };

  const { data: notifications } = useGetNotifications({
    query: { enabled: !!user, refetchInterval: 30000 }
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [notifOpen]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const LANG_CYCLE: Record<string, string> = { en: "ar", ar: "zh", zh: "en" };
  const toggleLanguage = () => {
    const next = LANG_CYCLE[i18n.language] ?? "en";
    i18n.changeLanguage(next);
    applyLangToDoc(next);
  };

  const canManagePlans = isAdmin || isManager || isTeamLeader;

  const navItems = [
    { href: "/dashboard",        label: t("nav.dashboard"),        icon: LayoutDashboard, show: true,                                            sectionKey: "dashboard" },
    { href: "/downtime",         label: t("nav.downtime"),         icon: AlertTriangle,   show: canManagePlans || isMaintenance,                 sectionKey: "downtime" },
    { href: "/inventory",        label: t("nav.inventory"),        icon: PackageSearch,   show: canManagePlans || isInventory,                   sectionKey: "inventory" },
    { href: "/orders",           label: t("nav.orders"),           icon: ShoppingCart,    show: canManagePlans || isMaintenance || isInventory,  sectionKey: "orders" },
    { href: "/pm",               label: t("nav.pm"),               icon: CalendarClock,   show: canManagePlans || isMaintenance,                 sectionKey: "pm" },
    { href: "/training",         label: t("nav.training"),         icon: GraduationCap,   show: canManagePlans || isMaintenance,                 sectionKey: "training" },
    { href: "/production",       label: t("nav.production"),       icon: Activity,        show: canManagePlans || isMaintenance,                 sectionKey: "production" },
    { href: "/tasks",            label: t("nav.tasks"),            icon: CheckSquare,     show: canManagePlans || isMaintenance,                 sectionKey: "tasks" },
    { href: "/line-plans",       label: t("nav.handover"),         icon: ArrowLeftRight,  show: !isInventory,                                    sectionKey: "linePlans" },
    { href: "/changeover",       label: t("nav.changeover"),       icon: Repeat2,         show: !isInventory,                                    sectionKey: "changeover" },
    { href: "/attendance",       label: t("nav.attendance"),       icon: Users,           show: true,                                            sectionKey: "attendance" },
    { href: "/vacation",         label: t("nav.vacation"),         icon: Palmtree,        show: true,                                            sectionKey: "vacation" },
    { href: "/machines",         label: t("nav.machines"),         icon: QrCode,          show: canManagePlans || isMaintenance,                 sectionKey: "machines" },
    { href: "/work-phones",      label: t("nav.workPhones"),       icon: Smartphone,      show: canManagePlans || isMaintenance || isInventory,  sectionKey: "workPhones" },
    { href: "/broken-machines",  label: t("nav.brokenMachines"),   icon: Wrench,          show: canManagePlans || isMaintenance,                 sectionKey: "brokenMachines" },
    { href: "/defects",          label: "Defects Log",             icon: AlertOctagon,    show: canManagePlans || isMaintenance },
    { href: "/machine-analysis", label: t("nav.machineAnalysis"),  icon: Cpu,             show: canManagePlans || isMaintenance,                 sectionKey: "machineAnalysis" },
    { href: "/machine-monitor",  label: "Machine Monitor",         icon: MonitorDot,      show: canManagePlans,                                  sectionKey: "machineMonitor" },
    { href: "/exams",            label: t("nav.exams"),            icon: FileCheck2,      show: canManagePlans || isMaintenance,                 sectionKey: "exams" },
    { href: "/kpi",              label: t("nav.kpi"),              icon: BarChart3,       show: canManagePlans,                                  sectionKey: "kpi" },
    { href: "/reports",          label: "Analytics & Reports",     icon: LineChart,       show: canManagePlans },
    { href: "/production-lines", label: "Production Lines",        icon: Factory,         show: isAdmin },
    { href: "/users",            label: t("nav.users"),            icon: Users,           show: isAdmin },
    { href: "/audit-logs",       label: t("nav.auditLogs"),        icon: ShieldCheck,     show: isAdmin },
    { href: "/factory-settings", label: "Factory Settings",        icon: Settings2,       show: isAdmin },
    { href: "/ai-assistant",     label: "AI Code Assistant",       icon: Bot,             show: isAdmin },
    { href: "/help",             label: t("nav.help"),             icon: BookOpen,        show: true },
  ];

  if (!user) return <>{children}</>;

  const visibleNav = navItems.filter(i => {
    // Global hide by admin (applies to everyone)
    if (config.hiddenSections?.[i.href]) return false;

    const sk = (i as any).sectionKey as string | undefined;

    if (!sk) return i.show;

    // Admin sees everything
    if (!user || user.role === "admin") return i.show;

    const allRoles = [user.role, ...((user as any).extraRoles ?? [])].filter(Boolean) as string[];
    const perms = config.sectionPerms;

    // Explicit grant for any role → show, even if hardcoded 'show' is false
    const hasExplicitGrant = allRoles.some(role => perms?.[sk]?.[role]?.canSee === true);
    if (hasExplicitGrant) return true;

    // Every role explicitly denied → hide, even if hardcoded 'show' is true
    const allExplicitlyDenied = allRoles.every(role => perms?.[sk]?.[role]?.canSee === false);
    if (allExplicitlyDenied) return false;

    // No explicit override → use hardcoded role flag
    return i.show;
  });

  const orderedNav = [...visibleNav].sort((a, b) => {
    const ai = navOrder.indexOf(a.href);
    const bi = navOrder.indexOf(b.href);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  orderedNavRef.current = orderedNav;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground selection:bg-primary/30">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:static inset-y-0 start-0 flex flex-col bg-card border-e border-white/5 transition-transform duration-300 z-40",
        "w-72 md:w-64",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        "rtl:translate-x-full rtl:md:translate-x-0"
      )}>
        {/* Logo area */}
        <div className="h-16 flex items-center justify-between border-b border-white/5 px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}images/oppo-logo-placeholder.png`} alt="Midea" className="w-8 h-8 rounded" />
            <span className="font-display font-bold text-lg text-primary tracking-wider">{config.systemName || "Midea CMMS"}</span>
          </div>
          <button
            className="md:hidden p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 custom-scrollbar">
          {isReordering && isAdmin && (
            <div style={{
              margin: "0 4px 8px",
              padding: "8px 10px",
              background: "hsl(217 91% 45% / 0.12)",
              border: "1px dashed hsl(217 91% 45% / 0.4)",
              borderRadius: "8px",
              fontSize: "11px",
              color: "hsl(217 91% 70%)",
              textAlign: "center",
            }}>
              Use ↑ ↓ to reorder sections
            </div>
          )}
          {orderedNav.map((item, idx) => {
            const active = location === item.href;
            if (isReordering && isAdmin) {
              return (
                <div
                  key={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 4px",
                    borderRadius: "8px",
                    background: "hsl(222 16% 11%)",
                    border: "1px solid hsl(222 16% 20%)",
                    marginBottom: "3px",
                  }}
                >
                  <GripVertical style={{ width: 14, height: 14, color: "hsl(222 16% 38%)", flexShrink: 0 }} />
                  <item.icon style={{ width: 16, height: 16, flexShrink: 0, color: "hsl(222 16% 55%)" }} />
                  <span style={{ flex: 1, fontSize: "12px", color: "hsl(0 0% 80%)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                  <button
                    onClick={() => moveNavItem(item.href, -1)}
                    disabled={idx === 0}
                    style={{
                      padding: "3px 5px", borderRadius: "4px",
                      background: "hsl(222 16% 18%)", border: "none", cursor: idx === 0 ? "not-allowed" : "pointer",
                      color: idx === 0 ? "hsl(222 16% 30%)" : "hsl(0 0% 75%)", flexShrink: 0,
                    }}
                    title="Move up"
                  >
                    <ChevronUp style={{ width: 12, height: 12 }} />
                  </button>
                  <button
                    onClick={() => moveNavItem(item.href, 1)}
                    disabled={idx === orderedNav.length - 1}
                    style={{
                      padding: "3px 5px", borderRadius: "4px",
                      background: "hsl(222 16% 18%)", border: "none", cursor: idx === orderedNav.length - 1 ? "not-allowed" : "pointer",
                      color: idx === orderedNav.length - 1 ? "hsl(222 16% 30%)" : "hsl(0 0% 75%)", flexShrink: 0,
                    }}
                    title="Move down"
                  >
                    <ChevronDown style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group text-sm font-medium",
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white active:bg-white/10"
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-white")} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-60 rtl:rotate-180" />}
              </Link>
            );
          })}
        </div>

        {/* Admin reorder button */}
        {isAdmin && (
          <div style={{ padding: "0 8px 6px" }}>
            <button
              onClick={() => setIsReordering(r => !r)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "7px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                border: isReordering
                  ? "1px solid hsl(142 71% 35% / 0.6)"
                  : "1px solid hsl(222 16% 22%)",
                background: isReordering
                  ? "hsl(142 71% 30% / 0.15)"
                  : "hsl(222 16% 10%)",
                color: isReordering
                  ? "hsl(142 71% 55%)"
                  : "hsl(222 16% 50%)",
                transition: "all 0.15s",
              }}
            >
              <GripVertical style={{ width: 13, height: 13 }} />
              {isReordering ? "✓ Done Reordering" : "Reorder Sections"}
            </button>
          </div>
        )}

        {/* User info + logout */}
        <div className="p-3 border-t border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0 border border-primary/30 text-sm">
              {user.fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">
                {[user.role, ...((user as any).extraRoles ?? [])].filter(Boolean).join(" · ")}
              </p>
            </div>
            {isAdmin && (
              <a
                href={`${import.meta.env.BASE_URL}docs.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                title="System Documentation"
              >
                <ScrollText className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              title={t("nav.logout")}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-14 flex-shrink-0 bg-card/60 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-3 md:px-6 z-10 sticky top-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display font-semibold text-base md:text-lg text-white capitalize truncate">
              {orderedNav.find(i => i.href === location)?.label || config.systemName || "Midea CMMS"}
            </h1>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors text-xs font-bold tracking-wider border border-white/10"
              title={t("lang.switchTo")}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{t("lang.current")}</span>
            </button>

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                className="relative p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 transition-colors"
                onClick={() => setNotifOpen(o => !o)}
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotificationsDropdown onClose={() => setNotifOpen(false)} />}
            </div>

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            {/* Logout */}
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
          <p className="text-center text-[11px] text-muted-foreground/40 mt-8 pb-2 tracking-wide select-none">
            {t("common.developedBy")}
          </p>
        </main>
      </div>
    </div>
  );
}
