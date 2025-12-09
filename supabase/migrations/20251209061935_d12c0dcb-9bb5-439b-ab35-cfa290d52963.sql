-- =============================================
-- CITIZEN CONNECT BACKEND DATABASE SCHEMA
-- =============================================

-- 1) Create custom ENUM types
CREATE TYPE public.app_role AS ENUM ('citizen', 'official', 'admin');
CREATE TYPE public.report_type AS ENUM ('infrastructure', 'misconduct');
CREATE TYPE public.report_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.report_status AS ENUM ('submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected');
CREATE TYPE public.evidence_type AS ENUM ('image', 'video', 'document');
CREATE TYPE public.project_status AS ENUM ('planned', 'ongoing', 'completed', 'on_hold');
CREATE TYPE public.transaction_type AS ENUM ('allocation', 'release', 'expenditure');

-- 2) Create profiles table (maps to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3) Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'citizen',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 4) Create reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type report_type NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity report_severity NOT NULL DEFAULT 'medium',
  status report_status NOT NULL DEFAULT 'submitted',
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_address TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  assigned_official_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ai_category_suggestion TEXT,
  ai_sentiment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5) Create report_evidence table
CREATE TABLE public.report_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_type evidence_type NOT NULL,
  original_filename TEXT,
  uploaded_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6) Create report_comments table
CREATE TABLE public.report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  author_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  author_role app_role NOT NULL,
  content TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7) Create report_timeline_events table
CREATE TABLE public.report_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  from_status report_status,
  to_status report_status,
  performed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8) Create projects table (transparency data)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  department TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  status project_status NOT NULL DEFAULT 'planned',
  total_budget_amount NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9) Create financial_transactions table
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  transaction_type transaction_type NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT,
  contractor_name TEXT,
  invoice_reference TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10) Create project_updates table
CREATE TABLE public.project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11) Create transparency_comments table
CREATE TABLE public.transparency_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12) Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 13) Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE p.auth_user_id = _user_id
      AND ur.role = _role
  )
$$;

-- Function to get user's profile id from auth id
CREATE OR REPLACE FUNCTION public.get_profile_id(_auth_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = _auth_user_id LIMIT 1
$$;

-- Function to check if user is official or admin
CREATE OR REPLACE FUNCTION public.is_official_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'official') OR public.has_role(_user_id, 'admin')
$$;

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transparency_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (
    user_id = public.get_profile_id(auth.uid())
  );

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Reports policies
CREATE POLICY "Citizens can create reports" ON public.reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Citizens can view own non-anonymous reports" ON public.reports
  FOR SELECT USING (
    reporter_user_id = public.get_profile_id(auth.uid()) AND is_anonymous = false
  );

CREATE POLICY "Officials can view assigned reports" ON public.reports
  FOR SELECT USING (
    assigned_official_id = public.get_profile_id(auth.uid()) OR
    public.has_role(auth.uid(), 'official')
  );

CREATE POLICY "Admins can view all reports" ON public.reports
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Officials and admins can update reports" ON public.reports
  FOR UPDATE USING (public.is_official_or_admin(auth.uid()));

CREATE POLICY "Admins can delete reports" ON public.reports
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Report evidence policies
CREATE POLICY "Anyone can add evidence to reports" ON public.report_evidence
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view evidence for accessible reports" ON public.report_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reports r 
      WHERE r.id = report_id AND (
        r.reporter_user_id = public.get_profile_id(auth.uid()) OR
        public.is_official_or_admin(auth.uid())
      )
    )
  );

-- Report comments policies
CREATE POLICY "Authenticated users can add comments" ON public.report_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view comments on accessible reports" ON public.report_comments
  FOR SELECT USING (
    is_public = true OR
    author_user_id = public.get_profile_id(auth.uid()) OR
    public.is_official_or_admin(auth.uid())
  );

-- Report timeline policies
CREATE POLICY "Users can view timeline for accessible reports" ON public.report_timeline_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reports r 
      WHERE r.id = report_id AND (
        r.reporter_user_id = public.get_profile_id(auth.uid()) OR
        public.is_official_or_admin(auth.uid())
      )
    )
  );

CREATE POLICY "System can insert timeline events" ON public.report_timeline_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Projects policies (public read for transparency)
CREATE POLICY "Anyone can view projects" ON public.projects
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage projects" ON public.projects
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Financial transactions policies (public read for transparency)
CREATE POLICY "Anyone can view transactions" ON public.financial_transactions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage transactions" ON public.financial_transactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Project updates policies (public read)
CREATE POLICY "Anyone can view project updates" ON public.project_updates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage project updates" ON public.project_updates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Transparency comments policies
CREATE POLICY "Anyone can view transparency comments" ON public.transparency_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add transparency comments" ON public.transparency_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = public.get_profile_id(auth.uid()));

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Audit logs policies
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- =============================================
-- TRIGGERS FOR AUTO-UPDATES
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_profile_id UUID;
BEGIN
  INSERT INTO public.profiles (auth_user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  )
  RETURNING id INTO new_profile_id;
  
  -- Assign default citizen role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_profile_id, 'citizen');
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on auth.user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- STORAGE BUCKETS
-- =============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('evidence-media', 'evidence-media', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('project-media', 'project-media', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true);

-- Storage policies for evidence-media
CREATE POLICY "Authenticated users can upload evidence" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'evidence-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view evidence" ON storage.objects
  FOR SELECT USING (bucket_id = 'evidence-media');

-- Storage policies for project-media (public)
CREATE POLICY "Anyone can view project media" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-media');

CREATE POLICY "Admins can upload project media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'project-media' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies for profile-images
CREATE POLICY "Anyone can view profile images" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-images');

CREATE POLICY "Users can upload own profile images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'profile-images' AND auth.uid() IS NOT NULL);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_reports_reporter ON public.reports(reporter_user_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_type ON public.reports(type);
CREATE INDEX idx_reports_assigned ON public.reports(assigned_official_id);
CREATE INDEX idx_reports_created ON public.reports(created_at DESC);
CREATE INDEX idx_report_evidence_report ON public.report_evidence(report_id);
CREATE INDEX idx_report_comments_report ON public.report_comments(report_id);
CREATE INDEX idx_report_timeline_report ON public.report_timeline_events(report_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_department ON public.projects(department);
CREATE INDEX idx_financial_transactions_project ON public.financial_transactions(project_id);
CREATE INDEX idx_project_updates_project ON public.project_updates(project_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);