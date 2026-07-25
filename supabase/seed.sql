-- ==============================================================================
-- INITIAL SEED DATA SCRIPT FOR MADRASA SAAS
-- Seeds 1 Madrasa, 1 Admin, 1 Teacher, 2 Classes, 5 Students, Records & Fees
-- ==============================================================================

-- 1. Insert Sample Madrasa
INSERT INTO public.madrasas (id, name, address, phone)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'جامعہ علوم اسلامیہ — مرکزی کیمپس',
  'خیابانِ جناح، لاہور',
  '0300-1234567'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. Insert Dummy Auth Users (Note: In live production Supabase, users are created via Auth API)
-- We insert into auth.users (if allowed by your SQL Editor permissions) or directly seed profiles for testing
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES 
(
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'admin@madrasa.com',
  crypt('AdminPass123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"مولانا احمد مدنی (مہتمم)","role":"admin","madrasa_id":"11111111-1111-1111-1111-111111111111"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
),
(
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'teacher@madrasa.com',
  crypt('TeacherPass123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"استاد محمد یوسف","role":"teacher","madrasa_id":"11111111-1111-1111-1111-111111111111"}',
  now(),
  now(),
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Insert or Update Profiles
INSERT INTO public.profiles (id, madrasa_id, full_name, role, phone)
VALUES 
(
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'مولانا احمد مدنی (مہتمم)',
  'admin',
  '0300-1112233'
),
(
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'استاد محمد یوسف',
  'teacher',
  '0300-4445566'
)
ON CONFLICT (id) DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  madrasa_id = EXCLUDED.madrasa_id;

-- 3. Insert 2 Classes
INSERT INTO public.classes (id, madrasa_id, teacher_id, class_name)
VALUES 
(
  '44444444-4444-4444-4444-444444444441',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'حفظِ قرآن — سال اول'
),
(
  '44444444-4444-4444-4444-444444444442',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'حفظِ قرآن — سال دوم'
)
ON CONFLICT (id) DO UPDATE SET class_name = EXCLUDED.class_name;

-- 4. Insert 5 Students
INSERT INTO public.students (id, madrasa_id, class_id, name, roll_number, guardian_phone, status)
VALUES 
(
  '55555555-5555-5555-5555-555555555551',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444441',
  'عبداللہ خان',
  '101',
  '0300-9998877',
  'active'
),
(
  '55555555-5555-5555-5555-555555555552',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444441',
  'محمد حسیب',
  '102',
  '0301-8887766',
  'active'
),
(
  '55555555-5555-5555-5555-555555555553',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444441',
  'علی حسنین',
  '103',
  '0302-7776655',
  'active'
),
(
  '55555555-5555-5555-5555-555555555554',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444442',
  'عمر فاروق',
  '201',
  '0303-6665544',
  'active'
),
(
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444442',
  'ابوبکر صدیق',
  '202',
  '0304-5554433',
  'active'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 5. Insert Initial Daily Hifz Records
INSERT INTO public.hifz_records (madrasa_id, student_id, teacher_id, date, sabaq_para, sabaq_lines, sabqi_para, manzil_para, teacher_notes)
VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555551',
  '33333333-3333-3333-3333-333333333333',
  CURRENT_DATE,
  1,
  15,
  1,
  30,
  'ماشاءاللہ بہترین تلاوت اور ممتاز کارکردگی۔'
),
(
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555552',
  '33333333-3333-3333-3333-333333333333',
  CURRENT_DATE,
  2,
  12,
  2,
  29,
  'سبق اچھا سنایا، منزل میں تھوڑی توجہ کی ضرورت ہے۔'
);

-- 6. Insert Initial Fee Records
INSERT INTO public.fees (madrasa_id, student_id, amount, month_year, status, paid_at)
VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555551',
  2500.00,
  '2026-07',
  'paid',
  now()
),
(
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555552',
  2500.00,
  '2026-07',
  'pending',
  NULL
);
