import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMadrasa } from '../context/MadrasaContext';
import { useAuth } from '../context/AuthContext';
import {
  generateAutomatedTasks,
  fetchCustomTasksFromSupabase,
  insertCustomTaskInSupabase,
  updateCustomTaskInSupabase,
  deleteCustomTaskFromSupabase,
  toggleCustomTaskCompletionInSupabase,
  formatDateISO,
  evaluateTaskTiming
} from '../utils/tasksEngine';
import './TasksReminders.css';

const INITIAL_FORM_DATA = {
  title: '',
  description: '',
  category: 'administrative',
  due_date: formatDateISO(new Date()),
  priority: 'normal',
  recurrence: 'none'
};

export default function TasksReminders() {
  const navigate = useNavigate();
  const { activeMadrasa, classesList } = useMadrasa();
  const { user } = useAuth();

  const [customTasks, setCustomTasks] = useState([]);
  const [automatedTasks, setAutomatedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [submitting, setSubmitting] = useState(false);

  const madrasaId = activeMadrasa?.id;

  // Load all tasks (both automated and custom)
  const loadAllTasks = useCallback(async () => {
    if (!madrasaId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Generate automated tasks
      const autoTasks = await generateAutomatedTasks({
        madrasaId,
        classesList: classesList || [],
        currentDate: new Date()
      });
      setAutomatedTasks(autoTasks);

      // 2. Fetch custom tasks from Supabase
      const customDbTasks = await fetchCustomTasksFromSupabase(madrasaId);
      
      // Calculate timing for each custom task
      const evaluatedCustomTasks = customDbTasks.map((t) => {
        const isDone = t.status === 'completed';
        const timing = evaluateTaskTiming(t.due_date, isDone, new Date());
        
        let categoryLabel = 'انتظامی';
        if (t.category === 'academic') categoryLabel = 'تعلیمی';
        if (t.category === 'financial') categoryLabel = 'مالیاتی';
        if (t.category === 'personal') categoryLabel = 'ذاتی';

        let priorityLabel = 'عمومی';
        if (t.priority === 'high') priorityLabel = 'فوری / اہم';
        if (t.priority === 'low') priorityLabel = 'عام';

        return {
          ...t,
          is_automated: false,
          categoryLabel,
          priorityLabel,
          ...timing
        };
      });

      setCustomTasks(evaluatedCustomTasks);
    } catch (err) {
      console.error('[TasksReminders] Load error:', err);
      setError('معلومات حاصل کرنے میں مسئلہ پیش آیا۔ براہِ کرم دوبارہ کوشش فرمائیں۔');
    } finally {
      setLoading(false);
    }
  }, [madrasaId, classesList]);

  useEffect(() => {
    loadAllTasks();
  }, [loadAllTasks]);

  // Combined Tasks List
  const allTasks = useMemo(() => {
    return [...automatedTasks, ...customTasks];
  }, [automatedTasks, customTasks]);

  // Metric Summary Counts
  const metrics = useMemo(() => {
    let overdueCount = 0;
    let todayCount = 0;
    let advanceCount = 0;
    let completedCount = 0;

    allTasks.forEach((t) => {
      if (t.statusKey === 'completed') {
        completedCount++;
      } else if (t.isOverdue) {
        overdueCount++;
      } else if (t.isDueToday) {
        todayCount++;
      } else if (t.isAdvanceNotice) {
        advanceCount++;
      }
    });

    return {
      total: allTasks.length,
      overdue: overdueCount,
      today: todayCount,
      advance: advanceCount,
      completed: completedCount
    };
  }, [allTasks]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      // Filter by tab/status
      if (activeFilter === 'overdue' && !t.isOverdue) return false;
      if (activeFilter === 'due_today' && !t.isDueToday) return false;
      if (activeFilter === 'advance_notice' && !t.isAdvanceNotice) return false;
      if (activeFilter === 'completed' && t.statusKey !== 'completed') return false;
      if (activeFilter === 'automated' && !t.is_automated) return false;
      if (activeFilter === 'custom' && t.is_automated) return false;

      // Filter by category
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const titleMatch = t.title ? t.title.toLowerCase().includes(query) : false;
        const descMatch = t.description ? t.description.toLowerCase().includes(query) : false;
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });
  }, [allTasks, activeFilter, selectedCategory, searchQuery]);

  // Open Modal for New Task
  const handleOpenAddModal = () => {
    setEditingTask(null);
    setFormData({
      ...INITIAL_FORM_DATA,
      due_date: formatDateISO(new Date())
    });
    setIsModalOpen(true);
  };

  // Open Modal for Editing Custom Task
  const handleOpenEditModal = (task) => {
    if (task.is_automated) return;
    setEditingTask(task);
    setFormData({
      title: task.title || '',
      description: task.description || '',
      category: task.category || 'administrative',
      due_date: task.due_date || formatDateISO(new Date()),
      priority: task.priority || 'normal',
      recurrence: task.recurrence || 'none'
    });
    setIsModalOpen(true);
  };

  // Save Task (Insert or Update)
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('براہِ کرم کام کا عنوان درج فرمائیں۔');
      return;
    }
    if (!formData.due_date) {
      setError('براہِ کرم مقررہ تاریخ کا انتخاب فرمائیں۔');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingTask) {
        await updateCustomTaskInSupabase(editingTask.id, {
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category,
          due_date: formData.due_date,
          priority: formData.priority,
          recurrence: formData.recurrence
        });
        setSuccessMessage('کام کامیابی سے تبدیل کر دیا گیا۔');
      } else {
        await insertCustomTaskInSupabase({
          madrasa_id: madrasaId,
          title: formData.title.trim(),
          description: formData.description.trim(),
          category: formData.category,
          due_date: formData.due_date,
          priority: formData.priority,
          recurrence: formData.recurrence,
          created_by: user?.id,
          status: 'pending'
        });
        setSuccessMessage('نیا کام کامیابی سے شامل کر دیا گیا۔');
      }

      setIsModalOpen(false);
      setEditingTask(null);
      await loadAllTasks();

      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('[TasksReminders] Save error:', err);
      setError('کام محفوظ کرنے میں مسئلہ پیش آیا۔');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Completion for Custom Task
  const handleToggleComplete = async (task) => {
    if (task.is_automated) return;
    try {
      await toggleCustomTaskCompletionInSupabase(task.id, task.status);
      await loadAllTasks();
      setSuccessMessage('کام کی کیفیت تبدیل ہو گئی۔');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('[TasksReminders] Toggle error:', err);
      setError('کیفیت تبدیل کرنے میں ناکامی ہوئی۔');
    }
  };

  // Delete Custom Task
  const handleDeleteTask = async (task) => {
    if (task.is_automated) return;
    const confirmed = window.confirm(`کیا آپ واقعی کام "${task.title}" کو حذف کرنا چاہتے ہیں؟`);
    if (!confirmed) return;

    try {
      await deleteCustomTaskFromSupabase(task.id);
      await loadAllTasks();
      setSuccessMessage('کام کامیابی سے حذف کر دیا گیا۔');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('[TasksReminders] Delete error:', err);
      setError('کام حذف کرنے میں ناکامی ہوئی۔');
    }
  };

  return (
    <div className="tasks-reminders-container" dir="rtl">
      {/* Top Header */}
      <div className="tasks-header">
        <div className="tasks-title-wrap">
          <h2 className="tasks-title">زیرِ غور و یادداشت</h2>
          <p className="tasks-subtitle">
            جامعہ کے روزمرہ، ہفتہ وار اور ماہانہ کاموں کی بروقت تکمیل اور یاددہانی کا گوشہ
          </p>
        </div>

        <div className="tasks-header-actions">
          <button
            type="button"
            className="tasks-primary-btn"
            id="addNewTaskBtn"
            onClick={handleOpenAddModal}
          >
            نیا کام شامل کریں
          </button>
        </div>
      </div>

      {/* Prominent Overdue Notice Banner (if any tasks are overdue) */}
      {metrics.overdue > 0 && (
        <div className="tasks-alert tasks-alert-overdue" role="alert">
          <div>
            <strong>توجہ فرمائیں:</strong> ادارے کے <strong>{metrics.overdue}</strong> کام زیرِ التوا ہیں جن کی مقررہ تاریخ گزر چکی ہے۔ برائے مہربانی ان کی فوری تکمیل کو یقینی بنائیں۔
          </div>
        </div>
      )}

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="tasks-alert tasks-alert-success" role="status">
          <span>{successMessage}</span>
          <button
            type="button"
            className="tasks-alert-close-btn"
            onClick={() => setSuccessMessage(null)}
          >
            بند کریں
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="tasks-alert tasks-alert-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="tasks-alert-close-btn"
            onClick={() => setError(null)}
          >
            بند کریں
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="tasks-metrics-grid">
        <div
          className={`tasks-metric-card ${activeFilter === 'all' ? 'active-metric' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          <span className="tasks-metric-title">کل کام</span>
          <span className="tasks-metric-value">{metrics.total}</span>
        </div>

        <div
          className={`tasks-metric-card tasks-metric-overdue ${activeFilter === 'overdue' ? 'active-metric' : ''}`}
          onClick={() => setActiveFilter('overdue')}
        >
          <span className="tasks-metric-title">زیرِ التوا (تاخیر شدہ)</span>
          <span className="tasks-metric-value">{metrics.overdue}</span>
        </div>

        <div
          className={`tasks-metric-card tasks-metric-today ${activeFilter === 'due_today' ? 'active-metric' : ''}`}
          onClick={() => setActiveFilter('due_today')}
        >
          <span className="tasks-metric-title">آج کے کام</span>
          <span className="tasks-metric-value">{metrics.today}</span>
        </div>

        <div
          className={`tasks-metric-card tasks-metric-advance ${activeFilter === 'advance_notice' ? 'active-metric' : ''}`}
          onClick={() => setActiveFilter('advance_notice')}
        >
          <span className="tasks-metric-title">پیشگی اطلاع (آئندہ ۲ دن)</span>
          <span className="tasks-metric-value">{metrics.advance}</span>
        </div>

        <div
          className={`tasks-metric-card tasks-metric-completed ${activeFilter === 'completed' ? 'active-metric' : ''}`}
          onClick={() => setActiveFilter('completed')}
        >
          <span className="tasks-metric-title">مکمل شدہ</span>
          <span className="tasks-metric-value">{metrics.completed}</span>
        </div>
      </div>

      {/* Toolbar: Filters, Category Select & Search */}
      <div className="tasks-toolbar">
        <div className="tasks-filter-pills">
          <button
            type="button"
            className={`tasks-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            تمام ({metrics.total})
          </button>
          <button
            type="button"
            className={`tasks-filter-pill ${activeFilter === 'overdue' ? 'active' : ''}`}
            onClick={() => setActiveFilter('overdue')}
          >
            زیرِ التوا ({metrics.overdue})
          </button>
          <button
            type="button"
            className={`tasks-filter-pill ${activeFilter === 'due_today' ? 'active' : ''}`}
            onClick={() => setActiveFilter('due_today')}
          >
            آج کے کام ({metrics.today})
          </button>
          <button
            type="button"
            className={`tasks-filter-pill ${activeFilter === 'advance_notice' ? 'active' : ''}`}
            onClick={() => setActiveFilter('advance_notice')}
          >
            پیشگی اطلاع ({metrics.advance})
          </button>
          <button
            type="button"
            className={`tasks-filter-pill ${activeFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveFilter('completed')}
          >
            مکمل شدہ ({metrics.completed})
          </button>
          <button
            type="button"
            className={`tasks-filter-pill ${activeFilter === 'automated' ? 'active' : ''}`}
            onClick={() => setActiveFilter('automated')}
          >
            خودکار تنظیمی امور ({automatedTasks.length})
          </button>
          <button
            type="button"
            className={`tasks-filter-pill ${activeFilter === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveFilter('custom')}
          >
            ذاتی امور ({customTasks.length})
          </button>
        </div>

        <div className="tasks-controls-wrap">
          {/* Category Dropdown */}
          <select
            className="tasks-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="زمرہ کا انتخاب"
          >
            <option value="all">تمام شعبہ جات / زمرے</option>
            <option value="academic">تعلیمی</option>
            <option value="administrative">انتظامی</option>
            <option value="financial">مالیاتی</option>
            <option value="personal">ذاتی</option>
          </select>

          {/* Search Input */}
          <input
            type="text"
            className="tasks-search-input"
            placeholder="کام تلاش کریں..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tasks Table */}
      {loading ? (
        <div className="tasks-empty-state">
          <p className="tasks-empty-title">معلومات حاصل کی جا رہی ہیں...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="tasks-empty-state">
          <p className="tasks-empty-title">کوئی کام موجود نہیں ہے</p>
          <p className="tasks-empty-desc">
            منتخب کردہ معیار یا فلٹر کے مطابق اس وقت کوئی کام فہرست میں نہیں ہے۔
          </p>
        </div>
      ) : (
        <div className="tasks-table-wrapper">
          <table className="tasks-table">
            <thead>
              <tr>
                <th style={{ width: '65px', textAlign: 'center' }}>نمبر شمار</th>
                <th>عنوان و تفصیل</th>
                <th style={{ width: '115px', textAlign: 'center' }}>نوعیت</th>
                <th style={{ width: '90px', textAlign: 'center' }}>زمرہ</th>
                <th style={{ width: '120px', textAlign: 'center' }}>مقررہ تاریخ</th>
                <th style={{ width: '150px', textAlign: 'center' }}>موجودہ کیفیت</th>
                <th style={{ width: '95px', textAlign: 'center' }}>ترجیح</th>
                <th style={{ width: '175px', textAlign: 'center' }}>کارروائی</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, index) => (
                <tr key={task.id}>
                  {/* Col 1: Sr No */}
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>

                  {/* Col 2: Title & Description */}
                  <td className="task-title-cell">
                    <div className="task-main-title">{task.title}</div>
                    {task.description && (
                      <div className="task-main-desc">{task.description}</div>
                    )}
                  </td>

                  {/* Col 3: Automated vs Custom */}
                  <td style={{ textAlign: 'center' }}>
                    <span className={`tasks-badge ${task.is_automated ? 'badge-type-auto' : 'badge-type-custom'}`}>
                      {task.is_automated ? 'خودکار تنظیمی' : 'ذاتی / اضافی'}
                    </span>
                  </td>

                  {/* Col 4: Category */}
                  <td style={{ textAlign: 'center' }}>
                    <span className="tasks-badge badge-priority-normal">
                      {task.categoryLabel}
                    </span>
                  </td>

                  {/* Col 5: Due Date */}
                  <td style={{ whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'center', fontWeight: '600' }}>
                    {task.due_date}
                  </td>

                  {/* Col 6: Status Badge */}
                  <td style={{ textAlign: 'center' }}>
                    <span className={`tasks-badge ${task.badgeClass}`}>
                      {task.statusLabel}
                    </span>
                  </td>

                  {/* Col 7: Priority */}
                  <td style={{ textAlign: 'center' }}>
                    <span className={`tasks-badge ${task.priority === 'high' ? 'badge-priority-high' : task.priority === 'low' ? 'badge-priority-low' : 'badge-priority-normal'}`}>
                      {task.priorityLabel}
                    </span>
                  </td>

                  {/* Col 8: Actions */}
                  <td style={{ textAlign: 'center' }}>
                    <div className="tasks-action-group">
                      {task.is_automated ? (
                        <button
                          type="button"
                          className="tasks-action-btn action-primary"
                          onClick={() => navigate(task.action_route)}
                        >
                          {task.action_label || 'متعلقہ صفحے پر جائیں'}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`tasks-action-btn ${task.status === 'completed' ? '' : 'action-complete'}`}
                            onClick={() => handleToggleComplete(task)}
                          >
                            {task.status === 'completed' ? 'نامکمل کریں' : 'مکمل کریں'}
                          </button>
                          <button
                            type="button"
                            className="tasks-action-btn"
                            onClick={() => handleOpenEditModal(task)}
                          >
                            ترمیم
                          </button>
                          <button
                            type="button"
                            className="tasks-action-btn action-danger"
                            onClick={() => handleDeleteTask(task)}
                          >
                            حذف
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Adding / Editing Custom Task */}
      {isModalOpen && (
        <div className="tasks-modal-overlay" role="dialog" aria-modal="true">
          <div className="tasks-modal-card">
            <div className="tasks-modal-header">
              <h3 className="tasks-modal-title">
                {editingTask ? 'کام کی تفصیلات میں ترمیم' : 'نیا کام شامل کریں'}
              </h3>
              <button
                type="button"
                className="tasks-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="بند کریں"
              >
                بند کریں
              </button>
            </div>

            <form onSubmit={handleSaveTask}>
              <div className="tasks-modal-body">
                {/* Task Title */}
                <div className="tasks-form-group">
                  <label className="tasks-form-label">
                    کام کا عنوان <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="tasks-form-input"
                    placeholder="مثلاً: مجلسِ شوریٰ کا اجلاس، کتب کی خریداری"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                {/* Task Description */}
                <div className="tasks-form-group">
                  <label className="tasks-form-label">تفصیل و نوٹس</label>
                  <textarea
                    className="tasks-form-textarea"
                    rows="3"
                    placeholder="کام کے متعلق ضروری ہدایات یا تفصیل درج فرمائیں..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Category & Priority Row */}
                <div className="tasks-form-row">
                  <div className="tasks-form-group">
                    <label className="tasks-form-label">شعبہ / زمرہ</label>
                    <select
                      className="tasks-form-select"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="administrative">انتظامی</option>
                      <option value="academic">تعلیمی</option>
                      <option value="financial">مالیاتی</option>
                      <option value="personal">ذاتی</option>
                    </select>
                  </div>

                  <div className="tasks-form-group">
                    <label className="tasks-form-label">ترجیح کی سطح</label>
                    <select
                      className="tasks-form-select"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="normal">عمومی</option>
                      <option value="high">فوری / اہم</option>
                      <option value="low">عام</option>
                    </select>
                  </div>
                </div>

                {/* Due Date & Recurrence Row */}
                <div className="tasks-form-row">
                  <div className="tasks-form-group">
                    <label className="tasks-form-label">
                      مقررہ آخری تاریخ <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      className="tasks-form-input"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="tasks-form-group">
                    <label className="tasks-form-label">تکرار</label>
                    <select
                      className="tasks-form-select"
                      value={formData.recurrence}
                      onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                    >
                      <option value="none">ایک بار (کوئی تکرار نہیں)</option>
                      <option value="daily">روزانہ</option>
                      <option value="weekly">ہفتہ وار</option>
                      <option value="monthly">ماہانہ</option>
                      <option value="yearly">سالانہ</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="tasks-modal-footer">
                <button
                  type="button"
                  className="tasks-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  منسوخ کریں
                </button>
                <button
                  type="submit"
                  className="tasks-primary-btn"
                  id="modalSaveTaskBtn"
                  disabled={submitting}
                >
                  {submitting ? 'محفوظ کیا جا رہا ہے...' : 'محفوظ کریں'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
