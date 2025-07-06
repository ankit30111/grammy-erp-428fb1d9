import { User, LogOut, Shield, Mail, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

export function UserProfileDropdown() {
  const { userProfile, isAdmin, signOut } = useAuth();

  if (!userProfile) {
    return (
      <Button variant="ghost" size="sm" className="gap-2">
        <User className="h-5 w-5" />
        <span>No Profile</span>
      </Button>
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-10">
          <User className="h-5 w-5" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">{userProfile.full_name || userProfile.email}</span>
            <div className="flex items-center gap-1">
              {isAdmin && <Shield className="h-3 w-3 text-primary" />}
              <span className="text-xs text-muted-foreground">
                {isAdmin ? 'Admin' : 'User'}
              </span>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>User Profile</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{userProfile.full_name || 'No name set'}</p>
              <p className="text-xs text-muted-foreground">Full Name</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm">{userProfile.email}</p>
              <p className="text-xs text-muted-foreground">Email</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm">{userProfile.departments?.name || 'Not assigned'}</p>
              <p className="text-xs text-muted-foreground">Department</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 flex items-center gap-2">
              <Badge variant={isAdmin ? "default" : "secondary"}>
                {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
              </Badge>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${userProfile.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-muted-foreground">
                  {userProfile.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}