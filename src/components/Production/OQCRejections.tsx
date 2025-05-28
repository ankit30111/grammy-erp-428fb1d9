
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OQCRejection, mockOQCRejections } from "@/types/production";
import { AlertTriangle, Upload, FileText, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function OQCRejections() {
  const { toast } = useToast();
  const [rejections, setRejections] = useState<OQCRejection[]>(mockOQCRejections);
  const [selectedRejection, setSelectedRejection] = useState<OQCRejection | null>(null);
  const [reworkNotes, setReworkNotes] = useState("");
  const [capaFile, setCAPAFile] = useState<File | null>(null);

  const handleStartRework = (rejectionId: string) => {
    setRejections(prev =>
      prev.map(rejection =>
        rejection.id === rejectionId
          ? { ...rejection, status: "REWORK_IN_PROGRESS" }
          : rejection
      )
    );

    toast({
      title: "Rework Started",
      description: "Rework process has been initiated for this lot",
    });
  };

  const handleUploadCAPA = (rejectionId: string) => {
    if (!reworkNotes.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide rework notes",
        variant: "destructive"
      });
      return;
    }

    setRejections(prev =>
      prev.map(rejection =>
        rejection.id === rejectionId
          ? { 
              ...rejection, 
              status: "CAPA_UPLOADED",
              reworkNotes: reworkNotes,
              capaDocument: capaFile?.name || `CAPA-${rejectionId}.pdf`
            }
          : rejection
      )
    );

    setReworkNotes("");
    setCAPAFile(null);
    setSelectedRejection(null);

    toast({
      title: "CAPA Uploaded",
      description: "Corrective action has been documented and uploaded",
    });
  };

  const getStatusBadge = (status: OQCRejection["status"]) => {
    switch (status) {
      case "PENDING_REWORK":
        return <Badge className="bg-red-100 text-red-800">Pending Rework</Badge>;
      case "REWORK_IN_PROGRESS":
        return <Badge className="bg-blue-100 text-blue-800">Rework in Progress</Badge>;
      case "CAPA_UPLOADED":
        return <Badge className="bg-green-100 text-green-800">CAPA Uploaded</Badge>;
      case "RESOLVED":
        return <Badge className="bg-gray-100 text-gray-800">Resolved</Badge>;
    }
  };

  const getStatusIcon = (status: OQCRejection["status"]) => {
    switch (status) {
      case "PENDING_REWORK":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "REWORK_IN_PROGRESS":
        return <Wrench className="h-4 w-4 text-blue-600" />;
      case "CAPA_UPLOADED":
        return <FileText className="h-4 w-4 text-green-600" />;
      case "RESOLVED":
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">OQC Rejections</h3>
        <Badge variant="outline" className="text-sm">
          Active Rejections: {rejections.filter(r => r.status !== "RESOLVED").length}
        </Badge>
      </div>

      {/* Rejection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rejections.filter(r => r.status !== "RESOLVED").map((rejection) => (
          <Card key={rejection.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{rejection.lotNumber}</CardTitle>
                {getStatusIcon(rejection.status)}
              </div>
              <CardDescription>Voucher: {rejection.voucherNumber}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rejection Reason</p>
                  <p className="text-sm">{rejection.rejectionReason}</p>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rejected Qty:</span>
                  <span className="font-medium">{rejection.rejectedQuantity}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Date:</span>
                  <span>{format(new Date(rejection.rejectionDate), "MMM dd")}</span>
                </div>
                
                <div>
                  {getStatusBadge(rejection.status)}
                </div>
                
                <div className="space-y-2">
                  {rejection.status === "PENDING_REWORK" && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleStartRework(rejection.id)}
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Start Rework
                    </Button>
                  )}
                  
                  {rejection.status === "REWORK_IN_PROGRESS" && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          className="w-full"
                          onClick={() => setSelectedRejection(rejection)}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload CAPA
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Upload CAPA Document</DialogTitle>
                          <DialogDescription>
                            Provide corrective and preventive action details for {rejection.lotNumber}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Rework Notes</label>
                            <Textarea
                              value={reworkNotes}
                              onChange={(e) => setReworkNotes(e.target.value)}
                              placeholder="Describe the corrective actions taken..."
                              rows={4}
                            />
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium">CAPA Document</label>
                            <Input
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => setCAPAFile(e.target.files?.[0] || null)}
                              className="mt-1"
                            />
                          </div>
                          
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setSelectedRejection(null)}>
                              Cancel
                            </Button>
                            <Button onClick={() => handleUploadCAPA(rejection.id)}>
                              Upload CAPA
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  
                  {rejection.status === "CAPA_UPLOADED" && rejection.capaDocument && (
                    <div className="text-xs text-green-600">
                      ✓ CAPA: {rejection.capaDocument}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Rejection History</CardTitle>
          <CardDescription>
            All OQC rejections and their resolution status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot Number</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Rejection Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Rejected Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CAPA Document</TableHead>
                  <TableHead>Rework Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejections.map((rejection) => (
                  <TableRow key={rejection.id}>
                    <TableCell className="font-medium">{rejection.lotNumber}</TableCell>
                    <TableCell>{rejection.voucherNumber}</TableCell>
                    <TableCell>{format(new Date(rejection.rejectionDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="max-w-xs truncate">{rejection.rejectionReason}</TableCell>
                    <TableCell>{rejection.rejectedQuantity}</TableCell>
                    <TableCell>{getStatusBadge(rejection.status)}</TableCell>
                    <TableCell>{rejection.capaDocument || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{rejection.reworkNotes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
