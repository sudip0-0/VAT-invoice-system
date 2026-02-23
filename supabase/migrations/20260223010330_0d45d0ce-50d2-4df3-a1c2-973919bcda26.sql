
-- Function to adjust stock based on invoice status changes
CREATE OR REPLACE FUNCTION public.adjust_stock_on_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  line RECORD;
  multiplier NUMERIC;
BEGIN
  -- Only act when status changes
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Determine if we need to deduct or add stock
  -- For INSERT with status 'issued', or UPDATE to 'issued'
  IF NEW.status = 'issued' AND (TG_OP = 'INSERT' OR OLD.status != 'issued') THEN
    -- Sale: deduct stock (-1), Purchase: add stock (+1)
    IF NEW.type IN ('sale', 'sale_return') THEN
      multiplier := -1;
    ELSIF NEW.type IN ('purchase', 'purchase_return') THEN
      multiplier := 1;
    ELSE
      RETURN NEW;
    END IF;

    -- Adjust stock for each line item that references an inventory item
    FOR line IN
      SELECT item_id, quantity FROM public.invoice_items
      WHERE invoice_id = NEW.id AND item_id IS NOT NULL
    LOOP
      UPDATE public.items
      SET current_stock = current_stock + (line.quantity * multiplier),
          updated_at = now()
      WHERE id = line.item_id;
    END LOOP;

  -- When cancelling a previously issued invoice, reverse the stock change
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'issued' THEN
    IF OLD.type IN ('sale', 'sale_return') THEN
      multiplier := 1;  -- Reverse: add back
    ELSIF OLD.type IN ('purchase', 'purchase_return') THEN
      multiplier := -1;  -- Reverse: deduct back
    ELSE
      RETURN NEW;
    END IF;

    FOR line IN
      SELECT item_id, quantity FROM public.invoice_items
      WHERE invoice_id = NEW.id AND item_id IS NOT NULL
    LOOP
      UPDATE public.items
      SET current_stock = current_stock + (line.quantity * multiplier),
          updated_at = now()
      WHERE id = line.item_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on invoices table
CREATE TRIGGER trg_adjust_stock_on_invoice_status
  AFTER INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_stock_on_invoice_status();
