-- Update stock table with new fields for GST and pricing
ALTER TABLE public.stock 
  RENAME COLUMN part_code TO hsn_code;

ALTER TABLE public.stock
  ADD COLUMN IF NOT EXISTS buying_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_percentage numeric NOT NULL DEFAULT 0;

-- Update the price column to be selling_price (for backward compatibility)
UPDATE public.stock SET selling_price = price WHERE selling_price = 0;

-- Add business profile settings table
CREATE TABLE IF NOT EXISTS public.business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT 'Vijaya Auto Spares',
  owner_name text,
  address text,
  gstin text,
  contact_phone text,
  contact_email text,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_settings
CREATE POLICY "Users can view own business settings"
  ON public.business_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own business settings"
  ON public.business_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business settings"
  ON public.business_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_business_settings_updated_at
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update orders table to store profit calculation fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_buying_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_selling_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_amount numeric DEFAULT 0;

-- Update order_items to include GST and pricing details
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS buying_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gst numeric DEFAULT 0;