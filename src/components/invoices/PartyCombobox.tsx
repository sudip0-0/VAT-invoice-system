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
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CASH_CUSTOMER_ID, CASH_CUSTOMER_NAME } from "@/lib/cash-customer";
import { cn } from "@/lib/utils";
import type { Party } from "@/hooks/useParties";

type PartyMode = "customer" | "vendor";

interface PartyComboboxProps {
  parties: Party[];
  value: string;
  mode: PartyMode;
  placeholder?: string;
  onSelect: (partyId: string) => void;
}

const RESULT_LIMIT = 50;

function getPartyLabel(mode: PartyMode) {
  return mode === "vendor" ? "vendor" : "customer";
}

export default function PartyCombobox({
  parties,
  value,
  mode,
  placeholder,
  onSelect,
}: PartyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedParty = useMemo(
    () => parties.find((party) => party.id === value),
    [parties, value],
  );
  const isCashCustomer = mode === "customer" && value === CASH_CUSTOMER_ID;

  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = q
      ? parties.filter((party) =>
          party.name.toLowerCase().includes(q) ||
          (party.phone || "").toLowerCase().includes(q) ||
          (party.pan_number || "").toLowerCase().includes(q)
        )
      : parties;

    return matches.slice(0, RESULT_LIMIT);
  }, [parties, search]);

  const partyLabel = getPartyLabel(mode);
  const label = isCashCustomer ? CASH_CUSTOMER_NAME : selectedParty?.name || placeholder || `Select ${partyLabel}...`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between px-3 text-left text-sm font-normal"
        >
          <span className={cn("truncate", !selectedParty && "text-muted-foreground")}>
            {label}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0 pointer-events-auto" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={`Search ${partyLabel}s by name, phone, or PAN...`}
          />
          <CommandList>
            <CommandEmpty>No matching {partyLabel}s.</CommandEmpty>
            <CommandGroup>
              {mode === "customer" && (!search || CASH_CUSTOMER_NAME.toLowerCase().includes(search.trim().toLowerCase())) && (
                <CommandItem
                  value={CASH_CUSTOMER_NAME}
                  onSelect={() => {
                    onSelect(CASH_CUSTOMER_ID);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="items-start gap-2"
                >
                  <Check className={cn("mt-0.5 h-4 w-4", value === CASH_CUSTOMER_ID ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{CASH_CUSTOMER_NAME}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">Default</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Enter customer details per invoice
                    </div>
                  </div>
                </CommandItem>
              )}
              {filteredParties.map((party) => (
                <CommandItem
                  key={party.id}
                  value={`${party.name} ${party.phone || ""} ${party.pan_number || ""}`}
                  onSelect={() => {
                    onSelect(party.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="items-start gap-2"
                >
                  <Check className={cn("mt-0.5 h-4 w-4", value === party.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{party.name}</span>
                      {party.pan_number && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">PAN {party.pan_number}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="capitalize">{party.type}</span>
                      {party.phone && <span>{party.phone}</span>}
                      {party.city && <span>{party.city}</span>}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
