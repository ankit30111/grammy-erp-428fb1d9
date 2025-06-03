
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PQCReportUpload from "./PQCReportUpload";
import LineRejectionForm from "./LineRejectionForm";

interface PQCActionsDialogProps {
  productionOrderId: string;
  isOpen: boolean;
  onClose: () => void;
}

const PQCActionsDialog = ({ productionOrderId, isOpen, onClose }: PQCActionsDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PQC Actions</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="report-upload" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="report-upload">PQC Report Upload</TabsTrigger>
            <TabsTrigger value="line-rejection">Line Rejection Entry</TabsTrigger>
          </TabsList>
          
          <TabsContent value="report-upload">
            <PQCReportUpload productionOrderId={productionOrderId} />
          </TabsContent>
          
          <TabsContent value="line-rejection">
            <LineRejectionForm productionOrderId={productionOrderId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PQCActionsDialog;
