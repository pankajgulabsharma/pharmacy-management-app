import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/app/layout/AppLayout";
import LoginPage from "@/features/auth/pages/LoginPage";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import BillingPage from "@/features/billing/pages/BillingPage";
import NotFoundPage from "@/app/pages/NotFoundPage";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { Allowed } from "@/features/auth/components/Allowed";
import { lazyPage } from "./lazyPage";

// Login, Dashboard and Billing come with the app (first screens);
// the rest load on first use — and are preloaded once signed in.
const CustomersPage = lazyPage(
  () => import("@/features/customers/pages/CustomersPage"),
);
const SettingsPage = lazyPage(
  () => import("@/features/settings/pages/SettingsPage"),
);
const ReportsPage = lazyPage(
  () => import("@/features/reports/pages/ReportsPage"),
);
const SuppliersPage = lazyPage(
  () => import("@/features/suppliers/pages/SuppliersPage"),
);
const PurchasesPage = lazyPage(
  () => import("@/features/purchases/pages/PurchasesPage"),
);
const InventoryPage = lazyPage(
  () => import("@/features/inventory/pages/InventoryPage"),
);
const ExpiryReturnPage = lazyPage(
  () => import("@/features/purchases/expiry/ExpiryReturnPage"),
);
const StockCountPage = lazyPage(
  () => import("@/features/stockCount/StockCountPage"),
);
const GallaPage = lazyPage(() => import("@/features/galla/GallaPage"));
const MedicinesPage = lazyPage(
  () => import("@/features/medicines/pages/MedicinesPage"),
);

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    // Every screen requires sign-in
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "billing", element: <BillingPage /> },
      {
        path: "galla",
        element: (
          <Allowed perm="sell">
            <GallaPage />
          </Allowed>
        ),
      },
      { path: "customers", element: <CustomersPage /> },
      { path: "medicines", element: <MedicinesPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "inventory/count", element: <StockCountPage /> },
      {
        path: "purchases",
        element: (
          <Allowed perm="purchases">
            <PurchasesPage />
          </Allowed>
        ),
      },
      {
        path: "purchases/expiry",
        element: (
          <Allowed perm="purchases">
            <ExpiryReturnPage />
          </Allowed>
        ),
      },
      {
        path: "suppliers",
        element: (
          <Allowed perm="purchases">
            <SuppliersPage />
          </Allowed>
        ),
      },
      {
        path: "reports",
        element: (
          <Allowed perm="reports">
            <ReportsPage />
          </Allowed>
        ),
      },
      {
        path: "settings",
        element: (
          <Allowed perm="admin">
            <SettingsPage />
          </Allowed>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
