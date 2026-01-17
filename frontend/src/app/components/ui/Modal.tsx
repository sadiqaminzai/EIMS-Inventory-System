import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from './utils';
import { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Modal = ({ open, onOpenChange, title, children, size = 'md' }: ModalProps) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow z-40" />
        <Dialog.Content 
          className={cn(
            "fixed left-[50%] top-[50%] max-h-[90vh] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white p-0 shadow-lg focus:outline-none data-[state=open]:animate-contentShow z-50 flex flex-col overflow-hidden transition-all duration-200",
            // Base width for mobile: 95% of viewport
            "w-[95vw]",
            // Desktop widths overrides
            size === 'sm' && "md:w-[400px]",
            size === 'md' && "md:w-[600px]",
            size === 'lg' && "md:w-[900px]",
            size === 'xl' && "md:w-[1200px]",
            // Full screen override
            size === 'full' && "w-screen h-screen max-h-screen rounded-none top-0 left-0 translate-x-0 translate-y-0"
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-3 bg-gray-50 shrink-0">
            <Dialog.Title className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              {title}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {title}
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                className="rounded-full p-1 hover:bg-gray-200 focus:outline-none"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
