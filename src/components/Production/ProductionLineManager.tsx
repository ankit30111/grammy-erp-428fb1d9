
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, Factory, List } from "lucide-react";

interface ProductionLineManagerProps {
  productionOrderId: string;
}

const PRODUCTION_LINES = [
  "Line 1",
  "Line 2", 
  "Sub Assembly 1",
  "Sub Assembly 2"
];

const ProductionLineManager = ({ productionOrderId }: ProductionLineManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lineAssignments, setLineAssignments] = useState({
    main_assembly: '',
    sub_assembly: '',
    accessory: ''
  });

  // Fetch production order with materials sent by store
  const { data: productionData } = useQuery({
    queryKey: ["production-with-materials", productionOrderId],
    queryFn: async () => {
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
        .eq("id", productionOrderId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch materials sent by store for this production order
  const { data: sentMaterials = [] } = useQuery({
    queryKey: ["sent-materials", productionOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_items")
        .select(`
          *,
          raw_materials!raw_material_id (
            id,
            material_code,
            name,
            category
          ),
          kit_preparation!inner(production_order_id)
        `)
        .eq("kit_preparation.production_order_id", productionOrderId);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch current production line status
  const { data: lineStatus = [] } = useQuery({
    queryKey: ["production-line-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_orders")
        .select(`
          id,
          voucher_number,
          status,
          scheduled_date,
          production_lines,
          products!product_id (name)
        `)
        .in("status", ["IN_PROGRESS", "SCHEDULED"])
        .order("scheduled_date");

      if (error) throw error;
      return data || [];
    },
  });

  // Group sent materials by BOM type
  const groupMaterialsByType = () => {
    const bom = productionData?.products?.bom || [];
    const materialsByType = {
      main_assembly: [] as any[],
      sub_assembly: [] as any[],
      accessory: [] as any[]
    };

    sentMaterials.forEach(sentItem => {
      const bomItem = bom.find(b => b.raw_material_id === sentItem.raw_material_id);
      if (bomItem) {
        const materialData = {
          ...sentItem,
          bom_type: bomItem.bom_type,
          required_quantity: bomItem.quantity * (productionData?.quantity || 1)
        };

        if (bomItem.bom_type === 'main_assembly') {
          materialsByType.main_assembly.push(materialData);
        } else if (bomItem.bom_type === 'sub_assembly') {
          materialsByType.sub_assembly.push(materialData);
        } else if (bomItem.bom_type === 'accessory') {
          materialsByType.accessory.push(materialData);
        }
      }
    });

    return materialsByType;
  };

  // Calculate pending quantities
  const calculatePendingQuantity = (required: number, sent: number) => {
    return Math.max(0, required - sent);
  };

  // Get line schedule information
  const getLineSchedule = (lineName: string) => {
    const lineOrders = lineStatus.filter(order => {
      const lines = order.production_lines || {};
      return Object.values(lines).includes(lineName);
    });

    const ongoing = lineOrders.find(order => order.status === "IN_PROGRESS");
    const scheduled = lineOrders.filter(order => order.status === "SCHEDULED");

    return { ongoing, scheduled };
  };

  // Update production line assignments
  const updateLineAssignmentsMutation = useMutation({
    mutationFn: async (assignments: any) => {
      const { error } = await supabase
        .from("production_orders")
        .update({
          production_lines: assignments,
          status: "SCHEDULED"
        })
        .eq("id", productionOrderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Production Lines Assigned",
        description: "Production line assignments have been saved and order scheduled",
      });
      queryClient.invalidateQueries({ queryKey: ["production-line-status"] });
    },
  });

  const handleLineAssignment = (assemblyType: string, lineName: string) => {
    setLineAssignments(prev => ({
      ...prev,
      [assemblyType]: lineName
    }));
  };

  const handleSaveAssignments = () => {
    if (!lineAssignments.main_assembly && !lineAssignments.sub_assembly && !lineAssignments.accessory) {
      toast({
        title: "No Lines Assigned",
        description: "Please assign at least one production line",
        variant: "destructive",
      });
      return;
    }

    updateLineAssignmentsMutation.mutate(lineAssignments);
  };

  const materialsByType = groupMaterialsByType();

  const renderAssemblySection = (sectionName: string, sectionKey: string, materials: any[]) => {
    const lineSchedule = lineAssignments[sectionKey] ? getLineSchedule(lineAssignments[sectionKey]) : null;

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              {sectionName}
              <Badge variant="secondary">{materials.length} materials</Badge>
            </div>
            <Select
              value={lineAssignments[sectionKey]}
              onValueChange={(value) => handleLineAssignment(sectionKey, value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Assign Production Line" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCTION_LINES.map((line) => (
                  <SelectItem key={line} value={line}>
                    {line}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {materials.length > 0 ? (
            <div className="space-y-2">
              {materials.map((material) => {
                const pending = calculatePendingQuantity(material.required_quantity, material.actual_quantity);
                return (
                  <div key={material.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <span className="font-mono text-sm">{material.raw_materials.material_code}</span>
                      <p className="text-sm text-muted-foreground">{material.raw_materials.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        Sent: <span className="font-medium text-green-600">{material.actual_quantity}</span>
                      </p>
                      {pending > 0 && (
                        <p className="text-sm">
                          Pending: <span className="font-medium text-orange-600">{pending}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No materials sent for this assembly</p>
          )}

          {lineSchedule && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Line Schedule: {lineAssignments[sectionKey]}</h4>
              {lineSchedule.ongoing && (
                <div className="mb-2">
                  <Badge variant="default" className="mr-2">Ongoing</Badge>
                  <span className="text-sm">{lineSchedule.ongoing.voucher_number} - {lineSchedule.ongoing.products?.name}</span>
                </div>
              )}
              {lineSchedule.scheduled.length > 0 && (
                <div>
                  <Badge variant="secondary" className="mr-2">Queue ({lineSchedule.scheduled.length})</Badge>
                  <span className="text-sm">{lineSchedule.scheduled.map(o => o.voucher_number).join(", ")}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Production Line Assignment - {productionData?.voucher_number}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Product</p>
              <p className="font-medium">{productionData?.products?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quantity</p>
              <p className="font-medium">{productionData?.quantity}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {renderAssemblySection("Main Assembly", "main_assembly", materialsByType.main_assembly)}
      {renderAssemblySection("Sub Assembly", "sub_assembly", materialsByType.sub_assembly)}
      {renderAssemblySection("Accessory", "accessory", materialsByType.accessory)}

      <div className="flex justify-end">
        <Button 
          onClick={handleSaveAssignments}
          disabled={updateLineAssignmentsMutation.isPending}
          size="lg"
        >
          {updateLineAssignmentsMutation.isPending ? "Saving..." : "Save Line Assignments & Schedule"}
        </Button>
      </div>
    </div>
  );
};

export default ProductionLineManager;
