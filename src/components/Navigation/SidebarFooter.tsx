
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface SidebarFooterProps {
  collapsed: boolean;
  allowedTabs: string[];
  userPermissions: any;
  isLoading: boolean;
}

export const SidebarFooter = ({ collapsed }: SidebarFooterProps) => {
  const navigate = useNavigate();
  
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error("Error signing out");
        return;
      }
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("An unexpected error occurred");
    }
  };

  return (
    <div className="p-2 mt-auto border-t border-sidebar-border">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className={cn(
          "w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium",
          collapsed && "justify-center px-2"
        )}
      >
        <LogOut size={16} />
        {!collapsed && <span className="ml-2">Sign Out</span>}
      </Button>
    </div>
  );
};
