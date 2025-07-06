import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Shield, Building2, Mail } from "lucide-react";
import { toast } from "sonner";

export function UserProfileDropdown() {
  const { userAccount, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out");
    } finally {
      setIsLoading(false);
    }
  };

  if (!userAccount) {
    return (
      <Button variant="ghost" size="sm" className="gap-2">
        <User className="h-5 w-5" />
        <span>Loading...</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="h-5 w-5" />
          <span>{userAccount.full_name || userAccount.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>User Profile</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="p-2 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{userAccount.full_name}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{userAccount.email}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Role: {userAccount.role}</span>
          </div>
          
          {userAccount.departments && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Department: {userAccount.departments.name}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm">
            <div className={`h-2 w-2 rounded-full ${userAccount.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-muted-foreground">
              Status: {userAccount.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer text-destructive focus:text-destructive" 
          onClick={handleSignOut}
          disabled={isLoading}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isLoading ? "Signing out..." : "Sign Out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}