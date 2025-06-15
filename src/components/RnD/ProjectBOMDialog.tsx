
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Upload, FileText, Trash2, Edit } from "lucide-react";

interface ProjectBOMDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

interface BOMItem {
  id?: string;
  material_name: string;
  material_code: string;
  description: string;
  quantity: number;
  unit: string;
  material_status: string;
  vendor_name: string;
  vendor_contact: string;
  expected_due_date: string;
  specification_sheet_url: string;
  notes: string;
  is_critical: boolean;
  cost_estimate: string;
  lead_time_days: string;
}

const ProjectBOMDialog = ({ isOpen, onClose, projectId, projectName }: ProjectBOMDialogProps) => {
  const [editingItem, setEditingItem] = useState<BOMItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch project BOM
  const { data: projectBOM } = useQuery({
    queryKey: ['project-bom', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_project_bom')
        .select('*')
        .eq('npd_project_id', projectId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: isOpen
  });

  // Fetch BOM materials
  const { data: bomMaterials, isLoading } = useQuery({
    queryKey: ['bom-materials', projectBOM?.id],
    queryFn: async () => {
      if (!projectBOM?.id) return [];
      
      const { data, error } = await supabase
        .from('npd_bom_materials')
        .select('*')
        .eq('npd_project_bom_id', projectBOM.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!projectBOM?.id
  });

  // Create BOM mutation
  const createBOMMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('npd_project_bom')
        .insert([{
          npd_project_id: projectId,
          bom_name: `${projectName} BOM`,
          description: `Bill of Materials for ${projectName}`
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-bom', projectId] });
      toast({
        title: "Success",
        description: "Project BOM created successfully"
      });
    }
  });

  // Add/Update material mutation
  const saveMaterialMutation = useMutation({
    mutationFn: async (material: BOMItem) => {
      let bomId = projectBOM?.id;
      
      if (!bomId) {
        const bomData = await createBOMMutation.mutateAsync();
        bomId = bomData.id;
      }

      let specUrl = material.specification_sheet_url;
      
      // Upload specification sheet if provided
      if (selectedFile) {
        const fileName = `${projectId}/${Date.now()}_${selectedFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('npd-specifications')
          .upload(fileName, selectedFile);
        
        if (uploadError) throw uploadError;
        specUrl = fileName;
      }

      const materialData = {
        ...material,
        npd_project_bom_id: bomId,
        specification_sheet_url: specUrl,
        cost_estimate: material.cost_estimate ? parseFloat(material.cost_estimate) : null,
        lead_time_days: material.lead_time_days ? parseInt(material.lead_time_days) : null
      };

      if (material.id) {
        const { data, error } = await supabase
          .from('npd_bom_materials')
          .update(materialData)
          .eq('id', material.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('npd_bom_materials')
          .insert([materialData])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-materials'] });
      queryClient.invalidateQueries({ queryKey: ['project-bom', projectId] });
      setEditingItem(null);
      setShowAddForm(false);
      setSelectedFile(null);
      toast({
        title: "Success",
        description: "Material saved successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save material",
        variant: "destructive"
      });
    }
  });

  // Delete material mutation
  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      const { error } = await supabase
        .from('npd_bom_materials')
        .delete()
        .eq('id', materialId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-materials'] });
      toast({
        title: "Success",
        description: "Material deleted successfully"
      });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UNDER_DEVELOPMENT': return 'bg-yellow-100 text-yellow-800';
      case 'SAMPLE_RECEIVED': return 'bg-blue-100 text-blue-800';
      case 'FINALISED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a PDF file",
        variant: "destructive"
      });
    }
  };

  const convertDatabaseItemToBOMItem = (dbItem: any): BOMItem => {
    return {
      ...dbItem,
      cost_estimate: dbItem.cost_estimate ? dbItem.cost_estimate.toString() : '',
      lead_time_days: dbItem.lead_time_days ? dbItem.lead_time_days.toString() : ''
    };
  };

  const renderMaterialForm = (material: BOMItem, isEdit: boolean = false) => (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Material Name *</Label>
          <Input
            value={material.material_name}
            onChange={(e) => setEditingItem({ ...material, material_name: e.target.value })}
            placeholder="Enter material name"
          />
        </div>
        <div className="space-y-2">
          <Label>Material Code</Label>
          <Input
            value={material.material_code}
            onChange={(e) => setEditingItem({ ...material, material_code: e.target.value })}
            placeholder="Enter material code"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={material.description}
          onChange={(e) => setEditingItem({ ...material, description: e.target.value })}
          placeholder="Describe the material and its specifications"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Quantity *</Label>
          <Input
            type="number"
            value={material.quantity}
            onChange={(e) => setEditingItem({ ...material, quantity: parseInt(e.target.value) || 1 })}
            min="1"
          />
        </div>
        <div className="space-y-2">
          <Label>Unit</Label>
          <Input
            value={material.unit}
            onChange={(e) => setEditingItem({ ...material, unit: e.target.value })}
            placeholder="PCS, KG, M"
          />
        </div>
        <div className="space-y-2">
          <Label>Material Status *</Label>
          <Select 
            value={material.material_status} 
            onValueChange={(value) => setEditingItem({ ...material, material_status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNDER_DEVELOPMENT">Under Development</SelectItem>
              <SelectItem value="SAMPLE_RECEIVED">Sample Received</SelectItem>
              <SelectItem value="FINALISED">Finalised</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Vendor Name</Label>
          <Input
            value={material.vendor_name}
            onChange={(e) => setEditingItem({ ...material, vendor_name: e.target.value })}
            placeholder="Enter vendor name"
          />
        </div>
        <div className="space-y-2">
          <Label>Vendor Contact</Label>
          <Input
            value={material.vendor_contact}
            onChange={(e) => setEditingItem({ ...material, vendor_contact: e.target.value })}
            placeholder="Phone/Email"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Expected Due Date</Label>
          <Input
            type="date"
            value={material.expected_due_date}
            onChange={(e) => setEditingItem({ ...material, expected_due_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Cost Estimate</Label>
          <Input
            type="number"
            step="0.01"
            value={material.cost_estimate}
            onChange={(e) => setEditingItem({ ...material, cost_estimate: e.target.value })}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label>Lead Time (Days)</Label>
          <Input
            type="number"
            value={material.lead_time_days}
            onChange={(e) => setEditingItem({ ...material, lead_time_days: e.target.value })}
            placeholder="Days"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Specification Sheet (PDF)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="flex-1"
          />
          {selectedFile && (
            <span className="text-sm text-green-600">
              <FileText className="h-4 w-4 inline mr-1" />
              {selectedFile.name}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={material.notes}
          onChange={(e) => setEditingItem({ ...material, notes: e.target.value })}
          placeholder="Additional notes about this material"
          rows={2}
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="critical"
          checked={material.is_critical}
          onChange={(e) => setEditingItem({ ...material, is_critical: e.target.checked })}
          className="rounded"
        />
        <Label htmlFor="critical">Critical Material</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => {
          setEditingItem(null);
          setShowAddForm(false);
          setSelectedFile(null);
        }}>
          Cancel
        </Button>
        <Button 
          onClick={() => saveMaterialMutation.mutate(material)}
          disabled={saveMaterialMutation.isPending || !material.material_name}
        >
          {saveMaterialMutation.isPending ? 'Saving...' : (isEdit ? 'Update' : 'Add')} Material
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Project BOM - {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!projectBOM && (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No BOM created for this project yet</p>
              <Button onClick={() => createBOMMutation.mutate()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project BOM
              </Button>
            </div>
          )}

          {projectBOM && (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{projectBOM.bom_name}</h3>
                  <p className="text-sm text-muted-foreground">Version {projectBOM.version}</p>
                </div>
                <Button onClick={() => {
                  setEditingItem({
                    material_name: '',
                    material_code: '',
                    description: '',
                    quantity: 1,
                    unit: 'PCS',
                    material_status: 'UNDER_DEVELOPMENT',
                    vendor_name: '',
                    vendor_contact: '',
                    expected_due_date: '',
                    specification_sheet_url: '',
                    notes: '',
                    is_critical: false,
                    cost_estimate: '',
                    lead_time_days: ''
                  });
                  setShowAddForm(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </div>

              {(showAddForm || editingItem) && editingItem && (
                <div>
                  <h4 className="font-medium mb-4">
                    {editingItem.id ? 'Edit Material' : 'Add New Material'}
                  </h4>
                  {renderMaterialForm(editingItem, !!editingItem.id)}
                </div>
              )}

              {isLoading ? (
                <div className="text-center py-8">Loading materials...</div>
              ) : bomMaterials?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4" />
                  <p>No materials added to this BOM yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bomMaterials?.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{material.material_name}</div>
                            <div className="text-sm text-muted-foreground">{material.material_code}</div>
                            {material.is_critical && (
                              <Badge variant="destructive" className="text-xs mt-1">Critical</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{material.quantity} {material.unit}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(material.material_status)}>
                            {formatStatus(material.material_status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{material.vendor_name || 'TBD'}</TableCell>
                        <TableCell>
                          {material.expected_due_date ? 
                            new Date(material.expected_due_date).toLocaleDateString() : 
                            'TBD'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingItem(convertDatabaseItemToBOMItem(material))}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMaterialMutation.mutate(material.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectBOMDialog;
