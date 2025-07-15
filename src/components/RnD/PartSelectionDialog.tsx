import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Search } from 'lucide-react';

interface PartSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bomId?: string;
  onPartAdded: () => void;
}

interface NewPart {
  material_name: string;
  description: string;
  expected_function: string;
  quantity: number;
  unit: string;
  vendor_name: string;
  vendor_contact: string;
  cost_estimate?: number;
  lead_time_days?: number;
  sample_target_date?: string;
  specifications: string;
  is_critical: boolean;
  category: string;
}

export const PartSelectionDialog: React.FC<PartSelectionDialogProps> = ({
  isOpen,
  onClose,
  bomId,
  onPartAdded
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExistingPart, setSelectedExistingPart] = useState<any>(null);
  const [newPart, setNewPart] = useState<NewPart>({
    material_name: '',
    description: '',
    expected_function: '',
    quantity: 1,
    unit: 'PCS',
    vendor_name: '',
    vendor_contact: '',
    specifications: '',
    is_critical: false,
    category: 'ic'
  });
  const { toast } = useToast();

  // Fetch existing raw materials
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['raw-materials-search', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('raw_materials')
        .select('*')
        .limit(50);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,material_code.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen
  });

  // Add existing part mutation
  const addExistingPartMutation = useMutation({
    mutationFn: async ({ partId, quantity }: { partId: string; quantity: number }) => {
      const part = rawMaterials.find(p => p.id === partId);
      if (!part) throw new Error('Part not found');

      const { error } = await supabase
        .from('npd_bom_materials')
        .insert({
          npd_project_bom_id: bomId,
          material_name: part.name,
          material_code: part.material_code,
          quantity,
          unit: 'PCS',
          specifications: part.specification,
          part_type: 'EXISTING',
          is_temporary_part: false,
          part_status: 'FINALIZED_AND_CODED'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Existing part added successfully" });
      onPartAdded();
    },
    onError: (error) => {
      toast({ title: "Error adding part", description: error.message, variant: "destructive" });
    }
  });

  // Add new uncoded part mutation
  const addNewPartMutation = useMutation({
    mutationFn: async (partData: NewPart) => {
      // Generate temporary part code
      const { data: tempCode, error: codeError } = await supabase
        .rpc('generate_temp_part_code', { part_category: partData.category });

      if (codeError) throw codeError;

      const { data: materialData, error: materialError } = await supabase
        .from('npd_bom_materials')
        .insert({
          npd_project_bom_id: bomId,
          material_name: partData.material_name,
          description: partData.description,
          expected_function: partData.expected_function,
          quantity: partData.quantity,
          unit: partData.unit,
          vendor_name: partData.vendor_name,
          vendor_contact: partData.vendor_contact,
          cost_estimate: partData.cost_estimate,
          lead_time_days: partData.lead_time_days,
          sample_target_date: partData.sample_target_date,
          specifications: partData.specifications,
          is_critical: partData.is_critical,
          part_type: 'NEW_UNCODED',
          is_temporary_part: true,
          temporary_part_code: tempCode,
          part_status: 'UNDER_DEVELOPMENT'
        })
        .select()
        .single();

      if (materialError) throw materialError;

      // Create initial sample tracking record
      await supabase
        .from('npd_sample_tracking')
        .insert({
          npd_bom_material_id: materialData.id,
          sample_request_date: new Date().toISOString().split('T')[0],
          created_by: (await supabase.auth.getUser()).data.user?.id
        });
    },
    onSuccess: () => {
      toast({ title: "New part added successfully" });
      setNewPart({
        material_name: '',
        description: '',
        expected_function: '',
        quantity: 1,
        unit: 'PCS',
        vendor_name: '',
        vendor_contact: '',
        specifications: '',
        is_critical: false,
        category: 'ic'
      });
      onPartAdded();
    },
    onError: (error) => {
      toast({ title: "Error adding new part", description: error.message, variant: "destructive" });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Material to BOM
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="existing" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Coded Parts</TabsTrigger>
            <TabsTrigger value="new">New Uncoded Parts</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by part name or code..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {rawMaterials.map((material) => (
                  <Card
                    key={material.id}
                    className={`cursor-pointer transition-colors ${
                      selectedExistingPart?.id === material.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedExistingPart(material)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{material.name}</h4>
                          <p className="text-sm text-muted-foreground">{material.material_code}</p>
                          <p className="text-xs text-muted-foreground">{material.specification}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p>{material.category}</p>
                          <p className="text-muted-foreground">PCS</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedExistingPart && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add to BOM</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Selected Part: {selectedExistingPart.name}</Label>
                    </div>
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        defaultValue="1"
                        onChange={(e) => setSelectedExistingPart({
                          ...selectedExistingPart,
                          quantity: parseInt(e.target.value)
                        })}
                      />
                    </div>
                    <Button
                      onClick={() => addExistingPartMutation.mutate({
                        partId: selectedExistingPart.id,
                        quantity: selectedExistingPart.quantity || 1
                      })}
                      disabled={addExistingPartMutation.isPending}
                    >
                      Add to BOM
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>New Uncoded Part Details</CardTitle>
                <CardDescription>
                  Add a new part that needs to be developed or sourced
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="material_name">Material Name *</Label>
                    <Input
                      id="material_name"
                      value={newPart.material_name}
                      onChange={(e) => setNewPart({ ...newPart, material_name: e.target.value })}
                      placeholder="e.g., STM32F4 Microcontroller"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={newPart.category}
                      onValueChange={(value) => setNewPart({ ...newPart, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ic">IC / Integrated Circuit</SelectItem>
                        <SelectItem value="pcb">PCB / Circuit Board</SelectItem>
                        <SelectItem value="resistor">Resistor</SelectItem>
                        <SelectItem value="capacitor">Capacitor</SelectItem>
                        <SelectItem value="connector">Connector</SelectItem>
                        <SelectItem value="mechanical">Mechanical</SelectItem>
                        <SelectItem value="packaging">Packaging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newPart.description}
                    onChange={(e) => setNewPart({ ...newPart, description: e.target.value })}
                    placeholder="Detailed description of the part"
                  />
                </div>

                <div>
                  <Label htmlFor="expected_function">Expected Function</Label>
                  <Textarea
                    id="expected_function"
                    value={newPart.expected_function}
                    onChange={(e) => setNewPart({ ...newPart, expected_function: e.target.value })}
                    placeholder="What function should this part perform?"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={newPart.quantity}
                      onChange={(e) => setNewPart({ ...newPart, quantity: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={newPart.unit}
                      onValueChange={(value) => setNewPart({ ...newPart, unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PCS">PCS</SelectItem>
                        <SelectItem value="KG">KG</SelectItem>
                        <SelectItem value="M">Meters</SelectItem>
                        <SelectItem value="L">Liters</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sample_target_date">Sample Target Date</Label>
                    <Input
                      id="sample_target_date"
                      type="date"
                      value={newPart.sample_target_date}
                      onChange={(e) => setNewPart({ ...newPart, sample_target_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vendor_name">Vendor Name</Label>
                    <Input
                      id="vendor_name"
                      value={newPart.vendor_name}
                      onChange={(e) => setNewPart({ ...newPart, vendor_name: e.target.value })}
                      placeholder="Primary vendor for development"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vendor_contact">Vendor Contact</Label>
                    <Input
                      id="vendor_contact"
                      value={newPart.vendor_contact}
                      onChange={(e) => setNewPart({ ...newPart, vendor_contact: e.target.value })}
                      placeholder="Contact information"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cost_estimate">Cost Estimate (₹)</Label>
                    <Input
                      id="cost_estimate"
                      type="number"
                      step="0.01"
                      value={newPart.cost_estimate || ''}
                      onChange={(e) => setNewPart({ ...newPart, cost_estimate: parseFloat(e.target.value) })}
                      placeholder="Estimated cost per unit"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead_time_days">Lead Time (Days)</Label>
                    <Input
                      id="lead_time_days"
                      type="number"
                      value={newPart.lead_time_days || ''}
                      onChange={(e) => setNewPart({ ...newPart, lead_time_days: parseInt(e.target.value) })}
                      placeholder="Expected lead time"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="specifications">Specifications</Label>
                  <Textarea
                    id="specifications"
                    value={newPart.specifications}
                    onChange={(e) => setNewPart({ ...newPart, specifications: e.target.value })}
                    placeholder="Technical specifications and requirements"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_critical"
                    checked={newPart.is_critical}
                    onChange={(e) => setNewPart({ ...newPart, is_critical: e.target.checked })}
                  />
                  <Label htmlFor="is_critical">Mark as Critical Part</Label>
                </div>

                <Button
                  onClick={() => addNewPartMutation.mutate(newPart)}
                  disabled={!newPart.material_name || addNewPartMutation.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Part to BOM
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};