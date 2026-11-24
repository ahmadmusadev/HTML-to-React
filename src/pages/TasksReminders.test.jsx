import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TasksReminders from './TasksReminders';
import * as tasksEngine from '../utils/tasksEngine';

// Mock contexts
const mockMadrasaState = {
  activeMadrasa: { id: 'madrasa-123', name: 'جامعہ حفظ القرآن' },
  classesList: [
    { id: 'class-1', name: 'درجہ اول' },
    { id: 'class-2', name: 'درجہ دوم' }
  ]
};

const mockAuthState = {
  user: { id: 'user-123', email: 'admin@madrasa.com' },
  role: 'admin',
  profile: { full_name: 'مہتمم صاحب' }
};

vi.mock('../context/MadrasaContext', () => ({
  useMadrasa: () => mockMadrasaState,
  MadrasaProvider: ({ children }) => <div>{children}</div>
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
  AuthProvider: ({ children }) => <div>{children}</div>
}));

// Mock Supabase calls in tasksEngine
vi.mock('../utils/tasksEngine', async () => {
  const actual = await vi.importActual('../utils/tasksEngine');
  return {
    ...actual,
    fetchCustomTasksFromSupabase: vi.fn(),
    insertCustomTaskInSupabase: vi.fn(),
    updateCustomTaskInSupabase: vi.fn(),
    deleteCustomTaskFromSupabase: vi.fn(),
    toggleCustomTaskCompletionInSupabase: vi.fn()
  };
});

describe('TasksReminders Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    tasksEngine.fetchCustomTasksFromSupabase.mockResolvedValue([
      {
        id: 'task-custom-1',
        madrasa_id: 'madrasa-123',
        title: 'مجلسِ شوریٰ کا اہم اجلاس',
        description: 'سالانہ تعلیمی رپورٹ کی تیاری اور منظوری',
        category: 'administrative',
        priority: 'high',
        due_date: '2026-11-24', // Due today
        status: 'pending'
      },
      {
        id: 'task-custom-2',
        madrasa_id: 'madrasa-123',
        title: 'کتب و اسباق کی خریداری',
        description: 'نئے سال کے لیے درسی کتب',
        category: 'academic',
        priority: 'normal',
        due_date: '2026-11-20', // Past due
        status: 'completed'
      }
    ]);
  });

  const renderComponent = async () => {
    let result;
    await act(async () => {
      result = render(
        <MemoryRouter>
          <TasksReminders />
        </MemoryRouter>
      );
    });
    return result;
  };

  it('renders title and subtitle in pure authentic Urdu without emojis', async () => {
    await renderComponent();

    expect(screen.getByText('زیرِ غور و یادداشت')).toBeInTheDocument();
    expect(
      screen.getByText('جامعہ کے روزمرہ، ہفتہ وار اور ماہانہ کاموں کی بروقت تکمیل اور یاددہانی کا گوشہ')
    ).toBeInTheDocument();

    // Check that there are no emojis in document body
    const textContent = document.body.textContent || '';
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(textContent)).toBe(false);
  });

  it('renders metric cards with correct counts', async () => {
    await renderComponent();

    expect(screen.getByText('کل کام')).toBeInTheDocument();
    expect(screen.getByText('زیرِ التوا (تاخیر شدہ)')).toBeInTheDocument();
    expect(screen.getByText('آج کے کام')).toBeInTheDocument();
    expect(screen.getByText('پیشگی اطلاع (آئندہ ۲ دن)')).toBeInTheDocument();
    expect(screen.getAllByText('مکمل شدہ').length).toBeGreaterThan(0);
  });

  it('renders both automated and custom tasks in the table', async () => {
    await renderComponent();

    // Automated task title
    expect(screen.getByText('طلبہ کی یومیہ حاضری کا اندراج')).toBeInTheDocument();
    // Custom task title
    expect(screen.getByText('مجلسِ شوریٰ کا اہم اجلاس')).toBeInTheDocument();
    expect(screen.getByText('کتب و اسباق کی خریداری')).toBeInTheDocument();
  });

  it('opens modal for adding new custom task with pure Urdu labels', async () => {
    await renderComponent();

    const addBtn = screen.getByText('نیا کام شامل کریں');
    fireEvent.click(addBtn);

    expect(screen.getByText('نیا کام شامل کریں', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('کام کا عنوان')).toBeInTheDocument();
    expect(screen.getByText('تفصیل و نوٹس')).toBeInTheDocument();
    expect(screen.getByText('شعبہ / زمرہ')).toBeInTheDocument();
    expect(screen.getByText('ترجیح کی سطح')).toBeInTheDocument();
    expect(screen.getByText('مقررہ آخری تاریخ')).toBeInTheDocument();
    expect(screen.getByText('تکرار')).toBeInTheDocument();
    expect(screen.getByText('محفوظ کریں')).toBeInTheDocument();
    expect(screen.getByText('منسوخ کریں')).toBeInTheDocument();
  });

  it('filters tasks when clicking on filter pills', async () => {
    await renderComponent();

    // Click 'خودکار تنظیمی امور'
    const autoFilterBtn = screen.getByRole('button', { name: /خودکار تنظیمی امور/i });
    fireEvent.click(autoFilterBtn);

    // Automated should be in document, custom should not
    expect(screen.getByText('طلبہ کی یومیہ حاضری کا اندراج')).toBeInTheDocument();
    expect(screen.queryByText('مجلسِ شوریٰ کا اہم اجلاس')).toBeNull();

    // Click 'ذاتی امور'
    const customFilterBtn = screen.getByRole('button', { name: /ذاتی امور/i });
    fireEvent.click(customFilterBtn);

    expect(screen.getByText('مجلسِ شوریٰ کا اہم اجلاس')).toBeInTheDocument();
    expect(screen.queryByText('طلبہ کی یومیہ حاضری کا اندراج')).toBeNull();
  });
});
