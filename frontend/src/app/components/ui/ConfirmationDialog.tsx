import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { clsx } from 'clsx';
import { ReactNode } from 'react';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'info';
}

export const ConfirmationDialog = ({ 
  open, 
  onOpenChange, 
  title, 
  description, 
  onConfirm, 
  confirmLabel = "Confirm", 
  cancelLabel = "Cancel",
  variant = 'danger'
}: ConfirmationDialogProps) => {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow z-50" />
        <AlertDialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[400px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none data-[state=open]:animate-contentShow z-50">
          <AlertDialog.Title className="text-gray-900 m-0 text-[17px] font-medium">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-gray-600 mt-4 mb-5 text-[15px] leading-normal">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-[25px]">
            <AlertDialog.Cancel asChild>
              <button className="text-gray-700 bg-gray-100 hover:bg-gray-200 inline-flex h-[35px] items-center justify-center rounded-[4px] px-[15px] font-medium leading-none outline-none focus:shadow-[0_0_0_2px] focus:shadow-gray-400">
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button 
                onClick={onConfirm}
                className={clsx(
                  "inline-flex h-[35px] items-center justify-center rounded-[4px] px-[15px] font-medium leading-none outline-none focus:shadow-[0_0_0_2px]",
                  variant === 'danger' ? "text-red-100 bg-red-600 hover:bg-red-700 focus:shadow-red-600" : "text-blue-100 bg-blue-600 hover:bg-blue-700 focus:shadow-blue-600"
                )}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
