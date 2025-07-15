import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Package, Settings, Clock, FileText, Users, Upload, Download } from 'lucide-react';
import { PartSelectionDialog } from './PartSelectionDialog';
import { SampleTrackingView } from './SampleTrackingView';
import { BOMStageManager } from './BOMStageManager';
import { CollaborationPanel } from './CollaborationPanel';

interface EnhancedProjectBOMDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export const EnhancedProjectBOMDialog: React.FC<EnhancedProjectBOMDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName
}) => {
  console.log('EnhancedProjectBOMDialog loaded successfully');
  const [showPartSelection, setShowPartSelection] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch project BOM
  const { data: projectBOM, isLoading } = useQuery({
    queryKey: ['npd-project-bom', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_project_bom')
        .select('*')
        .eq('npd_project_id', projectId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: isOpen && !!projectId
  });

  // Fetch BOM materials
  const { data: bomMaterials = [] } = useQuery({
    queryKey: ['npd-bom-materials', projectBOM?.id],
    queryFn: async () => {
      if (!projectBOM?.id) return [];
      
      const { data, error } = await supabase
        .from('npd_bom_materials')
        .select(`
          *,
          npd_sample_tracking (*)
        `)
        .eq('npd_project_bom_id', projectBOM.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectBOM?.id
  });

  // Create BOM mutation
  const createBOMMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('npd_project_bom')
        .insert({
          npd_project_id: projectId,
          bom_name: `${projectName} BOM`,
          description: 'NPD Project BOM',
          bom_stage: 'TEST_BOM'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npd-project-bom', projectId] });
      toast({ title: "BOM created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error creating BOM", description: error.message, variant: "destructive" });
    }
  });

  // Stage transition mutation
  const stageTransitionMutation = useMutation({
    mutationFn: async ({ bomId, newStage, notes }: { bomId: string; newStage: string; notes?: string }) => {
      const { error } = await supabase
        .from('npd_project_bom')
        .update({
          bom_stage: newStage,
          stage_updated_at: new Date().toISOString(),
          stage_updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', bomId);

      if (error) throw error;

      // Record stage history
      await supabase
        .from('npd_bom_stage_history')
        .insert({
          npd_project_bom_id: bomId,
          from_stage: projectBOM?.bom_stage,
          to_stage: newStage,
          transition_by: (await supabase.auth.getUser()).data.user?.id,
          notes
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npd-project-bom', projectId] });
      toast({ title: "Stage updated successfully" });
    }
  });

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'TEST_BOM': return 'bg-blue-100 text-blue-800';
      case 'SAMPLING_STAGE': return 'bg-yellow-100 text-yellow-800';
      case 'TESTING_STAGE': return 'bg-orange-100 text-orange-800';
      case 'PP_STAGE': return 'bg-purple-100 text-purple-800';
      case 'MP_STAGE': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UNDER_DEVELOPMENT': return 'bg-blue-100 text-blue-800';
      case 'SAMPLE_SENT': return 'bg-yellow-100 text-yellow-800';
      case 'SAMPLE_RECEIVED': return 'bg-orange-100 text-orange-800';
      case 'SAMPLE_APPROVED': return 'bg-green-100 text-green-800';
      case 'SAMPLE_REJECTED': return 'bg-red-100 text-red-800';
      case 'FINALIZED_AND_CODED': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredMaterials = bomMaterials.filter(material => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'CODED') return !material.is_temporary_part;
    if (filterStatus === 'UNCODED') return material.is_temporary_part;
    return material.part_status === filterStatus;
  });

  const exportBOM = async (format: 'csv' | 'excel') => {
    const csvData = bomMaterials.map(material => ({
      'Part Code': material.temporary_part_code || material.material_code || 'N/A',
      'Material Name': material.material_name,
      'Quantity': material.quantity,
      'Unit': material.unit,
      'Status': material.part_status,
      'Vendor': material.vendor_name || 'TBD',
      'Cost Estimate': material.cost_estimate || 'TBD',
      'Lead Time': material.lead_time_days || 'TBD',
      'Critical': material.is_critical ? 'Yes' : 'No'
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_BOM_${projectBOM?.bom_stage || 'Export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {projectName} - BOM Management
              {projectBOM && (
                <Badge className={getStageColor(projectBOM.bom_stage)}>
                  {projectBOM.bom_stage.replace('_', ' ')}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {!projectBOM ? (
            <Card className="p-6">
              <CardHeader>
                <CardTitle>No BOM Found</CardTitle>
                <CardDescription>
                  Create a BOM to start managing materials for this NPD project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => createBOMMutation.mutate()}>
                  Create BOM
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="materials" className="space-y-4">
              <TabsList>
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="samples">Sample Tracking</TabsTrigger>
                <TabsTrigger value="stages">Stage Management</TabsTrigger>
                <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
              </TabsList>

              <TabsContent value="materials" className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex gap-2">
                    <Button onClick={() => setShowPartSelection(true)}>
                      Add Material
                    </Button>
                    <Button variant="outline" onClick={() => exportBOM('csv')}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={filterStatus === 'ALL' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterStatus('ALL')}
                    >
                      All ({bomMaterials.length})
                    </Button>
                    <Button
                      variant={filterStatus === 'CODED' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterStatus('CODED')}
                    >
                      Coded ({bomMaterials.filter(m => !m.is_temporary_part).length})
                    </Button>
                    <Button
                      variant={filterStatus === 'UNCODED' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterStatus('UNCODED')}
                    >
                      Uncoded ({bomMaterials.filter(m => m.is_temporary_part).length})
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {filteredMaterials.map((material) => (
                    <Card key={material.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{material.material_name}</h4>
                            <Badge className={getStatusColor(material.part_status)}>
                              {material.part_status.replace('_', ' ')}
                            </Badge>
                            {material.is_critical && (
                              <Badge variant="destructive">Critical</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {material.temporary_part_code || material.material_code || 'No code assigned'}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Quantity:</span> {material.quantity} {material.unit}
                            </div>
                            <div>
                              <span className="font-medium">Vendor:</span> {material.vendor_name || 'TBD'}
                            </div>
                            <div>
                              <span className="font-medium">Lead Time:</span> {material.lead_time_days || 'TBD'} days
                            </div>
                            <div>
                              <span className="font-medium">Cost:</span> ₹{material.cost_estimate || 'TBD'}
                            </div>
                          </div>
                          {material.expected_function && (
                            <div className="text-sm">
                              <span className="font-medium">Function:</span> {material.expected_function}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {material.is_temporary_part && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedMaterialId(material.id)}
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Track Sample
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {filteredMaterials.length === 0 && (
                    <Card className="p-8 text-center text-muted-foreground">
                      No materials found matching the current filter
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="samples">
                <SampleTrackingView bomId={projectBOM.id} />
              </TabsContent>

              <TabsContent value="stages">
                <BOMStageManager
                  bomId={projectBOM.id}
                  currentStage={projectBOM.bom_stage}
                  onStageTransition={(newStage, notes) => 
                    stageTransitionMutation.mutate({ bomId: projectBOM.id, newStage, notes })
                  }
                />
              </TabsContent>

              <TabsContent value="collaboration">
                <CollaborationPanel bomId={projectBOM.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <PartSelectionDialog
        isOpen={showPartSelection}
        onClose={() => setShowPartSelection(false)}
        bomId={projectBOM?.id}
        onPartAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['npd-bom-materials', projectBOM?.id] });
          setShowPartSelection(false);
        }}
      />

      {selectedMaterialId && (
        <SampleTrackingView
          bomId={projectBOM?.id}
          materialId={selectedMaterialId}
          onClose={() => setSelectedMaterialId(null)}
        />
      )}
    </>
  );
};