
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { 
  BarChart2, 
  Package, 
  ClipboardCheck, 
  Truck, 
  Layers, 
  Settings, 
  Home, 
  Calendar, 
  Plus, 
  FileText, 
  UserPlus,
  ChevronRight
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  subItems?: {
    to: string;
    label: string;
    badge?: number;
    permission?: string;
  }[];
  permission?: string;
}

const NavItem = ({ to, icon, label, badge, subItems, permission }: NavItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { hasPermission, isAdmin } = useAuth();
  const location = useLocation();
  
  // Check if user has permission for this nav item
  if (permission && !hasPermission(permission) && !isAdmin()) {
    return null;
  }

  const isActive = location.pathname === to;
  const hasActiveSubItem = subItems?.some(item => location.pathname === item.to);

  if (subItems?.length) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton 
              isActive={isActive || hasActiveSubItem}
              className="w-full justify-between"
            >
              <div className="flex items-center gap-2">
                {icon}
                <span>{label}</span>
              </div>
              <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {subItems.map((item, index) => {
                if (item.permission && !hasPermission(item.permission) && !isAdmin()) {
                  return null;
                }
                
                return (
                  <SidebarMenuSubItem key={index}>
                    <SidebarMenuSubButton asChild isActive={location.pathname === item.to}>
                      <NavLink to={item.to} className="flex items-center justify-between w-full">
                        <span>{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-0.5">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <NavLink to={to} className="flex items-center gap-2 w-full">
          {icon}
          <span>{label}</span>
          {badge !== undefined && (
            <span className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full px-2 py-0.5">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

export function AppSidebar() {
  const { isAdmin } = useAuth();
  
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <img 
            alt="Grammy Electronics Logo" 
            src="https://grammyelectronics.com/wp-content/uploads/2021/04/grammy-logo@2x-1-1.png" 
            className="h-8 object-scale-down" 
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem 
                to="/" 
                icon={<Home size={20} />} 
                label="Dashboard" 
              />
              <NavItem 
                to="/projection" 
                icon={<Plus size={20} />} 
                label="Add Projection" 
                permission="planning" 
              />
              <NavItem 
                to="/planning" 
                icon={<Calendar size={20} />} 
                label="PPC" 
                permission="planning"
                subItems={[
                  {
                    to: "/planning",
                    label: "Planning",
                    permission: "planning"
                  },
                  {
                    to: "/purchase",
                    label: "Purchase",
                    permission: "purchase"
                  },
                  {
                    to: "/grn",
                    label: "GRN",
                    badge: 3,
                    permission: "purchase"
                  }
                ]}
              />
              <NavItem 
                to="/inventory" 
                icon={<Package size={20} />} 
                label="Store" 
                permission="store" 
              />
              <NavItem 
                to="/production" 
                icon={<BarChart2 size={20} />} 
                label="Production" 
                permission="production" 
              />
              <NavItem 
                to="/finished-goods" 
                icon={<Layers size={20} />} 
                label="Finished Goods" 
                permission="finished-goods" 
              />
              <NavItem 
                to="/quality" 
                icon={<ClipboardCheck size={20} />} 
                label="Quality Control" 
                permission="quality"
                subItems={[
                  {
                    to: "/quality/iqc",
                    label: "IQC",
                    badge: 3,
                    permission: "quality"
                  },
                  {
                    to: "/quality/pqc",
                    label: "PQC",
                    badge: 2,
                    permission: "quality"
                  },
                  {
                    to: "/quality/oqc",
                    label: "OQC",
                    badge: 1,
                    permission: "quality"
                  }
                ]}
              />
              <NavItem 
                to="/dispatch" 
                icon={<Truck size={20} />} 
                label="Dispatch" 
                permission="dispatch" 
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin() && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem 
                    to="/management/products" 
                    icon={<FileText size={20} />} 
                    label="Add New Product" 
                  />
                  <NavItem 
                    to="/management/raw-materials" 
                    icon={<Layers size={20} />} 
                    label="Add New Raw Material" 
                  />
                  <NavItem 
                    to="/management/user-management" 
                    icon={<UserPlus size={20} />} 
                    label="User Management" 
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <NavItem 
            to="/settings" 
            icon={<Settings size={20} />} 
            label="Settings" 
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
