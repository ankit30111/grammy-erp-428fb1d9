
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Plus, Edit, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { format, addMonths } from "date-fns";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { useProjections, useCreateProjection, useDeleteProjection } from "@/hooks/useProjections";
import { useDispatchOrders } from "@/hooks/useDispatchOrders";
import { EditProjectionDialog } from "@/components/Projections/EditProjectionDialog";

// Generate the next 12 months
const generateMonths = () => {
  const months = [];
  const today = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = addMonths(today, i);
    const monthYear = format(date, "MMM yyyy");
    const value = format(date, "yyyy-MM");
    months.push({ label: monthYear, value });
  }
  
  return months;
};

const months = generateMonths();

const Projection = () => {
  const [newProjection, setNewProjection] = useState({
    customer_id: "",
    product_id: "",
    quantity: "",
    delivery_month: "",
  });
  const [editingProjection, setEditingProjection] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch data from database
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: projections, isLoading: projectionsLoading } = useProjections();
  const { data: dispatchOrders } = useDispatchOrders();
  const createProjection = useCreateProjection();
  const deleteProjection = useDeleteProjection();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewProjection((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setNewProjection((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddProjection = async () => {
    // Validate inputs
    if (!newProjection.customer_id || !newProjection.product_id || !newProjection.quantity || !newProjection.delivery_month) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await createProjection.mutateAsync({
        customer_id: newProjection.customer_id,
        product_id: newProjection.product_id,
        quantity: parseInt(newProjection.quantity),
        delivery_month: newProjection.delivery_month,
      });

      // Reset form
      setNewProjection({
        customer_id: "",
        product_id: "",
        quantity: "",
        delivery_month: "",
      });

      toast({
        title: "Projection added",
        description: "New customer projection has been added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add projection. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditProjection = (projection: any) => {
    setEditingProjection(projection);
    setIsEditDialogOpen(true);
  };

  const handleDeleteProjection = async (projectionId: string) => {
    if (window.confirm("Are you sure you want to delete this projection?")) {
      try {
        await deleteProjection.mutateAsync(projectionId);
        toast({
          title: "Projection deleted",
          description: "Customer projection has been deleted successfully",
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete projection. Please try again.";
        toast({
          title: "Cannot delete projection",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  // Calculate supplied quantity from dispatch orders
  const getSuppliedQuantity = (customerId: string, productId: string, deliveryMonth: string) => {
    if (!dispatchOrders) return 0;
    
    const monthYear = deliveryMonth; // format: yyyy-MM
    return dispatchOrders
      .filter(order => {
        const orderMonth = format(new Date(order.dispatch_date), 'yyyy-MM');
        return order.customer_id === customerId && orderMonth === monthYear;
      })
      .reduce((total, order) => {
        const productItems = order.dispatch_order_items?.filter(item => item.product_id === productId) || [];
        return total + productItems.reduce((sum, item) => sum + item.quantity, 0);
      }, 0);
  };

  // Format month for display
  const formatMonth = (monthValue: string) => {
    const month = months.find(m => m.value === monthValue);
    return month ? month.label : monthValue;
  };

  return (
    <DashboardLayout>
      <div className="grid gap-4 md:gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Customer Projections</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last updated:</span>
            <span className="text-sm font-medium">Today, 14:35</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus size={20} className="text-primary" />
              Add New Projection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="customer" className="text-sm font-medium mb-1 block">
                  Customer
                </label>
                <Select
                  value={newProjection.customer_id}
                  onValueChange={(value) => handleSelectChange("customer_id", value)}
                  disabled={customersLoading}
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder={customersLoading ? "Loading..." : "Select customer"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="product" className="text-sm font-medium mb-1 block">
                  Product
                </label>
                <Select
                  value={newProjection.product_id}
                  onValueChange={(value) => handleSelectChange("product_id", value)}
                  disabled={productsLoading}
                >
                  <SelectTrigger id="product">
                    <SelectValue placeholder={productsLoading ? "Loading..." : "Select product"} />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="quantity" className="text-sm font-medium mb-1 block">
                  Quantity
                </label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  value={newProjection.quantity}
                  onChange={handleInputChange}
                  placeholder="Required quantity"
                />
              </div>
              <div>
                <label htmlFor="deliveryMonth" className="text-sm font-medium mb-1 block">
                  Delivery Month
                </label>
                <Select
                  value={newProjection.delivery_month}
                  onValueChange={(value) => handleSelectChange("delivery_month", value)}
                >
                  <SelectTrigger id="deliveryMonth">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 lg:col-span-4 flex justify-end mt-2">
                <Button 
                  onClick={handleAddProjection}
                  disabled={createProjection.isPending}
                >
                  {createProjection.isPending ? "Adding..." : "Add Projection"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Projections</CardTitle>
          </CardHeader>
          <CardContent>
            {projectionsLoading ? (
              <div className="text-center py-4">Loading projections...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Projected Qty</TableHead>
                    <TableHead>Supplied Qty</TableHead>
                    <TableHead>Pending Qty</TableHead>
                    <TableHead>Delivery Month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projections?.map((projection) => {
                    const suppliedQty = getSuppliedQuantity(
                      projection.customer_id, 
                      projection.product_id, 
                      projection.delivery_month
                    );
                    const pendingQty = projection.quantity - suppliedQty;
                    
                    return (
                      <TableRow key={projection.id}>
                        <TableCell className="font-medium">
                          {projection.customers?.name}
                        </TableCell>
                        <TableCell>{projection.products?.name}</TableCell>
                        <TableCell>{projection.quantity.toLocaleString()}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {suppliedQty.toLocaleString()}
                        </TableCell>
                        <TableCell className={pendingQty > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                          {pendingQty.toLocaleString()}
                        </TableCell>
                        <TableCell>{formatMonth(projection.delivery_month)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            projection.status === "New" ? "bg-blue-100 text-blue-800" : 
                            projection.status === "Confirmed" ? "bg-green-100 text-green-800" : 
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {projection.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditProjection(projection)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteProjection(projection.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <EditProjectionDialog
          projection={editingProjection}
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setEditingProjection(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default Projection;
