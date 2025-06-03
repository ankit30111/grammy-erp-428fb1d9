
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CustomerComplaints = () => {
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [brandName, setBrandName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<Date>();
  const [complaintDate, setComplaintDate] = useState<Date>(new Date());
  const [complaintReason, setComplaintReason] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTab, setSelectedTab] = useState("form");

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

  const createComplaintMutation = useMutation({
    mutationFn: async (complaintData: any) => {
      const { data, error } = await supabase
        .from("customer_complaints")
        .insert([complaintData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Customer complaint recorded successfully",
      });
      // Reset form
      setSelectedCustomer("");
      setBrandName("");
      setSelectedProduct("");
      setQuantity("");
      setBillNumber("");
      setPurchaseDate(undefined);
      setComplaintDate(new Date());
      setComplaintReason("");
      queryClient.invalidateQueries({ queryKey: ["customer-complaints"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record complaint",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomer || !brandName || !selectedProduct || !quantity || !billNumber || !complaintReason) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const complaintData = {
      customer_id: selectedCustomer,
      brand_name: brandName,
      product_id: selectedProduct,
      quantity: parseInt(quantity),
      bill_number: billNumber,
      purchase_date: purchaseDate?.toISOString().split('T')[0],
      complaint_date: complaintDate.toISOString().split('T')[0],
      complaint_reason: complaintReason,
    };

    createComplaintMutation.mutate(complaintData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'destructive';
      case 'In Progress': return 'secondary';
      case 'Resolved': return 'default';
      case 'Closed': return 'outline';
      default: return 'outline';
    }
  };

  const filteredComplaints = complaints.filter(complaint => 
    !searchFilter || 
    complaint.customers.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    complaint.brand_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    complaint.products.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    complaint.bill_number.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Customer Complaints</h1>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">New Complaint</TabsTrigger>
            <TabsTrigger value="list">All Complaints</TabsTrigger>
          </TabsList>
          
          <TabsContent value="form">
            <Card>
              <CardHeader>
                <CardTitle>Register New Complaint</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customer">Customer Name *</Label>
                      <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
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
                      <Label htmlFor="brand">Brand Name *</Label>
                      <Input
                        id="brand"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="Enter brand name"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="product">Product Name *</Label>
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.product_code} - {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Enter quantity"
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bill">Bill Number *</Label>
                      <Input
                        id="bill"
                        value={billNumber}
                        onChange={(e) => setBillNumber(e.target.value)}
                        placeholder="Enter bill number"
                        required
                      />
                    </div>

                    <div>
                      <Label>Purchase Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !purchaseDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {purchaseDate ? format(purchaseDate, "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={purchaseDate}
                            onSelect={setPurchaseDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div>
                    <Label>Complaint Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(complaintDate, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={complaintDate}
                          onSelect={(date) => date && setComplaintDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="reason">Complaint Reason *</Label>
                    <Textarea
                      id="reason"
                      value={complaintReason}
                      onChange={(e) => setComplaintReason(e.target.value)}
                      placeholder="Describe the complaint in detail..."
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={createComplaintMutation.isPending}
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {createComplaintMutation.isPending ? "Recording..." : "Record Complaint"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="list">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                <CardTitle>All Complaints</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search complaints..." 
                    className="pl-8"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredComplaints.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No complaints found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Bill Number</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComplaints.map((complaint) => (
                        <TableRow key={complaint.id}>
                          <TableCell>
                            {new Date(complaint.complaint_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{complaint.customers.name}</TableCell>
                          <TableCell>{complaint.brand_name}</TableCell>
                          <TableCell>{complaint.products.name}</TableCell>
                          <TableCell>{complaint.bill_number}</TableCell>
                          <TableCell>{complaint.quantity}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(complaint.status) as any}>
                              {complaint.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CustomerComplaints;
