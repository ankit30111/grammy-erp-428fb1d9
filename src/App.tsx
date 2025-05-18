
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Fix the missing import
import { ClipboardCheck } from "lucide-react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/production" element={<Index />} />
          <Route path="/quality" element={<Index />} />
          <Route path="/inventory" element={<Index />} />
          <Route path="/planning" element={<Index />} />
          <Route path="/purchase" element={<Index />} />
          <Route path="/dispatch" element={<Index />} />
          <Route path="/resources" element={<Index />} />
          <Route path="/bom" element={<Index />} />
          <Route path="/reports" element={<Index />} />
          <Route path="/notifications" element={<Index />} />
          <Route path="/settings" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
