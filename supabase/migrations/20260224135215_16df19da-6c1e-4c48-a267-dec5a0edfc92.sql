
-- Create stock_movements table
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  item_id uuid NOT NULL REFERENCES public.items(id),
  invoice_id uuid REFERENCES public.invoices(id),
  quantity numeric NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  reason text NOT NULL DEFAULT 'invoice',
  stock_before numeric NOT NULL DEFAULT 0,
  stock_after numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view stock movements"
  ON public.stock_movements FOR SELECT
  USING (is_business_member(auth.uid(), business_id));

CREATE POLICY "System can insert stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (is_business_member(auth.uid(), business_id));

-- Index for fast lookups
CREATE INDEX idx_stock_movements_item ON public.stock_movements(item_id, created_at DESC);
CREATE INDEX idx_stock_movements_business ON public.stock_movements(business_id, created_at DESC);

-- Update the trigger function to log movements
CREATE OR REPLACE FUNCTION public.adjust_stock_on_invoice_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  line RECORD;
  multiplier NUMERIC;
  old_stock NUMERIC;
  new_stock NUMERIC;
  move_dir TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'issued' AND (TG_OP = 'INSERT' OR OLD.status != 'issued') THEN
    IF NEW.type IN ('sale', 'sale_return') THEN
      multiplier := -1;
      move_dir := 'out';
    ELSIF NEW.type IN ('purchase', 'purchase_return') THEN
      multiplier := 1;
      move_dir := 'in';
    ELSE
      RETURN NEW;
    END IF;

    FOR line IN
      SELECT item_id, quantity FROM public.invoice_items
      WHERE invoice_id = NEW.id AND item_id IS NOT NULL
    LOOP
      SELECT current_stock INTO old_stock FROM public.items WHERE id = line.item_id;
      new_stock := old_stock + (line.quantity * multiplier);

      UPDATE public.items
      SET current_stock = new_stock, updated_at = now()
      WHERE id = line.item_id;

      INSERT INTO public.stock_movements (business_id, item_id, invoice_id, quantity, direction, reason, stock_before, stock_after)
      VALUES (NEW.business_id, line.item_id, NEW.id, line.quantity, move_dir, NEW.type, old_stock, new_stock);
    END LOOP;

  ELSIF NEW.status = 'cancelled' AND OLD.status = 'issued' THEN
    IF OLD.type IN ('sale', 'sale_return') THEN
      multiplier := 1;
      move_dir := 'in';
    ELSIF OLD.type IN ('purchase', 'purchase_return') THEN
      multiplier := -1;
      move_dir := 'out';
    ELSE
      RETURN NEW;
    END IF;

    FOR line IN
      SELECT item_id, quantity FROM public.invoice_items
      WHERE invoice_id = NEW.id AND item_id IS NOT NULL
    LOOP
      SELECT current_stock INTO old_stock FROM public.items WHERE id = line.item_id;
      new_stock := old_stock + (line.quantity * multiplier);

      UPDATE public.items
      SET current_stock = new_stock, updated_at = now()
      WHERE id = line.item_id;

      INSERT INTO public.stock_movements (business_id, item_id, invoice_id, quantity, direction, reason, stock_before, stock_after)
      VALUES (NEW.business_id, line.item_id, NEW.id, line.quantity, move_dir, 'cancellation', old_stock, new_stock);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
