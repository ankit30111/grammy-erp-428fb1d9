import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Container, useUpdateContainer } from "@/hooks/useContainers";

interface EditContainerDialogProps {
  container: Container | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'LOADING', label: 'Loading' },
  { value: 'LOADED', label: 'Loaded' },
  { value: 'CHINA_CUSTOM', label: 'China Custom' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'INDIAN_DOCK', label: 'Indian Dock' },
  { value: 'IN_TRAIN', label: 'In Train' },
  { value: 'INDIA_CUSTOM', label: 'India Custom' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'ARRIVED', label: 'Arrived' }
];

export default function EditContainerDialog({ container, open, onOpenChange }: EditContainerDialogProps) {
  const form = useForm<Partial<Container>>();
  const updateContainer = useUpdateContainer();

  useEffect(() => {
    if (container) {
      form.reset({
        container_number: container.container_number,
        current_status: container.current_status,
        ordered_date: container.ordered_date,
        loading_date: container.loading_date,
        loaded_date: container.loaded_date,
        china_custom_date: container.china_custom_date,
        shipped_date: container.shipped_date,
        in_transit_date: container.in_transit_date,
        indian_dock_date: container.indian_dock_date,
        in_train_date: container.in_train_date,
        india_custom_date: container.india_custom_date,
        dispatched_date: container.dispatched_date,
        arrived_date: container.arrived_date,
        supplier_info: container.supplier_info,
        notes: container.notes
      });
    }
  }, [container, form]);

  const onSubmit = async (data: Partial<Container>) => {
    if (!container) return;
    
    try {
      await updateContainer.mutateAsync({
        id: container.id,
        ...data
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating container:', error);
    }
  };

  if (!container) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Container</DialogTitle>
          <DialogDescription>
            Update container information and status
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="container_number"
                rules={{ required: "Container number is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Container Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter container number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="current_status"
                rules={{ required: "Status is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ordered_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordered Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="loading_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loading Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="loaded_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loaded Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipped_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipped Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="indian_dock_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indian Dock Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="arrived_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arrived Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="supplier_info"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Information</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter supplier details" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter any additional notes"
                      {...field} 
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateContainer.isPending}>
                {updateContainer.isPending ? 'Updating...' : 'Update Container'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}