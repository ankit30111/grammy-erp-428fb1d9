import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, Package, CheckCircle, XCircle, AlertTriangle, Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface SampleTrackingViewProps {
  bomId?: string;
  materialId?: string;
  onClose?: () => void;
}

export const SampleTrackingView: React.FC<SampleTrackingViewProps> = ({
  bomId,
  materialId,
  onClose
}) => {
  const [selectedSample, setSelectedSample] = useState<any>(null);
  const [updateData, setUpdateData] = useState<any>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sample tracking data
  const { data: sampleData = [] } = useQuery({
    queryKey: ['npd-sample-tracking', bomId, materialId],
    queryFn: async () => {
      let query = supabase
        .from('npd_sample_tracking')
        .select(`
          *,
          npd_bom_materials (
            id,
            material_name,
            temporary_part_code,
            vendor_name,
            part_status,
            sample_target_date,
            is_critical
          )
        `);

      if (materialId) {
        query = query.eq('npd_bom_material_id', materialId);
      } else if (bomId) {
        query = query.eq('npd_bom_materials.npd_project_bom_id', bomId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!(bomId || materialId)
  });

  // Update sample status mutation
  const updateSampleMutation = useMutation({
    mutationFn: async ({ sampleId, updates, materialUpdates }: any) => {
      // Update sample tracking
      if (Object.keys(updates).length > 0) {
        const { error: sampleError } = await supabase
          .from('npd_sample_tracking')
          .update({
            ...updates,
            updated_by: (await supabase.auth.getUser()).data.user?.id
          })
          .eq('id', sampleId);

        if (sampleError) throw sampleError;
      }

      // Update material status if needed
      if (Object.keys(materialUpdates).length > 0) {
        const sample = sampleData.find(s => s.id === sampleId);
        if (sample) {
          const { error: materialError } = await supabase
            .from('npd_bom_materials')
            .update(materialUpdates)
            .eq('id', sample.npd_bom_material_id);

          if (materialError) throw materialError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npd-sample-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['npd-bom-materials'] });
      toast({ title: "Sample status updated successfully" });
      setSelectedSample(null);
      setUpdateData({});
    },
    onError: (error) => {
      toast({ title: "Error updating sample", description: error.message, variant: "destructive" });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'UNDER_DEVELOPMENT': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'SAMPLE_SENT': return <Package className="h-4 w-4 text-yellow-500" />;
      case 'SAMPLE_RECEIVED': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'SAMPLE_APPROVED': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'SAMPLE_REJECTED': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'FINALIZED_AND_CODED': return <CheckCircle className="h-4 w-4 text-purple-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UNDER_DEVELOPMENT': return 'bg-blue-100 text-blue-800';
      case 'SAMPLE_SENT': return 'bg-yellow-100 text-yellow-800';
      case 'SAMPLE_RECEIVED': return 'bg-green-100 text-green-800';
      case 'SAMPLE_APPROVED': return 'bg-green-100 text-green-800';
      case 'SAMPLE_REJECTED': return 'bg-red-100 text-red-800';
      case 'FINALIZED_AND_CODED': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (targetDate: string, currentStatus: string) => {
    if (!targetDate || ['SAMPLE_APPROVED', 'FINALIZED_AND_CODED'].includes(currentStatus)) return false;
    return differenceInDays(new Date(), new Date(targetDate)) > 0;
  };

  const handleStatusUpdate = (action: string) => {
    const sample = selectedSample;
    const material = sample?.npd_bom_materials;
    
    let sampleUpdates: any = {};
    let materialUpdates: any = {};
    const today = new Date().toISOString().split('T')[0];

    switch (action) {
      case 'SAMPLE_SENT':
        sampleUpdates.sample_sent_date = updateData.sample_sent_date || today;
        materialUpdates.part_status = 'SAMPLE_SENT';
        break;
      case 'SAMPLE_RECEIVED':
        sampleUpdates.sample_received_date = updateData.sample_received_date || today;
        materialUpdates.part_status = 'SAMPLE_RECEIVED';
        break;
      case 'SAMPLE_APPROVED':
        sampleUpdates.sample_approval_date = updateData.sample_approval_date || today;
        sampleUpdates.approval_notes = updateData.approval_notes;
        materialUpdates.part_status = 'SAMPLE_APPROVED';
        break;
      case 'SAMPLE_REJECTED':
        sampleUpdates.sample_rejection_date = updateData.sample_rejection_date || today;
        sampleUpdates.rejection_reason = updateData.rejection_reason;
        materialUpdates.part_status = 'SAMPLE_REJECTED';
        break;
      case 'FINALIZE_AND_CODE':
        materialUpdates.part_status = 'FINALIZED_AND_CODED';
        materialUpdates.final_part_code = updateData.final_part_code;
        materialUpdates.is_temporary_part = false;
        break;
    }

    if (updateData.quality_notes) {
      sampleUpdates.quality_notes = updateData.quality_notes;
    }

    updateSampleMutation.mutate({
      sampleId: sample.id,
      updates: sampleUpdates,
      materialUpdates
    });
  };

  const content = (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Sample Tracking</h3>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {sampleData.map((sample) => {
          const material = sample.npd_bom_materials;
          const isOverdueStatus = isOverdue(material?.sample_target_date, material?.part_status);

          return (
            <Card key={sample.id} className={`${isOverdueStatus ? 'border-red-200 bg-red-50' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(material?.part_status)}
                    <span>{material?.material_name}</span>
                    {material?.is_critical && (
                      <Badge variant="destructive">Critical</Badge>
                    )}
                  </div>
                  <Badge className={getStatusColor(material?.part_status)}>
                    {material?.part_status?.replace('_', ' ')}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {material?.temporary_part_code} • Vendor: {material?.vendor_name || 'TBD'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Request Date:</span>
                    <p>{sample.sample_request_date ? format(new Date(sample.sample_request_date), 'MMM dd, yyyy') : 'Not set'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Target Date:</span>
                    <p className={isOverdueStatus ? 'text-red-600 font-medium' : ''}>
                      {material?.sample_target_date ? format(new Date(material.sample_target_date), 'MMM dd, yyyy') : 'Not set'}
                      {isOverdueStatus && <span className="ml-1">⚠️</span>}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Sent Date:</span>
                    <p>{sample.sample_sent_date ? format(new Date(sample.sample_sent_date), 'MMM dd, yyyy') : 'Not sent'}</p>
                  </div>
                  <div>
                    <span className="font-medium">Received Date:</span>
                    <p>{sample.sample_received_date ? format(new Date(sample.sample_received_date), 'MMM dd, yyyy') : 'Not received'}</p>
                  </div>
                </div>

                {sample.quality_notes && (
                  <div>
                    <span className="font-medium">Quality Notes:</span>
                    <p className="text-sm text-muted-foreground">{sample.quality_notes}</p>
                  </div>
                )}

                {sample.rejection_reason && (
                  <div>
                    <span className="font-medium">Rejection Reason:</span>
                    <p className="text-sm text-red-600">{sample.rejection_reason}</p>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {material?.part_status === 'UNDER_DEVELOPMENT' && (
                    <Button size="sm" onClick={() => setSelectedSample(sample)}>
                      Mark as Sent
                    </Button>
                  )}
                  {material?.part_status === 'SAMPLE_SENT' && (
                    <Button size="sm" onClick={() => setSelectedSample(sample)}>
                      Mark as Received
                    </Button>
                  )}
                  {material?.part_status === 'SAMPLE_RECEIVED' && (
                    <>
                      <Button size="sm" onClick={() => setSelectedSample(sample)}>
                        Approve Sample
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedSample(sample)}>
                        Reject Sample
                      </Button>
                    </>
                  )}
                  {material?.part_status === 'SAMPLE_APPROVED' && (
                    <Button size="sm" onClick={() => setSelectedSample(sample)}>
                      Finalize & Code
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {sampleData.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            No sample tracking data found
          </Card>
        )}
      </div>
    </div>
  );

  if (materialId) {
    return (
      <>
        {content}
        
        {selectedSample && (
          <Dialog open={!!selectedSample} onOpenChange={() => setSelectedSample(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Sample Status</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">{selectedSample.npd_bom_materials?.material_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Current Status: {selectedSample.npd_bom_materials?.part_status?.replace('_', ' ')}
                  </p>
                </div>

                {selectedSample.npd_bom_materials?.part_status === 'UNDER_DEVELOPMENT' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sample_sent_date">Sample Sent Date</Label>
                      <Input
                        id="sample_sent_date"
                        type="date"
                        value={updateData.sample_sent_date || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setUpdateData({ ...updateData, sample_sent_date: e.target.value })}
                      />
                    </div>
                    <Button onClick={() => handleStatusUpdate('SAMPLE_SENT')}>
                      Mark as Sent
                    </Button>
                  </div>
                )}

                {selectedSample.npd_bom_materials?.part_status === 'SAMPLE_SENT' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sample_received_date">Sample Received Date</Label>
                      <Input
                        id="sample_received_date"
                        type="date"
                        value={updateData.sample_received_date || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setUpdateData({ ...updateData, sample_received_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quality_notes">Quality Notes</Label>
                      <Textarea
                        id="quality_notes"
                        value={updateData.quality_notes || ''}
                        onChange={(e) => setUpdateData({ ...updateData, quality_notes: e.target.value })}
                        placeholder="Initial quality assessment notes"
                      />
                    </div>
                    <Button onClick={() => handleStatusUpdate('SAMPLE_RECEIVED')}>
                      Mark as Received
                    </Button>
                  </div>
                )}

                {selectedSample.npd_bom_materials?.part_status === 'SAMPLE_RECEIVED' && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button onClick={() => handleStatusUpdate('SAMPLE_APPROVED')}>
                        Approve Sample
                      </Button>
                      <Button variant="outline" onClick={() => handleStatusUpdate('SAMPLE_REJECTED')}>
                        Reject Sample
                      </Button>
                    </div>
                    <div>
                      <Label htmlFor="approval_notes">Approval/Rejection Notes</Label>
                      <Textarea
                        id="approval_notes"
                        value={updateData.approval_notes || updateData.rejection_reason || ''}
                        onChange={(e) => setUpdateData({ 
                          ...updateData, 
                          approval_notes: e.target.value,
                          rejection_reason: e.target.value 
                        })}
                        placeholder="Detailed notes about the decision"
                      />
                    </div>
                  </div>
                )}

                {selectedSample.npd_bom_materials?.part_status === 'SAMPLE_APPROVED' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="final_part_code">Final Part Code</Label>
                      <Input
                        id="final_part_code"
                        value={updateData.final_part_code || ''}
                        onChange={(e) => setUpdateData({ ...updateData, final_part_code: e.target.value })}
                        placeholder="Official part code after approval"
                      />
                    </div>
                    <Button 
                      onClick={() => handleStatusUpdate('FINALIZE_AND_CODE')}
                      disabled={!updateData.final_part_code}
                    >
                      Finalize & Code Part
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  return content;
};