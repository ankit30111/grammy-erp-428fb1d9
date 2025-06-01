
import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "@/components/Navigation/Sidebar";
import { Bell, User, Search, LogOut, Menu, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface UserProfile {
  full_name: string;
  email: string;
  mobile_number?: string;
  department_name?: string;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      if (user) {
        const { data: profile, error } = await supabase
          .from("user_accounts")
          .select(`
            full_name,
            email,
            departments!department_id (
              name
            )
          `)
          .eq("id", user.id)
          .single();
        
        if (error) {
          console.error("Error fetching user profile:", error);
        } else if (profile) {
          setUserProfile({
            full_name: profile.full_name || "User",
            email: profile.email || "",
            mobile_number: "",
            department_name: profile.departments?.name || "N/A"
          });
        }
      }
    };
    getCurrentUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  const { data: userPermissions } = useUserPermissions(userId);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error("Error signing out");
        return;
      }
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("An unexpected error occurred");
    }
  };

  // Generate breadcrumb from current path
  const generateBreadcrumb = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    if (pathSegments.length === 0) return [{ label: 'Dashboard', path: '/' }];
    
    const breadcrumbs = [{ label: 'Home', path: '/' }];
    let currentPath = '';
    
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
      breadcrumbs.push({ label, path: currentPath });
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumb();

  return (
    <div className="flex h-screen bg-background font-inter">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
        {/* Modern Header */}
        <header className="glass-card border-b h-16 flex items-center px-6 gap-4 sticky top-0 z-40 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hover:bg-accent/50 rounded-xl"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.path} className="flex items-center gap-2">
                  {index > 0 && <ChevronRight className="h-3 w-3" />}
                  <span 
                    className={index === breadcrumbs.length - 1 
                      ? "text-foreground font-medium" 
                      : "hover:text-foreground cursor-pointer transition-colors"
                    }
                    onClick={() => index < breadcrumbs.length - 1 && navigate(crumb.path)}
                  >
                    {crumb.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search across modules..." 
                className="input-modern pl-10 bg-background/50 border-border/50 focus:bg-background" 
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Modern Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-accent/50 rounded-xl">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium animate-pulse">
                    3
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 modern-card">
                <DropdownMenuLabel className="text-base font-semibold">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="space-y-1">
                  <DropdownMenuItem className="cursor-pointer p-3 rounded-lg">
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Quality Alert: Batch 452A</p>
                        <span className="status-badge status-warning text-xs">High</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Requires immediate attention</p>
                      <span className="text-xs text-muted-foreground">10 minutes ago</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer p-3 rounded-lg">
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Inventory Low: SKU-78452</p>
                        <span className="status-badge status-warning text-xs">Medium</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Stock below minimum threshold</p>
                      <span className="text-xs text-muted-foreground">35 minutes ago</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer p-3 rounded-lg">
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">New PO Approval Required</p>
                        <span className="status-badge bg-blue-100 text-blue-800 border-blue-200 text-xs">Info</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Purchase order PO-000123</p>
                      <span className="text-xs text-muted-foreground">1 hour ago</span>
                    </div>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer justify-center text-primary font-medium p-3">
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Modern User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-3 px-3 py-2 h-auto hover:bg-accent/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground font-medium text-sm">
                      {userProfile?.full_name?.charAt(0) || "U"}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">{userProfile?.full_name || "User"}</span>
                      <span className="text-xs text-muted-foreground">{userProfile?.department_name || "N/A"}</span>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 modern-card">
                <DropdownMenuLabel className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground font-medium">
                      {userProfile?.full_name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <p className="font-semibold">{userProfile?.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground">{userProfile?.email}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive p-3 rounded-lg">
                  <LogOut className="mr-3 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Modern Main Content */}
        <main className="flex-1 overflow-auto custom-scrollbar bg-gradient-to-br from-background to-muted/20 p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
