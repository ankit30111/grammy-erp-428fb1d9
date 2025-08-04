import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useVendors } from '@/hooks/useVendors';

interface VendorDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export const VendorDropdown = ({ value, onValueChange, placeholder = "Select vendor..." }: VendorDropdownProps) => {
  const [open, setOpen] = useState(false);
  const { vendors, isLoading } = useVendors();

  const selectedVendor = vendors.find(vendor => vendor.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isLoading}
        >
          {selectedVendor ? (
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs bg-muted px-1 rounded">
                {selectedVendor.vendor_code}
              </span>
              {selectedVendor.name}
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search vendors..." />
          <CommandList>
            <CommandEmpty>No vendors found.</CommandEmpty>
            <CommandGroup>
              {vendors.map((vendor) => (
                <CommandItem
                  key={vendor.id}
                  value={`${vendor.vendor_code} ${vendor.name}`}
                  onSelect={() => {
                    onValueChange(vendor.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === vendor.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-muted px-1 rounded">
                      {vendor.vendor_code}
                    </span>
                    <span>{vendor.name}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};