import React, { useState } from 'react';
import { Clock, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { EstimateDuration } from '@shared/timer-types';
import { cn } from '@/lib/utils';

interface DurationPickerProps {
  value?: number; // Duration in minutes
  onChange: (minutes: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showEditIconOnHover?: boolean;
}

const PRESET_DURATIONS = [
  { label: '15 minutes', value: EstimateDuration.THIRTY_MINUTES / 2 },
  { label: '30 minutes', value: EstimateDuration.THIRTY_MINUTES },
  { label: '1 hour', value: EstimateDuration.ONE_HOUR },
  { label: '1.5 hours', value: EstimateDuration.ONE_HOUR + 30 },
  { label: '2 hours', value: EstimateDuration.TWO_HOURS },
  { label: '3 hours', value: EstimateDuration.TWO_HOURS + 60 },
  { label: '4 hours', value: EstimateDuration.FOUR_HOURS },
  { label: '6 hours', value: EstimateDuration.FOUR_HOURS + 120 },
  { label: '8 hours', value: EstimateDuration.FOUR_HOURS * 2 },
];

export function DurationPicker({
  value,
  onChange,
  placeholder = "Select duration",
  className,
  disabled = false,
  showEditIconOnHover = false,
}: DurationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  const handlePresetSelect = (minutes: number) => {
    onChange(minutes);
    setIsOpen(false);
  };

  const handleCustomSubmit = () => {
    const hours = parseInt(customHours) || 0;
    const minutes = parseInt(customMinutes) || 0;
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes > 0) {
      onChange(totalMinutes);
      setIsOpen(false);
      setCustomHours('');
      setCustomMinutes('');
    }
  };

  const displayValue = value ? formatDuration(value) : placeholder;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-between font-normal",
            showEditIconOnHover && "group",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {displayValue}
          </div>
          <Edit3 className={cn("w-4 h-4", showEditIconOnHover ? "opacity-0 group-hover:opacity-50 transition-opacity" : "opacity-50")} />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h4 className="font-medium">Estimated Duration</h4>
          </div>

          {/* Preset Options */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">
              Quick Select
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_DURATIONS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={value === preset.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetSelect(preset.value)}
                  className="justify-start text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Duration */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-xs font-medium text-gray-600">
              Custom Duration
            </Label>
            
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Label htmlFor="hours" className="text-xs">Hours</Label>
                <Input
                  id="hours"
                  type="number"
                  min="0"
                  max="23"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  placeholder="0"
                  className="text-center"
                />
              </div>
              
              <span className="text-gray-400 mt-5">:</span>
              
              <div className="flex-1">
                <Label htmlFor="minutes" className="text-xs">Minutes</Label>
                <Input
                  id="minutes"
                  type="number"
                  min="0"
                  max="59"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="0"
                  className="text-center"
                />
              </div>
            </div>

            <Button
              onClick={handleCustomSubmit}
              disabled={!customHours && !customMinutes}
              className="w-full"
              size="sm"
            >
              Set Custom Duration
            </Button>
          </div>

          {/* Clear Option */}
          {value && (
            <div className="border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(0);
                  setIsOpen(false);
                }}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Remove Estimate
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Compact version for inline use
 */
export function CompactDurationPicker({
  value,
  onChange,
  className,
  disabled = false,
}: Omit<DurationPickerProps, 'placeholder'>) {
  return (
    <Select
      value={value?.toString() || ''}
      onValueChange={(val) => onChange(parseInt(val) || 0)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-32", className)}>
        <SelectValue placeholder="Estimate">
          {value ? (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span className="text-xs">
                {Math.floor(value / 60)}h {value % 60}m
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="text-xs">Estimate</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      
      <SelectContent>
        {PRESET_DURATIONS.map((preset) => (
          <SelectItem key={preset.value} value={preset.value.toString()}>
            {preset.label}
          </SelectItem>
        ))}
        <SelectItem value="0">No estimate</SelectItem>
      </SelectContent>
    </Select>
  );
}