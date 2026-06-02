
import { ReactNode } from "react";
import { Sidebar } from "@/components/Navigation/Sidebar";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserProfileDropdown } from "./UserProfileDropdown";
import { ThemeToggle } from "./ThemeToggle";
import { PlantSwitcher } from "./PlantSwitcher";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b border-border h-14 flex items-center px-6 gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across your workspace..."
                className="pl-9 h-9 bg-muted/50 border-transparent focus-visible:bg-card focus-visible:border-border"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <PlantSwitcher />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                  <Bell className="h-4 w-4" />
                  <span className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground text-[9px] font-semibold rounded-full h-4 w-4 flex items-center justify-center">
                    3
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">Quality Alert: Batch 452A</p>
                    <p className="text-xs text-muted-foreground">10 minutes ago</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">Inventory Low: SKU-78452</p>
                    <p className="text-xs text-muted-foreground">35 minutes ago</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">New PO Approval Required</p>
                    <p className="text-xs text-muted-foreground">1 hour ago</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer justify-center text-primary">
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <UserProfileDropdown />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-background">{children}</main>
      </div>
    </div>
  );
}
