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

  // npd_project_bom is gone — npd_bom_materials now hangs off the project
  // directly, and the stage lives on npd_projects.stage (npd_stage enum).
  const { data: projectBOM, isLoading } = useQuery({
    queryKey: ['npd-project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_projects')
        .select('id, project_name, stage')
        .eq('id', projectId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!projectId
  });

  // Fetch BOM materials
  const { data: bomMaterials = [] } = useQuery({
    queryKey: ['npd-bom-materials', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('npd_bom_materials')
        .select(`
          *,
          parts (part_code, name),
          vendors (name)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId
  });

  // There is no separate BOM header table any more, so a BOM always "exists"
  // for a project; the old createBOMMutation has nothing to create.

  // Stage transition mutation — writes npd_projects.stage.
  // npd_bom_stage_history has no replacement, so transitions are not logged.
  const stageTransitionMutation = useMutation({
    mutationFn: async ({ newStage }: { bomId: string; newStage: string; notes?: string }) => {
      const { error } = await supabase
        .from('npd_projects')
        .update({ stage: newStage as any })
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npd-project', projectId] });
      toast({ title: "Stage updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating stage", description: error.message, variant: "destructive" });
    }
  });

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'CONCEPT': return 'bg-slate-100 text-slate-800';
      case 'DESIGN': return 'bg-blue-100 text-blue-800';
      case 'BOM': return 'bg-blue-100 text-blue-800';
      case 'SAMPLE': return 'bg-yellow-100 text-yellow-800';
      case 'VALIDATION': return 'bg-orange-100 text-orange-800';
      case 'LAUNCHED': return 'bg-green-100 text-green-800';
      case 'DROPPED': return 'bg-red-100 text-red-800';
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
    // "coded" now simply means the material is linked to a real part row.
    if (filterStatus === 'CODED') return !!material.part_id;
    if (filterStatus === 'UNCODED') return !material.part_id;
    return material.status === filterStatus;
  });

  const exportBOM = async (format: 'csv' | 'excel') => {
    const csvData = bomMaterials.map(material => ({
      'Part Code': material.proposed_part_code || material.parts?.part_code || 'N/A',
      'Material Name': material.description,
      'Quantity': material.quantity,
      'Unit': material.uom,
      'Status': material.status,
      'Vendor': material.vendors?.name || 'TBD',
      'Target Price': material.target_price ?? 'TBD'
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_BOM_${projectBOM?.stage || 'Export'}.csv`;
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
                <Badge className={getStageColor(projectBOM.stage)}>
                  {projectBOM.stage}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {!projectBOM ? (
            <Card className="p-6">
              <CardHeader>
                <CardTitle>Project not found</CardTitle>
                <CardDescription>
                  This NPD project no longer exists, so its BOM cannot be shown.
                </CardDescription>
              </CardHeader>
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
                      Coded ({bomMaterials.filter(m => !!m.part_id).length})
                    </Button>
                    <Button
                      variant={filterStatus === 'UNCODED' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterStatus('UNCODED')}
                    >
                      Uncoded ({bomMaterials.filter(m => !m.part_id).length})
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {filteredMaterials.map((material) => (
                    <Card key={material.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{material.description}</h4>
                            <Badge className={getStatusColor(material.status)}>
                              {String(material.status ?? '').replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {material.proposed_part_code || material.parts?.part_code || 'No code assigned'}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Quantity:</span> {material.quantity} {material.uom}
                            </div>
                            <div>
                              <span className="font-medium">Vendor:</span> {material.vendors?.name || 'TBD'}
                            </div>
                            <div>
                              <span className="font-medium">Target Price:</span> ₹{material.target_price ?? 'TBD'}
                            </div>
                          </div>
                          {material.notes && (
                            <div className="text-sm">
                              <span className="font-medium">Notes:</span> {material.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!material.part_id && (
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
                <SampleTrackingView bomId={projectId} />
              </TabsContent>

              <TabsContent value="stages">
                <BOMStageManager
                  bomId={projectId}
                  currentStage={projectBOM.stage}
                  onStageTransition={(newStage, notes) =>
                    stageTransitionMutation.mutate({ bomId: projectId, newStage, notes })
                  }
                />
              </TabsContent>

              <TabsContent value="collaboration">
                <CollaborationPanel bomId={projectId} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <PartSelectionDialog
        isOpen={showPartSelection}
        onClose={() => setShowPartSelection(false)}
        bomId={projectId}
        onPartAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['npd-bom-materials', projectId] });
          setShowPartSelection(false);
        }}
      />

      {/*
        Sample rounds hang off the project, not off a single BOM line
        (npd_sample_tracking has project_id and sample_round, and no link to a
        material), so there is no per-material view to open. The Samples tab above
        shows the project's rounds.
      */}
    </>
  );
};