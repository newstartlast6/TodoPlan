import { EditableText } from "@/components/ui/editable-text";
import { GoalType, useGoal } from "@/hooks/use-goals";
import { cn } from "@/lib/utils";

interface GoalInlineProps {
  type: GoalType;
  date: Date;
  placeholder?: string;
  className?: string;
  label?: string;
}

export function GoalInline({ type, date, placeholder, className, label }: GoalInlineProps) {
  const { goal, setGoal } = useGoal(type, date);

  const defaultPlaceholder =
    placeholder ??
    (type === "daily"
      ? "Add daily goal"
      : type === "weekly"
      ? "Add weekly goal"
      : type === "monthly"
      ? "Add monthly goal"
      : "Add yearly goal");

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {label ? (
        <span className="text-xs uppercase tracking-wider text-muted-foreground/70">{label}</span>
      ) : null}
      <EditableText
        value={goal}
        onChange={setGoal}
        placeholder={defaultPlaceholder}
        className="font-semibold"
      />
    </div>
  );
}


