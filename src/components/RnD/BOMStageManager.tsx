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

// npd_project_bom (and its own bom_stage vocabulary) is gone — the project's
// stage now lives on npd_projects.stage, typed with the npd_stage enum
// (CONCEPT | DESIGN | BOM | SAMPLE | VALIDATION | LAUNCHED | DROPPED).
const STAGES = [
  {
    id: 'CONCEPT',
    name: 'Concept',
    description: 'Idea and feasibility, before any BOM exists',
    icon: Clock,
    color: 'bg-muted text-foreground',
    requirements: []
  },
  {
    id: 'DESIGN',
    name: 'Design',
    description: 'Layout planning and design work',
    icon: Cog,
    color: 'bg-accent text-primary',
    requirements: []
  },
  {
    id: 'BOM',
    name: 'Test BOM',
    description: 'Preliminary BOM for feasibility and layout planning',
    icon: Clock,
    color: 'bg-accent text-primary',
    requirements: []
  },
  {
    id: 'SAMPLE',
    name: 'Sampling Stage',
    description: 'Vendor samples requested for uncoded parts',
    icon: CheckCircle,
    color: 'bg-warning-wash text-warning',
    requirements: ['All uncoded parts must have samples requested']
  },
  {
    id: 'VALIDATION',
    name: 'Testing & Pilot',
    description: 'Functional testing and low-volume pilot run with the final BOM',
    icon: Factory,
    color: 'bg-warning-wash text-warning',
    requirements: ['All samples must be received', 'BOM finalized']
  },
  {
    id: 'LAUNCHED',
    name: 'MP (Mass Production)',
    description: 'Approved and locked BOM for mass production',
    icon: CheckCircle,
    color: 'bg-success-wash text-success',
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

  // npd_bom_stage_history has NO replacement after the rebuild — there is
  // nowhere left to read stage transitions from.
  const stageHistory: Array<Record<string, any>> = [];

  // Fetch BOM materials to check readiness
  const { data: bomMaterials = [] } = useQuery({
    queryKey: ['npd-bom-materials-stage-check', bomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('npd_bom_materials')
        .select('*')
        .eq('project_id', bomId);

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

    // After the rebuild npd_bom_materials only carries part_id / status, so
    // "uncoded" simply means no linked part row. is_temporary_part,
    // part_status and avl_generated no longer exist.
    const uncoded = bomMaterials.filter((m: any) => !m.part_id);

    switch (stageId) {
      case 'SAMPLE':
        if (uncoded.length === 0) {
          issues.push('No uncoded parts require sampling');
        }
        break;

      case 'VALIDATION': {
        const pendingSamples = uncoded.filter(
          (m: any) => !['SAMPLE_RECEIVED', 'SAMPLE_APPROVED'].includes(m.status)
        );
        if (pendingSamples.length > 0) {
          issues.push(`${pendingSamples.length} samples still pending`);
        }
        break;
      }

      case 'LAUNCHED': {
        const uncodedFinalParts = uncoded.filter(
          (m: any) => m.status !== 'FINALIZED_AND_CODED'
        );
        if (uncodedFinalParts.length > 0) {
          issues.push(`${uncodedFinalParts.length} parts not yet finalized and coded`);
        }
        break;
      }
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
                    isCompleted ? 'bg-success-wash' : isCurrent ? 'bg-accent' : 'bg-muted'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      isCompleted ? 'text-success' : isCurrent ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{stage.name}</h4>
                      {isCurrent && (
                        <Badge className={stage.color}>Current</Badge>
                      )}
                      {isCompleted && (
                        <Badge className="bg-success-wash text-success">Completed</Badge>
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
                      <div className="mt-2 p-2 bg-warning-wash rounded-md">
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          <span className="text-xs font-medium text-warning">Readiness Issues:</span>
                        </div>
                        <ul className="text-xs text-warning list-disc list-inside">
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

      <Card>
        <CardHeader>
          <CardTitle>Stage History</CardTitle>
          <CardDescription>
            Not available after the rebuild — the BOM stage-history table was
            removed and has no replacement, so past transitions are not recorded.
          </CardDescription>
        </CardHeader>
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