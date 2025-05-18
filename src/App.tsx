
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Projection from "./pages/Projection";
import PPC from "./pages/PPC";
import Purchase from "./pages/Purchase";
import Inventory from "./pages/Inventory";
import GRN from "./pages/GRN";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/projection" element={<Projection />} />
          <Route path="/production" element={<Index />} />
          <Route path="/quality" element={<Index />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/planning" element={<PPC />} />
          <Route path="/purchase" element={<Purchase />} />
          <Route path="/dispatch" element={<Index />} />
          <Route path="/resources" element={<Index />} />
          <Route path="/bom" element={<Index />} />
          <Route path="/reports" element={<Index />} />
          <Route path="/notifications" element={<Index />} />
          <Route path="/settings" element={<Index />} />
          <Route path="/grn" element={<GRN />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
