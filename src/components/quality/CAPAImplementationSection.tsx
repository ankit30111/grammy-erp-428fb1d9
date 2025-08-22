
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, FileText } from 'lucide-react';
import { CAPAForIQC, CAPAImplementationCheck } from '@/hooks/useCAPATracking';
import { format } from 'date-fns';

interface CAPAImplementationSectionProps {
  relevantCAPAs: CAPAForIQC[];
  grnItemId: string;
  materialId: string;
  vendorId: string | null;
  onCAPAChecksChange: (checks: CAPAImplementationCheck[]) => void;
}

const CAPAImplementationSection = ({
  relevantCAPAs,
  grnItemId,
  materialId,
  vendorId,
  onCAPAChecksChange
}: CAPAImplementationSectionProps) => {
  const [capaChecks, setCAPAChecks] = useState<Record<string, { implemented: boolean | null; remarks: string }>>({});

  const handleImplementationChange = (capaId: string, implemented: boolean) => {
    const updated = {
      ...capaChecks,
      [capaId]: {
        ...capaChecks[capaId],
        implemented
      }
    };
    setCAPAChecks(updated);
    updateCAPAChecks(updated);
  };

  const handleRemarksChange = (capaId: string, remarks: string) => {
    const updated = {
      ...capaChecks,
      [capaId]: {
        ...capaChecks[capaId],
        remarks
      }
    };
    setCAPAChecks(updated);
    updateCAPAChecks(updated);
  };

  const updateCAPAChecks = (checks: Record<string, { implemented: boolean | null; remarks: string }>) => {
    const capaImplementationChecks: CAPAImplementationCheck[] = [];
    
    Object.entries(checks).forEach(([capaId, check]) => {
      if (check.implemented !== null) {
        const capa = relevantCAPAs.find(c => c.id === capaId);
        if (capa) {
          capaImplementationChecks.push({
            capa_category: capa.capa_category,
            reference_id: capaId,
            grn_item_id: grnItemId,
            raw_material_id: materialId,
            vendor_id: vendorId,
            implemented: check.implemented,
            remarks: check.remarks || ''
          });
        }
      }
    });
    
    onCAPAChecksChange(capaImplementationChecks);
  };

  if (relevantCAPAs.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          CAPA Implementation Verification
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Please verify if the following approved CAPAs have been implemented for this material/vendor
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {relevantCAPAs.map((capa) => (
          <div key={capa.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {capa.capa_category.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm font-medium">{capa.part_or_process}</span>
                </div>
                {capa.vendor_name && (
                  <p className="text-xs text-muted-foreground">Vendor: {capa.vendor_name}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Approved: {format(new Date(capa.approved_at), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">CAPA Implemented?</Label>
                <Select
                  value={capaChecks[capa.id]?.implemented?.toString() || ''}
                  onValueChange={(value) => handleImplementationChange(capa.id, value === 'true')}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        Yes
                      </div>
                    </SelectItem>
                    <SelectItem value="false">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-red-600" />
                        No
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Remarks</Label>
                <Textarea
                  value={capaChecks[capa.id]?.remarks || ''}
                  onChange={(e) => handleRemarksChange(capa.id, e.target.value)}
                  placeholder="Add verification remarks..."
                  className="h-8 text-xs resize-none"
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default CAPAImplementationSection;
