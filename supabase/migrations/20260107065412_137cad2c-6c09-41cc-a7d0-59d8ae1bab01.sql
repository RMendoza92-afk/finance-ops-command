-- Create table for actuarial loss development triangles
CREATE TABLE public.loss_development_triangles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accident_year INTEGER NOT NULL,
  development_months INTEGER NOT NULL,
  metric_type TEXT NOT NULL,
  amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(accident_year, development_months, metric_type)
);

-- Create indexes for common queries
CREATE INDEX idx_triangles_ay ON public.loss_development_triangles(accident_year);
CREATE INDEX idx_triangles_metric ON public.loss_development_triangles(metric_type);
CREATE INDEX idx_triangles_ay_metric ON public.loss_development_triangles(accident_year, metric_type);

-- Enable RLS
ALTER TABLE public.loss_development_triangles ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to triangles" 
ON public.loss_development_triangles 
FOR SELECT 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_triangles_updated_at
BEFORE UPDATE ON public.loss_development_triangles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.loss_development_triangles IS 'Actuarial loss development triangle data by accident year and development period';