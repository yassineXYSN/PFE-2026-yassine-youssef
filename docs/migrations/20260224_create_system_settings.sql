-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id text PRIMARY KEY,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only superadmins can view and update system settings
CREATE POLICY "Superadmins can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    )
);

-- Insert initial security settings if not exists
INSERT INTO public.system_settings (id, settings)
VALUES ('security', '{
    "minPasswordLength": 8,
    "requireComplexPassword": true,
    "sessionTimeout": 30,
    "require2FA": false,
    "ipWhitelist": ""
}'::jsonb)
ON CONFLICT (id) DO NOTHING;
