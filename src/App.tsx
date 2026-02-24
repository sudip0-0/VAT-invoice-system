import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { BusinessProvider } from "./contexts/BusinessContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireBusiness from "./components/RequireBusiness";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceCreatePage from "./pages/InvoiceCreatePage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import InvoiceEditPage from "./pages/InvoiceEditPage";
import InventoryPage from "./pages/InventoryPage";
import StockMovementsPage from "./pages/StockMovementsPage";
import PartiesPage from "./pages/PartiesPage";
import QuotationsPage from "./pages/QuotationsPage";
import QuotationCreatePage from "./pages/QuotationCreatePage";
import PurchasesPage from "./pages/PurchasesPage";
import PurchaseCreatePage from "./pages/PurchaseCreatePage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import PaymentsPage from "./pages/PaymentsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import BusinessSetupPage from "./pages/BusinessSetupPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected: business setup */}
      <Route path="/setup-business" element={
        <ProtectedRoute><BusinessSetupPage /></ProtectedRoute>
      } />

      {/* Protected + requires business */}
      <Route path="/" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><Dashboard /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/invoices" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><InvoicesPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/invoices/new" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><InvoiceCreatePage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/invoices/:id" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><InvoiceDetailPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/invoices/:id/edit" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><InvoiceEditPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/purchases" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><PurchasesPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/purchases/new" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><PurchaseCreatePage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/quotations" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><QuotationsPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/quotations/new" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><QuotationCreatePage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><InventoryPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/inventory/movements" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><StockMovementsPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/parties" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><PartiesPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><ReportsPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/payments" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><PaymentsPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute><RequireBusiness><DashboardLayout><SettingsPage /></DashboardLayout></RequireBusiness></ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <BusinessProvider>
            <AppRoutes />
          </BusinessProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
