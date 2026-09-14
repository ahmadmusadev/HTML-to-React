import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileModal from './ProfileModal';

// Mock Supabase
const mockStorageUpload = vi.fn();
const mockStorageGetPublicUrl = vi.fn();
const mockProfilesUpdate = vi.fn();
const mockProfilesEq = vi.fn();

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
    },
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
      })),
    },
    from: vi.fn((table) => {
      if (table === 'profiles') {
        return {
          update: mockProfilesUpdate.mockImplementation(() => ({
            eq: mockProfilesEq,
          })),
        };
      }
      return {};
    }),
  },
}));

// Mock AuthContext
const mockUseAuth = vi.fn();
const mockFetchUserProfile = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { supabase } from '../lib/supabaseClient';

describe('ProfileModal Component', () => {
  const defaultAuthContext = {
    user: { email: 'qari@madrasa.com', id: 'user-123' },
    profile: { full_name: 'قاری محمد بلال', role: 'teacher', avatar_url: null },
    role: 'teacher',
    fetchUserProfile: mockFetchUserProfile,
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuthContext);
    mockProfilesEq.mockResolvedValue({ data: null, error: null });
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-avatar');
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ProfileModal isOpen={false} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with user information and required Urdu labels when isOpen is true', () => {
    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('پروفائل ترتیبات و پاسورڈ')).toBeInTheDocument();
    expect(screen.getByText('قاری محمد بلال')).toBeInTheDocument();
    expect(screen.getByText('qari@madrasa.com')).toBeInTheDocument();
    expect(screen.getByText('استاد / ٹیچر')).toBeInTheDocument();

    // Verify Urdu-only labels without emojis
    expect(screen.getByLabelText('موجودہ پاسورڈ')).toBeInTheDocument();
    expect(screen.getByLabelText('نیا پاسورڈ')).toBeInTheDocument();
    expect(screen.getByLabelText('نیا پاسورڈ کی تصدیق')).toBeInTheDocument();

    // Verify avatar controls
    expect(screen.getByText('تصویر منتخب کریں')).toBeInTheDocument();

    // Verify buttons
    expect(screen.getByRole('button', { name: 'پاسورڈ تبدیل کریں' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'منسوخ کریں' })).toBeInTheDocument();
  });

  it('renders avatar image if profile.avatar_url is set', () => {
    mockUseAuth.mockReturnValue({
      ...defaultAuthContext,
      profile: {
        ...defaultAuthContext.profile,
        avatar_url: 'https://storage.supabase.co/avatars/user-123/avatar.jpg',
      },
    });

    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    const avatarImg = screen.getByAltText('قاری محمد بلال');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', 'https://storage.supabase.co/avatars/user-123/avatar.jpg');
    expect(screen.getByRole('button', { name: 'تصویر حذف کریں' })).toBeInTheDocument();
  });

  it('handles avatar file validation failure (e.g. non-image or file > 2MB)', async () => {
    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    const fileInput = document.getElementById('profileAvatarFileInput');

    // Test non-image file
    const badFile = new File(['text-content'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('براہ کرم صرف تصویر (Image) فائل منتخب کریں۔');
    });

    expect(screen.queryByRole('button', { name: 'تصویر محفوظ کریں' })).not.toBeInTheDocument();
  });

  it('handles valid avatar file selection, upload to storage, and database profile update', async () => {
    mockStorageUpload.mockResolvedValue({ data: { path: 'user-123/avatar.png' }, error: null });
    mockStorageGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.supabase.co/avatars/user-123/avatar.png' },
    });

    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    const fileInput = document.getElementById('profileAvatarFileInput');
    const validFile = new File(['image-bytes'], 'avatar.png', { type: 'image/png' });
    Object.defineProperty(validFile, 'size', { value: 500 * 1024 });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // Should show upload and cancel buttons
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'تصویر محفوظ کریں' })).toBeInTheDocument();
      expect(screen.getByText('(نئی تصویر منتخب شدہ)')).toBeInTheDocument();
    });

    const uploadBtn = screen.getByRole('button', { name: 'تصویر محفوظ کریں' });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(supabase.storage.from).toHaveBeenCalledWith('avatars');
      expect(mockStorageUpload).toHaveBeenCalledWith(
        expect.stringContaining('user-123/avatar-'),
        validFile,
        expect.objectContaining({ upsert: true })
      );
      expect(mockProfilesUpdate).toHaveBeenCalledWith({
        avatar_url: 'https://storage.supabase.co/avatars/user-123/avatar.png',
      });
      expect(mockProfilesEq).toHaveBeenCalledWith('id', 'user-123');
      expect(mockFetchUserProfile).toHaveBeenCalledWith('user-123');
      expect(screen.getByRole('status')).toHaveTextContent('پروفائل تصویر کامیابی سے اپ لوڈ ہو گئی ہے۔');
    });
  });

  it('allows removing an existing avatar image', async () => {
    mockUseAuth.mockReturnValue({
      ...defaultAuthContext,
      profile: {
        ...defaultAuthContext.profile,
        avatar_url: 'https://storage.supabase.co/avatars/user-123/avatar.jpg',
      },
    });

    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    const removeBtn = screen.getByRole('button', { name: 'تصویر حذف کریں' });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockProfilesUpdate).toHaveBeenCalledWith({ avatar_url: null });
      expect(mockProfilesEq).toHaveBeenCalledWith('id', 'user-123');
      expect(mockFetchUserProfile).toHaveBeenCalledWith('user-123');
      expect(screen.getByRole('status')).toHaveTextContent('پروفائل تصویر کامیابی سے حذف کر دی گئی ہے۔');
    });
  });

  it('validates required password fields client-side before submission', async () => {
    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    const submitBtn = screen.getByRole('button', { name: 'پاسورڈ تبدیل کریں' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('موجودہ پاسورڈ درج کرنا لازمی ہے۔')).toBeInTheDocument();
      expect(screen.getByText('نیا پاسورڈ درج کرنا لازمی ہے۔')).toBeInTheDocument();
      expect(screen.getByText('نئے پاسورڈ کی تصدیق درج کرنا لازمی ہے۔')).toBeInTheDocument();
    });

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('validates password minimum length (< 6 characters) and mismatch', async () => {
    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    const currentInput = screen.getByLabelText('موجودہ پاسورڈ');
    const newInput = screen.getByLabelText('نیا پاسورڈ');
    const confirmInput = screen.getByLabelText('نیا پاسورڈ کی تصدیق');
    const submitBtn = screen.getByRole('button', { name: 'پاسورڈ تبدیل کریں' });

    // Test length < 6
    fireEvent.change(currentInput, { target: { value: 'current123' } });
    fireEvent.change(newInput, { target: { value: '12345' } });
    fireEvent.change(confirmInput, { target: { value: '12345' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('نیا پاسورڈ کم از کم 6 حروف پر مشتمل ہونا چاہیے۔')).toBeInTheDocument();
    });

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();

    // Test password mismatch
    fireEvent.change(newInput, { target: { value: 'secretPass123' } });
    fireEvent.change(confirmInput, { target: { value: 'wrongPass123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('نیا پاسورڈ اور تصدیقی پاسورڈ مماثل نہیں ہیں۔')).toBeInTheDocument();
    });

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('re-authenticates with current password and halts with Urdu error when incorrect', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: new Error('Invalid login credentials'),
    });

    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText('موجودہ پاسورڈ'), { target: { value: 'wrongCurrentPass' } });
    fireEvent.change(screen.getByLabelText('نیا پاسورڈ'), { target: { value: 'newValidPass123' } });
    fireEvent.change(screen.getByLabelText('نیا پاسورڈ کی تصدیق'), { target: { value: 'newValidPass123' } });

    fireEvent.click(screen.getByRole('button', { name: 'پاسورڈ تبدیل کریں' }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'qari@madrasa.com',
        password: 'wrongCurrentPass',
      });
      expect(screen.getByRole('alert')).toHaveTextContent('موجودہ پاسورڈ غلط ہے');
    });

    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('successfully updates password and shows success message when credentials are valid', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: {} },
      error: null,
    });
    supabase.auth.updateUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    const currentInput = screen.getByLabelText('موجودہ پاسورڈ');
    const newInput = screen.getByLabelText('نیا پاسورڈ');
    const confirmInput = screen.getByLabelText('نیا پاسورڈ کی تصدیق');

    fireEvent.change(currentInput, { target: { value: 'correctCurrentPass' } });
    fireEvent.change(newInput, { target: { value: 'newValidPass123' } });
    fireEvent.change(confirmInput, { target: { value: 'newValidPass123' } });

    fireEvent.click(screen.getByRole('button', { name: 'پاسورڈ تبدیل کریں' }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'qari@madrasa.com',
        password: 'correctCurrentPass',
      });
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newValidPass123',
      });
      expect(screen.getByRole('status')).toHaveTextContent('پاسورڈ کامیابی سے تبدیل ہو گیا ہے');
      // Inputs should be cleared
      expect(currentInput).toHaveValue('');
      expect(newInput).toHaveValue('');
      expect(confirmInput).toHaveValue('');
    });
  });

  it('displays real error if updateUser fails after successful re-authentication', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: {} },
      error: null,
    });
    supabase.auth.updateUser.mockResolvedValue({
      data: null,
      error: new Error('Password should be at least 6 characters'),
    });

    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.change(screen.getByLabelText('موجودہ پاسورڈ'), { target: { value: 'correctCurrentPass' } });
    fireEvent.change(screen.getByLabelText('نیا پاسورڈ'), { target: { value: 'newValidPass123' } });
    fireEvent.change(screen.getByLabelText('نیا پاسورڈ کی تصدیق'), { target: { value: 'newValidPass123' } });

    fireEvent.click(screen.getByRole('button', { name: 'پاسورڈ تبدیل کریں' }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
      expect(supabase.auth.updateUser).toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('نیا پاسورڈ کم از کم 6 حروف پر مشتمل ہونا چاہیے۔');
    });
  });

  it('calls onClose when close button or cancel button is clicked', () => {
    render(<ProfileModal isOpen={true} onClose={mockOnClose} />);

    const cancelBtn = screen.getByRole('button', { name: 'منسوخ کریں' });
    fireEvent.click(cancelBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: 'بند کریں' });
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
