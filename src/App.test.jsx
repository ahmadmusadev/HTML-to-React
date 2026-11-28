import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App, { MainHeader } from './App';

// Mock contexts
const mockSignOut = vi.fn();
const mockUploadLogo = vi.fn();
const mockRemoveLogo = vi.fn();

const mockAuthState = {
  user: { email: 'superadmin@madrasa.com', id: 'admin-123' },
  profile: { full_name: 'سپر ایڈمنسٹریٹر', role: 'super_admin', avatar_url: 'https://example.com/avatar.jpg' },
  role: 'super_admin',
  signOut: mockSignOut,
};

const mockMadrasaState = {
  activeMadrasa: { name: 'جامعہ حفظ القرآن' },
  activeLogo: 'https://example.com/logo.png',
  uploadLogo: mockUploadLogo,
  removeLogo: mockRemoveLogo,
  loadMadrasaData: vi.fn(),
};

vi.mock('./context/AuthContext', () => ({
  useAuth: () => mockAuthState,
  AuthProvider: ({ children }) => <div>{children}</div>,
}));

vi.mock('./context/MadrasaContext', () => ({
  useMadrasa: () => mockMadrasaState,
  MadrasaProvider: ({ children }) => <div>{children}</div>,
}));

describe('App Component', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(document.body).toBeInTheDocument();
  });
});

describe('MainHeader & Settings Dropdown Menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only Super Admin, profile picture, and Settings icon in the header badge', () => {
    render(<MainHeader theme="light" toggleTheme={vi.fn()} />);

    // Super Admin identity
    expect(screen.getByText('سپر ایڈمنسٹریٹر')).toBeInTheDocument();
    expect(screen.getByText('سپر ایڈمن')).toBeInTheDocument();

    // Profile picture
    const avatarImg = screen.getByAltText('سپر ایڈمنسٹریٹر');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', 'https://example.com/avatar.jpg');

    // Settings icon button
    const settingsBtn = document.getElementById('userSettingsMenuBtn');
    expect(settingsBtn).toBeInTheDocument();

    // The two old buttons should NOT be directly visible in the header badge
    expect(document.getElementById('changePasswordHeaderBtn')).toBeNull();
    expect(document.querySelector('.logout-header-btn')).toBeNull();
    expect(document.querySelector('.logo-upload-btn')).toBeNull();
  });

  it('opens Settings dropdown on clicking Settings icon, displaying all 4 requested options plus Logout', () => {
    render(<MainHeader theme="light" toggleTheme={vi.fn()} />);

    const settingsBtn = document.getElementById('userSettingsMenuBtn');
    expect(settingsBtn).toBeInTheDocument();

    // Initially, dropdown is closed
    expect(document.querySelector('.settings-dropdown-menu')).toBeNull();

    // Click to open dropdown
    fireEvent.click(settingsBtn);

    // Dropdown is open
    expect(document.querySelector('.settings-dropdown-menu')).toBeInTheDocument();

    // 1. Change Password
    const changePasswordItem = document.getElementById('menuItemChangePassword');
    expect(changePasswordItem).toBeInTheDocument();
    expect(changePasswordItem).toHaveTextContent('پاسورڈ تبدیل کریں');

    // 2. Upload/Update Profile Picture
    const uploadAvatarItem = document.getElementById('menuItemUploadAvatar');
    expect(uploadAvatarItem).toBeInTheDocument();
    expect(uploadAvatarItem).toHaveTextContent('پروفائل تصویر اپ لوڈ / اپ ڈیٹ کریں');

    // 3. Upload Logo
    const uploadLogoItem = document.getElementById('menuItemUploadLogo');
    expect(uploadLogoItem).toBeInTheDocument();
    expect(uploadLogoItem).toHaveTextContent('لوگو اپ لوڈ کریں');

    // 4. Update Logo
    const updateLogoItem = document.getElementById('menuItemUpdateLogo');
    expect(updateLogoItem).toBeInTheDocument();
    expect(updateLogoItem).toHaveTextContent('لوگو تبدیل / اپ ڈیٹ کریں');

    // Logout
    const logoutItem = document.getElementById('menuItemLogout');
    expect(logoutItem).toBeInTheDocument();
    expect(logoutItem).toHaveTextContent('لاگ آؤٹ');
  });

  it('closes dropdown when clicking outside or pressing Escape', () => {
    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <MainHeader theme="light" toggleTheme={vi.fn()} />
      </div>
    );

    const settingsBtn = document.getElementById('userSettingsMenuBtn');
    fireEvent.click(settingsBtn);
    expect(document.querySelector('.settings-dropdown-menu')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(document.querySelector('.settings-dropdown-menu')).toBeNull();

    // Reopen and test Escape key
    fireEvent.click(settingsBtn);
    expect(document.querySelector('.settings-dropdown-menu')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('.settings-dropdown-menu')).toBeNull();
  });

  it('clicking Change Password opens ProfileModal and closes dropdown', () => {
    render(<MainHeader theme="light" toggleTheme={vi.fn()} />);

    const settingsBtn = document.getElementById('userSettingsMenuBtn');
    fireEvent.click(settingsBtn);

    const changePasswordItem = document.getElementById('menuItemChangePassword');
    fireEvent.click(changePasswordItem);

    // Dropdown closes and ProfileModal opens
    expect(document.querySelector('.settings-dropdown-menu')).toBeNull();
    expect(document.querySelector('.profile-modal-overlay')).toBeInTheDocument();
  });

  it('clicking Logout calls signOut', () => {
    render(<MainHeader theme="light" toggleTheme={vi.fn()} />);

    const settingsBtn = document.getElementById('userSettingsMenuBtn');
    fireEvent.click(settingsBtn);

    const logoutItem = document.getElementById('menuItemLogout');
    fireEvent.click(logoutItem);

    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe('Mobile Hamburger Navigation', () => {
  it('renders mobile hamburger button in MainHeader with accessible labels and triggers toggleMobileNav on click', () => {
    const mockToggleMobileNav = vi.fn();
    render(
      <MainHeader
        theme="light"
        toggleTheme={vi.fn()}
        isMobileNavOpen={false}
        toggleMobileNav={mockToggleMobileNav}
      />
    );

    const hamburgerBtn = document.getElementById('mobileHamburgerBtn');
    expect(hamburgerBtn).toBeInTheDocument();
    expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false');
    expect(hamburgerBtn).toHaveAttribute('aria-label', 'مینو کھولیں');

    fireEvent.click(hamburgerBtn);
    expect(mockToggleMobileNav).toHaveBeenCalledTimes(1);
  });

  it('renders close state when isMobileNavOpen is true', () => {
    render(
      <MainHeader
        theme="light"
        toggleTheme={vi.fn()}
        isMobileNavOpen={true}
        toggleMobileNav={vi.fn()}
      />
    );

    const hamburgerBtn = document.getElementById('mobileHamburgerBtn');
    expect(hamburgerBtn).toHaveClass('active');
    expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'true');
    expect(hamburgerBtn).toHaveAttribute('aria-label', 'مینو بند کریں');
  });
});

describe('Institution Current Plan Indicator in Profile Header & Dropdown', () => {
  it('shows current plan badge near profile avatar and full plan card inside dropdown for madrasa admin', () => {
    const prevRole = mockAuthState.role;
    const prevProfileRole = mockAuthState.profile.role;
    const prevMadrasa = { ...mockMadrasaState };

    mockAuthState.role = 'admin';
    mockAuthState.profile.role = 'admin';
    mockMadrasaState.activeMadrasa = {
      id: 'm-10',
      name: 'جامعہ دارالعلوم',
      plan_name: 'standard_madrasa',
      max_students: 150
    };
    mockMadrasaState.planName = 'standard_madrasa';
    mockMadrasaState.maxStudents = 150;
    mockMadrasaState.activeStudentsCount = 42;

    try {
      render(<MainHeader theme="light" toggleTheme={vi.fn()} />);

      // Plan badge visible next to profile picture/role
      expect(screen.getByText('معیاری (150 طلباء)')).toBeInTheDocument();

      // Clicking profile trigger opens dropdown with full plan explanation
      const profileTrigger = document.querySelector('.user-profile-trigger');
      fireEvent.click(profileTrigger);

      expect(document.querySelector('.settings-dropdown-menu')).toBeInTheDocument();
      expect(screen.getByText('موجودہ پلان')).toBeInTheDocument();
      expect(screen.getByText(/آپ اس وقت/)).toHaveTextContent('آپ اس وقت معیاری مدرسہ پلان استعمال کر رہے ہیں');
      expect(screen.getByText('42 / 150')).toBeInTheDocument();
    } finally {
      mockAuthState.role = prevRole;
      mockAuthState.profile.role = prevProfileRole;
      Object.assign(mockMadrasaState, prevMadrasa);
      delete mockMadrasaState.planName;
      delete mockMadrasaState.maxStudents;
      delete mockMadrasaState.activeStudentsCount;
    }
  });
});
