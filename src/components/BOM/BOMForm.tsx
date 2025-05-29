
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface BOMItem {
  raw_material_id: string;
  raw_material_name: string;
  raw_material_code: string;
  bom_type: "main_assembly" | "sub_assembly" | "accessory";
  quantity: number;
  is_critical?: boolean;
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
  const [isCritical, setIsCritical] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    fetchRawMaterials();
  }, []);

  const fetchRawMaterials = async () => {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('is_active', true)
      .order('material_code');
    
    if (error) {
      console.error('Error fetching raw materials:', error);
    } else {
      setRawMaterials(data || []);
    }
  };

  const filteredMaterials = rawMaterials.filter(material =>
    material.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    material.material_code.toLowerCase().includes(searchValue.toLowerCase()) ||
    material.category.toLowerCase().includes(searchValue.toLowerCase())
  );

  const selectedMaterialData = rawMaterials.find(m => m.id === selectedMaterial);

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
      raw_material_code: material.material_code,
      bom_type: selectedType,
      quantity,
      is_critical: isCritical
    };

    onBOMChange([...bomItems, newItem]);
    setSelectedMaterial("");
    setQuantity(1);
    setIsCritical(false);
    setSearchValue("");
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
        <div className="grid grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>Raw Material</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {selectedMaterialData
                    ? `${selectedMaterialData.material_code} - ${selectedMaterialData.name}`
                    : "Select material..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput
                    placeholder="Search by code, name, or category..."
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <CommandList>
                    <CommandEmpty>No material found.</CommandEmpty>
                    <CommandGroup>
                      {filteredMaterials.map((material) => (
                        <CommandItem
                          key={material.id}
                          value={`${material.material_code} ${material.name} ${material.category}`}
                          onSelect={() => {
                            setSelectedMaterial(material.id);
                            setOpen(false);
                            setSearchValue("");
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{material.material_code}</span>
                            <span className="text-sm text-muted-foreground">{material.name}</span>
                            <span className="text-xs text-muted-foreground">({material.category})</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
          <div className="space-y-2">
            <Label>Critical Component</Label>
            <div className="flex items-center space-x-2 h-10">
              <Checkbox
                id="critical"
                checked={isCritical}
                onCheckedChange={(checked) => setIsCritical(checked as boolean)}
              />
              <Label htmlFor="critical" className="text-sm">Mark as critical</Label>
            </div>
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
                       className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.raw_material_code}</span>
                        {item.is_critical && (
                          <Badge variant="destructive" className="text-xs">Critical</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {item.raw_material_name} (Qty: {item.quantity})
                      </span>
                    </div>
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
