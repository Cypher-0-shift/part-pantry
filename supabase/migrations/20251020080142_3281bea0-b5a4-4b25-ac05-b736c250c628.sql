-- Add bill template fields to business_settings
ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS bill_template_url text,
ADD COLUMN IF NOT EXISTS bill_notes text,
ADD COLUMN IF NOT EXISTS bill_terms text,
ADD COLUMN IF NOT EXISTS show_logo boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_gst_details boolean DEFAULT true;