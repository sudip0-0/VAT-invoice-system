import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import InvoicesPage from "./pages/InvoicesPage";
import InventoryPage from "./pages/InventoryPage";
import PartiesPage from "./pages/PartiesPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            }
          />
          <Route path="/invoices" element={<DashboardLayout><InvoicesPage /></DashboardLayout>} />
          <Route path="/purchases" element={<DashboardLayout><PlaceholderPage title="Purchases" /></DashboardLayout>} />
          <Route path="/quotations" element={<DashboardLayout><PlaceholderPage title="Quotations" /></DashboardLayout>} />
          <Route path="/inventory" element={<DashboardLayout><InventoryPage /></DashboardLayout>} />
          <Route path="/parties" element={<DashboardLayout><PartiesPage /></DashboardLayout>} />
          <Route path="/reports" element={<DashboardLayout><PlaceholderPage title="Reports" /></DashboardLayout>} />
          <Route path="/settings" element={<DashboardLayout><PlaceholderPage title="Settings" /></DashboardLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
