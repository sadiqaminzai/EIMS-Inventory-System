import { Eye, Pencil, Trash2, Download } from 'lucide-react';
import { Button } from './button';
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ActionButtonsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
}

const ActionBtn = ({ onClick, icon: Icon, label, className }: any) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 transition-all duration-200 hover:scale-110", className)}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
);

export const ActionButtons = ({ onView, onEdit, onDelete, onDownload }: ActionButtonsProps) => {
  return (
    <div className="flex items-center gap-1">
      {onDownload && (
        <ActionBtn 
          onClick={onDownload} 
          icon={Download} 
          label="Download PDF" 
          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" 
        />
      )}
      {onView && (
        <ActionBtn 
          onClick={onView} 
          icon={Eye} 
          label="View Details" 
          className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 shadow-sm rounded-full" 
        />
      )}
      {onEdit && (
        <ActionBtn 
          onClick={onEdit} 
          icon={Pencil} 
          label="Edit" 
          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
        />
      )}
      {onDelete && (
        <ActionBtn 
          onClick={onDelete} 
          icon={Trash2} 
          label="Delete" 
          className="text-red-600 hover:text-red-700 hover:bg-red-50" 
        />
      )}
    </div>
  );
};
