-- Actuarial metrics table for main KPIs
CREATE TABLE public.actuarial_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_year integer NOT NULL,
  period_quarter integer NOT NULL,
  projected_loss numeric DEFAULT 0,
  prior_year_loss numeric DEFAULT 0,
  ultimate_loss numeric DEFAULT 0,
  lae_amount numeric DEFAULT 0,
  lae_ratio numeric DEFAULT 0,
  development_factor numeric DEFAULT 1,
  fixed_expense_ratio numeric DEFAULT 0,
  variable_expense_ratio numeric DEFAULT 0,
  total_expense_ratio numeric DEFAULT 0,
  target_expense_ratio numeric DEFAULT 0,
  selected_profit numeric DEFAULT 0,
  contingencies numeric DEFAULT 0,
  investment_income numeric DEFAULT 0,
  indicated_level_effect numeric DEFAULT 0,
  selected_change numeric DEFAULT 0,
  credibility numeric DEFAULT 0,
  trend_factor numeric DEFAULT 1,
  loss_ratio numeric DEFAULT 0,
  target_loss_ratio numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(period_year, period_quarter)
);

-- Coverage rate changes table
CREATE TABLE public.coverage_rate_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_year integer NOT NULL,
  coverage text NOT NULL,
  indicated_change numeric DEFAULT 0,
  selected_change numeric DEFAULT 0,
  premium_volume numeric DEFAULT 0,
  loss_ratio numeric DEFAULT 0,
  trend text DEFAULT 'flat',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(period_year, coverage)
);

-- State rate changes table
CREATE TABLE public.state_rate_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_year integer NOT NULL,
  state text NOT NULL,
  indicated_change numeric DEFAULT 0,
  selected_change numeric DEFAULT 0,
  policy_volume integer DEFAULT 0,
  loss_ratio numeric DEFAULT 0,
  filing_status text DEFAULT 'Draft',
  effective_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(period_year, state)
);

-- Quarterly loss development table
CREATE TABLE public.loss_development (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_year integer NOT NULL,
  period_quarter integer NOT NULL,
  reported_losses numeric DEFAULT 0,
  paid_losses numeric DEFAULT 0,
  incurred_losses numeric DEFAULT 0,
  ibnr numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(period_year, period_quarter)
);

-- Enable RLS on all tables
ALTER TABLE public.actuarial_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_rate_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_rate_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loss_development ENABLE ROW LEVEL SECURITY;

-- RLS policies for actuarial_metrics
CREATE POLICY "Anyone can view actuarial_metrics" ON public.actuarial_metrics FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert actuarial_metrics" ON public.actuarial_metrics FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update actuarial_metrics" ON public.actuarial_metrics FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS policies for coverage_rate_changes
CREATE POLICY "Anyone can view coverage_rate_changes" ON public.coverage_rate_changes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert coverage_rate_changes" ON public.coverage_rate_changes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update coverage_rate_changes" ON public.coverage_rate_changes FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS policies for state_rate_changes
CREATE POLICY "Anyone can view state_rate_changes" ON public.state_rate_changes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert state_rate_changes" ON public.state_rate_changes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update state_rate_changes" ON public.state_rate_changes FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS policies for loss_development
CREATE POLICY "Anyone can view loss_development" ON public.loss_development FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert loss_development" ON public.loss_development FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update loss_development" ON public.loss_development FOR UPDATE USING (auth.role() = 'authenticated');

-- Triggers for updated_at
CREATE TRIGGER update_actuarial_metrics_updated_at BEFORE UPDATE ON public.actuarial_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coverage_rate_changes_updated_at BEFORE UPDATE ON public.coverage_rate_changes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_state_rate_changes_updated_at BEFORE UPDATE ON public.state_rate_changes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_loss_development_updated_at BEFORE UPDATE ON public.loss_development FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();