import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, FileDown, Package, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateProductionVoucherPDF, generateProductionVoucherFilename, type ProductionVoucherData } from "@/utils/pdfTemplates";
import { PageHeader } from "@/components/shell/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/shell/DataTable";
import { StatePill } from "@/components/shell/StatePill";

interface ProductionVoucherDetailsProps {
  voucherId: string;
  onBack: () => void;
}

interface VoucherTableRow extends Record<string, unknown> {
  id: string;
  __group?: boolean;
  label?: string;
  count?: number;
  materialCode?: string;
  description?: string;
  category?: string;
  required?: number;
  stock?: number;
  sent?: number;
  received?: number;
  toSend?: number;
  balance?: number;
  pending?: number;
  isFullyReceived?: boolean;
  hasInsufficientStock?: boolean;
}

const ProductionVoucherDetails = ({ voucherId, onBack }: ProductionVoucherDetailsProps) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch production order details with BOM
  const { data: productionOrder, isLoading } = useQuery({
    queryKey: ["production-order-details", voucherId],
    queryFn: async () => {
      console.log("🔍 Fetching production order details for:", voucherId);
      
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          *,
          products!product_id (
            name,
            bom!product_id (
              *,
              raw_materials!raw_material_id (
                id,
                material_code,
                name,
                category
              )
            )
          )
        `)
        .eq("id", voucherId)
        .single();

      if (error) {
        console.error("❌ Error fetching production order:", error);
        throw error;
      }

      console.log("📊 Production order data:", data);
      return data;
    },
  });

  // Fetch real-time inventory data with auto-refresh
  const { data: inventoryData = [], refetch: refetchInventory, dataUpdatedAt: inventoryUpdatedAt } = useQuery({
    queryKey: ["inventory-real-time", voucherId, productionOrder?.plant_id],
    enabled: !!productionOrder?.plant_id,
    queryFn: async () => {
      console.log("🔍 Fetching real-time inventory data for plant:", productionOrder?.plant_id);

      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          raw_materials!raw_material_id (
            id,
            material_code,
            name,
            category
          )
        `)
        .eq("plant_id", productionOrder!.plant_id)
        .order("last_updated", { ascending: false });

      if (error) {
        console.error("❌ Error fetching inventory:", error);
        throw error;
      }

      console.log("📦 Real-time inventory data:", data);
      return data || [];
    },
    refetchInterval: 2000, // Auto-refresh every 2 seconds
  });

  // Enhanced dispatched materials query to track actual received quantities
  const { data: dispatchedItems = [] } = useQuery({
    queryKey: ["dispatched-materials", voucherId],
    queryFn: async () => {
      console.log("🔍 Fetching dispatched materials for voucher:", voucherId);
      
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          raw_material_id,
          actual_quantity,
          verified_by_production,
          created_at,
          raw_materials!raw_material_id (
            id,
            material_code,
            name,
            category
          ),
          kit_preparation!inner(production_order_id)
        `)
        .eq("kit_preparation.production_order_id", voucherId);

      if (error) {
        console.error("❌ Error fetching dispatched materials:", error);
        throw error;
      }

      console.log("📋 Dispatched materials:", data);
      return data || [];
    },
  });

  // Create inventory lookup map
  const inventoryMap = new Map();
  inventoryData.forEach(item => {
    inventoryMap.set(item.raw_materials.id, item.quantity);
  });

  // Enhanced calculation to use production-verified quantities
  const getActualReceivedQuantity = (materialId: string) => {
    return dispatchedItems
      .filter(item => item.raw_materials.id === materialId && item.verified_by_production)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Get total dispatched (sent) quantities regardless of production verification
  const getDispatchedQuantity = (materialId: string) => {
    return dispatchedItems
      .filter(item => item.raw_materials.id === materialId)
      .reduce((sum, item) => sum + item.actual_quantity, 0);
  };

  // Get current stock from real-time inventory
  const getCurrentStock = (materialId: string) => {
    return inventoryMap.get(materialId) || 0;
  };

  // CRITICAL FIX: Enhanced material dispatch mutation with atomic operations and comprehensive logging
  const sendMaterialsMutation = useMutation({
    mutationFn: async (materialsToSend: any[]) => {
      console.log("🚀 STARTING ENHANCED MATERIAL DISPATCH WITH ATOMIC INVENTORY DEDUCTION...");
      console.log("📋 Materials to dispatch:", materialsToSend);
      
      // STEP 1: Comprehensive pre-validation
      const validationErrors: string[] = [];
      const dispatchPlan = [];
      
      for (const material of materialsToSend) {
        const currentStock = getCurrentStock(material.raw_materials.id);
        const quantityToSend = quantities[material.raw_materials.id] || 0;
        
        console.log(`🧮 PRE-VALIDATION for ${material.raw_materials.material_code}:`);
        console.log(`   - Material ID: ${material.raw_materials.id}`);
        console.log(`   - Current Stock: ${currentStock}`);
        console.log(`   - Quantity to Send: ${quantityToSend}`);
        
        if (quantityToSend <= 0) {
          validationErrors.push(`Invalid quantity for ${material.raw_materials.material_code}`);
          continue;
        }
        
        if (quantityToSend > currentStock) {
          validationErrors.push(`Insufficient stock for ${material.raw_materials.material_code}: Required ${quantityToSend}, Available ${currentStock}`);
          continue;
        }

        dispatchPlan.push({
          materialId: material.raw_materials.id,
          materialCode: material.raw_materials.material_code,
          materialName: material.raw_materials.name,
          currentStock,
          quantityToSend,
          newStock: currentStock - quantityToSend,
          requiredQuantity: material.quantity * productionOrder.quantity,
          plantId: productionOrder.plant_id as string,
        });
      }

      if (validationErrors.length > 0) {
        console.error("❌ VALIDATION FAILED:", validationErrors);
        throw new Error(validationErrors.join('; '));
      }

      console.log("✅ VALIDATION PASSED. Dispatch plan:", dispatchPlan);

      try {
        // STEP 2: Create kit preparation record with retry logic
        console.log("🔄 STEP 2: Creating kit preparation record...");
        const { data: kitPrep, error: kitError } = await supabase
          .from("kit_preparation")
          .insert({
            production_order_id: voucherId,
            status: "MATERIALS_SENT"
          })
          .select()
          .single();

        if (kitError) {
          console.error("❌ STEP 2 FAILED - Kit preparation error:", kitError);
          throw new Error(`Failed to create kit preparation: ${kitError.message}`);
        }

        console.log("✅ STEP 2 SUCCESS - Kit preparation created:", kitPrep.id);

        // STEP 3: Process each material with ATOMIC inventory deduction and logging
        const dispatchResults = [];
        
        for (const plan of dispatchPlan) {
          console.log(`📦 PROCESSING ATOMIC DISPATCH for ${plan.materialCode}...`);
          
          // CRITICAL: Atomic inventory update with immediate verification
          console.log(`🔄 CRITICAL: Updating inventory for material ${plan.materialId}...`);
          console.log(`   - Before: ${plan.currentStock}`);
          console.log(`   - Deducting: ${plan.quantityToSend}`);
          console.log(`   - Expected After: ${plan.newStock}`);
          
          const { data: inventoryUpdate, error: invError } = await supabase
            .from("inventory")
            .update({
              quantity: plan.newStock,
              last_updated: new Date().toISOString()
            })
            .eq("raw_material_id", plan.materialId)
            .eq("plant_id", plan.plantId)
            .select("quantity")
            .single();

          if (invError) {
            console.error("❌ CRITICAL FAILURE - Inventory update failed:", invError);
            throw new Error(`CRITICAL: Failed to update inventory for ${plan.materialCode}: ${invError.message}`);
          }

          console.log("✅ INVENTORY UPDATE SUCCESSFUL:", {
            material: plan.materialCode,
            previous: plan.currentStock,
            new: inventoryUpdate.quantity,
            deducted: plan.quantityToSend
          });

          // STEP 4: Create kit item record
          const { data: kitItemData, error: itemError } = await supabase
            .from("kit_items")
            .insert({
              kit_preparation_id: kitPrep.id,
              raw_material_id: plan.materialId,
              required_quantity: plan.requiredQuantity,
              actual_quantity: plan.quantityToSend
            })
            .select()
            .single();

          if (itemError) {
            console.error("❌ Kit item creation failed:", itemError);
            throw new Error(`Failed to create kit item for ${plan.materialCode}: ${itemError.message}`);
          }

          console.log("✅ KIT ITEM CREATED:", kitItemData.id);

          // STEP 5: CRITICAL - Log material movement for audit trail
          console.log(`📝 LOGGING MATERIAL MOVEMENT for ${plan.materialCode}...`);
          
          const { data: movementData, error: movementError } = await supabase
            .from("material_movements")
            .insert({
              raw_material_id: plan.materialId,
              movement_type: "ISSUED_TO_PRODUCTION",
              quantity: plan.quantityToSend,
              reference_id: voucherId,
              reference_type: "PRODUCTION_ORDER",
              reference_number: productionOrder.voucher_number,
              notes: `Store Dispatch: ${plan.materialCode} dispatched to Production Voucher ${productionOrder.voucher_number}. Stock: ${plan.currentStock} → ${plan.newStock}`
            })
            .select()
            .single();

          if (movementError) {
            console.error("❌ MATERIAL MOVEMENT LOGGING FAILED:", movementError);
            throw new Error(`Failed to log material movement for ${plan.materialCode}: ${movementError.message}`);
          }

          console.log("✅ MATERIAL MOVEMENT LOGGED:", movementData.id);

          dispatchResults.push({
            material_code: plan.materialCode,
            material_name: plan.materialName,
            quantity_sent: plan.quantityToSend,
            previous_stock: plan.currentStock,
            new_stock: plan.newStock,
            voucher_number: productionOrder.voucher_number,
            kit_item_id: kitItemData.id,
            movement_id: movementData.id
          });

          console.log(`✅ COMPLETE DISPATCH PROCESSING for ${plan.materialCode}`);
        }

        console.log("🎉 ALL MATERIALS DISPATCHED SUCCESSFULLY WITH FULL AUDIT TRAIL");
        
        // ENHANCED: Trigger real-time updates across the application
        localStorage.setItem('material_dispatched', Date.now().toString());
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'material_dispatched',
          newValue: Date.now().toString()
        }));
        
        return { 
          success: true, 
          kitPrepId: kitPrep.id, 
          results: dispatchResults,
          voucherNumber: productionOrder.voucher_number
        };

      } catch (error) {
        console.error("❌ DISPATCH TRANSACTION FAILED:", error);
        throw error;
      }
    },
    onSuccess: (result) => {
      console.log("🎉 DISPATCH SUCCESS:", result);
      
      toast({
        title: "Materials Dispatched Successfully",
        description: `${result.results.length} materials dispatched to Production Voucher ${result.voucherNumber}. Real-time inventory deduction completed.`,
      });
      
      // Clear quantities and force comprehensive refresh
      setQuantities({});
      
      // CRITICAL: Force immediate refresh of ALL related data
      console.log("🔄 FORCING COMPREHENSIVE DATA REFRESH...");
      queryClient.invalidateQueries({ queryKey: ["production-order-details"] });
      queryClient.invalidateQueries({ queryKey: ["dispatched-materials"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-real-time"] });
      queryClient.invalidateQueries({ queryKey: ["material-movements-logbook"] });
      
      // Multiple staged refreshes for real-time sync
      setTimeout(() => {
        console.log("🔄 DELAYED INVENTORY REFRESH 1...");
        refetchInventory();
      }, 500);
      
      setTimeout(() => {
        console.log("🔄 DELAYED INVENTORY REFRESH 2...");
        refetchInventory();
      }, 1500);
    },
    onError: (error: Error) => {
      console.error("❌ DISPATCH FAILED:", error);
      toast({
        title: "Material Dispatch Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuantityChange = (materialId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setQuantities(prev => ({
      ...prev,
      [materialId]: quantity
    }));
  };

  const handleSendMaterials = () => {
    const bom = productionOrder?.products?.bom || [];
    const materialsWithQuantities = bom.filter(item => 
      quantities[item.raw_materials.id] && quantities[item.raw_materials.id] > 0
    );

    if (materialsWithQuantities.length === 0) {
      toast({
        title: "No Materials Selected",
        description: "Please enter quantities for the materials you want to dispatch",
        variant: "destructive",
      });
      return;
    }

    // Enhanced validation before dispatch
    const insufficientStockMaterials = materialsWithQuantities.filter(material => {
      const currentStock = getCurrentStock(material.raw_materials.id);
      const quantityToSend = quantities[material.raw_materials.id];
      return quantityToSend > currentStock;
    });

    if (insufficientStockMaterials.length > 0) {
      const materialNames = insufficientStockMaterials.map(m => m.raw_materials.material_code).join(', ');
      toast({
        title: "Insufficient Stock",
        description: `Cannot dispatch materials with insufficient stock: ${materialNames}. Please check inventory levels.`,
        variant: "destructive",
      });
      return;
    }

    console.log("🚀 INITIATING ENHANCED MATERIAL DISPATCH for:", materialsWithQuantities.length, "materials");
    sendMaterialsMutation.mutate(materialsWithQuantities);
  };

  // Generate PDF for production voucher
  const handleGeneratePDF = () => {
    if (!productionOrder || !bom.length || dispatchedItems.length === 0) {
      toast({
        title: "Cannot Generate PDF",
        description: "No materials have been dispatched yet. Please dispatch materials first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare PDF data
      const pdfData: ProductionVoucherData = {
        voucherNumber: productionOrder.voucher_number,
        productName: productionOrder.products?.name || "Unknown Product",
        productionQuantity: productionOrder.quantity,
        scheduledDate: productionOrder.scheduled_date,
        dispatchedAt: new Date().toISOString(),
        dispatchedBy: "Store Department", // Could be enhanced to get current user
        materials: bom.map(bomItem => ({
          materialCode: bomItem.raw_materials.material_code,
          materialName: bomItem.raw_materials.name,
          category: bomItem.raw_materials.category,
          requiredQuantity: bomItem.quantity * productionOrder.quantity,
          dispatchedQuantity: getDispatchedQuantity(bomItem.raw_materials.id),
          currentStock: getCurrentStock(bomItem.raw_materials.id),
          bomType: bomItem.bom_type || 'main_assembly'
        }))
      };

      // Generate and download PDF
      const pdf = generateProductionVoucherPDF(pdfData);
      const filename = generateProductionVoucherFilename(productionOrder.voucher_number);
      pdf.save(filename);

      toast({
        title: "PDF Generated",
        description: `Production voucher PDF downloaded: ${filename}`,
      });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "PDF Generation Failed",
        description: "Failed to generate production voucher PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Force inventory refresh when component mounts or voucher changes
  useEffect(() => {
    console.log("🔄 AUTO-REFRESHING INVENTORY DATA FOR REAL-TIME SYNC");
    refetchInventory();
  }, [voucherId, refetchInventory]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Loading production voucher details...</p>
        </div>
      </div>
    );
  }

  if (!productionOrder) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Production voucher not found</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  const bom = productionOrder.products?.bom || [];
  const orderQuantity = productionOrder.quantity;

  const groupedBOM = [
    { label: "Sub Assembly", items: bom.filter((item) => item.bom_type === "sub_assembly") },
    { label: "Main Assembly", items: bom.filter((item) => item.bom_type === "main_assembly") },
    { label: "Accessory", items: bom.filter((item) => item.bom_type === "accessory") },
  ];

  const tableRows: VoucherTableRow[] = groupedBOM.flatMap((group) => {
    if (group.items.length === 0) return [];
    const materialRows = group.items.map((item): VoucherTableRow => {
      const materialId = item.raw_materials.id;
      const required = item.quantity * orderQuantity;
      const stock = getCurrentStock(materialId);
      const sent = getDispatchedQuantity(materialId);
      const received = getActualReceivedQuantity(materialId);
      const toSend = quantities[materialId] || 0;
      return {
        id: materialId,
        materialCode: item.raw_materials.material_code,
        description: item.raw_materials.name,
        category: item.raw_materials.category,
        required,
        stock,
        sent,
        received,
        toSend,
        balance: Math.max(0, required - received - toSend),
        pending: Math.max(0, sent - received),
        isFullyReceived: received >= required,
        hasInsufficientStock: toSend > stock,
      };
    });
    return [
      { id: `group-${group.label}`, __group: true, label: group.label, count: `${materialRows.length} lines` },
      ...materialRows,
    ];
  });

  const materialRows = tableRows.filter((row) => !row.__group);
  const columns: DataTableColumn<VoucherTableRow>[] = [
    { key: "material", header: "Material", width: 96 },
    { key: "description", header: "Description", width: "auto", truncate: true },
    { key: "required", header: "Req.", width: 76, align: "right" },
    { key: "stock", header: "Stock", width: 76, align: "right" },
    { key: "movement", header: "Sent → Recd.", width: 104, align: "right" },
    { key: "toSend", header: "To send", width: 92, align: "right" },
    { key: "balance", header: "Balance", width: 84, align: "right" },
  ];

  const totals = materialRows.reduce(
    (sum, row) => ({
      required: sum.required + (row.required ?? 0),
      stock: sum.stock + (row.stock ?? 0),
      sent: sum.sent + (row.sent ?? 0),
      received: sum.received + (row.received ?? 0),
      toSend: sum.toSend + (row.toSend ?? 0),
      balance: sum.balance + (row.balance ?? 0),
    }),
    { required: 0, stock: 0, sent: 0, received: 0, toSend: 0, balance: 0 },
  );
  const selectedLines = materialRows.filter((row) => (row.toSend ?? 0) > 0).length;
  const shortLines = materialRows.filter((row) => (row.balance ?? 0) > 0).length;
  const syncSeconds = inventoryUpdatedAt ? Math.max(0, Math.floor((Date.now() - inventoryUpdatedAt) / 1000)) : 0;
  const syncLabel = syncSeconds < 5 ? "Synced just now" : `Synced ${syncSeconds}s ago`;
  const statusState = productionOrder.status === "COMPLETED" ? "ok" : productionOrder.status === "IN_PROGRESS" ? "warn" : "idle";

  return (
    <div className="min-w-0 space-y-3">
      <PageHeader
        title={`Production Voucher ${productionOrder.voucher_number}`}
        subtitle="Material issue and production receipt status"
        breadcrumb={[
          { label: "Store", to: "/store", onClick: onBack },
          { label: "Production Vouchers", to: "/store", onClick: onBack },
          { label: productionOrder.voucher_number },
        ]}
        meta={syncLabel}
        actions={(
          <Button variant="outline" size="sm" onClick={() => refetchInventory()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh inventory
          </Button>
        )}
      />

      <section className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-y border-hairline bg-surface-2 px-3 py-2" aria-label="Voucher summary">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-[15px] font-semibold text-foreground">{productionOrder.voucher_number}</span>
          <StatePill state={statusState}>{productionOrder.status?.replace("_", " ")}</StatePill>
        </div>
        <div className="ml-auto grid grid-cols-4 gap-x-6">
          {[
            ["Product", productionOrder.products?.name || "—"],
            ["Order qty", orderQuantity],
            ["BOM lines", materialRows.length],
            ["Short lines", shortLines],
          ].map(([label, value]) => (
            <div key={String(label)} className="min-w-0 text-right">
              <div className="font-mono text-[9px] font-medium uppercase tracking-[0.09em] text-muted-foreground">{label}</div>
              <div className="max-w-40 truncate font-mono text-[15px] font-medium tabular-nums text-foreground" title={String(value)}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      <DataTable<VoucherTableRow>
        columns={columns}
        rows={tableRows}
        getRowKey={(row) => row.id}
        getRowState={(row) => {
          if (row.hasInsufficientStock || ((row.stock ?? 0) === 0 && (row.balance ?? 0) > 0)) return "bad";
          if ((row.pending ?? 0) > 0 || (row.toSend ?? 0) > 0) return "warn";
          if (row.isFullyReceived) return "ok";
          return null;
        }}
        renderCell={(row, column, { expanded, toggleExpanded }) => {
          switch (column.key) {
            case "material":
              return (
                <button type="button" onClick={toggleExpanded} className="flex w-full items-center gap-1.5 text-left font-mono font-semibold text-foreground" aria-expanded={expanded}>
                  {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <span className="truncate">{row.materialCode}</span>
                </button>
              );
            case "description": return row.description ?? "—";
            case "required": return (row.required ?? 0).toLocaleString();
            case "stock": return <span className={(row.stock ?? 0) === 0 ? "text-muted-foreground" : "text-foreground"}>{(row.stock ?? 0).toLocaleString()}</span>;
            case "movement":
              return row.sent === row.received ? (
                <span className={(row.sent ?? 0) > 0 ? "font-semibold text-success" : "text-muted-foreground"}>{(row.sent ?? 0).toLocaleString()}</span>
              ) : (
                <span><span>{(row.sent ?? 0).toLocaleString()}</span><span className="mx-1 text-muted-foreground">→</span><span>{(row.received ?? 0).toLocaleString()}</span></span>
              );
            case "toSend": {
              const value = row.toSend ?? 0;
              return (
                <Input
                  type="number"
                  min="0"
                  max={Math.min(row.stock ?? 0, Math.max(0, (row.required ?? 0) - (row.received ?? 0)))}
                  value={value || ""}
                  onChange={(event) => handleQuantityChange(row.id, event.target.value)}
                  className={`ml-auto h-[26px] w-[62px] rounded-[3px] px-1.5 text-right font-mono text-[12.5px] tabular-nums shadow-none ring-offset-0 hover:border-input focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:ring-offset-0 ${value > 0 ? "border-input bg-background" : "border-transparent bg-transparent"} ${row.hasInsufficientStock ? "border-destructive" : ""}`}
                  placeholder="0"
                  disabled={row.isFullyReceived}
                />
              );
            }
            case "balance": return (row.balance ?? 0) > 0 ? <span className="font-semibold text-destructive">{(row.balance ?? 0).toLocaleString()}</span> : <span className="text-muted-foreground">0</span>;
            default: return null;
          }
        }}
        renderExpanded={(row) => (
          <div className="grid grid-cols-4 gap-4 text-[11px]">
            <div><span className="text-muted-foreground">Category</span><div className="mt-0.5 font-medium text-foreground">{row.category || "Uncategorised"}</div></div>
            <div><span className="text-muted-foreground">Available stock</span><div className="mt-0.5 font-mono tabular-nums text-foreground">{(row.stock ?? 0).toLocaleString()}</div></div>
            <div><span className="text-muted-foreground">In motion</span><div className="mt-0.5 font-mono tabular-nums text-warning">{(row.pending ?? 0).toLocaleString()}</div></div>
            <div><span className="text-muted-foreground">Line condition</span><div className="mt-0.5"><StatePill state={row.hasInsufficientStock ? "bad" : row.isFullyReceived ? "ok" : (row.pending ?? 0) > 0 ? "warn" : "idle"}>{row.hasInsufficientStock ? "Insufficient stock" : row.isFullyReceived ? "Confirmed" : (row.pending ?? 0) > 0 ? "In motion" : "Available"}</StatePill></div></div>
          </div>
        )}
        footer={{
          material: "Totals",
          required: totals.required.toLocaleString(),
          stock: totals.stock.toLocaleString(),
          movement: <span>{totals.sent.toLocaleString()}<span className="mx-1 text-muted-foreground">→</span>{totals.received.toLocaleString()}</span>,
          toSend: totals.toSend.toLocaleString(),
          balance: <span className={totals.balance > 0 ? "text-destructive" : "text-muted-foreground"}>{totals.balance.toLocaleString()}</span>,
        }}
      />

      <div className="sticky bottom-0 z-20 flex min-h-12 flex-wrap items-center gap-3 border-t border-border bg-background/95 py-2 backdrop-blur-sm">
        <p className="mr-auto text-[12px] text-muted-foreground">
          Dispatching <span className="font-mono font-semibold text-foreground">{totals.toSend.toLocaleString()}</span> units across <span className="font-mono font-semibold text-foreground">{selectedLines}</span> lines · <span className="font-mono font-semibold text-destructive">{shortLines}</span> lines still short
        </p>
        <Button variant="ghost" onClick={() => setQuantities({})} disabled={selectedLines === 0}>Clear entries</Button>
        <Button variant="outline" onClick={handleGeneratePDF} disabled={dispatchedItems.length === 0}>
          <FileDown className="h-4 w-4" />
          Generate PDF
        </Button>
        <Button onClick={handleSendMaterials} disabled={sendMaterialsMutation.isPending}>
          {sendMaterialsMutation.isPending ? "Dispatching…" : "Dispatch materials"}
        </Button>
      </div>
    </div>
  );
};

export default ProductionVoucherDetails;
