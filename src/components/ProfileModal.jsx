import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { validatePasswordChange, formatPasswordChangeError } from '../utils/passwordValidation';
import { validateAvatarFile } from '../utils/avatarValidation';
import './ProfileModal.css';

export default function ProfileModal({ isOpen, onClose, initialSection = null }) {
  const { user, profile, role, fetchUserProfile } = useAuth();
  const passwordInputRef = useRef(null);
  const avatarSectionRef = useRef(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Avatar Upload State
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(profile?.avatar_url || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarSuccessMsg, setAvatarSuccessMsg] = useState('');
  const [avatarErrorMsg, setAvatarErrorMsg] = useState('');

  // Sync avatar preview when profile updates or modal opens
  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarPreviewUrl(profile.avatar_url);
    } else {
      setAvatarPreviewUrl(null);
    }
  }, [profile?.avatar_url, isOpen]);

  // Reset all state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setErrors({});
      setErrorMsg('');
      setSuccessMsg('');
      setIsSubmitting(false);

      setSelectedAvatarFile(null);
      setAvatarSuccessMsg('');
      setAvatarErrorMsg('');
      setIsUploadingAvatar(false);
    }
  }, [isOpen]);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus/scroll to target section on open
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (initialSection === 'avatar') {
        avatarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (initialSection === 'password') {
        passwordInputRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen, initialSection]);

  if (!isOpen) return null;

  const getRoleLabel = (r) => {
    switch (r) {
      case 'super_admin': return 'سپر ایڈمن';
      case 'admin': return 'مہتمم / ایڈمن';
      case 'teacher': return 'استاد / ٹیچر';
      default: return 'صارف';
    }
  };

  const handleModalClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setErrors({});
    setErrorMsg('');
    setSuccessMsg('');

    setSelectedAvatarFile(null);
    setAvatarSuccessMsg('');
    setAvatarErrorMsg('');
    onClose();
  };

  // Avatar File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setAvatarSuccessMsg('');
    setAvatarErrorMsg('');

    if (!file) return;

    const validation = validateAvatarFile(file);
    if (!validation.isValid) {
      setAvatarErrorMsg(validation.error);
      setSelectedAvatarFile(null);
      setAvatarPreviewUrl(profile?.avatar_url || null);
      return;
    }

    setSelectedAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl(objectUrl);
  };

  const cancelAvatarSelection = () => {
    setSelectedAvatarFile(null);
    setAvatarPreviewUrl(profile?.avatar_url || null);
    setAvatarErrorMsg('');
    setAvatarSuccessMsg('');
  };

  // Avatar Upload to Supabase Storage
  const handleUploadAvatar = async () => {
    if (!selectedAvatarFile || !user?.id) return;

    setAvatarSuccessMsg('');
    setAvatarErrorMsg('');
    setIsUploadingAvatar(true);

    try {
      const fileExt = selectedAvatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      // 1. Upload to Supabase Storage 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedAvatarFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // 2. Retrieve the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update public.profiles table
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (dbError) {
        throw dbError;
      }

      // 4. Refresh user profile in AuthContext
      if (typeof fetchUserProfile === 'function') {
        await fetchUserProfile(user.id);
      }

      setSelectedAvatarFile(null);
      setAvatarPreviewUrl(publicUrl);
      setAvatarSuccessMsg('پروفائل تصویر کامیابی سے اپ لوڈ ہو گئی ہے۔');
    } catch (err) {
      console.error('Avatar upload error:', err);
      setAvatarErrorMsg(err?.message || 'تصویر اپ لوڈ کرنے میں مسئلہ پیش آیا۔');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Avatar Removal
  const handleRemoveAvatar = async () => {
    if (!user?.id) return;

    setAvatarSuccessMsg('');
    setAvatarErrorMsg('');
    setIsUploadingAvatar(true);

    try {
      // 1. Clear avatar_url in public.profiles table
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (dbError) {
        throw dbError;
      }

      // 2. Refresh profile in AuthContext
      if (typeof fetchUserProfile === 'function') {
        await fetchUserProfile(user.id);
      }

      setSelectedAvatarFile(null);
      setAvatarPreviewUrl(null);
      setAvatarSuccessMsg('پروفائل تصویر کامیابی سے حذف کر دی گئی ہے۔');
    } catch (err) {
      console.error('Avatar remove error:', err);
      setAvatarErrorMsg(err?.message || 'تصویر حذف کرنے میں مسئلہ پیش آیا۔');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Password Change Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setErrors({});

    // 1. Client-side validation
    const validation = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const userEmail = user?.email;
    if (!userEmail) {
      setErrorMsg('صارف کا ای میل ایڈریس دستیاب نہیں ہے۔ براہ کرم دوبارہ لاگ ان کریں۔');
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Re-authenticate with CURRENT password
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (reauthError) {
        const formatted = formatPasswordChangeError(reauthError, 'موجودہ پاسورڈ غلط ہے');
        if (formatted.includes('سرور یا ڈیٹا بیس سے رابطہ نہیں ہو سکا')) {
          setErrorMsg(formatted);
        } else {
          setErrorMsg('موجودہ پاسورڈ غلط ہے');
        }
        return;
      }

      // 3. Update user password (pass current_password as required by Supabase auth policy)
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // 4. On success: clear form & show Urdu success message
      setSuccessMsg('پاسورڈ کامیابی سے تبدیل ہو گیا ہے');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    } catch (err) {
      console.error('Password change error:', err);
      setErrorMsg(formatPasswordChangeError(err, 'پاسورڈ تبدیل کرنے میں مسئلہ پیش آیا۔'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const userInitial = (profile?.full_name || user?.email || 'U')[0].toUpperCase();
  const userName = profile?.full_name || user?.email?.split('@')[0] || 'صارف';

  return (
    <div
      className="profile-modal-overlay"
      onClick={handleModalClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profileModalTitle"
    >
      <div
        className="profile-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="profile-modal-header">
          <h2 id="profileModalTitle" className="profile-modal-title">
            پروفائل ترتیبات و پاسورڈ
          </h2>
          <button
            type="button"
            className="profile-modal-close-btn"
            onClick={handleModalClose}
            aria-label="بند کریں"
            title="بند کریں"
          >
            ×
          </button>
        </div>

        {/* User Profile & Avatar Section */}
        <div ref={avatarSectionRef} className="profile-modal-avatar-section">
          <div className="profile-modal-user-summary">
            <div className="profile-modal-avatar">
              {avatarPreviewUrl ? (
                <img
                  src={avatarPreviewUrl}
                  alt={userName}
                  className="profile-modal-avatar-img"
                />
              ) : (
                userInitial
              )}
            </div>
            <div className="profile-modal-user-details">
              <div className="profile-modal-user-name">{userName}</div>
              <div className="profile-modal-user-meta">
                <span className="profile-modal-role-badge">{getRoleLabel(role)}</span>
                {user?.email && (
                  <span className="profile-modal-user-email">{user.email}</span>
                )}
              </div>
            </div>
          </div>

          {/* Avatar Notifications */}
          {avatarSuccessMsg && (
            <div className="profile-modal-alert-success" style={{ margin: '6px 0 0 0', padding: '8px 12px', fontSize: '0.82rem' }} role="status">
              {avatarSuccessMsg}
            </div>
          )}

          {avatarErrorMsg && (
            <div className="profile-modal-alert-error" style={{ margin: '6px 0 0 0', padding: '8px 12px', fontSize: '0.82rem' }} role="alert">
              {avatarErrorMsg}
            </div>
          )}

          {/* Avatar Controls */}
          <div className="profile-modal-avatar-actions">
            <input
              type="file"
              id="profileAvatarFileInput"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploadingAvatar}
              style={{ display: 'none' }}
            />
            <label
              htmlFor="profileAvatarFileInput"
              className="avatar-action-btn avatar-select-btn"
            >
              تصویر منتخب کریں
            </label>

            {selectedAvatarFile && (
              <>
                <button
                  type="button"
                  onClick={handleUploadAvatar}
                  disabled={isUploadingAvatar}
                  className="avatar-action-btn avatar-upload-btn"
                >
                  {isUploadingAvatar ? 'اپ لوڈ ہو رہا ہے...' : 'تصویر محفوظ کریں'}
                </button>
                <button
                  type="button"
                  onClick={cancelAvatarSelection}
                  disabled={isUploadingAvatar}
                  className="avatar-action-btn avatar-delete-btn"
                >
                  منسوخ کریں
                </button>
              </>
            )}

            {!selectedAvatarFile && profile?.avatar_url && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={isUploadingAvatar}
                className="avatar-action-btn avatar-delete-btn"
              >
                تصویر حذف کریں
              </button>
            )}

            {selectedAvatarFile && (
              <span className="avatar-selected-note">
                (نئی تصویر منتخب شدہ)
              </span>
            )}
          </div>
        </div>

        {/* Password Success Alert */}
        {successMsg && (
          <div className="profile-modal-alert-success" role="status">
            {successMsg}
          </div>
        )}

        {/* Password Error Alert */}
        {errorMsg && (
          <div className="profile-modal-alert-error" role="alert">
            {errorMsg}
          </div>
        )}

        {/* Change Password Form */}
        <form onSubmit={handleSubmit} className="profile-modal-form" noValidate>
          <div className="profile-modal-field">
            <label className="profile-modal-label" htmlFor="currentPasswordInput">
              موجودہ پاسورڈ
            </label>
            <div className="profile-modal-password-wrapper">
              <input
                ref={passwordInputRef}
                id="currentPasswordInput"
                type={showCurrentPassword ? 'text' : 'password'}
                className={`profile-modal-input profile-modal-password-input ${errors.currentPassword ? 'input-error' : ''}`}
                placeholder="موجودہ پاسورڈ درج کریں"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (errors.currentPassword) {
                    setErrors(prev => ({ ...prev, currentPassword: '' }));
                  }
                }}
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="profile-modal-password-toggle"
                onClick={() => setShowCurrentPassword(prev => !prev)}
                title={showCurrentPassword ? 'پاس ورڈ چھپائیں' : 'پاس ورڈ دکھائیں'}
                aria-label={showCurrentPassword ? 'موجودہ پاسورڈ چھپائیں' : 'موجودہ پاسورڈ دکھائیں'}
              >
                {showCurrentPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <span className="profile-modal-field-error">{errors.currentPassword}</span>
            )}
          </div>

          <div className="profile-modal-field">
            <label className="profile-modal-label" htmlFor="newPasswordInput">
              نیا پاسورڈ
            </label>
            <div className="profile-modal-password-wrapper">
              <input
                id="newPasswordInput"
                type={showNewPassword ? 'text' : 'password'}
                className={`profile-modal-input profile-modal-password-input ${errors.newPassword ? 'input-error' : ''}`}
                placeholder="کم از کم 6 حروف پر مشتمل پاسورڈ"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword) {
                    setErrors(prev => ({ ...prev, newPassword: '' }));
                  }
                }}
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="profile-modal-password-toggle"
                onClick={() => setShowNewPassword(prev => !prev)}
                title={showNewPassword ? 'پاس ورڈ چھپائیں' : 'پاس ورڈ دکھائیں'}
                aria-label={showNewPassword ? 'نیا پاسورڈ چھپائیں' : 'نیا پاسورڈ دکھائیں'}
              >
                {showNewPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {errors.newPassword && (
              <span className="profile-modal-field-error">{errors.newPassword}</span>
            )}
          </div>

          <div className="profile-modal-field">
            <label className="profile-modal-label" htmlFor="confirmPasswordInput">
              نیا پاسورڈ کی تصدیق
            </label>
            <div className="profile-modal-password-wrapper">
              <input
                id="confirmPasswordInput"
                type={showConfirmPassword ? 'text' : 'password'}
                className={`profile-modal-input profile-modal-password-input ${errors.confirmPassword ? 'input-error' : ''}`}
                placeholder="نیا پاسورڈ دوبارہ درج کریں"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }
                }}
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="profile-modal-password-toggle"
                onClick={() => setShowConfirmPassword(prev => !prev)}
                title={showConfirmPassword ? 'پاس ورڈ چھپائیں' : 'پاس ورڈ دکھائیں'}
                aria-label={showConfirmPassword ? 'تصدیقی پاسورڈ چھپائیں' : 'تصدیقی پاسورڈ دکھائیں'}
              >
                {showConfirmPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="profile-modal-field-error">{errors.confirmPassword}</span>
            )}
          </div>

          <div className="profile-modal-actions">
            <button
              type="button"
              className="profile-modal-btn-cancel"
              onClick={handleModalClose}
              disabled={isSubmitting}
            >
              منسوخ کریں
            </button>
            <button
              type="submit"
              className="profile-modal-btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'تبدیل ہو رہا ہے...' : 'پاسورڈ تبدیل کریں'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
