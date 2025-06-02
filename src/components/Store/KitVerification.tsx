
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Package, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KitVerification = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedKit, setSelectedKit] = useState<any>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);

  // Fetch kits that have been sent to production but not yet verified
  const { data: kitsToVerify = [] } = useQuery({
    queryKey: ["kits-to-verify"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_preparation")
        .select(`
          *,
          production_orders!inner(
            voucher_number,
            quantity,
            production_schedules(
              projections(
                products(name)
              )
            )
          ),
          kit_items(
            *,
            raw_materials(material_code, name),
            verified_by_production
          )
        `)
        .in("status", ["COMPLETE KIT SENT", "PARTIAL KIT SENT", "MAIN ASSEMBLY COMPONENTS SENT", "SUB ASSEMBLY COMPONENTS SENT", "ACCESSORY COMPONENTS SENT"])
        .eq("kit_items.verified_by_production", false);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch kits that have been verified by production
  const { data: verifiedKits = [] } = useQuery({
    queryKey: ["verified-kits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kit_preparation")
        .select(`
          *,
          production_orders!inner(
            voucher_number,
            quantity,
            production_schedules(
              projections(
                products(name)
              )
            )
          ),
          kit_items(
            *,
            raw_materials(material_code, name),
            verified_by_production
          )
        `)
        .in("status", ["COMPLETE KIT SENT", "PARTIAL KIT SENT", "MAIN ASSEMBLY COMPONENTS SENT", "SUB ASSEMBLY COMPONENTS SENT", "ACCESSORY COMPONENTS SENT"])
        .eq("kit_items.verified_by_production", true);

      if (error) throw error;
      return data || [];
    },
  });

  // Mutation to verify kit items
  const verifyKitMutation = useMutation({
    mutationFn: async ({ kitId }: { kitId: string }) => {
      // Update all kit items for this kit as verified
      const { error } = await supabase
        .from("kit_items")
        .update({
          verified_by_production: true
        })
        .eq("kit_preparation_id", kitId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kits-to-verify"] });
      queryClient.invalidateQueries({ queryKey: ["verified-kits"] });
      
      toast({
        title: "Kit Verified",
        description: "Kit has been verified by production",
      });
    },
    onError: (error) => {
      console.error("Error verifying kit:", error);
      toast({
        title: "Error",
        description: "Failed to verify kit",
        variant: "destructive",
      });
    },
  });

  const handleVerifyKit = (kitId: string) => {
    verifyKitMutation.mutate({ kitId });
  };

  const handleViewKitDetails = (kit: any) => {
    setSelectedKit(kit);
    setIsDetailViewOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETE KIT SENT': return 'default';
      case 'PARTIAL KIT SENT': return 'warning';
      case 'MAIN ASSEMBLY COMPONENTS SENT': return 'secondary';
      case 'SUB ASSEMBLY COMPONENTS SENT': return 'secondary';
      case 'ACCESSORY COMPONENTS SENT': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kits to Be Verified */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Kits to Be Verified ({kitsToVerify.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kitsToVerify.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No kits pending verification
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kit Number</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kitsToVerify.map((kit: any) => (
                      <TableRow key={kit.id}>
                        <TableCell className="font-mono">{kit.kit_number}</TableCell>
                        <TableCell>{kit.production_orders?.voucher_number}</TableCell>
                        <TableCell>{kit.production_orders?.production_schedules?.projections?.products?.name}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(kit.status) as any}>
                            {kit.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewKitDetails(kit)}
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleVerifyKit(kit.id)}
                              disabled={verifyKitMutation.isPending}
                              className="gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Verify
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Kits Verified */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Kits Verified ({verifiedKits.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {verifiedKits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No verified kits yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kit Number</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verified Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verifiedKits.map((kit: any) => (
                      <TableRow key={kit.id}>
                        <TableCell className="font-mono">{kit.kit_number}</TableCell>
                        <TableCell>{kit.production_orders?.voucher_number}</TableCell>
                        <TableCell>{kit.production_orders?.production_schedules?.projections?.products?.name}</TableCell>
                        <TableCell>
                          <Badge variant="default">
                            Verified
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {kit.updated_at ? format(new Date(kit.updated_at), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Kit Details Dialog */}
      <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Kit Details - {selectedKit?.kit_number}</DialogTitle>
          </DialogHeader>
          {selectedKit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <span className="text-sm text-muted-foreground">Voucher:</span>
                  <p className="font-medium">{selectedKit.production_orders?.voucher_number}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Product:</span>
                  <p className="font-medium">{selectedKit.production_orders?.production_schedules?.projections?.products?.name}</p>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material Code</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Required Qty</TableHead>
                    <TableHead>Issued Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedKit.kit_items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.raw_materials?.material_code}</TableCell>
                      <TableCell>{item.raw_materials?.name}</TableCell>
                      <TableCell>{item.required_quantity}</TableCell>
                      <TableCell>{item.issued_quantity || 0}</TableCell>
                      <TableCell>
                        <Badge variant={item.verified_by_production ? "default" : "secondary"}>
                          {item.verified_by_production ? "Verified" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KitVerification;
