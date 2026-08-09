import React from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  Palette,
  Shirt,
  Grid3x3,
  Sparkles,
  Wand2,
  Boxes,
  Shield,
  Sun,
  Moon,
  Monitor,
  Key,
  Clock,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { Button, Segmented, type SegmentedOption } from './ui';
import type { Theme } from '../hooks/useTheme';

export type AppMode = 'clothing' | 'ecom' | 'ofa' | 'picset' | 'runninghub' | 'admin';

export interface HeaderProps {
  // App mode
  appMode: AppMode;
  onModeChange: (mode: AppMode) => void;

  // Permissions
  isAdmin: boolean;
  canUseClothing: boolean;
  canUseEcom: boolean;
  canUseOfa: boolean;
  canUsePicset: boolean;
  canUseRunninghub: boolean;

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

  // History panel (Lịch sử của tôi)
  onOpenHistory?: () => void;

  // Trailing action slot (e.g. clothing toolbar buttons)
  actions?: React.ReactNode;

  // Contextual tabs for the active workspace (e.g. Ecom subtabs)
  workspaceNav?: React.ReactNode;
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
        boxShadow: '0 2px 6px color-mix(in srgb, var(--color-accent) 25%, transparent), inset 0 0.5px 0.5px rgba(255,255,255,0.4)',
      }}
    >
      <Palette size={size * 0.55} strokeWidth={2.2} />
    </div>
  );
}

function OtamaWordmark() {
  return (
    <div className="otama-wordmark flex items-center gap-2.5">
      <OtamaLogo size={36} />
      <div className="otama-wordmark-copy flex flex-col">
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

function HistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Lịch sử của tôi (7 ngày)"
      aria-label="Lịch sử"
      className="flex items-center justify-center rounded-lg transition-colors"
      style={{
        width: 40, height: 36,
        background: 'var(--color-fill)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-soft)', cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
    >
      <Clock size={16} strokeWidth={1.9} />
    </button>
  );
}

function ThemeToggle({ theme, resolvedTheme, onThemeChange }: { theme: Theme; resolvedTheme: 'light' | 'dark'; onThemeChange: (t: Theme) => void }) {
  // Compact Sun/Moon icon toggle per handoff. Icon-only keeps the button
  // tight in the header cluster and dodges the "invisible label" trap when
  // text-on-thumb contrast is weak in light mode.
  const active = theme === 'system' ? resolvedTheme : theme;
  const cellStyle = (isOn: boolean): React.CSSProperties => ({
    width: 36,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isOn ? 'var(--color-card)' : 'transparent',
    color: isOn ? 'var(--color-text)' : 'var(--color-text-tertiary)',
    border: 'none',
    borderRadius: 9,
    cursor: 'pointer',
    boxShadow: isOn ? '0 1px 2px rgba(0,0,0,0.08), 0 3px 8px rgba(0,0,0,0.06)' : 'none',
    transition: 'background-color 150ms, color 150ms',
  });
  return (
    <div
      role="group"
      aria-label="Theme"
      className="theme-toggle"
      style={{ display: 'inline-flex', padding: 2, background: 'var(--color-fill)', border: '1px solid var(--color-border-soft)', borderRadius: 11, gap: 2 }}
    >
      <button type="button" onClick={() => onThemeChange('light')} title="Light mode" style={cellStyle(active === 'light')}>
        <Sun size={14} strokeWidth={2} />
      </button>
      <button type="button" onClick={() => onThemeChange('dark')} title="Dark mode" style={cellStyle(active === 'dark')}>
        <Moon size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export function Header(props: HeaderProps) {
  const {
    appMode, onModeChange,
    isAdmin, canUseClothing, canUseEcom, canUseOfa, canUsePicset, canUseRunninghub,
    theme, resolvedTheme, onThemeChange,
    hasApiKey, onOpenSettings,
    isAuthReady, user, onLogin, onLogout,
    onOpenHistory,
    actions,
    workspaceNav,
  } = props;

  const modeOptions: SegmentedOption<AppMode>[] = [
    ...(isAdmin || canUseClothing ? [{ value: 'clothing' as const, label: 'Quần áo', icon: Shirt }] : []),
    ...(isAdmin || canUseEcom ? [{ value: 'ecom' as const, label: 'Ecom', icon: Grid3x3 }] : []),
    ...(isAdmin || canUseOfa ? [{ value: 'ofa' as const, label: 'OFA', icon: Sparkles }] : []),
    ...(isAdmin || canUsePicset ? [{ value: 'picset' as const, label: 'Picset', icon: Wand2 }] : []),
    ...(isAdmin || canUseRunninghub ? [{ value: 'runninghub' as const, label: 'Runninghub', icon: Boxes }] : []),
    ...(isAdmin ? [{ value: 'admin' as const, label: 'Admin', icon: Shield }] : []),
  ];

  return (
    <header
      className="w-full sticky top-0 z-40"
      style={{
        background: 'color-mix(in srgb, var(--color-bg-elevated) 88%, transparent)',
        backdropFilter: 'blur(20px) saturate(1.25)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.25)',
        borderBottom: '1px solid var(--color-border-soft)',
        boxShadow: '0 6px 24px color-mix(in srgb, var(--color-text) 4%, transparent)',
      }}
    >
      <div className="max-w-[1800px] mx-auto px-3 md:px-5 xl:px-6 py-2.5 flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-2.5">
        {/* Row 1 desktop: logo + segmented + right cluster.
            On mobile: logo + right cluster on top, segmented below */}
        <div className="flex items-center justify-between md:justify-start gap-4 md:flex-1">
          <OtamaWordmark />

          {/* Desktop segmented (inline) */}
          {modeOptions.length > 1 && (
            <nav className="hidden lg:flex lg:ml-5" aria-label="Khu vực làm việc">
              <Segmented<AppMode>
                value={appMode}
                onChange={onModeChange}
                options={modeOptions}
                size="md"
              />
            </nav>
          )}

          {/* Mobile right cluster (compact) */}
          <div className="mobile-header-actions flex lg:hidden items-center gap-2">
            {user && onOpenHistory && <HistoryButton onClick={onOpenHistory} />}
            <ThemeToggle theme={theme} resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
            {isAuthReady && <AvatarPill user={user} onLogin={onLogin} onLogout={onLogout} />}
          </div>
        </div>

        {/* Mobile segmented (scrolls horizontally on narrow phones when 5-6 tabs
            would exceed viewport width — bleed to edges via -mx-4 so the scroll
            hint is visible at both sides). */}
        {modeOptions.length > 1 && (
          <div className="lg:hidden -mx-4 px-4 overflow-x-auto no-scrollbar">
            <Segmented<AppMode>
              value={appMode}
              onChange={onModeChange}
              options={modeOptions}
              size="md"
            />
          </div>
        )}


        {workspaceNav && (
          <div className="w-full md:basis-full md:order-3 md:max-w-[760px] md:mx-auto -mx-4 md:mx-auto px-4 md:px-0 overflow-x-auto no-scrollbar">
            {workspaceNav}
          </div>
        )}

        {/* Desktop right cluster */}
        <div className="hidden lg:flex items-center gap-2">
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
          {user && onOpenHistory && <HistoryButton onClick={onOpenHistory} />}
          <ThemeToggle theme={theme} resolvedTheme={resolvedTheme} onThemeChange={onThemeChange} />
          {isAuthReady && <AvatarPill user={user} onLogin={onLogin} onLogout={onLogout} />}
        </div>

        {/* Mobile action row (if any) */}
        {actions && (
          <div className="flex lg:hidden items-center justify-end gap-2 flex-wrap">
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
