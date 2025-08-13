import { useState } from "react";
import { InsertTask } from "@shared/schema";
import { cn } from "@/lib/utils";

interface AddTaskInlineProps {
  date: Date;
  tasksCountForDay: number;
  onCreate: (newTask: InsertTask) => void;
  testId?: string;
}

export function AddTaskInline({ date, tasksCountForDay, onCreate, testId }: AddTaskInlineProps) {
  const [title, setTitle] = useState("");

  const handleCreate = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const payload: InsertTask = {
      title: trimmed,
      startTime: start,
      endTime: end,
      completed: false,
      priority: 'medium',
      scheduledDate: date,
      dayOrder: tasksCountForDay,
    } as any;
    onCreate(payload);
    setTitle("");
  };

  return (
    <div
      className={cn(
        "flex items-center space-x-4 p-4 border-2 border-dashed border-gray-200 rounded-lg",
        "hover:border-orange-500 transition-colors duration-200 cursor-pointer"
      )}
      onClick={(e) => {
        const input = (e.currentTarget.querySelector('input') as HTMLInputElement | null);
        input?.focus();
      }}
      data-testid={testId}
    >
      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
      <input
        type="text"
        placeholder="Add a new task..."
        className="flex-1 bg-transparent outline-none text-muted-foreground placeholder-gray-400"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate();
        }}
      />
    </div>
  );
}


