import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/app/components/ui/utils"
import { Button } from "@/app/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/app/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover"

export interface SearchableSelectProps {
  options: { value: string | number; label: string; disabled?: boolean }[]
  value?: string | number
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  className?: string
  modal?: boolean
  width?: string | number
  triggerId?: string
  disabled?: boolean
  'aria-label'?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  error,
  className,
  modal = false,
  width = "200px",
  triggerId,
  disabled = false,
  'aria-label': ariaLabel
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)

  // Find label for current value
  const selectedLabel = React.useMemo(() => {
    const current = value === undefined || value === null ? '' : String(value)
    return options.find((option) => String(option.value) === current)?.label
  }, [options, value])

  const hasValue = value !== undefined && value !== null && String(value) !== ''
  const displayLabel = hasValue ? (selectedLabel ?? String(value)) : placeholder

  const filteredOptions = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return options
    return options.filter((option) => option.label.toLowerCase().includes(term))
  }, [options, search])

  React.useEffect(() => {
    const count = filteredOptions.length
    const nextIndex = count === 0 ? -1 : Math.min(activeIndex, count - 1)
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex)
    }
  }, [filteredOptions.length, activeIndex])

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {label && <label className="text-[10px] font-semibold uppercase text-gray-500">{label}</label>}
      <Popover open={open} onOpenChange={setOpen} modal={modal}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            type="button"
            id={triggerId}
            disabled={disabled}
            aria-label={ariaLabel ?? placeholder}
            className={cn(
              "w-full justify-between h-7 text-xs px-2 font-normal border-gray-300 hover:bg-white focus:ring-1 focus:ring-blue-500 bg-white",
              !hasValue && "text-muted-foreground",
              error && "border-red-500 focus:ring-red-500"
            )}
          >
            <span className="truncate">
              {displayLabel}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0" 
          align="start" 
          style={{ width: width }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search...`}
              className="h-8 text-xs"
              value={search}
              onValueChange={setSearch}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (filteredOptions.length === 0) return;
                  setActiveIndex((prev) => {
                    const next = prev < 0 ? 0 : (prev + 1) % filteredOptions.length;
                    return next;
                  });
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (filteredOptions.length === 0) return;
                  setActiveIndex((prev) => {
                    if (prev <= 0) return filteredOptions.length - 1;
                    return prev - 1;
                  });
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions.length === 0) return;
                  const active = filteredOptions[Math.max(activeIndex, 0)];
                  if (active && !active.disabled) {
                    onChange(String(active.value))
                    setOpen(false)
                  }
                }
              }}
            />
            <CommandList>
                {filteredOptions.length === 0 ? (
                  <CommandEmpty>No results found.</CommandEmpty>
                ) : (
                  <div className="p-1">
                    {filteredOptions.map((option, idx) => (
                      <div
                        key={String(option.value)}
                        role="option"
                        aria-selected={hasValue && String(value) === String(option.value)}
                        className={cn(
                          "relative flex select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none",
                          option.disabled ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-100",
                          idx === activeIndex && "bg-slate-100",
                          hasValue && String(value) === String(option.value) && "bg-slate-100"
                        )}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseDown={(e) => {
                          if (option.disabled) return;
                          e.preventDefault();
                          onChange(String(option.value));
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3 w-3",
                            hasValue && String(value) === String(option.value) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                      </div>
                    ))}
                  </div>
                )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}
