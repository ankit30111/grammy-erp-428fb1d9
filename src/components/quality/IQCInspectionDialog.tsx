import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FileText, Upload, File, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIQCInspection } from "@/hooks/useIQCInspection";

interface IQCInspectionDialogProps {
  grn: any;
  isOpen: boolean;
  onClose: () => void;
}

const IQCInspectionDialog = ({ grn, isOpen, onClose }: IQCInspectionDialogProps) => {
  const {
    inspectionResults,
    validationErrors,
    updateInspectionResult,
    submitInspection
  } = useIQCInspection(grn);

  // Handle file upload
  const handleFileChange = (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateInspectionResult(itemId, {
      iqcReport: file,
      selectedFile: file.name
    });
  };

  // Handle status change
  const handleStatusChange = (itemId: string, status: 'APPROVED' | 'REJECTED' | 'SEGREGATED') => {
    const item = grn.grn_items.find((i: any) => i.id === itemId);
    if (!item) return;

    let acceptedQty = item.received_quantity;
    let rejectedQty = 0;

    if (status === 'REJECTED') {
      acceptedQty = 0;
      rejectedQty = item.received_quantity;
    } else if (status === 'SEGREGATED') {
      // For segregated, we'll let the user input the quantities
      acceptedQty = Math.floor(item.received_quantity / 2); // Default half-half
      rejectedQty = item.received_quantity - acceptedQty;
    }

    updateInspectionResult(itemId, {
      status,
      acceptedQuantity: acceptedQty,
      rejectedQuantity: rejectedQty,
    });
  };

  // Handle quantity inputs for segregated items
  const handleQuantityChange = (
    itemId: string, 
    field: 'acceptedQuantity' | 'rejectedQuantity',
    value: number
  ) => {
    const item = grn.grn_items.find((i: any) => i.id === itemId);
    if (!item) return;
    
    const clampedValue = Math.max(0, Math.min(value, item.received_quantity));
    const otherField = field === 'acceptedQuantity' ? 'rejectedQuantity' : 'acceptedQuantity';
    const otherValue = item.received_quantity - clampedValue;
    
    updateInspectionResult(itemId, {
      [field]: clampedValue,
      [otherField]: Math.max(0, otherValue)
    });
  };

  const handleRemarksChange = (itemId: string, remarks: string) => {
    updateInspectionResult(itemId, { remarks });
  };

  const handleSubmit = () => {
    submitInspection.mutate();
  };

  const handleClose = () => {
    onClose();
  };

  // Find items that need inspection
  const pendingItems = grn?.grn_items?.filter((item: any) => 
    !item.iqc_status || item.iqc_status === 'PENDING'
  ) || [];

  if (!grn || pendingItems.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            IQC Inspection: GRN #{grn.grn_number} - {grn.vendors?.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="bg-muted/20 p-4 rounded-md">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>PO Number:</strong> {grn.purchase_orders?.po_number}</div>
              <div><strong>Vendor:</strong> {grn.vendors?.name}</div>
              <div><strong>Received Date:</strong> {new Date(grn.received_date).toLocaleDateString()}</div>
              <div><strong>Items:</strong> {grn.grn_items?.length || 0}</div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Material Inspection</h3>
            {pendingItems.map((item: any) => (
              <div key={item.id} className="border rounded-md mb-4 overflow-hidden">
                <div className="bg-muted p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">
                        {item.raw_materials?.material_code}
                      </span>
                      <Badge variant="outline">{item.raw_materials?.name}</Badge>
                    </div>
                    <div>
                      <span className="text-sm">
                        Received: <strong>{item.received_quantity}</strong> units
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 space-y-4">
                  <div>
                    <Label>Inspection Outcome</Label>
                    <RadioGroup
                      value={inspectionResults[item.id]?.status}
                      onValueChange={(value) => handleStatusChange(
                        item.id, 
                        value as 'APPROVED' | 'REJECTED' | 'SEGREGATED'
                      )}
                      className="flex items-center space-x-6 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="APPROVED" id={`pass-${item.id}`} />
                        <Label htmlFor={`pass-${item.id}`} className="text-green-600">Pass</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="SEGREGATED" id={`segregate-${item.id}`} />
                        <Label htmlFor={`segregate-${item.id}`} className="text-amber-600">Segregate</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="REJECTED" id={`fail-${item.id}`} />
                        <Label htmlFor={`fail-${item.id}`} className="text-red-600">Fail</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  
                  {inspectionResults[item.id]?.status === 'SEGREGATED' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Accepted Quantity</Label>
                          <Input
                            type="number"
                            min={0}
                            max={item.received_quantity}
                            value={inspectionResults[item.id]?.acceptedQuantity || 0}
                            onChange={(e) => handleQuantityChange(
                              item.id, 
                              'acceptedQuantity',
                              parseInt(e.target.value) || 0
                            )}
                            className={`mt-1 ${validationErrors[item.id] ? 'border-red-500' : ''}`}
                          />
                        </div>
                        <div>
                          <Label>Rejected Quantity</Label>
                          <Input
                            type="number"
                            min={0}
                            max={item.received_quantity}
                            value={inspectionResults[item.id]?.rejectedQuantity || 0}
                            onChange={(e) => handleQuantityChange(
                              item.id, 
                              'rejectedQuantity',
                              parseInt(e.target.value) || 0
                            )}
                            className={`mt-1 ${validationErrors[item.id] ? 'border-red-500' : ''}`}
                          />
                        </div>
                      </div>
                      {validationErrors[item.id] && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{validationErrors[item.id]}</AlertDescription>
                        </Alert>
                      )}
                      <div className="text-sm text-muted-foreground">
                        Total: {(inspectionResults[item.id]?.acceptedQuantity || 0) + (inspectionResults[item.id]?.rejectedQuantity || 0)} / {item.received_quantity}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <Label>Upload IQC Report</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="relative w-full">
                        <Input
                          type="file"
                          id={`iqc-report-${item.id}`}
                          className="hidden"
                          onChange={(e) => handleFileChange(item.id, e)}
                          accept=".pdf,.jpg,.png"
                        />
                        <Input
                          readOnly
                          value={inspectionResults[item.id]?.selectedFile || ''}
                          placeholder="Select a file..."
                          onClick={() => document.getElementById(`iqc-report-${item.id}`)?.click()}
                          className="cursor-pointer pr-10"
                        />
                        <Upload className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => window.open(
                        `https://oacdhvmpkuadlyvvvbpq.supabase.co/storage/v1/object/public/raw-material-documents/${
                          item.raw_materials?.specification_sheet_url || ''
                        }`, 
                        '_blank'
                      )}
                      disabled={!item.raw_materials?.specification_sheet_url}
                    >
                      <File className="h-3 w-3" />
                      Spec Sheet
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => window.open(
                        `https://oacdhvmpkuadlyvvvbpq.supabase.co/storage/v1/object/public/raw-material-documents/${
                          item.raw_materials?.iqc_checklist_url || ''
                        }`, 
                        '_blank'
                      )}
                      disabled={!item.raw_materials?.iqc_checklist_url}
                    >
                      <FileText className="h-3 w-3" />
                      IQC Format
                    </Button>
                  </div>
                  
                  <div>
                    <Label>Remarks</Label>
                    <Textarea
                      value={inspectionResults[item.id]?.remarks || ''}
                      onChange={(e) => handleRemarksChange(item.id, e.target.value)}
                      placeholder="Enter inspection remarks..."
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Global validation errors */}
          {Object.keys(validationErrors).length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please fix all validation errors before submitting the inspection.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={submitInspection.isPending}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={submitInspection.isPending || Object.keys(validationErrors).some(key => validationErrors[key])}
              className="gap-2"
            >
              {submitInspection.isPending ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Saving...
                </>
              ) : (
                "Complete Inspection"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IQCInspectionDialog;