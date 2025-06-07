
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Search, Building2 } from "lucide-react";
import { useVendors } from "@/hooks/useVendors";

interface VendorSelectorProps {
  selectedVendorIds: string[];
  onVendorChange: (vendorIds: string[]) => void;
  primaryVendorId?: string;
  onPrimaryVendorChange: (vendorId: string) => void;
  label?: string;
  className?: string;
}

export const VendorSelector = ({
  selectedVendorIds,
  onVendorChange,
  primaryVendorId,
  onPrimaryVendorChange,
  label = "Vendors",
  className = ""
}: VendorSelectorProps) => {
  const { vendors, isLoading } = useVendors();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.vendor_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedVendors = vendors.filter(vendor => 
    selectedVendorIds.includes(vendor.id)
  );

  const handleVendorToggle = (vendorId: string) => {
    const newSelectedIds = selectedVendorIds.includes(vendorId)
      ? selectedVendorIds.filter(id => id !== vendorId)
      : [...selectedVendorIds, vendorId];
    
    onVendorChange(newSelectedIds);
    
    // If we removed the primary vendor, clear the primary selection
    if (!newSelectedIds.includes(primaryVendorId || "")) {
      onPrimaryVendorChange("");
    }
  };

  const handlePrimaryVendorSelect = (vendorId: string) => {
    onPrimaryVendorChange(vendorId);
    // Ensure the primary vendor is also selected
    if (!selectedVendorIds.includes(vendorId)) {
      onVendorChange([...selectedVendorIds, vendorId]);
    }
  };

  const removeVendor = (vendorId: string) => {
    const newSelectedIds = selectedVendorIds.filter(id => id !== vendorId);
    onVendorChange(newSelectedIds);
    
    // If we removed the primary vendor, clear the primary selection
    if (vendorId === primaryVendorId) {
      onPrimaryVendorChange("");
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label} (Optional)</Label>
      
      {/* Selected Vendors Display */}
      {selectedVendors.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedVendors.map(vendor => (
            <Badge 
              key={vendor.id} 
              variant={vendor.id === primaryVendorId ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              <Building2 className="h-3 w-3" />
              {vendor.vendor_code} - {vendor.name}
              {vendor.id === primaryVendorId && " (Primary)"}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => removeVendor(vendor.id)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search vendors by name or code..."
          className="pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
        />
      </div>

      {/* Dropdown */}
      {isDropdownOpen && (
        <Card className="absolute z-50 w-full max-w-md border shadow-lg">
          <CardContent className="p-0">
            <ScrollArea className="max-h-60">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading vendors...
                </div>
              ) : filteredVendors.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No vendors found
                </div>
              ) : (
                <div className="divide-y">
                  {filteredVendors.map(vendor => (
                    <div key={vendor.id} className="p-3 hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">
                            {vendor.vendor_code} - {vendor.name}
                          </div>
                          {vendor.email && (
                            <div className="text-sm text-muted-foreground">
                              {vendor.email}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={selectedVendorIds.includes(vendor.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleVendorToggle(vendor.id)}
                          >
                            {selectedVendorIds.includes(vendor.id) ? "Remove" : "Select"}
                          </Button>
                          {selectedVendorIds.includes(vendor.id) && (
                            <Button
                              type="button"
                              variant={vendor.id === primaryVendorId ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePrimaryVendorSelect(vendor.id)}
                            >
                              {vendor.id === primaryVendorId ? "Primary" : "Set Primary"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="p-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setIsDropdownOpen(false)}
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
