import { Building2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlant } from "@/contexts/PlantContext";

export function PlantSwitcher() {
  const { plants, activePlant, setActivePlant, loading } = usePlant();

  if (loading || plants.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-3 text-sm font-medium"
        >
          <Building2 className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">
            {activePlant?.name ?? "Select plant"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch plant</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {plants.map((plant) => (
          <DropdownMenuItem
            key={plant.id}
            onClick={() => setActivePlant(plant.id)}
            className="cursor-pointer flex items-center justify-between"
          >
            <div className="flex flex-col">
              <span className="font-medium">{plant.name}</span>
              <span className="text-xs text-muted-foreground">{plant.code}</span>
            </div>
            {activePlant?.id === plant.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}