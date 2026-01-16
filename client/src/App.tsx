import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import LeadsPage from "@/pages/leads";
import FollowUpsPage from "@/pages/follow-ups";
import PipelinePage from "@/pages/pipeline";
import ClientsPage from "@/pages/clients";
import ServicesPage from "@/pages/services";
import TasksPage from "@/pages/tasks";
import QuotationsPage from "@/pages/quotations";
import InvoicesPage from "@/pages/invoices";
import PaymentsPage from "@/pages/payments";
import TeamPage from "@/pages/team";
import CampaignsPage from "@/pages/campaigns";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (location === "/login") {
    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    if (user) {
      return <Redirect to="/" />;
    }
    return <LoginPage />;
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/leads" component={LeadsPage} />
          <Route path="/follow-ups" component={FollowUpsPage} />
          <Route path="/pipeline" component={PipelinePage} />
          <Route path="/clients" component={ClientsPage} />
          <Route path="/services" component={ServicesPage} />
          <Route path="/tasks" component={TasksPage} />
          <Route path="/quotations" component={QuotationsPage} />
          <Route path="/invoices" component={InvoicesPage} />
          <Route path="/payments" component={PaymentsPage} />
          <Route path="/team" component={TeamPage} />
          <Route path="/campaigns" component={CampaignsPage} />
          <Route path="/reports" component={ReportsPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
