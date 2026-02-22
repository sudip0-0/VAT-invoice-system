
-- Drop and recreate businesses policies as PERMISSIVE
DROP POLICY IF EXISTS "Authenticated users can create businesses" ON public.businesses;
DROP POLICY IF EXISTS "Members can view their businesses" ON public.businesses;
DROP POLICY IF EXISTS "Owners can update their business" ON public.businesses;

CREATE POLICY "Authenticated users can create businesses" ON public.businesses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Members can view their businesses" ON public.businesses
  FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), id));

CREATE POLICY "Owners can update their business" ON public.businesses
  FOR UPDATE TO authenticated
  USING (public.get_user_business_role(auth.uid(), id) = 'owner');

-- Also fix business_users INSERT policy
DROP POLICY IF EXISTS "Owners can manage business users" ON public.business_users;
DROP POLICY IF EXISTS "Members can view business users" ON public.business_users;
DROP POLICY IF EXISTS "Owners can update business users" ON public.business_users;
DROP POLICY IF EXISTS "Owners can delete business users" ON public.business_users;

CREATE POLICY "Members can view business users" ON public.business_users
  FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Users can insert own membership" ON public.business_users
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      user_id = auth.uid() OR
      public.get_user_business_role(auth.uid(), business_id) = 'owner'
    )
  );

CREATE POLICY "Owners can update business users" ON public.business_users
  FOR UPDATE TO authenticated
  USING (public.get_user_business_role(auth.uid(), business_id) = 'owner');

CREATE POLICY "Owners can delete business users" ON public.business_users
  FOR DELETE TO authenticated
  USING (public.get_user_business_role(auth.uid(), business_id) = 'owner');

-- Fix other tables too
DROP POLICY IF EXISTS "Members can view tax rates" ON public.tax_rates;
DROP POLICY IF EXISTS "Owners/managers can manage tax rates" ON public.tax_rates;

CREATE POLICY "Members can view tax rates" ON public.tax_rates
  FOR SELECT TO authenticated
  USING (public.is_business_member(auth.uid(), business_id));

CREATE POLICY "Owners/managers can manage tax rates" ON public.tax_rates
  FOR ALL TO authenticated
  USING (public.get_user_business_role(auth.uid(), business_id) IN ('owner', 'manager'));

-- Fix profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
