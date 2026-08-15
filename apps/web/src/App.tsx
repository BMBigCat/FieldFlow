import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context";
import { ThemeProvider } from "./lib/theme-context";
import { CustomerDetailPage } from "./routes/CustomerDetailPage";
import { CustomersListPage } from "./routes/CustomersListPage";
import { DashboardHome } from "./routes/DashboardHome";
import { DashboardLayout } from "./routes/DashboardLayout";
import { InvoiceDetailPage } from "./routes/InvoiceDetailPage";
import { InvoicesListPage } from "./routes/InvoicesListPage";
import { JobDetailPage } from "./routes/JobDetailPage";
import { JobsCalendarPage } from "./routes/JobsCalendarPage";
import { LoginPage } from "./routes/LoginPage";
import { NewCustomerPage } from "./routes/NewCustomerPage";
import { NewJobPage } from "./routes/NewJobPage";
import { OrganizationSettingsPage } from "./routes/OrganizationSettingsPage";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/settings/organization" element={<OrganizationSettingsPage />} />
              <Route path="/customers" element={<CustomersListPage />} />
              <Route path="/customers/new" element={<NewCustomerPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />
              <Route path="/jobs" element={<JobsCalendarPage />} />
              <Route path="/jobs/new" element={<NewJobPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/invoices" element={<InvoicesListPage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
