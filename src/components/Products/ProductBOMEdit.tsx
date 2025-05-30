
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BOMForm, BOMItem } from "@/components/BOM/BOMForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductBOMEditProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ProductBOMEdit({ product, open, onOpenChange, onSuccess }: ProductBOMEditProps) {
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [originalBomItems, setOriginalBomItems] = useState<BOMItem[]>([]);
  const [changeReason, setChangeReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (product && open) {
      fetchBOMItems();
    }
  }, [product, open]);

  const fetchBOMItems = async () => {
    if (!product) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bom')
        .select(`
          *,
          raw_materials (
            material_code,
            name
          )
        `)
        .eq('product_id', product.id);

      if (error) throw error;

      const formattedItems: BOMItem[] = (data || []).map(item => ({
        raw_material_id: item.raw_material_id,
        raw_material_name: item.raw_materials?.name || '',
        raw_material_code: item.raw_materials?.material_code || '',
        bom_type: item.bom_type,
        quantity: item.quantity,
        is_critical: item.is_critical
      }));

      setBomItems(formattedItems);
      setOriginalBomItems(formattedItems);
    } catch (error) {
      console.error('Error fetching BOM items:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    return JSON.stringify(bomItems) !== JSON.stringify(originalBomItems);
  };

  const hasAllBOMTypes = () => {
    const types = bomItems.map(item => item.bom_type);
    return ["main_assembly", "sub_assembly", "accessory"].every(type => types.includes(type as any));
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      toast({
        title: "No Changes",
        description: "No changes detected in the BOM",
        variant: "destructive"
      });
      return;
    }

    if (!changeReason.trim()) {
      toast({
        title: "Change Reason Required",
        description: "Please provide a reason for the BOM changes",
        variant: "destructive"
      });
      return;
    }

    if (!hasAllBOMTypes()) {
      toast({
        title: "BOM Required",
        description: "Please add at least one item for each BOM type (Main Assembly, Sub Assembly, Accessory)",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Get current version number
      const { data: bomVersionData, error: versionError } = await supabase
        .from('bom_versions')
        .select('version_number')
        .eq('product_id', product.id)
        .order('version_number', { ascending: false })
        .limit(1);

      if (versionError && versionError.code !== 'PGRST116') {
        throw versionError;
      }

      const nextVersion = bomVersionData && bomVersionData.length > 0 
        ? bomVersionData[0].version_number + 1 
        : 1;

      // Archive current BOM
      if (originalBomItems.length > 0) {
        const { error: archiveError } = await supabase
          .from('bom_versions')
          .insert({
            product_id: product.id,
            version_number: nextVersion - 1,
            change_reason: nextVersion === 1 ? "Initial version" : "Previous version",
            bom_data: originalBomItems,
            created_at: new Date().toISOString()
          });

        if (archiveError) throw archiveError;
      }

      // Delete current BOM items
      const { error: deleteError } = await supabase
        .from('bom')
        .delete()
        .eq('product_id', product.id);

      if (deleteError) throw deleteError;

      // Insert new BOM items
      const bomInserts = bomItems.map(item => ({
        product_id: product.id,
        raw_material_id: item.raw_material_id,
        bom_type: item.bom_type,
        quantity: item.quantity,
        is_critical: item.is_critical || false
      }));

      const { error: insertError } = await supabase
        .from('bom')
        .insert(bomInserts);

      if (insertError) throw insertError;

      // Create new version record
      const { error: versionInsertError } = await supabase
        .from('bom_versions')
        .insert({
          product_id: product.id,
          version_number: nextVersion,
          change_reason: changeReason,
          bom_data: bomItems,
          created_at: new Date().toISOString()
        });

      if (versionInsertError) throw versionInsertError;

      toast({
        title: "Success",
        description: `BOM updated successfully. New version: ${nextVersion}.0`
      });

      onSuccess();
      setChangeReason("");
    } catch (error) {
      console.error('Error updating BOM:', error);
      toast({
        title: "Error",
        description: "Failed to update BOM",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit BOM for {product.name} ({product.product_code})</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center p-8">Loading BOM...</div>
        ) : (
          <div className="space-y-6">
            <BOMForm bomItems={bomItems} onBOMChange={setBomItems} />
            
            {hasChanges() && (
              <div className="space-y-2">
                <Label htmlFor="change-reason">Reason for Changes *</Label>
                <Textarea
                  id="change-reason"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Please describe the reason for these BOM changes..."
                  rows={3}
                />
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!hasChanges() || !hasAllBOMTypes() || isLoading}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
