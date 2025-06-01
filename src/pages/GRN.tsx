
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Package, Clock, Check, X, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useGRN } from "@/hooks/useGRN";
import GRNForm from "@/components/PPC/GRNForm";

const GRN = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [selectedGRN, setSelectedGRN] = useState<string | null>(null);
  
  const { data: existingGRNs, isLoading: grnLoading } = useGRN();

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Goods Receipt Note (GRN)</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, 14:35</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex w-full mb-4">
          <Button 
            variant={activeTab === "create" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setActiveTab("create")}
          >
            <Package className="h-4 w-4 mr-2" />
            Create GRN
          </Button>
          <Button 
            variant={activeTab === "view" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setActiveTab("view")}
          >
            <Clock className="h-4 w-4 mr-2" />
            Recent GRNs
          </Button>
        </div>

        {activeTab === "create" ? (
          <GRNForm />
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent GRNs</CardTitle>
              </CardHeader>
              <CardContent>
                {grnLoading ? (
                  <div className="text-center py-8">Loading GRNs...</div>
                ) : existingGRNs && existingGRNs.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>GRN Number</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>PO Reference</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {existingGRNs.map((grn) => (
                          <TableRow key={grn.id}>
                            <TableCell className="font-medium">{grn.grn_number}</TableCell>
                            <TableCell>{new Date(grn.received_date).toLocaleDateString()}</TableCell>
                            <TableCell>{grn.vendors?.name || 'N/A'}</TableCell>
                            <TableCell>{grn.purchase_orders?.po_number || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline"
                                className={
                                  grn.status === "RECEIVED" ? "bg-green-100 text-green-800 hover:bg-green-100" :
                                  grn.status === "REJECTED" ? "bg-red-100 text-red-800 hover:bg-red-100" :
                                  "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                }
                              >
                                {grn.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedGRN(selectedGRN === grn.id ? null : grn.id)}
                              >
                                {selectedGRN === grn.id ? "Hide Details" : "View Details"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {selectedGRN && (
                      <div className="mt-6 border-t pt-4">
                        <h3 className="text-lg font-medium mb-4">GRN Details: {selectedGRN}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <span className="text-sm text-muted-foreground">Status</span>
                            <p className="font-medium">
                              {existingGRNs.find(grn => grn.id === selectedGRN)?.status}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">PO Reference</span>
                            <p className="font-medium">
                              {existingGRNs.find(grn => grn.id === selectedGRN)?.purchase_orders?.po_number}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Vendor</span>
                            <p className="font-medium">
                              {existingGRNs.find(grn => grn.id === selectedGRN)?.vendors?.name}
                            </p>
                          </div>
                        </div>
                        
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Material Code</TableHead>
                              <TableHead>Material Name</TableHead>
                              <TableHead>PO Quantity</TableHead>
                              <TableHead>Received Quantity</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {existingGRNs.find(grn => grn.id === selectedGRN)?.grn_items?.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                                <TableCell>{item.raw_materials?.name}</TableCell>
                                <TableCell>{item.po_quantity?.toLocaleString()}</TableCell>
                                <TableCell>{item.received_quantity?.toLocaleString()}</TableCell>
                                <TableCell>
                                  {item.received_quantity < item.po_quantity ? (
                                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                      Partial
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                                      Complete
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        
                        <div className="mt-4 flex justify-end gap-2">
                          {existingGRNs.find(grn => grn.id === selectedGRN)?.status === "RECEIVED" && (
                            <>
                              <Button variant="outline" size="sm" className="border-green-500 text-green-600 hover:bg-green-50">
                                <Check size={16} className="mr-1" />
                                Approve
                              </Button>
                              <Button variant="outline" size="sm" className="border-red-500 text-red-600 hover:bg-red-50">
                                <X size={16} className="mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          <Button variant="outline" size="sm">
                            <Trash2 size={16} className="mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No GRNs found</p>
                    <p className="text-sm text-muted-foreground mt-2">Create your first GRN to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GRN;
