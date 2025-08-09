import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export function TimePicker({ 
  value, 
  onChange, 
  label, 
  disabled, 
  className,
  error 
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeInput, setTimeInput] = useState("");
  const [dateInput, setDateInput] = useState("");

  // Update inputs when value changes
  useEffect(() => {
    setTimeInput(format(value, "HH:mm"));
    setDateInput(format(value, "yyyy-MM-dd"));
  }, [value]);

  const handleTimeChange = (newTime: string) => {
    setTimeInput(newTime);
    
    // Parse the time and combine with current date
    const timeParts = newTime.split(':');
    if (timeParts.length === 2) {
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const newDate = new Date(value);
        newDate.setHours(hours, minutes, 0, 0);
        onChange(newDate);
      }
    }
  };

  const handleDateChange = (newDate: string) => {
    setDateInput(newDate);
    
    // Parse the date and combine with current time
    const parsedDate = parse(newDate, "yyyy-MM-dd", new Date());
    if (isValid(parsedDate)) {
      const newDateTime = new Date(parsedDate);
      newDateTime.setHours(value.getHours(), value.getMinutes(), 0, 0);
      onChange(newDateTime);
    }
  };

  const formatDisplayValue = () => {
    return format(value, "MMM d, yyyy 'at' h:mm a");
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium text-foreground">
          {label}
        </Label>
      )}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              disabled && "opacity-50 cursor-not-allowed",
              error && "border-destructive"
            )}
            disabled={disabled}
            data-testid="time-picker-trigger"
          >
            <Clock className="mr-2 h-4 w-4" />
            {formatDisplayValue()}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-80 p-4" align="start" data-testid="time-picker-content">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date-input" className="text-sm font-medium">
                Date
              </Label>
              <Input
                id="date-input"
                type="date"
                value={dateInput}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full"
                data-testid="date-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="time-input" className="text-sm font-medium">
                Time
              </Label>
              <Input
                id="time-input"
                type="time"
                value={timeInput}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full"
                data-testid="time-input"
              />
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                Preview: {formatDisplayValue()}
              </span>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                data-testid="time-picker-done"
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {error && (
        <p className="text-sm text-destructive" data-testid="time-picker-error">
          {error}
        </p>
      )}
    </div>
  );
}