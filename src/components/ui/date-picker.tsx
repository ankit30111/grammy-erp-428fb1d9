import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** yyyy-MM-dd, or empty */
  value: string;
  onChange: (value: string) => void;
  /** Earliest date that can be picked, yyyy-MM-dd */
  min?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * A date field the size of any other input. The month opens in a popover of
 * fixed size instead of sitting on the page, so it never stretches a card or
 * pushes the form around.
 */
export const DatePicker = ({ value, onChange, min, placeholder = "Pick a date", id, className, disabled }: DatePickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  const minDate = min ? parseISO(min) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start normal-case tracking-normal font-normal text-sm min-h-10",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="opacity-60" />
          {selected ? format(selected, "EEE, d MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate}
          onSelect={(d) => {
            if (!d) return;
            onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          disabled={minDate ? (d) => d < minDate : undefined}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};
