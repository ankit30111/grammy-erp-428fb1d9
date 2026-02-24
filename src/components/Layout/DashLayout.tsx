import { ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import { Bell, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserProfileDropdown } from "./UserProfileDropdown";
import { DashSidebar } from "@/components/Navigation/DashSidebar";

const routeLabels: Record<string, string> = {
  "": "Dashboard",
  products: "Product Master",
  "factory-orders": "Factory Orders",
  inventory: "Inventory",
  sales: "Sales Orders",
  customers: "Customers",
  tracking: "Dispatch Tracking",
  service: "Service & Warranty",
  spares: "Spare Parts",
};

interface DashLayoutProps {
  children: ReactNode;
}

export function DashLayout({ children }: DashLayoutProps) {
  const location = useLocation();
  const segment = location.pathname.replace("/dash", "").replace(/^\//, "");
  const pageLabel = routeLabels[segment] || segment || "Dashboard";

  return (
    <div className="flex h-screen bg-background">
      <DashSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b h-14 flex items-center px-4 gap-4 shrink-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Grammy ERP</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/dash" className="hover:text-foreground transition-colors font-medium text-violet-600">DASH</Link>
            {segment && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-foreground font-medium">{pageLabel}</span>
              </>
            )}
          </nav>

          {/* Search */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search SKU / Serial / Customer..." className="pl-8 h-9" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    2
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>DASH Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">Low Stock: DASH-SP100</p>
                    <p className="text-xs text-muted-foreground">15 minutes ago</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">New Service Ticket #TK-042</p>
                    <p className="text-xs text-muted-foreground">1 hour ago</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <UserProfileDropdown />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
