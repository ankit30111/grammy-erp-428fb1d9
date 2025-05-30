
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCustomers } from "@/hooks/useCustomers";
import { useProducts } from "@/hooks/useProducts";
import { useUpdateProjection } from "@/hooks/useProjections";
import { format, addMonths } from "date-fns";

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

interface EditProjectionDialogProps {
  projection: any;
  isOpen: boolean;
  onClose: () => void;
}

export const EditProjectionDialog = ({ projection, isOpen, onClose }: EditProjectionDialogProps) => {
  const [formData, setFormData] = useState({
    customer_id: "",
    product_id: "",
    quantity: "",
    delivery_month: "",
  });
  
  const { toast } = useToast();
  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const updateProjection = useUpdateProjection();

  useEffect(() => {
    if (projection) {
      setFormData({
        customer_id: projection.customer_id,
        product_id: projection.product_id,
        quantity: projection.quantity.toString(),
        delivery_month: projection.delivery_month,
      });
    }
  }, [projection]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.customer_id || !formData.product_id || !formData.quantity || !formData.delivery_month) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateProjection.mutateAsync({
        id: projection.id,
        updates: {
          customer_id: formData.customer_id,
          product_id: formData.product_id,
          quantity: parseInt(formData.quantity),
          delivery_month: formData.delivery_month,
        }
      });

      toast({
        title: "Projection updated",
        description: "Customer projection has been updated successfully",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update projection. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatMonth = (monthValue: string) => {
    const month = months.find(m => m.value === monthValue);
    return month ? month.label : monthValue;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Projection</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="customer">Customer</Label>
            <Select
              value={formData.customer_id}
              onValueChange={(value) => handleSelectChange("customer_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
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
            <Label htmlFor="product">Product</Label>
            <Select
              value={formData.product_id}
              onValueChange={(value) => handleSelectChange("product_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
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
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              value={formData.quantity}
              onChange={handleInputChange}
              placeholder="Required quantity"
            />
          </div>
          
          <div>
            <Label htmlFor="deliveryMonth">Delivery Month</Label>
            <Select
              value={formData.delivery_month}
              onValueChange={(value) => handleSelectChange("delivery_month", value)}
            >
              <SelectTrigger>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateProjection.isPending}
          >
            {updateProjection.isPending ? "Updating..." : "Update Projection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
