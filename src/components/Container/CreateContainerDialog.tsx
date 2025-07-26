import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateContainer, Container } from "@/hooks/useContainers";

interface CreateContainerDialogProps {
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

export default function CreateContainerDialog({ open, onOpenChange }: CreateContainerDialogProps) {
  const form = useForm<Omit<Container, 'id' | 'created_at' | 'updated_at'>>();
  const createContainer = useCreateContainer();

  const onSubmit = async (data: Omit<Container, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await createContainer.mutateAsync(data);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating container:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Container</DialogTitle>
          <DialogDescription>
            Create a new container to track its import journey
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            <FormField
              control={form.control}
              name="ordered_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordered Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supplier_info"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Information</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter supplier details" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vessel_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vessel Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter vessel name" {...field} />
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
              <Button type="submit" disabled={createContainer.isPending}>
                {createContainer.isPending ? 'Creating...' : 'Create Container'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}