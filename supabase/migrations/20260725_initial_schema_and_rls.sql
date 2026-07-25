-- ==============================================================================
-- MADRASA SAAS BACKEND & DATABASE MIGRATION SCRIPT
-- PostgreSQL + Supabase Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID Extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABLES DEFINITION
-- ------------------------------------------------------------------------------

-- 1.1 Madrasas Table
CREATE TABLE IF NOT EXISTS public.madrasas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.2 Profiles Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'teacher')),
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.3 Classes Table
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    class_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.4 Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    roll_number TEXT,
    guardian_phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'left')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.5 Hifz Records Table
CREATE TABLE IF NOT EXISTS public.hifz_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    date DATE DEFAULT CURRENT_DATE,
    sabaq_para INT,
    sabaq_lines INT,
    sabqi_para INT,
    manzil_para INT,
    teacher_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.6 Fees Table
CREATE TABLE IF NOT EXISTS public.fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
    status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. INDEXES FOR MULTI-TENANT QUERY PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_madrasa_id ON public.profiles(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_classes_madrasa_id ON public.classes(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_students_madrasa_id ON public.students(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_hifz_records_madrasa_id ON public.hifz_records(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_hifz_records_student_id ON public.hifz_records(student_id);
CREATE INDEX IF NOT EXISTS idx_hifz_records_date ON public.hifz_records(date);
CREATE INDEX IF NOT EXISTS idx_fees_madrasa_id ON public.fees(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_fees_student_id ON public.fees(student_id);

-- ------------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS FOR SECURITY & RLS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Helper function: Get user role safely without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper function: Get user madrasa_id safely without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_madrasa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT madrasa_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------------------------
-- 4. AUTH HOOK TRIGGER (AUTO-CREATE PROFILE ON USER SIGNUP)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, madrasa_id, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'کاربر'),
    COALESCE(new.raw_user_meta_data->>'role', 'teacher'),
    CASE 
      WHEN (new.raw_user_meta_data->>'madrasa_id') IS NOT NULL AND (new.raw_user_meta_data->>'madrasa_id') != ''
      THEN (new.raw_user_meta_data->>'madrasa_id')::uuid
      ELSE NULL
    END,
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 5. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.madrasas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hifz_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 6. RLS POLICIES
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- 6.1 MADRASAS POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "Super admin full access on madrasas" ON public.madrasas;
CREATE POLICY "Super admin full access on madrasas" ON public.madrasas
    FOR ALL TO authenticated
    USING (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Admin view and edit own madrasa" ON public.madrasas;
CREATE POLICY "Admin view and edit own madrasa" ON public.madrasas
    FOR ALL TO authenticated
    USING (id = public.get_user_madrasa_id());

DROP POLICY IF EXISTS "Teacher view own madrasa" ON public.madrasas;
CREATE POLICY "Teacher view own madrasa" ON public.madrasas
    FOR SELECT TO authenticated
    USING (id = public.get_user_madrasa_id());

-- ==============================================================================
-- 6.2 PROFILES POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "Super admin full access on profiles" ON public.profiles;
CREATE POLICY "Super admin full access on profiles" ON public.profiles
    FOR ALL TO authenticated
    USING (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Admin view and manage profiles in own madrasa" ON public.profiles;
CREATE POLICY "Admin view and manage profiles in own madrasa" ON public.profiles
    FOR ALL TO authenticated
    USING (
        public.get_user_role() = 'admin' 
        AND madrasa_id = public.get_user_madrasa_id()
    );

DROP POLICY IF EXISTS "Teacher view profiles in own madrasa" ON public.profiles;
CREATE POLICY "Teacher view profiles in own madrasa" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id()
    );

-- ==============================================================================
-- 6.3 CLASSES POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "Super admin full access on classes" ON public.classes;
CREATE POLICY "Super admin full access on classes" ON public.classes
    FOR ALL TO authenticated
    USING (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Admin manage classes in own madrasa" ON public.classes;
CREATE POLICY "Admin manage classes in own madrasa" ON public.classes
    FOR ALL TO authenticated
    USING (
        public.get_user_role() = 'admin' 
        AND madrasa_id = public.get_user_madrasa_id()
    );

DROP POLICY IF EXISTS "Teacher view classes in own madrasa" ON public.classes;
CREATE POLICY "Teacher view classes in own madrasa" ON public.classes
    FOR SELECT TO authenticated
    USING (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id()
    );

-- ==============================================================================
-- 6.4 STUDENTS POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "Super admin full access on students" ON public.students;
CREATE POLICY "Super admin full access on students" ON public.students
    FOR ALL TO authenticated
    USING (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Admin manage students in own madrasa" ON public.students;
CREATE POLICY "Admin manage students in own madrasa" ON public.students
    FOR ALL TO authenticated
    USING (
        public.get_user_role() = 'admin' 
        AND madrasa_id = public.get_user_madrasa_id()
    );

DROP POLICY IF EXISTS "Teacher view students in own madrasa" ON public.students;
CREATE POLICY "Teacher view students in own madrasa" ON public.students
    FOR SELECT TO authenticated
    USING (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id()
    );

-- ==============================================================================
-- 6.5 HIFZ RECORDS POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "Super admin full access on hifz_records" ON public.hifz_records;
CREATE POLICY "Super admin full access on hifz_records" ON public.hifz_records
    FOR ALL TO authenticated
    USING (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Admin manage hifz_records in own madrasa" ON public.hifz_records;
CREATE POLICY "Admin manage hifz_records in own madrasa" ON public.hifz_records
    FOR ALL TO authenticated
    USING (
        public.get_user_role() = 'admin' 
        AND madrasa_id = public.get_user_madrasa_id()
    );

DROP POLICY IF EXISTS "Teacher manage hifz_records in own madrasa" ON public.hifz_records;
CREATE POLICY "Teacher manage hifz_records in own madrasa" ON public.hifz_records
    FOR ALL TO authenticated
    USING (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id()
    )
    WITH CHECK (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id()
    );

-- ==============================================================================
-- 6.6 FEES POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "Super admin full access on fees" ON public.fees;
CREATE POLICY "Super admin full access on fees" ON public.fees
    FOR ALL TO authenticated
    USING (public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "Admin manage fees in own madrasa" ON public.fees;
CREATE POLICY "Admin manage fees in own madrasa" ON public.fees
    FOR ALL TO authenticated
    USING (
        public.get_user_role() = 'admin' 
        AND madrasa_id = public.get_user_madrasa_id()
    );

DROP POLICY IF EXISTS "Teacher view fees in own madrasa" ON public.fees;
CREATE POLICY "Teacher view fees in own madrasa" ON public.fees
    FOR SELECT TO authenticated
    USING (
        public.get_user_role() = 'teacher' 
        AND madrasa_id = public.get_user_madrasa_id()
    );
