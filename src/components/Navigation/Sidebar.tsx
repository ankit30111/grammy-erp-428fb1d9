
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  LayoutDashboard, 
  Factory, 
  Package, 
  Truck, 
  ClipboardCheck, 
  Users, 
  ShoppingCart,
  BarChart3,
  Settings,
  ChevronDown,
  Building2,
  X,
  Menu
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navigationItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    color: "text-blue-600"
  },
  {
    title: "Production",
    icon: Factory,
    href: "/production",
    color: "text-orange-600",
    badge: "Live",
    children: [
      { title: "Production Lines", href: "/production" },
      { title: "Schedule Management", href: "/production?tab=scheduled" },
      { title: "Quality Control", href: "/production?tab=oqc-rejections" },
    ]
  },
  {
    title: "Store Management",
    icon: Package,
    href: "/store",
    color: "text-green-600",
    children: [
      { title: "Kit Management", href: "/store" },
      { title: "Inventory", href: "/store?tab=inventory" },
      { title: "GRN Receiving", href: "/store?tab=grn" },
    ]
  },
  {
    title: "Dispatch",
    icon: Truck,
    href: "/dispatch",
    color: "text-purple-600"
  },
  {
    title: "Quality Control",
    icon: ClipboardCheck,
    href: "/quality",
    color: "text-red-600"
  },
  {
    title: "Purchase",
    icon: ShoppingCart,
    href: "/purchase",
    color: "text-indigo-600"
  },
  {
    title: "CRM",
    icon: Users,
    href: "/crm",
    color: "text-pink-600"
  },
  {
    title: "Reports",
    icon: BarChart3,
    href: "/reports",
    color: "text-cyan-600"
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
    color: "text-gray-600"
  }
];

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border z-50 transition-all duration-300 flex flex-col",
        isOpen ? "w-72" : "w-0 lg:w-16"
      )}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          {isOpen && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-sidebar-foreground text-lg">Grammy ERP</h2>
                <p className="text-xs text-sidebar-foreground/70">Electronics Management</p>
              </div>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent/50 lg:hidden"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const isItemActive = isActive(item.href);
              const isExpanded = expandedItems.includes(item.title);
              const hasChildren = item.children && item.children.length > 0;

              if (hasChildren) {
                return (
                  <Collapsible
                    key={item.title}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(item.title)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "nav-link group w-full justify-start",
                          isItemActive && "active"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5", item.color)} />
                        {isOpen && (
                          <>
                            <span className="flex-1 text-left">{item.title}</span>
                            {item.badge && (
                              <span className="px-2 py-0.5 bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full font-medium">
                                {item.badge}
                              </span>
                            )}
                            <ChevronDown className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )} />
                          </>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    
                    {isOpen && (
                      <CollapsibleContent className="space-y-1 ml-6 mt-1">
                        {item.children?.map((child) => (
                          <Link
                            key={child.href}
                            to={child.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                              "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/30",
                              isActive(child.href) && "text-sidebar-primary bg-sidebar-accent/50"
                            )}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                            {child.title}
                          </Link>
                        ))}
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                );
              }

              return (
                <Link
                  key={item.title}
                  to={item.href}
                  className={cn(
                    "nav-link group",
                    isItemActive && "active"
                  )}
                  title={!isOpen ? item.title : undefined}
                >
                  <item.icon className={cn("h-5 w-5", item.color)} />
                  {isOpen && (
                    <>
                      <span className="flex-1">{item.title}</span>
                      {item.badge && (
                        <span className="px-2 py-0.5 bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full font-medium">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Sidebar Footer */}
        {isOpen && (
          <div className="p-4 border-t border-sidebar-border">
            <div className="bg-sidebar-accent/30 rounded-xl p-3">
              <div className="flex items-center gap-2 text-sidebar-foreground mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">System Status</span>
              </div>
              <p className="text-xs text-sidebar-foreground/70">All systems operational</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
