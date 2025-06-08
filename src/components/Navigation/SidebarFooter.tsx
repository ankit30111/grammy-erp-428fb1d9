
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
    <div className="p-2 mt-auto border-t border-sidebar-border space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className={cn("w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent", collapsed && "justify-center px-2")}
      >
        <LogOut size={20} />
        {!collapsed && <span className="ml-2">Sign Out</span>}
      </Button>
    </div>
  );
};
