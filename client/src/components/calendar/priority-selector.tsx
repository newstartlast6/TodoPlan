import { useState } from "react";
import { Flag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Priority = 'low' | 'medium' | 'high';

interface PrioritySelectorProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  disabled?: boolean;
  className?: string;
}

const priorityConfig = {
  low: {
    label: 'Low Priority',
    color: 'text-green-600 bg-green-100 border-green-200',
    icon: '🟢',
  },
  medium: {
    label: 'Medium Priority',
    color: 'text-yellow-600 bg-yellow-100 border-yellow-200',
    icon: '🟡',
  },
  high: {
    label: 'High Priority',
    color: 'text-red-600 bg-red-100 border-red-200',
    icon: '🔴',
  },
} as const;

export function PrioritySelector({ value, onChange, disabled, className }: PrioritySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentConfig = priorityConfig[value];

  const handleSelect = (priority: Priority) => {
    onChange(priority);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-between h-auto p-2 border",
            currentConfig.color,
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          disabled={disabled}
          data-testid="priority-selector-trigger"
        >
          <div className="flex items-center space-x-2">
            <Flag className="w-4 h-4" />
            <span className="text-sm font-medium">{currentConfig.label}</span>
          </div>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-48" data-testid="priority-selector-content">
        {(Object.keys(priorityConfig) as Priority[]).map((priority) => {
          const config = priorityConfig[priority];
          const isSelected = priority === value;
          
          return (
            <DropdownMenuItem
              key={priority}
              onClick={() => handleSelect(priority)}
              className={cn(
                "flex items-center space-x-3 cursor-pointer",
                isSelected && "bg-accent"
              )}
              data-testid={`priority-option-${priority}`}
            >
              <span className="text-base">{config.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{config.label}</div>
              </div>
              {isSelected && (
                <Badge variant="secondary" className="text-xs">
                  Current
                </Badge>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}