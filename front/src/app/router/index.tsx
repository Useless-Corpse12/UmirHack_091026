import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "../../pages/LoginPage";
import { RegisterPage } from "../../pages/RegisterPage";
import { VerifyEmailPage } from "../../pages/VerifyEmailPage";
import { InvitePage } from "../../pages/InvitePage";
import { RestaurantsPage } from "../../pages/RestaurantsPage";
import { RestaurantDetailPage } from "../../pages/RestaurantDetailPage";
import { ProductsPage } from "../../pages/ProductsPage";
import { MenuPage } from "../../pages/MenuPage";
import { DashboardPage } from "../../pages/DashboardPage";
import { AnalyticsPage } from "../../pages/AnalyticsPage";
import { WarehousePage } from "../../pages/WarehousePage";
import { DeliveriesPage } from "../../pages/DeliveriesPage";
import { EmployeesPage } from "../../pages/EmployeesPage";
import { SettingsPage } from "../../pages/SettingsPage";
import { ProtectedRoute, RestaurantRoleGuard } from "./ProtectedRoute";
import { RestaurantBoundary } from "../../features/restaurant-runtime/RestaurantBoundary";
import { apiConfig } from "../../shared/api/config";
import { NativeCatalogPage } from "../../pages/native/NativeCatalogPage";
import { NativeTerminalsPage } from "../../pages/native/NativeTerminalsPage";
import {
  NativeRestaurantLayout, NativeDashboardPage,
  NativeEmployeesPage, NativeDeliveriesPage,
  NativeWarehousePage, NativeAnalyticsPage,
} from "../../pages/native/NativePages";

const live = apiConfig.mode === "live";
const guard = (element: React.ReactNode, roles: ("owner" | "admin" | "manager")[] = ["owner", "admin"]) =>
  <RestaurantRoleGuard allowedRoles={roles}>{element}</RestaurantRoleGuard>;

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route path="/invite" element={<InvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<RestaurantsPage />} />
        <Route path="/restaurant/:id" element={
          <RestaurantBoundary>{live ? <NativeRestaurantLayout /> : <RestaurantDetailPage />}</RestaurantBoundary>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={live ? <NativeDashboardPage /> : <DashboardPage />} />
          <Route path="analytics" element={live ? <NativeAnalyticsPage /> : <AnalyticsPage />} />
          <Route path="warehouse" element={live ? <NativeWarehousePage /> : <WarehousePage />} />
          <Route path="deliveries" element={live ? <NativeDeliveriesPage /> : <DeliveriesPage />} />
          <Route path="menu" element={live ? <NativeCatalogPage /> : guard(<MenuPage />)} />
          <Route path="products" element={live ? <Navigate to="../menu" replace /> : guard(<ProductsPage />)} />
          {live && <Route path="terminals" element={guard(<NativeTerminalsPage />)} />}
          <Route path="employees" element={live ? guard(<NativeEmployeesPage />) : guard(<EmployeesPage />)} />
          <Route path="settings" element={guard(<SettingsPage />, ["owner"])} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
