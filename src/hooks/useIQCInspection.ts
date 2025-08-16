
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InspectionResult {
  status: 'APPROVED' | 'REJECTED' | 'SEGREGATED';
  remarks: string;
  acceptedQuantity: number;
  rejectedQuantity: number;
  iqcReport?: File;
  selectedFile?: string;
}

export const useIQCInspection = (grn: any) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [inspectionResults, setInspectionResults] = useState<Record<string, InspectionResult>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize results when GRN changes
  useEffect(() => {
    if (!grn?.grn_items) {
      setInspectionResults({});
      return;
    }
    
    const initialResults: Record<string, InspectionResult> = {};
    grn.grn_items.forEach((item: any) => {
      if (!item.iqc_status || item.iqc_status === 'PENDING') {
        initialResults[item.id] = {
          status: 'APPROVED',
          remarks: '',
          acceptedQuantity: item.received_quantity || 0,
          rejectedQuantity: 0,
          selectedFile: '',
        };
      }
    });
    
    setInspectionResults(initialResults);
    setValidationErrors({});
  }, [grn]);

  const validateQuantities = (itemId: string, results: Record<string, InspectionResult>): string | null => {
    const item = grn.grn_items.find((i: any) => i.id === itemId);
    if (!item) return "Item not found";
    
    const result = results[itemId];
    if (!result) return "No inspection data";
    
    const total = result.acceptedQuantity + result.rejectedQuantity;
    const received = item.received_quantity;
    
    if (total !== received) {
      return `Total quantities (${total}) must equal received quantity (${received})`;
    }
    
    if (result.acceptedQuantity < 0 || result.rejectedQuantity < 0) {
      return "Quantities cannot be negative";
    }
    
    return null;
  };

  const updateInspectionResult = (itemId: string, updates: Partial<InspectionResult>) => {
    const newResults = {
      ...inspectionResults,
      [itemId]: {
        ...inspectionResults[itemId],
        ...updates
      }
    };
    
    setInspectionResults(newResults);
    
    // Clear validation error if quantities are now valid
    const error = validateQuantities(itemId, newResults);
    setValidationErrors(prev => ({
      ...prev,
      [itemId]: error || ''
    }));
  };

  const submitInspection = useMutation({
    mutationFn: async () => {
      const itemIds = Object.keys(inspectionResults);
      
      console.log('Starting IQC submission for items:', itemIds);
      console.log('Inspection results:', inspectionResults);
      
      // Validate all items before submission
      const errors: Record<string, string> = {};
      itemIds.forEach(itemId => {
        const error = validateQuantities(itemId, inspectionResults);
        if (error) {
          errors[itemId] = error;
        }
      });
      
      if (Object.keys(errors).length > 0) {
        console.error('Validation errors found:', errors);
        setValidationErrors(errors);
        throw new Error("Please fix validation errors before submitting");
      }

      try {
        // Upload IQC reports with retry logic
        const uploadResults: { itemId: string; reportUrl: string }[] = [];
        
        for (const itemId of itemIds) {
          const result = inspectionResults[itemId];
          let reportUrl = '';

          if (result.iqcReport) {
            console.log('Uploading IQC report for item:', itemId);
            const fileName = `iqc-report-${grn.grn_number}-${itemId}-${Date.now()}.${result.iqcReport.name.split('.').pop()}`;
            
            let uploadAttempts = 0;
            const maxRetries = 3;
            
            while (uploadAttempts < maxRetries) {
              try {
                const { error: uploadError } = await supabase.storage
                  .from("iqc-reports")
                  .upload(fileName, result.iqcReport, {
                    cacheControl: '3600',
                    upsert: false
                  });

                if (uploadError) {
                  console.error(`Upload attempt ${uploadAttempts + 1} failed:`, uploadError);
                  uploadAttempts++;
                  if (uploadAttempts >= maxRetries) {
                    throw new Error(`File upload failed after ${maxRetries} attempts: ${uploadError.message}`);
                  }
                  await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
                  continue;
                }
                
                reportUrl = fileName;
                console.log('File uploaded successfully:', fileName);
                break;
              } catch (error) {
                console.error(`Upload error on attempt ${uploadAttempts + 1}:`, error);
                uploadAttempts++;
                if (uploadAttempts >= maxRetries) {
                  throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
              }
            }
          }

          uploadResults.push({ itemId, reportUrl });
        }

        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        console.log('Authenticated user:', user.id);

        // Update all GRN items
        for (const { itemId, reportUrl } of uploadResults) {
          const result = inspectionResults[itemId];
          
          console.log(`Updating GRN item ${itemId} with:`, {
            iqc_status: result.status,
            accepted_quantity: result.acceptedQuantity,
            rejected_quantity: result.rejectedQuantity,
            iqc_report_url: reportUrl || null
          });

          const updateData: any = {
            iqc_status: result.status,
            iqc_completed_at: new Date().toISOString(),
            iqc_completed_by: user.id,
            accepted_quantity: result.acceptedQuantity,
            rejected_quantity: result.rejectedQuantity,
            iqc_report_url: reportUrl || null
          };

          const { error } = await supabase
            .from("grn_items")
            .update(updateData)
            .eq("id", itemId);

          if (error) {
            console.error('Database update error for item', itemId, ':', error);
            throw new Error(`Failed to update item ${itemId}: ${error.message}`);
          }

          console.log(`Successfully updated GRN item ${itemId}`);
        }

        // Update GRN status if all items are completed
        const allItemsInspected = grn.grn_items.every((item: any) => 
          item.iqc_status !== 'PENDING' || !!inspectionResults[item.id]
        );

        console.log('All items inspected:', allItemsInspected);

        if (allItemsInspected) {
          console.log('Updating GRN status to IQC_COMPLETED for GRN:', grn.id);
          const { error: grnError } = await supabase
            .from("grn")
            .update({ status: "IQC_COMPLETED" })
            .eq("id", grn.id);

          if (grnError) {
            console.error('GRN status update error:', grnError);
            throw new Error(`Failed to update GRN status: ${grnError.message}`);
          }
          
          console.log('Successfully updated GRN status');
        }

        console.log('IQC submission completed successfully');

      } catch (error) {
        console.error('IQC submission error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('IQC submission successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['pending-grns'] });
      queryClient.invalidateQueries({ queryKey: ['completed-grns'] });
      queryClient.invalidateQueries({ queryKey: ['completed-iqc-items'] });
      queryClient.invalidateQueries({ queryKey: ['grn-items'] });
      toast({
        title: "Inspection Completed",
        description: "GRN items have been inspected successfully. CAPA workflows have been initiated for rejected/segregated items.",
      });
      setInspectionResults({});
      setValidationErrors({});
    },
    onError: (error: any) => {
      console.error("Error submitting IQC inspection:", error);
      
      let errorMessage = "Failed to save inspection results";
      if (error.message.includes("upload")) {
        errorMessage = "File upload failed. Please check your internet connection and try again.";
      } else if (error.message.includes("validation")) {
        errorMessage = "Please fix the validation errors before submitting.";
      } else if (error.message.includes("Failed to update")) {
        errorMessage = "Database update failed. Please try again.";
      } else if (error.message.includes("User not authenticated")) {
        errorMessage = "Authentication required. Please log in and try again.";
      }
      
      toast({
        title: "Inspection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  return {
    inspectionResults,
    validationErrors,
    updateInspectionResult,
    submitInspection,
    validateQuantities
  };
};
