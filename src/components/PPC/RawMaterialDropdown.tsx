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
import { useRawMaterials } from '@/hooks/useRawMaterials';

interface RawMaterialDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  excludeIds?: string[];
}

export const RawMaterialDropdown = ({ 
  value, 
  onValueChange, 
  placeholder = "Select material...",
  excludeIds = []
}: RawMaterialDropdownProps) => {
  const [open, setOpen] = useState(false);
  const { rawMaterials, isLoading } = useRawMaterials();

  const filteredMaterials = rawMaterials.filter(material => 
    !excludeIds.includes(material.id)
  );

  const selectedMaterial = rawMaterials.find(material => material.id === value);

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
          {selectedMaterial ? (
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs bg-muted px-1 rounded">
                {selectedMaterial.material_code}
              </span>
              {selectedMaterial.name}
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search materials..." />
          <CommandList>
            <CommandEmpty>No materials found.</CommandEmpty>
            <CommandGroup>
              {filteredMaterials.map((material) => (
                <CommandItem
                  key={material.id}
                  value={`${material.material_code} ${material.name}`}
                  onSelect={() => {
                    onValueChange(material.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === material.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-muted px-1 rounded">
                      {material.material_code}
                    </span>
                    <span>{material.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({material.category})
                    </span>
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