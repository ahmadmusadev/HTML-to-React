import { supabase } from '../lib/supabaseClient';

/**
 * کیلنڈر کے ایام کا فرق معلوم کرنے کا فنکشن (تاریخ کے حساب سے، وقت کو نظر انداز کر کے)
 * @param {string|Date} date1 
 * @param {string|Date} date2 
 * @returns {number} ایام کا فرق (date1 - date2)
 */
export function getDaysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * تاریخ کو معیاری YYYY-MM-DD فارمیٹ میں تبدیل کرنے کا فنکشن
 * @param {Date|string} d 
 * @returns {string} YYYY-MM-DD
 */
export function formatDateISO(d) {
  const date = d ? new Date(d) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * اردو میں مہینے کا نام
 */
export const URDU_MONTH_NAMES = [
  'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
  'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'
];

/**
 * کام کی کیفیت (Status) کا تعین:
 * صارف کی ہدایت کے مطابق:
 * 1. پیشگی اطلاع: مقررہ تاریخ سے ٹھیک 2 دن پہلے (diffDays === 1 یا 2)
 * 2. آج کا کام: مقررہ تاریخ پر (diffDays === 0)
 * 3. زیرِ التوا: مقررہ تاریخ گزرنے کے بعد 3 دن تک (diffDays >= -3 اور diffDays < 0)
 * 4. مکمل شدہ: اگر پہلے ہی مکمل ہو چکا ہو
 */
export function evaluateTaskTiming(dueDate, isCompleted = false, referenceDate = new Date()) {
  if (isCompleted) {
    return {
      statusKey: 'completed',
      statusLabel: 'مکمل شدہ',
      badgeClass: 'badge-completed',
      isOverdue: false,
      isDueToday: false,
      isAdvanceNotice: false,
      isInNotificationWindow: true,
      diffDays: getDaysDifference(dueDate, referenceDate)
    };
  }

  const diffDays = getDaysDifference(dueDate, referenceDate);

  if (diffDays === 0) {
    return {
      statusKey: 'due_today',
      statusLabel: 'آج کی مقررہ میعاد',
      badgeClass: 'badge-today',
      isOverdue: false,
      isDueToday: true,
      isAdvanceNotice: false,
      isInNotificationWindow: true,
      diffDays
    };
  }

  if (diffDays === 1 || diffDays === 2) {
    return {
      statusKey: 'advance_notice',
      statusLabel: `پیشگی اطلاع (${diffDays === 1 ? 'کل' : '۲ دن بعد'})`,
      badgeClass: 'badge-advance',
      isOverdue: false,
      isDueToday: false,
      isAdvanceNotice: true,
      isInNotificationWindow: true,
      diffDays
    };
  }

  if (diffDays >= -3 && diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      statusKey: 'overdue',
      statusLabel: `زیرِ التوا (${overdueDays} دن تاخیر)`,
      badgeClass: 'badge-overdue',
      isOverdue: true,
      isDueToday: false,
      isAdvanceNotice: false,
      isInNotificationWindow: true,
      diffDays
    };
  }

  if (diffDays < -3) {
    return {
      statusKey: 'past_due',
      statusLabel: `میعاد ختم (${Math.abs(diffDays)} دن قبل)`,
      badgeClass: 'badge-expired',
      isOverdue: true,
      isDueToday: false,
      isAdvanceNotice: false,
      isInNotificationWindow: false,
      diffDays
    };
  }

  // diffDays > 2 (مستقبل کے کام جو ابھی پیشگی اطلاع کی حد میں نہیں آئے)
  return {
    statusKey: 'future',
    statusLabel: `آئندہ کے امور (${diffDays} دن بعد)`,
    badgeClass: 'badge-future',
    isOverdue: false,
    isDueToday: false,
    isAdvanceNotice: false,
    isInNotificationWindow: false,
    diffDays
  };
}

/**
 * 8 طے شدہ خودکار کاموں کی فہرست اور کیفیت کی جانچ
 * @param {Object} params
 * @param {string} params.madrasaId
 * @param {Array} params.classesList
 * @param {Date|string} [params.currentDate]
 * @param {Object} [params.loadedData] پہلے سے لوڈ شدہ ڈیٹا بیس ریکارڈز
 * @returns {Promise<Array>} خودکار کاموں کی تفصیلی فہرست
 */
export async function generateAutomatedTasks({
  madrasaId,
  classesList = [],
  currentDate = new Date(),
  loadedData = {}
}) {
  if (!madrasaId) return [];

  const now = new Date(currentDate);
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const day = now.getDate();
  const currentMonthName = URDU_MONTH_NAMES[monthIndex];
  const todayStr = formatDateISO(now);

  // مہینے کا آخری دن معلوم کرنا
  const lastDateOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  const endOfMonthDateStr = formatDateISO(new Date(year, monthIndex, lastDateOfMonth));
  const startOfMonthDateStr = formatDateISO(new Date(year, monthIndex, 1));
  const midMonthEvaluationDateStr = formatDateISO(new Date(year, monthIndex, 5));
  const feeDueDateStr = formatDateISO(new Date(year, monthIndex, 1));
  const payrollDueDateStr = formatDateISO(new Date(year, monthIndex, 1));

  const automatedTasks = [];

  // 1. طلبہ کی یومیہ حاضری
  const studentAttCompleted = loadedData.studentAttendanceToday !== undefined
    ? loadedData.studentAttendanceToday
    : false;
  const studentAttTiming = evaluateTaskTiming(todayStr, studentAttCompleted, now);
  automatedTasks.push({
    id: `auto-student-attendance-${todayStr}`,
    is_automated: true,
    title: 'طلبہ کی یومیہ حاضری کا اندراج',
    description: `تمام فعال درجات (${classesList.length} درجات) کے طلبہ کی یومیہ حاضری مکمل کی جائے۔`,
    category: 'academic',
    categoryLabel: 'تعلیمی',
    priority: 'high',
    priorityLabel: 'فوری / اہم',
    due_date: todayStr,
    action_route: '/attendance',
    action_label: 'حاضری کے صفحے پر جائیں',
    ...studentAttTiming
  });

  // 2. اساتذہ و ملازمین کی حاضری
  const staffAttCompleted = loadedData.staffAttendanceToday !== undefined
    ? loadedData.staffAttendanceToday
    : false;
  const staffAttTiming = evaluateTaskTiming(todayStr, staffAttCompleted, now);
  automatedTasks.push({
    id: `auto-staff-attendance-${todayStr}`,
    is_automated: true,
    title: 'اساتذہ و ملازمین کی حاضری',
    description: 'جامعہ کے اساتذہ اور دفتری ملازمین کی یومیہ آمد و روانگی کی حاضری درج کی جائے۔',
    category: 'administrative',
    categoryLabel: 'انتظامی',
    priority: 'high',
    priorityLabel: 'فوری / اہم',
    due_date: todayStr,
    action_route: '/attendance',
    action_label: 'اسٹاف حاضری پر جائیں',
    ...staffAttTiming
  });

  // 3. ماہانہ خواندگی کا ابتدائی اندراج (یکم تاریخ)
  const monthlyLitInitCompleted = loadedData.monthlyLiteracyInitialCompleted !== undefined
    ? loadedData.monthlyLiteracyInitialCompleted
    : false;
  const monthlyLitInitTiming = evaluateTaskTiming(startOfMonthDateStr, monthlyLitInitCompleted, now);
  automatedTasks.push({
    id: `auto-monthly-literacy-init-${year}-${monthIndex + 1}`,
    is_automated: true,
    title: `ماہانہ خواندگی کا ابتدائی اندراج (${currentMonthName} ${year})`,
    description: 'ہر مہینے کی یکم تاریخ کو طلبہ کے حفظ و ناظرہ کی ماہانہ خواندگی کا ابتدائی اندراج لازمی ہے۔',
    category: 'academic',
    categoryLabel: 'تعلیمی',
    priority: 'high',
    priorityLabel: 'فوری / اہم',
    due_date: startOfMonthDateStr,
    action_route: '/entry',
    action_label: 'اندراج ماہانہ خواندگی پر جائیں',
    ...monthlyLitInitTiming
  });

  // 4. ماہانہ خواندگی کی مکمل رپورٹ (30 یا آخری تاریخ)
  const monthlyLitFinalCompleted = loadedData.monthlyLiteracyFinalCompleted !== undefined
    ? loadedData.monthlyLiteracyFinalCompleted
    : false;
  const monthlyLitFinalTiming = evaluateTaskTiming(endOfMonthDateStr, monthlyLitFinalCompleted, now);
  automatedTasks.push({
    id: `auto-monthly-literacy-final-${year}-${monthIndex + 1}`,
    is_automated: true,
    title: `ماہانہ خواندگی کی مکمل رپورٹ (${currentMonthName} ${year})`,
    description: 'مہینے کے اختتام پر جملہ درجات کی ماہانہ خواندگی رپورٹ کی حتمی تکمیل اور توثیق۔',
    category: 'academic',
    categoryLabel: 'تعلیمی',
    priority: 'high',
    priorityLabel: 'فوری / اہم',
    due_date: endOfMonthDateStr,
    action_route: '/entry',
    action_label: 'ماہانہ رپورٹ کا جائزہ لیں',
    ...monthlyLitFinalTiming
  });

  // 5. ماہانہ تعلیمی جائزہ (5 سے 10 تاریخ)
  const monthlyEvalCompleted = loadedData.monthlyEvaluationCompleted !== undefined
    ? loadedData.monthlyEvaluationCompleted
    : false;
  const monthlyEvalTiming = evaluateTaskTiming(midMonthEvaluationDateStr, monthlyEvalCompleted, now);
  automatedTasks.push({
    id: `auto-monthly-evaluations-${year}-${monthIndex + 1}`,
    is_automated: true,
    title: `ماہانہ تعلیمی جائزہ (${currentMonthName} ${year})`,
    description: 'ماہانہ تعلیمی امتحانات اور طلبہ کے جائزوں کا باضابطہ اندراج اور ریکارڈ۔',
    category: 'academic',
    categoryLabel: 'تعلیمی',
    priority: 'normal',
    priorityLabel: 'عمومی',
    due_date: midMonthEvaluationDateStr,
    action_route: '/entry',
    action_label: 'جائزہ جات پر جائیں',
    ...monthlyEvalTiming
  });

  // 6. ماہانہ فیس کا اجراء و وصولی
  const feesCompleted = loadedData.feesCompleted !== undefined
    ? loadedData.feesCompleted
    : false;
  const feesTiming = evaluateTaskTiming(feeDueDateStr, feesCompleted, now);
  automatedTasks.push({
    id: `auto-monthly-fees-${year}-${monthIndex + 1}`,
    is_automated: true,
    title: `ماہانہ فیس کا اجراء و واجبات (${currentMonthName} ${year})`,
    description: 'طلبہ کے ماہانہ فیس واؤچرز کی تیاری اور فیس وصولی کے اندراج کی جانچ۔',
    category: 'financial',
    categoryLabel: 'مالیاتی',
    priority: 'normal',
    priorityLabel: 'عمومی',
    due_date: feeDueDateStr,
    action_route: '/fees',
    action_label: 'فیس ریکارڈ پر جائیں',
    ...feesTiming
  });

  // 7. اساتذہ و عملہ کی ماہانہ تنخواہ کا اجراء
  const payrollCompleted = loadedData.payrollCompleted !== undefined
    ? loadedData.payrollCompleted
    : false;
  const payrollTiming = evaluateTaskTiming(payrollDueDateStr, payrollCompleted, now);
  automatedTasks.push({
    id: `auto-monthly-payroll-${year}-${monthIndex + 1}`,
    is_automated: true,
    title: `اساتذہ و ملازمین کا مشاہرہ (${currentMonthName} ${year})`,
    description: 'ماہانہ تنخواہوں کا حساب، کٹوتی اور ادائیگی کی تصدیق۔',
    category: 'financial',
    categoryLabel: 'مالیاتی',
    priority: 'high',
    priorityLabel: 'فوری / اہم',
    due_date: payrollDueDateStr,
    action_route: '/payroll',
    action_label: 'تنخواہ کے گوشے پر جائیں',
    ...payrollTiming
  });

  // 8. امتحانی نتائج کا اندراج
  const examsCompleted = loadedData.examsCompleted !== undefined
    ? loadedData.examsCompleted
    : false;
  // امتحانات کی عمومی مقررہ تاریخ ہر تین ماہ بعد یا موجودہ مہینے کی 15 تاریخ
  const examDueDateStr = formatDateISO(new Date(year, monthIndex, 15));
  const examTiming = evaluateTaskTiming(examDueDateStr, examsCompleted, now);
  automatedTasks.push({
    id: `auto-exams-${year}-${monthIndex + 1}`,
    is_automated: true,
    title: `سہ ماہی و ششماہی امتحانی نتائج کا اندراج`,
    description: 'منعقدہ امتحانات کے پرچوں کے نمبرات اور مقدارِ حفظ کا تفصیلی اندراج۔',
    category: 'academic',
    categoryLabel: 'تعلیمی',
    priority: 'normal',
    priorityLabel: 'عمومی',
    due_date: examDueDateStr,
    action_route: '/exams',
    action_label: 'امتحانات پر جائیں',
    ...examTiming
  });

  return automatedTasks;
}

/**
 * سپابیس سے دستی و ذاتی کاموں کو حاصل کرنا
 */
export async function fetchCustomTasksFromSupabase(madrasaId) {
  if (!madrasaId) return [];

  const { data, error } = await supabase
    .from('institution_tasks')
    .select('*')
    .eq('madrasa_id', madrasaId)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('[tasksEngine] Error fetching institution_tasks:', error.message);
    throw error;
  }

  return data || [];
}

/**
 * نیا ذاتی کام سپابیس میں درج کرنا
 */
export async function insertCustomTaskInSupabase(taskPayload) {
  const { data, error } = await supabase
    .from('institution_tasks')
    .insert([taskPayload])
    .select()
    .single();

  if (error) {
    console.error('[tasksEngine] Error inserting institution_tasks:', error.message);
    throw error;
  }

  return data;
}

/**
 * ذاتی کام کی معلومات میں ترمیم کرنا
 */
export async function updateCustomTaskInSupabase(taskId, updates) {
  const { data, error } = await supabase
    .from('institution_tasks')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('[tasksEngine] Error updating institution_tasks:', error.message);
    throw error;
  }

  return data;
}

/**
 * ذاتی کام کو مکمل / غیر مکمل قرار دینا
 */
export async function toggleCustomTaskCompletionInSupabase(taskId, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

  return updateCustomTaskInSupabase(taskId, {
    status: newStatus,
    completed_at: completedAt
  });
}

/**
 * ذاتی کام کو حذف کرنا
 */
export async function deleteCustomTaskFromSupabase(taskId) {
  const { error } = await supabase
    .from('institution_tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('[tasksEngine] Error deleting institution_tasks:', error.message);
    throw error;
  }

  return true;
}
