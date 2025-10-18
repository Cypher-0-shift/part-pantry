-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  garage_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create stock table for spare parts inventory
CREATE TABLE public.stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  part_code TEXT NOT NULL,
  part_name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stock"
  ON public.stock FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stock"
  ON public.stock FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stock"
  ON public.stock FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stock"
  ON public.stock FOR DELETE
  USING (auth.uid() = user_id);

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own customers"
  ON public.customers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customers"
  ON public.customers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers"
  ON public.customers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers"
  ON public.customers FOR DELETE
  USING (auth.uid() = user_id);

-- Create udhaari (credit) table
CREATE TABLE public.udhaari (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.udhaari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own udhaari"
  ON public.udhaari FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own udhaari"
  ON public.udhaari FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own udhaari"
  ON public.udhaari FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own udhaari"
  ON public.udhaari FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_stock_updated_at
  BEFORE UPDATE ON public.stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_udhaari_updated_at
  BEFORE UPDATE ON public.udhaari
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for part images
INSERT INTO storage.buckets (id, name, public)
VALUES ('part-images', 'part-images', true);

-- Storage policies for part images
CREATE POLICY "Users can upload own part images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'part-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view part images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'part-images');

CREATE POLICY "Users can update own part images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'part-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own part images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'part-images' AND auth.uid()::text = (storage.foldername(name))[1]);