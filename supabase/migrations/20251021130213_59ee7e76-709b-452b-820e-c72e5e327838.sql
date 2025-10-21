-- Add car-related columns to stock table for hierarchical filtering
ALTER TABLE public.stock
ADD COLUMN car_company text,
ADD COLUMN car_model text,
ADD COLUMN car_name text;

-- Create index for better filter performance
CREATE INDEX idx_stock_car_company ON public.stock(car_company);
CREATE INDEX idx_stock_car_model ON public.stock(car_model);
CREATE INDEX idx_stock_car_name ON public.stock(car_name);