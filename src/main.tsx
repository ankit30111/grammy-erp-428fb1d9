
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/toaster"
import App from './App.tsx'
import './index.css'

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 20, // 20 minutes (replaces cacheTime)
      refetchOnWindowFocus: false,
      keepPreviousData: true,
    },
  },
})

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

const root = createRoot(container);
root.render(
  <QueryClientProvider client={queryClient}>
    <App />
    <Toaster />
  </QueryClientProvider>
);
