import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/app/layout/AppLayout";
import LoginPage from "@/features/auth/pages/LoginPage";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import BillingPage from "@/features/billing/pages/BillingPage";
import MedicinesPage from "@/features/medicines/pages/MedicinesPage";
import InventoryPage from "@/features/inventory/pages/InventoryPage";
import PurchasesPage from "@/features/purchases/pages/PurchasesPage";
import SuppliersPage from "@/features/suppliers/pages/SuppliersPage";
import ReportsPage from "@/features/reports/pages/ReportsPage";
import SettingsPage from "@/features/settings/pages/SettingsPage";
import NotFoundPage from "@/app/pages/NotFoundPage";
import CustomersPage from "@/features/customers/pages/CustomersPage";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { Allowed } from "@/features/auth/components/Allowed";

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
      { path: "customers", element: <CustomersPage /> },
      { path: "medicines", element: <MedicinesPage /> },
      { path: "inventory", element: <InventoryPage /> },
      {
        path: "purchases",
        element: (
          <Allowed perm="stock">
            <PurchasesPage />
          </Allowed>
        ),
      },
      {
        path: "suppliers",
        element: (
          <Allowed perm="stock">
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
