
import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Plus } from "lucide-react";
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

// Mock data for customers and products
const mockCustomers = [
  "AudioTech Inc",
  "SoundMaster",
  "EchoSystems",
  "BassBoost Audio",
  "ClearSound Ltd"
];

const mockProducts = [
  "Speaker A300",
  "Subwoofer S200",
  "Tweeter T100",
  "Amplifier AM500",
  "Bluetooth Speaker B400",
  "Soundbar SB100"
];

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

// Mock data for projections
const mockProjections = [
  { id: "1", customer: "AudioTech Inc", product: "Speaker A300", quantity: 5000, deliveryMonth: "2025-06", status: "New" },
  { id: "2", customer: "SoundMaster", product: "Subwoofer S200", quantity: 2000, deliveryMonth: "2025-06", status: "Confirmed" },
  { id: "3", customer: "EchoSystems", product: "Tweeter T100", quantity: 10000, deliveryMonth: "2025-07", status: "New" },
];

const Projection = () => {
  const [projections, setProjections] = useState(mockProjections);
  const [newProjection, setNewProjection] = useState({
    customer: "",
    product: "",
    quantity: "",
    deliveryMonth: "",
  });
  const { toast } = useToast();

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

  const handleAddProjection = () => {
    // Validate inputs
    if (!newProjection.customer || !newProjection.product || !newProjection.quantity || !newProjection.deliveryMonth) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Add new projection
    const projection = {
      id: `${projections.length + 1}`,
      ...newProjection,
      quantity: parseInt(newProjection.quantity),
      status: "New",
    };

    setProjections((prev) => [projection, ...prev]);
    
    // Reset form
    setNewProjection({
      customer: "",
      product: "",
      quantity: "",
      deliveryMonth: "",
    });

    toast({
      title: "Projection added",
      description: "New customer projection has been added successfully",
    });
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
                  value={newProjection.customer}
                  onValueChange={(value) => handleSelectChange("customer", value)}
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCustomers.map((customer) => (
                      <SelectItem key={customer} value={customer}>
                        {customer}
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
                  value={newProjection.product}
                  onValueChange={(value) => handleSelectChange("product", value)}
                >
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockProducts.map((product) => (
                      <SelectItem key={product} value={product}>
                        {product}
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
                  value={newProjection.deliveryMonth}
                  onValueChange={(value) => handleSelectChange("deliveryMonth", value)}
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
                <Button onClick={handleAddProjection}>Add Projection</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Projections</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Delivery Month</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projections.map((projection) => (
                  <TableRow key={projection.id}>
                    <TableCell className="font-medium">{projection.customer}</TableCell>
                    <TableCell>{projection.product}</TableCell>
                    <TableCell>{projection.quantity.toLocaleString()}</TableCell>
                    <TableCell>{formatMonth(projection.deliveryMonth)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        projection.status === "New" ? "bg-blue-100 text-blue-800" : 
                        projection.status === "Confirmed" ? "bg-green-100 text-green-800" : 
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {projection.status}
                      </span>
                    </TableCell>
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

export default Projection;
