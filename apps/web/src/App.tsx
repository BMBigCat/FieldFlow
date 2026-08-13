import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context";
import { ThemeProvider } from "./lib/theme-context";
import { CustomerDetailPage } from "./routes/CustomerDetailPage";
import { CustomersListPage } from "./routes/CustomersListPage";
import { DashboardHome } from "./routes/DashboardHome";
import { DashboardLayout } from "./routes/DashboardLayout";
import { LoginPage } from "./routes/LoginPage";
import { NewCustomerPage } from "./routes/NewCustomerPage";
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
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
