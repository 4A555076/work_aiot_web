import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function BaseSelect({
    label,
    error,
    value,
    displayValue,
    onChange,
    options = [],
    placeholder = "請選擇",
    disabled = false,
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selected = options.find((opt) => opt.value === value);
    const filteredOptions  = options.filter(opt =>opt.label.includes(search));

    return (
        <div className="flex flex-col gap-2 w-full">
        
            {label && (
                <Label className="type-meta font-semibold text-foreground ">{label}</Label>
            )}

            <Popover 
                modal
                open={disabled ? false : open}                
                onOpenChange={(nextOpen) => {
                    if (!disabled) setOpen(nextOpen);
                }}
            >
                <PopoverTrigger>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        disabled={disabled}
                        className={cn(
                            "type-body h-11 w-full justify-between rounded-xl border border-input bg-card xl:h-12 2xl:h-13",
                            error && "border-destructive"
                        )}
                    >
                        <span className={`flex-1 text-left truncate`}>
                            {selected ? displayValue ?? selected.label : placeholder}
                        </span>

                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>

                <PopoverContent
                    className="p-0"
                    align="start"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="搜尋"
                            value={search}
                            onValueChange={setSearch}
                            className="text-lg"
                        />

                        <CommandList>
                            <CommandEmpty>沒有結果</CommandEmpty>

                            <CommandGroup>
                            {filteredOptions.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.label}
                                    onSelect={() => {
                                        onChange(opt.value);
                                        setOpen(false);
                                    }}
                                >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === opt.value ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {opt.label}
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {error && (
                <span className="type-meta text-destructive ">
                {error}
                </span>
            )}
        </div>
    );
}
