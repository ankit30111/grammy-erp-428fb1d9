
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const KitVerification = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
                    <TableHead>Action</TableHead>
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
                        <Button
                          size="sm"
                          onClick={() => handleVerifyKit(kit.id)}
                          disabled={verifyKitMutation.isPending}
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Verify
                        </Button>
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
                        {kit.sent_to_production_at ? format(new Date(kit.sent_to_production_at), 'MMM dd, yyyy') : '-'}
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
  );
};

export default KitVerification;
