
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, BookOpen, Download, Upload } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MovementRecord {
  id: string;
  date: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  actionType: 'RECEIVED' | 'ISSUED';
  referenceNumber: string;
  issuedTo: string;
  bomSection?: string;
  notes?: string;
}

export default function MaterialMovementLogBook() {
  const { toast } = useToast();
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<MovementRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMovementHistory();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('material-movements')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory'
        },
        () => {
          loadMovementHistory();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grn_items'
        },
        () => {
          loadMovementHistory();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kit_items'
        },
        () => {
          loadMovementHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterMovements();
  }, [movements, searchTerm, actionFilter]);

  const loadMovementHistory = async () => {
    try {
      setIsLoading(true);
      
      // Load received materials (from GRN items)
      const { data: receivedMaterials, error: receivedError } = await supabase
        .from('grn_items')
        .select(`
          id,
          accepted_quantity,
          store_confirmed_at,
          raw_materials!inner(
            material_code,
            name
          ),
          grn!inner(
            grn_number,
            purchase_orders!inner(po_number)
          )
        `)
        .eq('store_confirmed', true)
        .order('store_confirmed_at', { ascending: false });

      if (receivedError) throw receivedError;

      // Load issued materials (from kit items)
      const { data: issuedMaterials, error: issuedError } = await supabase
        .from('kit_items')
        .select(`
          id,
          actual_quantity,
          created_at,
          raw_materials!inner(
            material_code,
            name
          ),
          kit_preparation!inner(
            kit_number,
            production_orders!inner(
              voucher_number,
              production_schedules!inner(
                projections!inner(
                  products!inner(name)
                )
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (issuedError) throw issuedError;

      // Transform received materials
      const receivedRecords: MovementRecord[] = receivedMaterials?.map(item => ({
        id: `received-${item.id}`,
        date: item.store_confirmed_at,
        materialCode: item.raw_materials.material_code,
        materialName: item.raw_materials.name,
        quantity: item.accepted_quantity,
        actionType: 'RECEIVED',
        referenceNumber: item.grn.grn_number,
        issuedTo: `PO: ${item.grn.purchase_orders.po_number}`,
        notes: 'Material received after IQC approval'
      })) || [];

      // Transform issued materials
      const issuedRecords: MovementRecord[] = issuedMaterials?.map(item => ({
        id: `issued-${item.id}`,
        date: item.created_at,
        materialCode: item.raw_materials.material_code,
        materialName: item.raw_materials.name,
        quantity: item.actual_quantity,
        actionType: 'ISSUED',
        referenceNumber: item.kit_preparation.kit_number,
        issuedTo: 'Production',
        bomSection: 'Production Kit',
        notes: `Voucher: ${item.kit_preparation.production_orders.voucher_number}`
      })) || [];

      // Combine and sort by date
      const allMovements = [...receivedRecords, ...issuedRecords].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setMovements(allMovements);

    } catch (error) {
      console.error('Error loading movement history:', error);
      toast({
        title: "Error",
        description: "Failed to load movement history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterMovements = () => {
    let filtered = movements;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(movement =>
        movement.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.issuedTo.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by action type
    if (actionFilter !== "ALL") {
      filtered = filtered.filter(movement => movement.actionType === actionFilter);
    }

    setFilteredMovements(filtered);
  };

  const getActionBadge = (actionType: string) => {
    return actionType === 'RECEIVED' ? (
      <Badge variant="default" className="gap-1">
        <Download className="h-3 w-3" />
        Received
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <Upload className="h-3 w-3" />
        Issued
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Material Movement Log Book
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading movement history...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Material Movement Log Book ({movements.length} records)
        </CardTitle>
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search materials, vouchers..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Actions</SelectItem>
              <SelectItem value="RECEIVED">Received Only</SelectItem>
              <SelectItem value="ISSUED">Issued Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredMovements.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Material Code</TableHead>
                  <TableHead>Material Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Action Type</TableHead>
                  <TableHead>Reference Number</TableHead>
                  <TableHead>Issued To / Source</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{format(new Date(movement.date), 'MMM dd, yyyy HH:mm')}</TableCell>
                    <TableCell className="font-mono">{movement.materialCode}</TableCell>
                    <TableCell>{movement.materialName}</TableCell>
                    <TableCell className={movement.actionType === 'RECEIVED' ? "text-green-600" : "text-orange-600"}>
                      {movement.actionType === 'RECEIVED' ? '+' : '-'}{movement.quantity}
                    </TableCell>
                    <TableCell>{getActionBadge(movement.actionType)}</TableCell>
                    <TableCell className="font-mono">{movement.referenceNumber}</TableCell>
                    <TableCell>{movement.issuedTo}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{movement.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="mx-auto h-12 w-12 opacity-50 mb-4" />
            <p>No movement records found</p>
            <p className="text-sm mt-1">Material movements will appear here as they occur</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
