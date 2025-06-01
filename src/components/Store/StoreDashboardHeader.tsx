
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface StoreDashboardHeaderProps {
  onSyncInventory: () => void;
  isSyncing: boolean;
}

export default function StoreDashboardHeader({ onSyncInventory, isSyncing }: StoreDashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Store Dashboard</h1>
        <p className="text-muted-foreground">Manage vouchers, kit preparation, inventory, GRN receiving, and material requests</p>
      </div>
      <div className="flex items-center gap-4">
        <Button 
          onClick={onSyncInventory}
          disabled={isSyncing}
          variant="outline"
          className="gap-2"
        >
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sync Inventory
        </Button>
      </div>
    </div>
  );
}
