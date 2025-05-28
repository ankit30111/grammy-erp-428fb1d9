
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Projection from "./pages/Projection";
import PPC from "./pages/PPC";
import Purchase from "./pages/Purchase";
import Inventory from "./pages/Inventory";
import Production from "./pages/Production";
import GRN from "./pages/GRN";
import Quality from "./pages/Quality";
import IQC from "./pages/quality/IQC";
import PQC from "./pages/quality/PQC";
import OQC from "./pages/quality/OQC";
import Management from "./pages/Management";
import ProductsManagement from "./pages/management/ProductsManagement";
import RawMaterialsManagement from "./pages/management/RawMaterialsManagement";
import HRManagement from "./pages/management/HRManagement";
import UserManagement from "./pages/management/UserManagement";
import FinishedGoods from "./pages/FinishedGoods";
import React from "react";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Auth />;
  }

  return (
    <Routes>
      <Route path="/auth" element={<Navigate to="/" replace />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Index />
        </ProtectedRoute>
      } />
      <Route path="/projection" element={
        <ProtectedRoute requiredPermission="planning">
          <Projection />
        </ProtectedRoute>
      } />
      <Route path="/planning" element={
        <ProtectedRoute requiredPermission="planning">
          <PPC />
        </ProtectedRoute>
      } />
      <Route path="/production" element={
        <ProtectedRoute requiredPermission="production">
          <Production />
        </ProtectedRoute>
      } />
      <Route path="/quality" element={
        <ProtectedRoute requiredPermission="quality">
          <Quality />
        </ProtectedRoute>
      } />
      <Route path="/quality/iqc" element={
        <ProtectedRoute requiredPermission="quality">
          <IQC />
        </ProtectedRoute>
      } />
      <Route path="/quality/pqc" element={
        <ProtectedRoute requiredPermission="quality">
          <PQC />
        </ProtectedRoute>
      } />
      <Route path="/quality/oqc" element={
        <ProtectedRoute requiredPermission="quality">
          <OQC />
        </ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute requiredPermission="store">
          <Inventory />
        </ProtectedRoute>
      } />
      <Route path="/purchase" element={
        <ProtectedRoute requiredPermission="purchase">
          <Purchase />
        </ProtectedRoute>
      } />
      <Route path="/grn" element={
        <ProtectedRoute requiredPermission="purchase">
          <GRN />
        </ProtectedRoute>
      } />
      <Route path="/dispatch" element={
        <ProtectedRoute requiredPermission="dispatch">
          <Index />
        </ProtectedRoute>
      } />
      <Route path="/finished-goods" element={
        <ProtectedRoute requiredPermission="finished-goods">
          <FinishedGoods />
        </ProtectedRoute>
      } />
      <Route path="/management" element={
        <ProtectedRoute adminOnly>
          <Management />
        </ProtectedRoute>
      } />
      <Route path="/management/products" element={
        <ProtectedRoute adminOnly>
          <ProductsManagement />
        </ProtectedRoute>
      } />
      <Route path="/management/raw-materials" element={
        <ProtectedRoute adminOnly>
          <RawMaterialsManagement />
        </ProtectedRoute>
      } />
      <Route path="/management/human-resources" element={
        <ProtectedRoute adminOnly>
          <HRManagement />
        </ProtectedRoute>
      } />
      <Route path="/management/user-management" element={
        <ProtectedRoute adminOnly>
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Index />
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

export default App;
