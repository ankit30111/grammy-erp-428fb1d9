
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";

const CustomerComplaints = () => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    brand_name: "",
    product_id: "",
    quantity: "",
    bill_number: "",
    complaint_date: "",
    purchase_date: "",
    complaint_reason: "",
    status: "Open"
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, product_code")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch complaints
  const { data: complaints = [] } = useQuery({
    queryKey: ["customer-complaints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_complaints")
        .select(`
          *,
          customers!inner(name),
          products!inner(name, product_code)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Create complaint mutation
  const createComplaintMutation = useMutation({
    mutationFn: async (complaintData: any) => {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("customer_complaints")
        .insert({
          ...complaintData,
          quantity: parseInt(complaintData.quantity),
          complaint_date: complaintData.complaint_date,
          purchase_date: complaintData.purchase_date || null,
          created_by: user.data.user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Customer complaint created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["customer-complaints"] });
      setShowForm(false);
      setFormData({
        customer_id: "",
        brand_name: "",
        product_id: "",
        quantity: "",
        bill_number: "",
        complaint_date: "",
        purchase_date: "",
        complaint_reason: "",
        status: "Open"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create complaint",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createComplaintMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return <Badge variant="destructive">Open</Badge>;
      case "CAPA SHARED WITH CUSTOMER":
        return <Badge variant="default">CAPA Shared</Badge>;
      case "IQC_COMPLETED":
        return <Badge variant="secondary">IQC Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Customer Complaints</h1>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Complaint
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Complaint</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer Name</Label>
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Brand Name</Label>
                    <Input
                      value={formData.brand_name}
                      onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Product Name</Label>
                    <Select
                      value={formData.product_id}
                      onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.product_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Bill Number</Label>
                    <Input
                      value={formData.bill_number}
                      onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Date of Complaint</Label>
                    <Input
                      type="date"
                      value={formData.complaint_date}
                      onChange={(e) => setFormData({ ...formData, complaint_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Purchase Date</Label>
                    <Input
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="CAPA SHARED WITH CUSTOMER">CAPA Shared with Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Complaint Reason</Label>
                  <Textarea
                    value={formData.complaint_reason}
                    onChange={(e) => setFormData({ ...formData, complaint_reason: e.target.value })}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={createComplaintMutation.isPending}>
                    {createComplaintMutation.isPending ? "Creating..." : "Create Complaint"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>All Complaints</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search complaints..." className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Bill Number</TableHead>
                  <TableHead>Complaint Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.map((complaint) => (
                  <TableRow key={complaint.id}>
                    <TableCell>{complaint.customers?.name}</TableCell>
                    <TableCell>{complaint.brand_name}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{complaint.products?.name}</div>
                        <div className="text-sm text-muted-foreground">{complaint.products?.product_code}</div>
                      </div>
                    </TableCell>
                    <TableCell>{complaint.quantity}</TableCell>
                    <TableCell>{complaint.bill_number}</TableCell>
                    <TableCell>{format(new Date(complaint.complaint_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                    <TableCell className="max-w-xs truncate">{complaint.complaint_reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CustomerComplaints;
