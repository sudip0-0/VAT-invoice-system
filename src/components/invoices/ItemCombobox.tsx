import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatNPR } from "@/lib/nepal-format";
import { cn } from "@/lib/utils";
import type { Item } from "@/hooks/useItems";

type ItemMode = "sale" | "purchase" | "quotation";

interface ItemComboboxProps {
  items: Item[];
  value: string | null;
  displayName?: string;
  mode: ItemMode;
  onSelect: (itemId: string) => void;
  onCustom: () => void;
}

const RESULT_LIMIT = 50;

function getItemPrice(item: Item, mode: ItemMode) {
  if (mode === "purchase") return item.purchase_price ?? item.sale_price;
  return item.sale_price;
}

export default function ItemCombobox({
  items,
  value,
  displayName,
  mode,
  onSelect,
  onCustom,
}: ItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedItem = useMemo(
    () => items.find((item) => item.id === value),
    [items, value],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = q
      ? items.filter((item) =>
          item.name.toLowerCase().includes(q) ||
          (item.code || "").toLowerCase().includes(q)
        )
      : items;

    return matches.slice(0, RESULT_LIMIT);
  }, [items, search]);

  const label = selectedItem?.name || displayName || "Select item...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between px-0 text-left text-xs font-normal hover:bg-transparent"
        >
          <span className={cn("truncate", !selectedItem && !displayName && "text-muted-foreground")}>
            {label}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0 pointer-events-auto" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search items by name or code..."
          />
          <CommandList>
            <CommandEmpty>No matching items.</CommandEmpty>
            <CommandGroup>
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.name} ${item.code || ""}`}
                  onSelect={() => {
                    onSelect(item.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="items-start gap-2"
                >
                  <Check className={cn("mt-0.5 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.name}</span>
                      {item.code && <span className="shrink-0 text-[10px] text-muted-foreground">{item.code}</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{item.unit}</span>
                      <span>Stock: {Number(item.current_stock)}</span>
                      <span>{formatNPR(getItemPrice(item, mode), { showSymbol: false })}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="custom item"
                onSelect={() => {
                  onCustom();
                  setOpen(false);
                  setSearch("");
                }}
              >
                Custom item...
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
