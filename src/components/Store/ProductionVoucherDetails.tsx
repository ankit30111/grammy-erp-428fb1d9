import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronDown, ChevronRight, FileDown, Package, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateProductionVoucherPDF, generateProductionVoucherFilename, type ProductionVoucherData } from "@/utils/pdfTemplates";
import { PageHeader } from "@/components/shell/PageHeader";
import { fetchStockBalanceRows, getStockLocationId, hasLedgerEntry, postStockMovement } from "@/utils/stockLedger";
import { MOVEMENT_TYPES } from "@/constants/movementTypes";

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
          parts!part_id (
            name,
            bom!parent_part_id (
              *,
              parts!child_part_id (
                id,
                part_code,
                name,
                category,
                source_type
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

  // Fetch real-time stock balance with auto-refresh
  const { data: inventoryData = [], refetch: refetchInventory, dataUpdatedAt: inventoryUpdatedAt } = useQuery({
    queryKey: ["inventory-real-time", voucherId, productionOrder?.plant_id],
    enabled: !!productionOrder?.plant_id,
    queryFn: async () => {
      const plantId = productionOrder?.plant_id as string | undefined;
      if (!plantId) return [];
      console.log("🔍 Fetching real-time stock balance for plant:", plantId);

      const rows = await fetchStockBalanceRows(plantId, "MAIN");
      console.log("📦 Real-time stock balance rows:", rows.length);
      return rows;
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
          part_id,
          issued_quantity,
          received_quantity,
          created_at,
          parts!part_id (
            id,
            part_code,
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
    inventoryMap.set(item.parts?.id, item.quantity);
  });

  // Enhanced calculation to use production-verified quantities
  const getActualReceivedQuantity = (materialId: string) => {
    return dispatchedItems
      // "Verified by production" is no longer a separate flag: a received_quantity
      // that has been filled in IS the confirmation. One fact, one column.
      .filter(item => item.parts?.id === materialId && item.received_quantity != null)
      .reduce((sum, item) => sum + Number(item.received_quantity ?? 0), 0);
  };

  // Get total dispatched (sent) quantities regardless of production verification
  const getDispatchedQuantity = (materialId: string) => {
    return dispatchedItems
      .filter(item => item.parts?.id === materialId)
      .reduce((sum, item) => sum + Number(item.issued_quantity ?? 0), 0);
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
        const currentStock = getCurrentStock(material.parts.id);
        const quantityToSend = quantities[material.parts.id] || 0;
        
        console.log(`🧮 PRE-VALIDATION for ${material.parts.part_code}:`);
        console.log(`   - Material ID: ${material.parts.id}`);
        console.log(`   - Current Stock: ${currentStock}`);
        console.log(`   - Quantity to Send: ${quantityToSend}`);
        
        if (quantityToSend <= 0) {
          validationErrors.push(`Invalid quantity for ${material.parts.part_code}`);
          continue;
        }
        
        if (quantityToSend > currentStock) {
          validationErrors.push(`Insufficient stock for ${material.parts.part_code}: Required ${quantityToSend}, Available ${currentStock}`);
          continue;
        }

        dispatchPlan.push({
          materialId: material.parts.id,
          materialCode: material.parts.part_code,
          materialName: material.parts.name,
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
        // One kit per voucher until production has counted it. Issuing material a
        // second time used to create a SECOND kit against the same voucher - two
        // rows both saying "sent", each with its own lines - so the same voucher
        // could be issued material twice with nothing on screen showing it. A
        // top-up adds to the open kit instead.
        const { data: openKit, error: openKitError } = await supabase
          .from("kit_preparation")
          .select("id")
          .eq("production_order_id", voucherId)
          .in("status", ["PREPARED", "SHORTAGE", "SENT"])
          .maybeSingle();
        if (openKitError) throw openKitError;

        let kitPrep = openKit;
        if (!kitPrep) {
          const { data: created, error: kitError } = await supabase
            .from("kit_preparation")
            .insert({
              // kit_number is issued by set_kit_number; plant_id is NOT NULL and was
              // missing, so creating a kit failed before it ever reached the items.
              kit_number: "",
              plant_id: productionOrder?.plant_id,
              production_order_id: voucherId,
              status: "SENT",
              sent_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (kitError) {
            console.error("❌ STEP 2 FAILED - Kit preparation error:", kitError);
            throw new Error(`Failed to create kit preparation: ${kitError.message}`);
          }
          kitPrep = created;
        } else {
          await supabase
            .from("kit_preparation")
            .update({ status: "SENT", sent_at: new Date().toISOString() })
            .eq("id", kitPrep.id);
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
          
          const mainLocationId = await getStockLocationId(plan.plantId, "MAIN");

          // Deterministic reference: the kit item this dispatch line creates.
          // The id is generated up front so the ledger entry and the kit_items
          // row share it, and a retry of this same line cannot post twice.
          const kitItemId = crypto.randomUUID();

          try {
            if (!(await hasLedgerEntry("KIT_ITEM_ISSUE", kitItemId, MOVEMENT_TYPES.ISSUED_TO_PRODUCTION))) {
              // Negative delta: stock leaves the main store for production.
              await postStockMovement({
                plant_id: plan.plantId,
                part_id: plan.materialId,
                location_id: mainLocationId,
                qty_delta: -plan.quantityToSend,
                movement_type: MOVEMENT_TYPES.ISSUED_TO_PRODUCTION,
                reason_code: "STORE_DISPATCH",
                reference_type: "KIT_ITEM_ISSUE",
                reference_id: kitItemId,
                reference_number: productionOrder.voucher_number,
                notes: `Store Dispatch: ${plan.materialCode} dispatched to Production Voucher ${productionOrder.voucher_number}. Stock: ${plan.currentStock} → ${plan.newStock}`,
              });
            }
          } catch (invError: any) {
            console.error("❌ CRITICAL FAILURE - Stock movement failed:", invError);
            throw new Error(`CRITICAL: Failed to update stock for ${plan.materialCode}: ${invError.message}`);
          }

          console.log("✅ STOCK MOVEMENT POSTED:", {
            material: plan.materialCode,
            previous: plan.currentStock,
            new: plan.newStock,
            deducted: plan.quantityToSend
          });

          // STEP 4: Create kit item record
          // issued_quantity, not received_quantity.
          //
          // This line is why Production > Kit Receipt showed "Issued by store: 0"
          // for a kit that had physically gone out: the store wrote what it sent
          // into received_quantity, which is production's column to fill after
          // counting, and left issued_quantity at its default of zero. So the
          // store's number never reached production, and production's count was
          // pre-filled with the store's figure before anyone had counted anything -
          // which is exactly the disagreement the kit feedback loop exists to catch.
          const { error: itemError } = await supabase
            .from("kit_items")
            .insert({
              id: kitItemId,
              kit_preparation_id: kitPrep.id,
              part_id: plan.materialId,
              required_quantity: plan.requiredQuantity,
              issued_quantity: plan.quantityToSend,
            });

          if (itemError) {
            console.error("❌ Kit item creation failed:", itemError);
            throw new Error(`Failed to create kit item for ${plan.materialCode}: ${itemError.message}`);
          }

          console.log("✅ KIT ITEM CREATED:", kitItemId);

          dispatchResults.push({
            part_code: plan.materialCode,
            material_name: plan.materialName,
            quantity_sent: plan.quantityToSend,
            previous_stock: plan.currentStock,
            new_stock: plan.newStock,
            voucher_number: productionOrder.voucher_number,
            kit_item_id: kitItemId
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
    const bom = productionOrder?.parts?.bom || [];
    const materialsWithQuantities = bom.filter(item => 
      quantities[item.parts.id] && quantities[item.parts.id] > 0
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
      const currentStock = getCurrentStock(material.parts.id);
      const quantityToSend = quantities[material.parts.id];
      return quantityToSend > currentStock;
    });

    if (insufficientStockMaterials.length > 0) {
      const materialNames = insufficientStockMaterials.map(m => m.parts.part_code).join(', ');
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
        productName: productionOrder.parts?.name || "Unknown Product",
        productionQuantity: productionOrder.quantity,
        scheduledDate: productionOrder.planned_date,
        dispatchedAt: new Date().toISOString(),
        dispatchedBy: "Store Department", // Could be enhanced to get current user
        materials: bom.map(bomItem => ({
          materialCode: bomItem.parts.part_code,
          materialName: bomItem.parts.name,
          category: bomItem.parts.category,
          requiredQuantity: bomItem.quantity * productionOrder.quantity,
          dispatchedQuantity: getDispatchedQuantity(bomItem.parts.id),
          currentStock: getCurrentStock(bomItem.parts.id),
          sourceType: bomItem.parts?.source_type || 'PURCHASED'
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

  const bom = productionOrder.parts?.bom || [];
  const orderQuantity = productionOrder.quantity;

  // bom.bom_type no longer exists, so these three filters all matched nothing and
  // the voucher showed no materials at all while reporting a BOM count. With a
  // recursive BOM the meaningful split is purchased vs assembled, which lives on
  // parts.source_type - not a fixed three-way category. One group until there is a
  // real reason for more.
  const groupedBOM = [{ label: "Materials", items: bom }];

  const tableRows: VoucherTableRow[] = groupedBOM.flatMap((group) => {
    if (group.items.length === 0) return [];
    const materialRows = group.items.map((item): VoucherTableRow => {
      const materialId = item.parts.id;
      const required = item.quantity * orderQuantity;
      const stock = getCurrentStock(materialId);
      const sent = getDispatchedQuantity(materialId);
      const received = getActualReceivedQuantity(materialId);
      const toSend = quantities[materialId] || 0;
      return {
        id: materialId,
        materialCode: item.parts.part_code,
        description: item.parts.name,
        category: item.parts.category,
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
      { id: `group-${group.label}`, __group: true, label: group.label, count: materialRows.length },
      ...materialRows,
    ];
  });

  const materialRows = tableRows.filter((row) => !row.__group);
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
  const statusState = productionOrder.status === "COMPLETED" ? "ok" : productionOrder.status === "IN_PRODUCTION" ? "warn" : "idle";

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Production Voucher ${productionOrder.voucher_number}`}
        breadcrumb={[
          { label: "Store", to: "/store", onClick: onBack },
          { label: "Production Vouchers", to: "/store", onClick: onBack },
          { label: productionOrder.voucher_number },
        ]}
        meta={syncLabel}
        actions={(
          <Button variant="outline" size="sm" onClick={() => refetchInventory()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh inventory
          </Button>
        )}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-10 gap-y-3 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-semibold">{productionOrder.voucher_number}</span>
            <Badge variant={productionOrder.status === "COMPLETED" ? "default" : "secondary"}>
              {String(productionOrder.status).replace(/_/g, " ")}
            </Badge>
          </div>
          {[
            ["Product", productionOrder.parts?.name || "—"],
            ["Order qty", Number(orderQuantity).toLocaleString()],
            ["BOM lines", materialRows.length],
            ["Short lines", shortLines],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="font-medium truncate max-w-56" title={String(value)}>{value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Required</TableHead>
              <TableHead className="text-right">In Stock</TableHead>
              <TableHead className="text-right">Sent / Received</TableHead>
              <TableHead className="text-right">To Send</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono font-medium whitespace-nowrap">
                  {row.materialCode}
                </TableCell>
                <TableCell className="max-w-xs truncate" title={row.description ?? ""}>
                  {row.description ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(row.required ?? 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={(row.stock ?? 0) === 0 ? "text-muted-foreground" : ""}>
                    {(row.stock ?? 0).toLocaleString()}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(row.sent ?? 0).toLocaleString()}
                  <span className="mx-1 text-muted-foreground">→</span>
                  {(row.received ?? 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    max={Math.min(row.stock ?? 0, Math.max(0, (row.required ?? 0) - (row.received ?? 0)))}
                    value={(row.toSend ?? 0) || ""}
                    onChange={(event) => handleQuantityChange(row.id, event.target.value)}
                    placeholder="0"
                    disabled={row.isFullyReceived}
                    className={`ml-auto h-8 w-24 text-right font-mono ${row.hasInsufficientStock ? "border-destructive" : ""}`}
                  />
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {(row.balance ?? 0) > 0 ? (
                    <span className="text-destructive">{(row.balance ?? 0).toLocaleString()}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
              <TableCell colSpan={2}>Totals</TableCell>
              <TableCell className="text-right font-mono">{totals.required.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">{totals.stock.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">
                {totals.sent.toLocaleString()}
                <span className="mx-1 text-muted-foreground">→</span>
                {totals.received.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono">{totals.toSend.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">
                <span className={totals.balance > 0 ? "text-destructive" : "text-muted-foreground"}>
                  {totals.balance.toLocaleString()}
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="sticky bottom-0 z-20 flex min-h-12 flex-wrap items-center gap-3 border-t border-border bg-background/95 py-2 backdrop-blur-sm">
        <p className="mr-auto text-[16px] text-muted-foreground">
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
