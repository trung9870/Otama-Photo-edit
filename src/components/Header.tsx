import React from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  Palette,
  Shirt,
  Grid3x3,
  Shield,
  Sun,
  Moon,
  Monitor,
  Key,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { Button, Segmented, type SegmentedOption } from './ui';
import type { Theme } from '../hooks/useTheme';

export type AppMode = 'clothing' | 'ecom' | 'admin';

export interface HeaderProps {
  // App mode
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;

  // Permissions
  isAdmin: boolean;
  canUseClothing: boolean;
  canUseEcom: boolean;

  // Theme
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  onThemeChange: (theme: Theme) => void;

  // API Key (admin only)
  hasApiKey: boolean;
  onOpenSettings: () => void;

  // Auth
  isAuthReady: boolean;
  user: FirebaseUser | null;
  onLogin: () => void;
  onLogout: () => void;

  // Trailing action slot (e.g. clothing toolbar buttons)
  actions?: React.ReactNode;
}

function OtamaLogo({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center text-white shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-indigo) 100%)',
        boxShadow: '0 2px 6px rgba(0,122,255,0.25), inset 0 0.5px 0.5px rgba(255,255,255,0.4)',
      }}
    >
      <Palette size={size * 0.55} strokeWidth={2.2} />
    </div>
  );
}

function OtamaWordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <OtamaLogo size={36} />
      <div className="flex flex-col">
        <div
          className="font-bold leading-none"
          style={{
            fontSize: 17,
            color: 'var(--color-text)',
            letterSpacing: '-0.03em',
          }}
        >
          Otama
        </div>
        <div
          className="font-medium uppercase leading-none mt-1"
          style={{
            fontSize: 10,
            color: 'var(--color-text-tertiary)',
            letterSpacing: '0.16em',
          }}
        >
          Photo Editor
        </div>
      </div>
    </div>
  );
}

function AvatarPill({ user, onLogin, onLogout }: { user: FirebaseUser | null; onLogin: () => void; onLogout: () => void }) {
  if (!user) {
    return (
      <Button variant="tinted" size="sm" icon={LogIn} onClick={onLogin}>
        Đăng nhập đồng bộ
      </Button>
    );
  }

  const initial = (user.displayName || user.email || '?').slice(0, 1).toUpperCase();
  const displayName = user.displayName || user.email?.split('@')[0] || '';

  return (
    <div
      className="flex items-center gap-2 rounded-full"
      style={{
        padding: '4px 6px 4px 4px',
        background: 'var(--color-fill)',
      }}
    >
      {user.photoURL ? (
        <img
          src={user.photoURL}
          alt={user.displayName || ''}
          className="w-[26px] h-[26px] rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="flex items-center justify-center text-white font-bold rounded-full"
          style={{
            width: 26,
            height: 26,
            fontSize: 11,
            background: 'linear-gradient(135deg, var(--color-pink), var(--color-warning))',
          }}
        >
          {initial}
        </div>
      )}
      <span
        className="hidden sm:inline-block max-w-[120px] truncate"
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-text)',
        }}
      >
        {displayName}
      </span>
      <button
        type="button"
        onClick={onLogout}
        title="Đăng xuất"
        className="p-1 rounded-full transition-colors"
        style={{ color: 'var(--color-text-tertiary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
      >
        <LogOut size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function ThemeToggle({ theme, resolvedTheme, onThemeChange }: { theme: Theme; resolvedTheme: 'light' | 'dark'; onThemeChange: (t: Theme) => void }) {
  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const label = theme === 'system' ? 'Auto' : theme === 'dark' ? 'Tối' : 'Sáng';
  const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  return (
    <Button
      variant="secondary"
      size="sm"
      icon={Icon}
      onClick={() => onThemeChange(next)}
      title={`Theme: ${theme}`}
    >
      {label}
    </Button>
  );
}

export function Header(props: HeaderProps) {
  const {
    appMode, onModeChange,
    isAdmin, canUseClothing, canUseEcom,
    theme, resolvedTheme, onThemeChange,
    hasApiKey, onOpenSettings,
    isAuthReady, user, onLogin, onLogout,
    actions,
  } = props;

  const modeOptions: SegmentedOption<AppMode>[] = [
    ...(isAdmin || canUseClothing ? [{ value: 'clothing' as const, label: 'Quần áo', icon: Shirt }] : []),
    ...(isAdmin || canUseEcom ? [{ value: 'ecom' as const, label: 'Ecom', icon: Grid3x3 }] : []),
    ...(isAdmin ? [{ value: 'admin' as const, label: 'Admin', icon: Shield }] : []),
  ];

  return (
    <header
      className="w-full"
      style={{
        background: 'var(--color-bg-elevated)',
        borderBottom: '0.5px solid var(--color-border-soft)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Row 1 desktop: logo + segmented + right cluster.
            On mobile: logo + right cluster on top, segmented below */}
        <div className="flex items-center justify-between md:justify-start gap-4 md:flex-1">
          <OtamaWordmark />

          {/* Desktop segmented (inline) */}
          {modeOptions.length > 1 && (
            <div className="hidden md:flex md:ml-6">
              <Segmented<AppMode>
                value={appMode}
                onChange={onModeChange}
                options={modeOptions}
                size="md"
              />
            </div>
          )}

          {/* Mobile right cluster (compact) */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle theme={theme} resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
            {isAuthReady && <AvatarPill user={user} onLogin={onLogin} onLogout={onLogout} />}
          </div>
        </div>

        {/* Mobile segmented (full width, second row) */}
        {modeOptions.length > 1 && (
          <div className="md:hidden">
            <Segmented<AppMode>
              value={appMode}
              onChange={onModeChange}
              options={modeOptions}
              size="lg"
              fullWidth
            />
          </div>
        )}

        {/* Desktop right cluster */}
        <div className="hidden md:flex items-center gap-2">
          {actions}
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              icon={Key}
              tone={hasApiKey ? 'success' : 'warning'}
              onClick={onOpenSettings}
              style={hasApiKey ? { color: 'var(--color-success)' } : { color: 'var(--color-warning)' }}
            >
              {hasApiKey ? 'API Key' : 'Thêm API Key'}
            </Button>
          )}
          <ThemeToggle theme={theme} resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
          {isAuthReady && <AvatarPill user={user} onLogin={onLogin} onLogout={onLogout} />}
        </div>

        {/* Mobile action row (if any) */}
        {actions && (
          <div className="flex md:hidden items-center justify-end gap-2 flex-wrap">
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                icon={Key}
                onClick={onOpenSettings}
              >
                {hasApiKey ? 'API' : 'Thêm API'}
              </Button>
            )}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
