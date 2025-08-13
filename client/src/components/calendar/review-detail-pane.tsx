import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReviewForm } from "@/components/ui/review-form";

interface ReviewDetailPaneProps {
  type: 'daily' | 'weekly';
  anchorDate: Date;
  onClose?: () => void;
  className?: string;
}

export function ReviewDetailPane({ type, anchorDate, onClose, className }: ReviewDetailPaneProps) {
  return (
    <div className={cn("h-full flex flex-col bg-white border-l border-gray-100", className)} data-testid="review-detail-pane">
      <div className="flex-1 overflow-y-auto">
        <ReviewForm type={type} anchorDate={anchorDate} />
      </div>
    </div>
  );
}


