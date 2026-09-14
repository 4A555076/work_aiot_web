import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
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

export default function BaseMultiSelect({
  label,
  error,
  value = [],
  onChange,
  options = [],
  placeholder = "請選擇（可多選）",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // 篩選出所有已被選中的 options 物件
  const selectedOptions = options.filter((opt) => value.includes(opt.value));
  const filteredOptions = options.filter((opt) => opt.label.includes(search));


  // 若已選取，則移除, 若未選取，則加入
  const handleSelect = (currentValue) => {
    if (value.includes(currentValue)) {
      onChange(value.filter((val) => val !== currentValue));
    } else {
      onChange([...value, currentValue]);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">

      {label && (
        <Label className="type-meta font-semibold text-foreground">{label}</Label>
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
            aria-expanded={disabled ? false : open}
            disabled={disabled}
            className="type-body h-11 w-full justify-between rounded-xl border border-input bg-card xl:h-12 2xl:h-13"
          >
            <span className={`flex-1 text-left truncate`}>
                {selectedOptions.length > 0 ? (
                <span className="text-muted-foreground">已選取 {selectedOptions.length} 個項目</span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-auto" />
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

            <div className="flex items-center gap-2 border-b border-border p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                disabled={
                  options.length === 0 || options.every((option) => value.includes(option.value))
                }
                onClick={() => onChange(options.map((option) => option.value))}
              >
                全選
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                disabled={value.length === 0}
                onClick={() => onChange([])}
              >
                清除
              </Button>
            </div>

            <CommandList>
              <CommandEmpty>沒有結果</CommandEmpty>

              <CommandGroup>
                {filteredOptions.map((opt) => {
                  const isSelected = value.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => handleSelect(opt.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <span className="type-meta text-destructive ">{error}</span>}
    </div>
  );
}
