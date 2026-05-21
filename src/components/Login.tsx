import React from 'react';
import { Palette, Loader2, LogIn, Sparkles, Check, Bed } from 'lucide-react';
import { Button, Pill } from './ui';

export interface LoginProps {
  loginEmail: string;
  setLoginEmail: (v: string) => void;
  loginPassword: string;
  setLoginPassword: (v: string) => void;
  loginError: string | null;
  loginLoading: boolean;
  onEmailSubmit: (e: React.FormEvent) => void;
  onGoogleLogin: () => void;
}

function OtamaMark({ size = 64 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center text-white shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-indigo) 100%)',
        boxShadow: '0 6px 20px rgba(0,122,255,0.30), inset 0 0.5px 0.5px rgba(255,255,255,0.4)',
      }}
    >
      <Palette size={size * 0.55} strokeWidth={2.2} />
    </div>
  );
}

function OtamaWordmark({ large = false }: { large?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <OtamaMark size={large ? 40 : 36} />
      <div className="flex flex-col">
        <div
          className="font-bold leading-none"
          style={{
            fontSize: large ? 18 : 17,
            color: 'var(--color-text)',
            letterSpacing: '-0.03em',
          }}
        >
          Otama
        </div>
        <div
          className="font-medium uppercase leading-none mt-1"
          style={{
            fontSize: large ? 11 : 10,
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 0 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5 0 9.5-1.9 12.9-5l-6-5c-1.8 1.4-4.2 2.3-6.9 2.3-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6 5c-.4.4 6.5-4.7 6.5-14.7 0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
      <span
        className="font-semibold uppercase"
        style={{
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          letterSpacing: '0.12em',
        }}
      >
        hoặc
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
    </div>
  );
}

function LoginForm(props: LoginProps) {
  const { loginEmail, setLoginEmail, loginPassword, setLoginPassword, loginError, loginLoading, onEmailSubmit, onGoogleLogin } = props;
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onEmailSubmit} className="flex flex-col gap-3">
        <div>
          <label
            className="block font-semibold mb-1.5"
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              letterSpacing: '-0.01em',
            }}
          >
            Email
          </label>
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            disabled={loginLoading}
            placeholder="nhanvien@otama.vn"
            autoComplete="email"
            className="w-full transition-colors outline-none focus:ring-0"
            style={{
              height: 44,
              padding: '0 14px',
              borderRadius: 10,
              background: 'var(--color-fill)',
              color: 'var(--color-text)',
              fontSize: 14,
              border: '0.5px solid transparent',
              letterSpacing: '-0.01em',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
          />
        </div>
        <div>
          <label
            className="block font-semibold mb-1.5"
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              letterSpacing: '-0.01em',
            }}
          >
            Mật khẩu
          </label>
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            disabled={loginLoading}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full transition-colors outline-none focus:ring-0"
            style={{
              height: 44,
              padding: '0 14px',
              borderRadius: 10,
              background: 'var(--color-fill)',
              color: 'var(--color-text)',
              fontSize: 14,
              border: '0.5px solid transparent',
              letterSpacing: '-0.01em',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
          />
        </div>

        {loginError && (
          <div
            className="rounded-lg p-3"
            style={{
              fontSize: 12,
              background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
              color: 'var(--color-danger)',
              border: '0.5px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
            }}
          >
            {loginError}
          </div>
        )}

        <Button
          type="submit"
          variant="filled"
          size="lg"
          fullWidth
          disabled={loginLoading}
          icon={loginLoading ? Loader2 : LogIn}
        >
          {loginLoading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
      </form>

      <Divider />

      <Button
        variant="outline"
        size="lg"
        fullWidth
        disabled={loginLoading}
        onClick={onGoogleLogin}
      >
        <GoogleIcon />
        <span style={{ marginLeft: 6 }}>Tiếp tục với Google</span>
      </Button>
    </div>
  );
}

export function Login(props: LoginProps) {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: 'var(--color-bg)',
        backgroundImage: 'radial-gradient(circle at 30% 20%, var(--color-accent-soft), transparent 60%)',
      }}
    >
      {/* Mobile + small tablet: stacked single column */}
      <div className="md:hidden min-h-screen flex flex-col px-6 pt-14 pb-8">
        <div className="flex-1 flex flex-col justify-center gap-9">
          <div className="flex flex-col items-start gap-5">
            <OtamaMark size={64} />
            <div>
              <div
                className="font-bold leading-tight"
                style={{
                  fontSize: 34,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                }}
              >
                Chào mừng<br />trở lại.
              </div>
              <div
                className="mt-2.5"
                style={{
                  fontSize: 17,
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '-0.01em',
                }}
              >
                Đăng nhập để tiếp tục chỉnh sửa với Otama.
              </div>
            </div>
          </div>

          <LoginForm {...props} />
        </div>

        <div
          className="text-center mt-6"
          style={{
            fontSize: 12,
            color: 'var(--color-text-tertiary)',
            lineHeight: 1.4,
          }}
        >
          Tài khoản nhân viên do quản trị viên cấp.
        </div>
      </div>

      {/* Desktop: split layout */}
      <div className="hidden md:flex min-h-screen">
        {/* Left brand panel */}
        <div
          className="flex flex-col justify-between"
          style={{
            width: 540,
            padding: '56px 56px',
          }}
        >
          <OtamaWordmark large />

          <div className="flex flex-col gap-4">
            <div
              className="font-bold"
              style={{
                fontSize: 52,
                color: 'var(--color-text)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              Chụp ảnh đẹp.<br />
              <span
                style={{
                  background: 'linear-gradient(135deg, var(--color-accent), var(--color-purple))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Tự động.
              </span>
            </div>
            <div
              style={{
                fontSize: 17,
                color: 'var(--color-text-secondary)',
                maxWidth: 380,
                lineHeight: 1.45,
                letterSpacing: '-0.01em',
              }}
            >
              AI tạo ảnh sản phẩm, thay đồ người mẫu và dựng trang chi tiết TMĐT chỉ trong vài giây.
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Pill tone="accent" icon={Sparkles}>Gemini 3 Pro</Pill>
              <Pill tone="success" icon={Check}>Đồng bộ Cloud</Pill>
              <Pill tone="warning" icon={Bed}>Bedding · Fashion</Pill>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            © 2026 Otama. Made with care in Hà Nội.
          </div>
        </div>

        {/* Right login card */}
        <div className="flex-1 flex items-center justify-center p-10">
          <div
            className="flex flex-col gap-5"
            style={{
              width: 420,
              padding: 36,
              borderRadius: 22,
              background: 'var(--color-card)',
              boxShadow: 'var(--shadow-sheet)',
              border: '0.5px solid var(--color-border-soft)',
            }}
          >
            <div>
              <div
                className="font-bold"
                style={{
                  fontSize: 22,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.02em',
                }}
              >
                Đăng nhập
              </div>
              <div
                className="mt-1"
                style={{
                  fontSize: 14,
                  color: 'var(--color-text-secondary)',
                }}
              >
                Sử dụng tài khoản nội bộ của bạn.
              </div>
            </div>

            <LoginForm {...props} />

            <p
              className="text-center mt-1"
              style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
              }}
            >
              Tài khoản nhân viên do quản trị viên (Sếp) cấp.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
