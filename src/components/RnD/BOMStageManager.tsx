import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Clock, ArrowRight, AlertTriangle, Factory, Cog } from 'lucide-react';

interface BOMStageManagerProps {
  bomId: string;
  currentStage: string;
  onStageTransition: (newStage: string, notes?: string) => void;
}

const STAGES = [
  {
    id: 'TEST_BOM',
    name: 'Test BOM',
    description: 'Preliminary BOM for feasibility and layout planning',
    icon: Clock,
    color: 'bg-blue-100 text-blue-800',
    requirements: []
  },
  {
    id: 'SAMPLING_STAGE',
    name: 'Sampling Stage',
    description: 'Vendor samples requested for uncoded parts',
    icon: CheckCircle,
    color: 'bg-yellow-100 text-yellow-800',
    requirements: ['All uncoded parts must have samples requested']
  },
  {
    id: 'TESTING_STAGE',
    name: 'Testing Stage',
    description: 'Functional and compatibility testing of components',
    icon: Cog,
    color: 'bg-orange-100 text-orange-800',
    requirements: ['All samples must be received', 'Testing protocols defined']
  },
  {
    id: 'PP_STAGE',
    name: 'PP (Pilot Production)',
    description: 'Low-volume run with final BOM version',
    icon: Factory,
    color: 'bg-purple-100 text-purple-800',
    requirements: ['All parts tested and approved', 'BOM finalized']
  },
  {
    id: 'MP_STAGE',
    name: 'MP (Mass Production)',
    description: 'Approved and locked BOM for mass production',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-800',
    requirements: ['Pilot production successful', 'All parts coded', 'AVL and IQC ready']
  }
];

export const BOMStageManager: React.FC<BOMStageManagerProps> = ({
  bomId,
  currentStage,
  onStageTransition
}) => {
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [targetStage, setTargetStage] = useState('');
  const [transitionNotes, setTransitionNotes] = useState('');

  // Fetch stage history
  const { data: stageHistory = [] } = useQuery({
    queryKey: ['npd-bom-stage-history', bomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_bom_stage_history')
        .select('*')
        .eq('npd_project_bom_id', bomId)
        .order('transition_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!bomId
  });

  // Fetch BOM materials to check readiness
  const { data: bomMaterials = [] } = useQuery({
    queryKey: ['npd-bom-materials-stage-check', bomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_bom_materials')
        .select('*')
        .eq('npd_project_bom_id', bomId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!bomId
  });

  const getCurrentStageIndex = () => {
    return STAGES.findIndex(stage => stage.id === currentStage);
  };

  const canTransitionTo = (stageId: string) => {
    const currentIndex = getCurrentStageIndex();
    const targetIndex = STAGES.findIndex(stage => stage.id === stageId);
    
    // Can only move forward one stage at a time
    return targetIndex === currentIndex + 1;
  };

  const checkStageReadiness = (stageId: string) => {
    const issues: string[] = [];
    
    switch (stageId) {
      case 'SAMPLING_STAGE':
        const uncodedParts = bomMaterials.filter(m => m.is_temporary_part);
        if (uncodedParts.length === 0) {
          issues.push('No uncoded parts require sampling');
        }
        break;
      
      case 'TESTING_STAGE':
        const pendingSamples = bomMaterials.filter(m => 
          m.is_temporary_part && 
          !['SAMPLE_RECEIVED', 'SAMPLE_APPROVED'].includes(m.part_status)
        );
        if (pendingSamples.length > 0) {
          issues.push(`${pendingSamples.length} samples still pending`);
        }
        break;
      
      case 'PP_STAGE':
        const unapprovedParts = bomMaterials.filter(m => 
          m.is_temporary_part && m.part_status !== 'SAMPLE_APPROVED'
        );
        if (unapprovedParts.length > 0) {
          issues.push(`${unapprovedParts.length} parts not yet approved`);
        }
        break;
      
      case 'MP_STAGE':
        const uncodedFinalParts = bomMaterials.filter(m => 
          m.is_temporary_part && m.part_status !== 'FINALIZED_AND_CODED'
        );
        if (uncodedFinalParts.length > 0) {
          issues.push(`${uncodedFinalParts.length} parts not yet finalized and coded`);
        }
        
        const missingAVL = bomMaterials.filter(m => !m.avl_generated);
        if (missingAVL.length > 0) {
          issues.push(`${missingAVL.length} parts missing AVL`);
        }
        break;
    }
    
    return issues;
  };

  const handleStageTransition = (stageId: string) => {
    setTargetStage(stageId);
    setShowTransitionDialog(true);
  };

  const confirmTransition = () => {
    onStageTransition(targetStage, transitionNotes);
    setShowTransitionDialog(false);
    setTransitionNotes('');
    setTargetStage('');
  };

  const currentStageIndex = getCurrentStageIndex();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>BOM Stage Pipeline</CardTitle>
          <CardDescription>
            Track your NPD BOM through the development lifecycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {STAGES.map((stage, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = stage.id === currentStage;
              const isNext = canTransitionTo(stage.id);
              const readinessIssues = checkStageReadiness(stage.id);
              const Icon = stage.icon;

              return (
                <div key={stage.id} className="flex items-center gap-4">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    isCompleted ? 'bg-green-100' : isCurrent ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{stage.name}</h4>
                      {isCurrent && (
                        <Badge className={stage.color}>Current</Badge>
                      )}
                      {isCompleted && (
                        <Badge className="bg-green-100 text-green-800">Completed</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{stage.description}</p>
                    
                    {stage.requirements.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground">Requirements:</p>
                        <ul className="text-xs text-muted-foreground list-disc list-inside">
                          {stage.requirements.map((req, idx) => (
                            <li key={idx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {readinessIssues.length > 0 && isNext && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded-md">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-xs font-medium text-yellow-800">Readiness Issues:</span>
                        </div>
                        <ul className="text-xs text-yellow-700 list-disc list-inside">
                          {readinessIssues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    {isNext && (
                      <Button
                        size="sm"
                        onClick={() => handleStageTransition(stage.id)}
                        disabled={readinessIssues.length > 0}
                      >
                        <ArrowRight className="h-4 w-4 mr-1" />
                        Advance
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {stageHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stage History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stageHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      {entry.from_stage && (
                        <>
                          <span className="font-medium">
                            {STAGES.find(s => s.id === entry.from_stage)?.name}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                      <span className="font-medium">
                        {STAGES.find(s => s.id === entry.to_stage)?.name}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground">{entry.notes}</p>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(entry.transition_date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showTransitionDialog} onOpenChange={setShowTransitionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Stage Transition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p>
                Move from <strong>{STAGES.find(s => s.id === currentStage)?.name}</strong> to{' '}
                <strong>{STAGES.find(s => s.id === targetStage)?.name}</strong>?
              </p>
            </div>
            
            <div>
              <Label htmlFor="transition_notes">Transition Notes (Optional)</Label>
              <Textarea
                id="transition_notes"
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                placeholder="Add notes about this stage transition..."
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={confirmTransition}>
                Confirm Transition
              </Button>
              <Button variant="outline" onClick={() => setShowTransitionDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};