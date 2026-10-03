import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/app/layout/AppLayout";
import LoginPage from "@/features/auth/pages/LoginPage";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import BillingPage from "@/features/billing/pages/BillingPage";
import MedicinesPage from "@/features/medicines/pages/MedicinesPage";
import InventoryPage from "@/features/inventory/pages/InventoryPage";
import PurchasesPage from "@/features/purchases/pages/PurchasesPage";
import SuppliersPage from "@/features/suppliers/pages/SuppliersPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "billing", element: <BillingPage /> },
      { path: "medicines", element: <MedicinesPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "purchases", element: <PurchasesPage /> },
      { path: "suppliers", element: <SuppliersPage /> },
    ],
  },
]);
