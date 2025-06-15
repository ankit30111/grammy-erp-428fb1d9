
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Edit, Save, X, Calculator } from "lucide-react";
import { ProductionVoucherWithDispatch, useCreateSerialNumberAssignment, useUpdateSerialNumberAssignment } from "@/hooks/useProductionSerialNumbers";
import { calculateEndingSerialNumber, validateSerialNumberRange } from "@/utils/serialNumberUtils";
import { useToast } from "@/hooks/use-toast";

interface SerialNumberAssignmentProps {
  voucher: ProductionVoucherWithDispatch;
}

const SerialNumberAssignment = ({ voucher }: SerialNumberAssignmentProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [startingSerial, setStartingSerial] = useState("");
  const [endingSerial, setEndingSerial] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { toast } = useToast();
  const createMutation = useCreateSerialNumberAssignment();
  const updateMutation = useUpdateSerialNumberAssignment();

  // Initialize form data
  useEffect(() => {
    if (voucher.serial_number_assignment) {
      setStartingSerial(voucher.serial_number_assignment.starting_serial_number || "");
      setEndingSerial(voucher.serial_number_assignment.ending_serial_number || "");
      setNotes(voucher.serial_number_assignment.notes || "");
    } else {
      setStartingSerial("");
      setEndingSerial("");
      setNotes("");
    }
  }, [voucher.serial_number_assignment]);

  // Auto-calculate ending serial when starting serial changes
  useEffect(() => {
    if (startingSerial && isEditing) {
      const calculated = calculateEndingSerialNumber(startingSerial, voucher.quantity);
      setEndingSerial(calculated);
    }
  }, [startingSerial, voucher.quantity, isEditing]);

  // Validate serial number range
  useEffect(() => {
    if (startingSerial && endingSerial) {
      const validation = validateSerialNumberRange(startingSerial, endingSerial, voucher.quantity);
      setValidationError(validation.isValid ? null : validation.error || null);
    } else {
      setValidationError(null);
    }
  }, [startingSerial, endingSerial, voucher.quantity]);

  const handleSave = async () => {
    if (!startingSerial || !endingSerial) {
      toast({
        title: "Missing Information",
        description: "Please enter both starting and ending serial numbers",
        variant: "destructive"
      });
      return;
    }

    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    const data = {
      production_order_id: voucher.id,
      starting_serial_number: startingSerial,
      ending_serial_number: endingSerial,
      quantity: voucher.quantity,
      notes: notes || undefined
    };

    try {
      if (voucher.serial_number_assignment) {
        await updateMutation.mutateAsync({
          id: voucher.serial_number_assignment.id,
          updates: {
            starting_serial_number: startingSerial,
            ending_serial_number: endingSerial,
            notes: notes || undefined
          }
        });
      } else {
        await createMutation.mutateAsync(data);
      }
      setIsEditing(false);
    } catch (error) {
      // Error handling is done in the mutation hooks
    }
  };

  const handleCancel = () => {
    // Reset to original values
    if (voucher.serial_number_assignment) {
      setStartingSerial(voucher.serial_number_assignment.starting_serial_number || "");
      setEndingSerial(voucher.serial_number_assignment.ending_serial_number || "");
      setNotes(voucher.serial_number_assignment.notes || "");
    } else {
      setStartingSerial("");
      setEndingSerial("");
      setNotes("");
    }
    setIsEditing(false);
    setValidationError(null);
  };

  const hasAssignment = voucher.serial_number_assignment;
  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {voucher.voucher_number}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={hasAssignment ? "default" : "secondary"}>
              {hasAssignment ? "Assigned" : "Pending"}
            </Badge>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-1"
              >
                <Edit className="h-3 w-3" />
                {hasAssignment ? "Edit" : "Assign"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voucher Information */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <Label className="text-muted-foreground">Product</Label>
            <p className="font-medium">{voucher.products?.name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Customer</Label>
            <p className="font-medium">{voucher.production_schedules?.projections?.customers?.name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Quantity</Label>
            <p className="font-medium">{voucher.quantity}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Scheduled Date</Label>
            <p className="font-medium">{new Date(voucher.scheduled_date).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Serial Number Assignment */}
        {isEditing ? (
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startingSerial">Starting Serial Number</Label>
                <Input
                  id="startingSerial"
                  value={startingSerial}
                  onChange={(e) => setStartingSerial(e.target.value)}
                  placeholder="e.g., ABCD010212345"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endingSerial" className="flex items-center gap-2">
                  Ending Serial Number
                  <Calculator className="h-3 w-3 text-muted-foreground" />
                </Label>
                <Input
                  id="endingSerial"
                  value={endingSerial}
                  onChange={(e) => setEndingSerial(e.target.value)}
                  placeholder="Auto-calculated"
                  disabled={isLoading}
                />
              </div>
            </div>

            {validationError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {validationError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about serial number assignment..."
                rows={2}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={isLoading || !!validationError || !startingSerial || !endingSerial}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isLoading ? "Saving..." : "Save Assignment"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        ) : hasAssignment ? (
          <div className="space-y-2 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Starting Serial Number</Label>
                <p className="font-mono text-sm bg-muted p-2 rounded">
                  {hasAssignment.starting_serial_number}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Ending Serial Number</Label>
                <p className="font-mono text-sm bg-muted p-2 rounded">
                  {hasAssignment.ending_serial_number}
                </p>
              </div>
            </div>
            {hasAssignment.notes && (
              <div>
                <Label className="text-muted-foreground">Notes</Label>
                <p className="text-sm text-muted-foreground">{hasAssignment.notes}</p>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Assigned on {new Date(hasAssignment.assigned_at || hasAssignment.created_at).toLocaleDateString()}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground border-t">
            No serial numbers assigned yet
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SerialNumberAssignment;
