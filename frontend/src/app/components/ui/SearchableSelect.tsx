import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/app/components/ui/utils"
import { Button } from "@/app/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover"

export interface SearchableSelectProps {
  options: { value: string; label: string; disabled?: boolean }[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  className?: string
  modal?: boolean
  width?: string | number
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
  width = "200px"
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)

  // Find label for current value
  const selectedLabel = React.useMemo(() => {
    return options.find((option) => option.value === value)?.label
  }, [options, value])

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {label && <label className="text-[10px] font-semibold uppercase text-gray-500">{label}</label>}
      <Popover open={open} onOpenChange={setOpen} modal={modal}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-7 text-xs px-2 font-normal border-gray-300 hover:bg-white focus:ring-1 focus:ring-blue-500 bg-white",
              !value && "text-muted-foreground",
              error && "border-red-500 focus:ring-red-500"
            )}
          >
            <span className="truncate">
              {value ? selectedLabel : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0" 
          align="start" 
          style={{ width: width }}
        >
          <Command>
            <CommandInput placeholder={`Search...`} className="h-8 text-xs" />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                {options.map((option) => (
                    <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                        onChange(option.value)
                        setOpen(false)
                    }}
                    disabled={option.disabled}
                    className="text-xs"
                    >
                    <Check
                        className={cn(
                        "mr-2 h-3 w-3",
                        value === option.value ? "opacity-100" : "opacity-0"
                        )}
                    />
                    {option.label}
                    </CommandItem>
                ))}
                </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}
