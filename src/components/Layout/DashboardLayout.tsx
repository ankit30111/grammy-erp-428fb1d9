
import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "@/components/Navigation/Sidebar";
import { Bell, User, Search, LogOut, Mail, Phone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const navigate = useNavigate();
  
  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      
      if (user) {
        // Fetch user profile from user_accounts table
        const { data: profile } = await supabase
          .from("user_accounts")
          .select("name, email, mobile_number")
          .eq("id", user.id)
          .single();
        
        setUserProfile(profile);
      }
    };
    
    getCurrentUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  // Get user permissions based on their department
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
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-card border-b h-14 flex items-center px-4 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8 h-9"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    3
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-5 w-5" />
                  <span>{userProfile?.name || "User"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Profile</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <div className="px-2 py-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{userProfile?.name || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">Name</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{userProfile?.email || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">Email</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{userProfile?.mobile_number || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">Mobile Number</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {userPermissions && typeof userPermissions === 'object' && 'departmentName' in userPermissions 
                          ? userPermissions.departmentName 
                          : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">Department</p>
                    </div>
                  </div>
                </div>
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
