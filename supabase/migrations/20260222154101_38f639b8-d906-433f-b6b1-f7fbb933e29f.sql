
-- ─── ENUMS ────────────────────────────────────────────────────────────────────

CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'staff', 'accountant');
CREATE TYPE public.invoice_type AS ENUM ('sale', 'purchase', 'sale_return', 'purchase_return', 'quotation', 'delivery_challan');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.payment_method AS ENUM ('cash', 'esewa', 'khalti', 'fonepay', 'connectips', 'bank_transfer', 'cheque', 'credit');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.item_type AS ENUM ('product', 'service');
CREATE TYPE public.tax_type AS ENUM ('vat_13', 'exempt', 'zero_rated', 'non_taxable');
CREATE TYPE public.party_type AS ENUM ('customer', 'vendor', 'both');
CREATE TYPE public.business_type AS ENUM ('kirana', 'wholesale', 'retail', 'restaurant', 'pharmacy', 'service', 'manufacturer', 'other');

-- ─── PROFILES ─────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  active_business_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── BUSINESSES ───────────────────────────────────────────────────────────────

CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.business_type NOT NULL DEFAULT 'retail',
  pan_number TEXT UNIQUE,
  is_vat_registered BOOLEAN NOT NULL DEFAULT false,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  logo_url TEXT,
  fiscal_year_start INT NOT NULL DEFAULT 4,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  next_invoice_num INT NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'NPR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ─── BUSINESS USERS (roles) ──────────────────────────────────────────────────

CREATE TABLE public.business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;

-- Security definer function to check business membership
CREATE OR REPLACE FUNCTION public.is_business_member(_user_id UUID, _business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_users
    WHERE user_id = _user_id AND business_id = _business_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_business_role(_user_id UUID, _business_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.business_users
  WHERE user_id = _user_id AND business_id = _business_id AND is_active = true
  LIMIT 1;
$$;

-- Business policies: members can see their businesses
CREATE POLICY "Members can view their businesses" ON public.businesses
  FOR SELECT USING (public.is_business_member(auth.uid(), id));
CREATE POLICY "Owners can update their business" ON public.businesses
  FOR UPDATE USING (public.get_user_business_role(auth.uid(), id) = 'owner');
CREATE POLICY "Authenticated users can create businesses" ON public.businesses
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Business users policies
CREATE POLICY "Members can view business users" ON public.business_users
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Owners can manage business users" ON public.business_users
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      public.get_user_business_role(auth.uid(), business_id) = 'owner'
    )
  );
CREATE POLICY "Owners can update business users" ON public.business_users
  FOR UPDATE USING (public.get_user_business_role(auth.uid(), business_id) = 'owner');
CREATE POLICY "Owners can delete business users" ON public.business_users
  FOR DELETE USING (public.get_user_business_role(auth.uid(), business_id) = 'owner');

-- ─── TAX RATES ────────────────────────────────────────────────────────────────

CREATE TABLE public.tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type public.tax_type NOT NULL,
  rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tax rates" ON public.tax_rates
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Owners/managers can manage tax rates" ON public.tax_rates
  FOR ALL USING (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager'));

-- ─── ITEM CATEGORIES ──────────────────────────────────────────────────────────

CREATE TABLE public.item_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.item_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view categories" ON public.item_categories
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Owners/managers can manage categories" ON public.item_categories
  FOR ALL USING (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager'));

-- ─── ITEMS ────────────────────────────────────────────────────────────────────

CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.item_categories(id),
  tax_rate_id UUID REFERENCES public.tax_rates(id),
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  type public.item_type NOT NULL DEFAULT 'product',
  unit TEXT NOT NULL DEFAULT 'PCS',
  purchase_price NUMERIC(12,2),
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  opening_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  current_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  low_stock_alert NUMERIC(12,3),
  hsn_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (business_id, code)
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view items" ON public.items
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Staff+ can insert items" ON public.items
  FOR INSERT WITH CHECK (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager', 'staff'));
CREATE POLICY "Managers+ can update items" ON public.items
  FOR UPDATE USING (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager'));
CREATE POLICY "Owners can delete items" ON public.items
  FOR DELETE USING (public.get_user_business_role(auth.uid(), business_id) = 'owner');

-- ─── PARTIES ──────────────────────────────────────────────────────────────────

CREATE TABLE public.parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  type public.party_type NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  pan_number TEXT,
  address TEXT,
  city TEXT,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(12,2),
  credit_days INT DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view parties" ON public.parties
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Staff+ can insert parties" ON public.parties
  FOR INSERT WITH CHECK (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager', 'staff'));
CREATE POLICY "Managers+ can update parties" ON public.parties
  FOR UPDATE USING (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager'));
CREATE POLICY "Owners can delete parties" ON public.parties
  FOR DELETE USING (public.get_user_business_role(auth.uid(), business_id) = 'owner');

-- ─── INVOICES ─────────────────────────────────────────────────────────────────

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  type public.invoice_type NOT NULL DEFAULT 'sale',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  invoice_number TEXT NOT NULL,
  reference_number TEXT,
  customer_id UUID REFERENCES public.parties(id),
  vendor_id UUID REFERENCES public.parties(id),
  issued_date_ad TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_date_bs TEXT NOT NULL,
  due_date_ad TIMESTAMPTZ,
  due_date_bs TEXT,
  sub_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_vat_invoice BOOLEAN NOT NULL DEFAULT false,
  buyer_pan TEXT,
  vat_period TEXT,
  notes TEXT,
  terms_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (business_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invoices" ON public.invoices
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Staff+ can create invoices" ON public.invoices
  FOR INSERT WITH CHECK (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager', 'staff'));
CREATE POLICY "Managers+ can update invoices" ON public.invoices
  FOR UPDATE USING (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager'));
CREATE POLICY "Owners can delete invoices" ON public.invoices
  FOR DELETE USING (public.get_user_business_role(auth.uid(), business_id) = 'owner');

-- ─── INVOICE ITEMS ────────────────────────────────────────────────────────────

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id),
  tax_rate_id UUID REFERENCES public.tax_rates(id),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'PCS',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amt NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Invoice items follow parent invoice access
CREATE POLICY "Members can view invoice items" ON public.invoice_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.is_business_member(auth.uid(), i.business_id))
  );
CREATE POLICY "Staff+ can insert invoice items" ON public.invoice_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.get_user_business_role(auth.uid(), i.business_id) IN ('owner', 'manager', 'staff'))
  );
CREATE POLICY "Managers+ can update invoice items" ON public.invoice_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.get_user_business_role(auth.uid(), i.business_id) IN ('owner', 'manager'))
  );
CREATE POLICY "Owners can delete invoice items" ON public.invoice_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.get_user_business_role(auth.uid(), i.business_id) = 'owner')
  );

-- ─── PAYMENTS ─────────────────────────────────────────────────────────────────

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  party_id UUID REFERENCES public.parties(id),
  method public.payment_method NOT NULL DEFAULT 'cash',
  status public.payment_status NOT NULL DEFAULT 'completed',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  reference TEXT,
  notes TEXT,
  gateway_ref_id TEXT,
  cheque_number TEXT,
  cheque_date TIMESTAMPTZ,
  bank_name TEXT,
  payment_date_ad TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_date_bs TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payments" ON public.payments
  FOR SELECT USING (public.is_business_member(auth.uid(), business_id));
CREATE POLICY "Staff+ can create payments" ON public.payments
  FOR INSERT WITH CHECK (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager', 'staff'));
CREATE POLICY "Managers+ can update payments" ON public.payments
  FOR UPDATE USING (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager'));

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parties_updated_at BEFORE UPDATE ON public.parties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_items_business ON public.items(business_id, name);
CREATE INDEX idx_parties_business ON public.parties(business_id, name);
CREATE INDEX idx_invoices_business_status ON public.invoices(business_id, status);
CREATE INDEX idx_invoices_business_date ON public.invoices(business_id, issued_date_ad);
CREATE INDEX idx_payments_business_invoice ON public.payments(business_id, invoice_id);
