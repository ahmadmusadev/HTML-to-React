// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code runs in Supabase Edge Functions (Deno runtime).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

import { generateSecurePassword } from './passwordGenerator.ts';
import { buildProfileUpsertPayload } from './profilePayload.ts';

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'سرور کی ترتیبات میں کمی ہے (Missing environment variables).' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authenticate the caller using Bearer token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'لاگ ان درکار ہے۔ برائے مہربانی دوبارہ لاگ ان کریں۔' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'آپ کا سیشن ختم ہو چکا ہے یا غلط ہے۔' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch caller's profile to inspect role and madrasa_id
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, madrasa_id')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'صارف کا پروفائل ریکارڈ تلاش نہیں کیا جا سکا۔' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerRole = callerProfile.role;

    // 3. Parse request payload
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'درخواست کا فارمیٹ درست نہیں ہے۔' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      email: rawEmail,
      fullName: rawFullName,
      role: targetRole,
      madrasaName: rawMadrasaName,
      madrasaId: rawMadrasaId,
      phone: rawPhone,
      district: rawDistrict,
      address: rawAddress
    } = body;

    const email = (rawEmail || '').trim().toLowerCase();
    const fullName = (rawFullName || '').trim();
    const madrasaName = (rawMadrasaName || '').trim();
    let targetMadrasaId = (rawMadrasaId || '').trim();
    const phone = (rawPhone || '').trim();
    const district = (rawDistrict || '').trim();
    const address = (rawAddress || '').trim();

    // 4. Basic input validations
    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ error: 'براہ کرم درست ای میل ایڈریس درج کریں۔' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!fullName || fullName.length < 2) {
      return new Response(
        JSON.stringify({ error: 'مکمل نام درج کرنا لازمی ہے۔' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['admin', 'teacher'].includes(targetRole)) {
      return new Response(
        JSON.stringify({ error: 'منتخب کردہ کردار صرف ایڈمن یا استاد ہو سکتا ہے۔' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Authorization check
    let createdMadrasaId = null;

    if (targetRole === 'admin') {
      // Only super_admin can create new madrasa admins
      if (callerRole !== 'super_admin') {
        return new Response(
          JSON.stringify({ error: 'آپ کے پاس نیا مدرسہ یا ایڈمن شامل کرنے کا اختیار نہیں ہے۔' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!madrasaName) {
        return new Response(
          JSON.stringify({ error: 'مدرسے کا نام درج کرنا لازمی ہے۔' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the new madrasa in public.madrasas
      const madrasaInsertData: Record<string, any> = {
        name: madrasaName
      };
      if (district) madrasaInsertData.district = district;
      if (address) madrasaInsertData.address = address;
      if (phone) madrasaInsertData.phone = phone;

      const { data: newMadrasa, error: madrasaInsertErr } = await supabaseAdmin
        .from('madrasas')
        .insert([madrasaInsertData])
        .select('id')
        .single();

      if (madrasaInsertErr || !newMadrasa) {
        return new Response(
          JSON.stringify({ error: `مدرسہ بنانے میں مسئلہ پیش آیا: ${madrasaInsertErr?.message || ''}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      createdMadrasaId = newMadrasa.id;
      targetMadrasaId = newMadrasa.id;

      // Automatically include the 5 default classes for this newly added madrasa
      try {
        const initialClasses = [
          { madrasa_id: newMadrasa.id, class_name: 'حفظِ قرآن — ناظرہ' },
          { madrasa_id: newMadrasa.id, class_name: 'حفظِ قرآن — سال اول' },
          { madrasa_id: newMadrasa.id, class_name: 'حفظِ قرآن — سال دوم' },
          { madrasa_id: newMadrasa.id, class_name: 'حفظِ قرآن — سال سوم' },
          { madrasa_id: newMadrasa.id, class_name: 'حفظِ قرآن — سال چہارم' }
        ];
        await supabaseAdmin.from('classes').insert(initialClasses);
      } catch (clsErr) {
        console.warn('[create-account-invite] Initial classes seeding warning:', clsErr);
      }
    } else if (targetRole === 'teacher') {
      // super_admin or admin can invite teachers
      if (callerRole === 'admin') {
        // Enforce the teacher belongs strictly to the caller's madrasa
        if (!callerProfile.madrasa_id) {
          return new Response(
            JSON.stringify({ error: 'آپ کے اکاؤنٹ کے ساتھ کوئی مدرسہ منسلک نہیں ہے۔' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        targetMadrasaId = callerProfile.madrasa_id;
      } else if (callerRole === 'super_admin') {
        if (!targetMadrasaId || !UUID_REGEX.test(targetMadrasaId)) {
          return new Response(
            JSON.stringify({ error: 'مدرسہ منتخب کرنا لازمی ہے۔' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'آپ کے پاس استاد کا اکاؤنٹ بنانے کا اختیار نہیں ہے۔' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Create user directly via Supabase Auth Admin API with generated password
    const generatedPassword = generateSecurePassword(12);

    const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: targetRole,
        madrasa_id: targetMadrasaId,
        phone: phone || null
      }
    });

    if (createErr || !createData?.user) {
      // Rollback newly created madrasa if user creation failed (e.g. email already exists)
      if (createdMadrasaId) {
        await supabaseAdmin.from('madrasas').delete().eq('id', createdMadrasaId);
      }

      let errorUrdu = 'اکاؤنٹ بنانے میں مسئلہ پیش آیا۔';
      const errMsg = (createErr?.message || '').toLowerCase();
      if (
        errMsg.includes('already been registered') ||
        errMsg.includes('already registered') ||
        errMsg.includes('already exists') ||
        createErr?.code === 'email_exists' ||
        createErr?.status === 422
      ) {
        errorUrdu = 'یہ ای میل ایڈریس پہلے سے سسٹم میں رجسٹرڈ ہے۔';
      } else if (createErr?.message) {
        errorUrdu = `خرابی: ${createErr.message}`;
      }

      return new Response(
        JSON.stringify({ error: errorUrdu }),
        { status: createErr?.status || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const createdUser = createData.user;

    // 7. Reinforce public.profiles upsert (in case database trigger doesn't execute or metadata is delayed)
    const profilePayload = buildProfileUpsertPayload({
      id: createdUser.id,
      fullName,
      role: targetRole,
      madrasaId: targetMadrasaId,
      phone
    });

    const { error: upsertErr } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (upsertErr) {
      console.error('Profile upsert failed after auth user creation. Rolling back:', upsertErr);

      // Attempt rollback of created auth user to avoid leaving an orphaned/broken account
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
      } catch (deleteErr) {
        console.error('Failed to rollback created auth user:', deleteErr);
      }

      // Roll back created madrasa if this operation created one
      if (createdMadrasaId) {
        try {
          await supabaseAdmin.from('madrasas').delete().eq('id', createdMadrasaId);
        } catch (madrasaDeleteErr) {
          console.error('Failed to rollback created madrasa:', madrasaDeleteErr);
        }
      }

      return new Response(
        JSON.stringify({
          error: 'اکاؤنٹ بنانے کے بعد پروفائل کو محفوظ کرنے میں خرابی پیش آئی، براہ کرم دوبارہ کوشش کریں۔',
          details: upsertErr.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'اکاؤنٹ کامیابی سے بن گیا ہے۔ نیچے دیا گیا پاسورڈ صارف کو فراہم کریں۔',
        user: {
          id: createdUser.id,
          email: createdUser.email
        },
        madrasa_id: targetMadrasaId,
        password: generatedPassword
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unhandled edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'غیر متوقع سرور خرابی پیش آئی ہے۔ برائے مہربانی بعد میں کوشش کریں۔' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
