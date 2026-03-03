import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Eye } from "lucide-react";

const customerTypes = ["Distributor", "Dealer", "Retailer", "Institutional"];

interface Props {
  customers: any[] | undefined;
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (customer: any) => void;
}

export function CustomerListView({ customers, isLoading, onAdd, onEdit }: Props) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = customers?.filter((c: any) => {
    const s = search.toLowerCase();
    const matchSearch =
      c.customer_name.toLowerCase().includes(s) ||
      (c.gst_number || "").toLowerCase().includes(s) ||
      (c.phone || "").includes(s) ||
      (c.territory || "").toLowerCase().includes(s) ||
      (c.salesman_name || "").toLowerCase().includes(s);
    const matchType = filterType === "all" || c.customer_type === filterType;
    const matchStatus = filterStatus === "all" || (filterStatus === "active" ? c.is_active : !c.is_active);
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Network</h1>
          <p className="text-muted-foreground">Dealers, distributors & retailers</p>
        </div>
        <Button onClick={onAdd}><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, GST, phone, territory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {customerTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>Territory</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Salesman</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => onEdit(c)}>
                  <TableCell className="font-medium">{c.customer_name}</TableCell>
                  <TableCell><Badge variant="outline">{c.customer_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{c.gst_number || "—"}</TableCell>
                  <TableCell>{c.territory || "—"}</TableCell>
                  <TableCell>₹{Number(c.credit_limit).toLocaleString()}</TableCell>
                  <TableCell className={Number(c.outstanding_balance) > 0 ? "text-destructive font-bold" : ""}>
                    ₹{Number(c.outstanding_balance).toLocaleString()}
                  </TableCell>
                  <TableCell>{c.salesman_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit(c); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!filtered || filtered.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {isLoading ? "Loading..." : "No customers found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
