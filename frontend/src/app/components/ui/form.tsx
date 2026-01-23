import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';

// --- Dense Input ---

interface DenseInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const DenseInput = forwardRef<HTMLInputElement, DenseInputProps>(
  ({ label, error, className, ...props }, ref) => {
    const isRequired = Boolean(props.required || (props as any)['aria-required']);
    return (
      <div className="flex flex-col gap-0.5">
        {label && (
          <label className="text-[10px] font-semibold uppercase text-gray-500">
            {label}
            {isRequired && <span className="text-red-500"> *</span>}
          </label>
        )}
        <input
          ref={ref}
          className={clsx(
            "h-7 text-xs border border-gray-300 rounded px-2 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-shadow",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    );
  }
);
DenseInput.displayName = 'DenseInput';

// --- Dense Select ---

interface DenseSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string | number; label: string }[];
  labelPosition?: 'top' | 'right';
}

export const DenseSelect = forwardRef<HTMLSelectElement, DenseSelectProps>(
  ({ label, error, options, className, labelPosition = 'top', ...props }, ref) => {
    return (
      <div className={clsx("flex gap-0.5", labelPosition === 'right' ? "flex-row items-center" : "flex-col")}>        
        {labelPosition !== 'right' && label && (
          <label className="text-[10px] font-semibold uppercase text-gray-500">{label}</label>
        )}
        <select
          ref={ref}
          className={clsx(
            "h-7 text-xs border border-gray-300 rounded px-1 focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        >
          <option value="" disabled>Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {labelPosition === 'right' && label && (
          <label className="text-[10px] font-semibold uppercase text-gray-500">{label}</label>
        )}
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    );
  }
);
DenseSelect.displayName = 'DenseSelect';
