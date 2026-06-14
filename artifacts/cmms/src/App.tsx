import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { FactoryConfigProvider, useFactoryConfig } from "@/contexts/factory-config-context";

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Downtime from "@/pages/downtime";
import Inventory from "@/pages/inventory";
import Orders from "@/pages/orders";
import PM from "@/pages/pm";
import Training from "@/pages/training";
import Production from "@/pages/production";
import Tasks from "@/pages/tasks";
import LinePlans from "@/pages/line-plans";
import Changeover from "@/pages/changeover";
import Attendance from "@/pages/attendance";
import BrokenMachines from "@/pages/broken-machines";
import Users from "@/pages/users";
import Vacation from "@/pages/vacation";
import MachineAnalysis from "@/pages/machine-analysis";
import KPI from "@/pages/kpi";
import Exams from "@/pages/exams";
import MachineRegistry from "@/pages/machines";
import AuditLogs from "@/pages/audit-logs";
import WorkPhones from "@/pages/work-phones";
import Defects from "@/pages/defects";
import MachineMonitor from "@/pages/machine-monitor";
import Reports from "@/pages/reports";
import ProductionLines from "@/pages/production-lines";
import FactorySettings from "@/pages/factory-settings";
import AiAssistant from "@/pages/ai-assistant";
import Help from "@/pages/help";

const queryClient = new QueryClient();

function ProtectedRoute({
  component: Component,
  adminOnly,
  allowedRoles,
  sectionKey,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
  allowedRoles?: string[];
  sectionKey?: string;
}) {
  const { isAuthenticated, isLoading, isAdmin, user } = useAuth();
  const { config } = useFactoryConfig();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background text-primary">
        INITIALIZING SYSTEM...
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  if (adminOnly && !isAdmin) {
    setLocation("/dashboard");
    return null;
  }

  // Unified access check — admin is always exempt
  if (user && user.role !== "admin") {
    const allRoles = [
      user.role ?? "",
      ...(((user as unknown) as { extraRoles?: string[] })?.extraRoles ?? []),
    ].filter(Boolean);

    const perms = config.sectionPerms;

    if (sectionKey) {
      // Explicit grant in section perms overrides the hardcoded allowedRoles restriction
      const hasExplicitGrant = allRoles.some(
        role => perms?.[sectionKey]?.[role]?.canSee === true
      );
      // Explicit denial: every one of the user's roles is set to canSee: false
      const allExplicitlyDenied = allRoles.every(
        role => perms?.[sectionKey]?.[role]?.canSee === false
      );
      const hasBaseAccess = !allowedRoles || allowedRoles.some(r => allRoles.includes(r));

      if (allExplicitlyDenied || (!hasBaseAccess && !hasExplicitGrant)) {
        setLocation("/dashboard");
        return null;
      }
    } else if (allowedRoles) {
      // No sectionKey — fall back to hardcoded role list only
      if (!allowedRoles.some(r => allRoles.includes(r))) {
        setLocation("/dashboard");
        return null;
      }
    }
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (isAuthenticated && location === "/") {
    window.location.href = `${import.meta.env.BASE_URL}dashboard`;
    return null;
  }

  const elevated = ["admin", "manager", "teamleader"];
  const allAccess = ["admin", "manager", "teamleader", "maintenance", "inventory"];
  const noInventory = ["admin", "manager", "teamleader", "maintenance"];
  const withInventory = ["admin", "manager", "teamleader", "inventory"];
  const withBoth = ["admin", "manager", "teamleader", "maintenance", "inventory"];

  return (
    <Switch>
      <Route path="/"               component={Login} />
      <Route path="/signup"         component={Signup} />
      <Route path="/dashboard"      component={() => <ProtectedRoute component={Dashboard} />} />

      <Route path="/downtime"        component={() => <ProtectedRoute component={Downtime}        allowedRoles={noInventory}  sectionKey="downtime" />} />
      <Route path="/inventory"       component={() => <ProtectedRoute component={Inventory}       allowedRoles={withInventory} sectionKey="inventory" />} />
      <Route path="/orders"          component={() => <ProtectedRoute component={Orders}          allowedRoles={withBoth}     sectionKey="orders" />} />
      <Route path="/pm"              component={() => <ProtectedRoute component={PM}              allowedRoles={noInventory}  sectionKey="pm" />} />
      <Route path="/training"        component={() => <ProtectedRoute component={Training}        allowedRoles={noInventory}  sectionKey="training" />} />
      <Route path="/production"      component={() => <ProtectedRoute component={Production}      allowedRoles={noInventory}  sectionKey="production" />} />
      <Route path="/tasks"           component={() => <ProtectedRoute component={Tasks}           allowedRoles={noInventory}  sectionKey="tasks" />} />
      <Route path="/line-plans"      component={() => <ProtectedRoute component={LinePlans}       allowedRoles={noInventory}  sectionKey="linePlans" />} />
      <Route path="/changeover"      component={() => <ProtectedRoute component={Changeover}      allowedRoles={noInventory}  sectionKey="changeover" />} />
      <Route path="/attendance"      component={() => <ProtectedRoute component={Attendance}      allowedRoles={allAccess}    sectionKey="attendance" />} />
      <Route path="/vacation"        component={() => <ProtectedRoute component={Vacation}        allowedRoles={allAccess}    sectionKey="vacation" />} />
      <Route path="/machines"        component={() => <ProtectedRoute component={MachineRegistry} allowedRoles={noInventory}  sectionKey="machines" />} />
      <Route path="/broken-machines" component={() => <ProtectedRoute component={BrokenMachines} allowedRoles={noInventory}  sectionKey="brokenMachines" />} />
      <Route path="/machine-analysis" component={() => <ProtectedRoute component={MachineAnalysis} allowedRoles={noInventory} sectionKey="machineAnalysis" />} />
      <Route path="/kpi"             component={() => <ProtectedRoute component={KPI}             allowedRoles={elevated}    sectionKey="kpi" />} />
      <Route path="/exams"           component={() => <ProtectedRoute component={Exams}           allowedRoles={["admin","manager","teamleader","maintenance"]} sectionKey="exams" />} />
      <Route path="/work-phones"     component={() => <ProtectedRoute component={WorkPhones}      allowedRoles={withBoth}    sectionKey="workPhones" />} />
      <Route path="/defects"         component={() => <ProtectedRoute component={Defects}         allowedRoles={noInventory} />} />
      <Route path="/machine-monitor" component={() => <ProtectedRoute component={MachineMonitor} allowedRoles={elevated}    sectionKey="machineMonitor" />} />
      <Route path="/reports"         component={() => <ProtectedRoute component={Reports}         allowedRoles={elevated} />} />
      <Route path="/help"            component={() => <ProtectedRoute component={Help} />} />

      <Route path="/production-lines" component={() => <ProtectedRoute component={ProductionLines} adminOnly />} />
      <Route path="/users"           component={() => <ProtectedRoute component={Users}           adminOnly />} />
      <Route path="/audit-logs"      component={() => <ProtectedRoute component={AuditLogs}       adminOnly />} />
      <Route path="/factory-settings" component={() => <ProtectedRoute component={FactorySettings} adminOnly />} />
      <Route path="/ai-assistant"    component={() => <ProtectedRoute component={AiAssistant}     adminOnly />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <FactoryConfigProvider>
            <Router />
          </FactoryConfigProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
