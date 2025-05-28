
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface BOMItem {
  raw_material_id: string;
  raw_material_name: string;
  bom_type: "main_assembly" | "sub_assembly" | "accessory";
  quantity: number;
}

interface BOMFormProps {
  bomItems: BOMItem[];
  onBOMChange: (items: BOMItem[]) => void;
}

export function BOMForm({ bomItems, onBOMChange }: BOMFormProps) {
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedType, setSelectedType] = useState<"main_assembly" | "sub_assembly" | "accessory">("main_assembly");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchRawMaterials();
  }, []);

  const fetchRawMaterials = async () => {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching raw materials:', error);
    } else {
      setRawMaterials(data || []);
    }
  };

  const addBOMItem = () => {
    if (!selectedMaterial || quantity <= 0) return;

    const material = rawMaterials.find(m => m.id === selectedMaterial);
    if (!material) return;

    // Check if this combination already exists
    const exists = bomItems.some(item => 
      item.raw_material_id === selectedMaterial && item.bom_type === selectedType
    );

    if (exists) {
      alert("This material is already added for this BOM type");
      return;
    }

    const newItem: BOMItem = {
      raw_material_id: selectedMaterial,
      raw_material_name: material.name,
      bom_type: selectedType,
      quantity
    };

    onBOMChange([...bomItems, newItem]);
    setSelectedMaterial("");
    setQuantity(1);
  };

  const removeBOMItem = (index: number) => {
    const updatedItems = bomItems.filter((_, i) => i !== index);
    onBOMChange(updatedItems);
  };

  const getBOMTypeColor = (type: string) => {
    switch (type) {
      case "main_assembly": return "bg-blue-100 text-blue-800";
      case "sub_assembly": return "bg-green-100 text-green-800";
      case "accessory": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const hasAllBOMTypes = () => {
    const types = bomItems.map(item => item.bom_type);
    return ["main_assembly", "sub_assembly", "accessory"].every(type => types.includes(type as any));
  };

  const getBOMItemsByType = (type: string) => {
    return bomItems.filter(item => item.bom_type === type);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bill of Materials (BOM)</CardTitle>
        <p className="text-sm text-muted-foreground">
          All three types (Main Assembly, Sub Assembly, Accessory) are required to create a product.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add BOM Item Form */}
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Raw Material</Label>
            <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {rawMaterials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name} ({material.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>BOM Type</Label>
            <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main_assembly">Main Assembly</SelectItem>
                <SelectItem value="sub_assembly">Sub Assembly</SelectItem>
                <SelectItem value="accessory">Accessory</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={addBOMItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        {/* BOM Items by Type */}
        {["main_assembly", "sub_assembly", "accessory"].map((type) => (
          <div key={type} className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium capitalize">{type.replace('_', ' ')}</h4>
              <Badge className={getBOMTypeColor(type)}>
                {getBOMItemsByType(type).length} items
              </Badge>
            </div>
            <div className="grid gap-2">
              {getBOMItemsByType(type).map((item, index) => {
                const itemIndex = bomItems.findIndex(bomItem => 
                  bomItem.raw_material_id === item.raw_material_id && 
                  bomItem.bom_type === item.bom_type
                );
                return (
                  <div key={`${item.raw_material_id}-${item.bom_type}`} 
                       className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>{item.raw_material_name} (Qty: {item.quantity})</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBOMItem(itemIndex)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {getBOMItemsByType(type).length === 0 && (
                <div className="p-2 text-center text-muted-foreground bg-gray-50 rounded">
                  No items added for {type.replace('_', ' ')}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Validation Message */}
        {!hasAllBOMTypes() && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            ⚠️ Please add at least one item for each BOM type (Main Assembly, Sub Assembly, Accessory) to proceed.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
