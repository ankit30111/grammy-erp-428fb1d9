
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ClipboardCheck, FileCheck, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const Quality = () => {
  const navigate = useNavigate();

  // Mock stats
  const stats = {
    pendingIQC: 15,
    activePQC: 8,
    pendingOQC: 5,
    returnAnalysis: 3,
    capaItems: 7
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Quality Control</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, {format(new Date(), "HH:mm")}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>Incoming Quality Control</CardTitle>
              <CardDescription>Raw material inspection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending GRNs:</span>
                  <span className="font-medium">{stats.pendingIQC}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Open CAPAs:</span>
                  <span className="font-medium">{stats.capaItems}</span>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={() => navigate("/quality/iqc")}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" /> Go to IQC
                </Button>
              </div>
              <div className="absolute -right-4 -top-1 opacity-10">
                <FileCheck className="h-24 w-24 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>Production Quality Control</CardTitle>
              <CardDescription>In-process quality checks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active Productions:</span>
                  <span className="font-medium">{stats.activePQC}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Inspection Points:</span>
                  <span className="font-medium">24</span>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={() => navigate("/quality/pqc")}
                >
                  <Layers className="h-4 w-4 mr-2" /> Go to PQC
                </Button>
              </div>
              <div className="absolute -right-4 -top-1 opacity-10">
                <Layers className="h-24 w-24 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>Outgoing Quality Control</CardTitle>
              <CardDescription>Final product inspection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pending Batches:</span>
                  <span className="font-medium">{stats.pendingOQC}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Customer Returns:</span>
                  <span className="font-medium">{stats.returnAnalysis}</span>
                </div>
                <Button 
                  className="w-full mt-4" 
                  onClick={() => navigate("/quality/oqc")}
                >
                  <FileCheck className="h-4 w-4 mr-2" /> Go to OQC
                </Button>
              </div>
              <div className="absolute -right-4 -top-1 opacity-10">
                <ClipboardCheck className="h-24 w-24 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Quality Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4 pb-4 border-b">
                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-800 font-medium">H</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Solder Quality Issues</h3>
                    <p className="text-sm text-muted-foreground">Identified during IQC for Speaker Driver components from vendor ABC Electronics.</p>
                    <div className="mt-1">
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">High Priority</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4 pb-4 border-b">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-amber-800 font-medium">M</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Component Alignment</h3>
                    <p className="text-sm text-muted-foreground">Found during PQC on Line 1 production of Speaker A300 model.</p>
                    <div className="mt-1">
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Medium Priority</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-amber-800 font-medium">M</span>
                  </div>
                  <div>
                    <h3 className="font-medium">Missing Parts</h3>
                    <p className="text-sm text-muted-foreground">Customer return analysis found missing accessory items in packaging.</p>
                    <div className="mt-1">
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Medium Priority</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quality Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">IQC Rejection Rate:</span>
                  <span className="font-medium">3.2%</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div className="h-2 rounded-full bg-amber-500" style={{ width: '3.2%' }}></div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">PQC Defect Rate:</span>
                  <span className="font-medium">1.7%</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: '1.7%' }}></div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">OQC Rejection Rate:</span>
                  <span className="font-medium">0.5%</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: '0.5%' }}></div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Customer Return Rate:</span>
                  <span className="font-medium">0.2%</span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: '0.2%' }}></div>
                </div>
                
                <Button variant="outline" className="w-full mt-2">
                  View Detailed Reports
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Quality;
