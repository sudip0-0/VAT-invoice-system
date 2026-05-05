import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type CashCustomerDetails,
  emptyCashCustomerDetails,
  normalizeCashCustomerDetails,
} from "@/lib/cash-customer";

interface CashCustomerDialogProps {
  open: boolean;
  value: CashCustomerDetails;
  onOpenChange: (open: boolean) => void;
  onSave: (details: CashCustomerDetails) => void;
}

export default function CashCustomerDialog({
  open,
  value,
  onOpenChange,
  onSave,
}: CashCustomerDialogProps) {
  const [form, setForm] = useState<CashCustomerDetails>(emptyCashCustomerDetails);

  useEffect(() => {
    if (open) {
      setForm(value);
    }
  }, [open, value]);

  const set = (key: keyof CashCustomerDetails, nextValue: string) => {
    setForm((prev) => ({ ...prev, [key]: nextValue }));
  };

  const handleSave = () => {
    onSave(normalizeCashCustomerDetails(form));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cash A/C Customer Details</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Customer Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Cash customer"
              className="h-9 text-sm"
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">PAN/VAT No.</Label>
            <Input
              value={form.panNumber}
              onChange={(e) => set("panNumber", e.target.value)}
              placeholder="Optional"
              className="h-9 text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="Optional"
              className="h-9 text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Address</Label>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Optional"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
