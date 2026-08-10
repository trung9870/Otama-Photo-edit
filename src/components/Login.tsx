import React from 'react';
import { motion, type Variants } from 'motion/react';
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
        boxShadow: '0 6px 20px color-mix(in srgb, var(--color-accent) 30%, transparent), inset 0 0.5px 0.5px rgba(255,255,255,0.4)',
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

/* Hai khối màu ấm trôi chậm phía sau — tạo chiều sâu thay cho nền phẳng */
function AmbientGlow() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 620, height: 620, top: '-18%', left: '-8%',
          background: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
          filter: 'blur(110px)',
        }}
        animate={{ x: [0, 70, 0], y: [0, 45, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 520, height: 520, bottom: '-22%', right: '-6%',
          background: 'color-mix(in srgb, var(--color-indigo) 18%, transparent)',
          filter: 'blur(120px)',
        }}
        animate={{ x: [0, -60, 0], y: [0, -40, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

export function Login(props: LoginProps) {
  return (
    <div
      className="min-h-dvh w-full relative"
      style={{ background: 'var(--color-bg)' }}
    >
      <AmbientGlow />
      {/* Mobile + small tablet: stacked single column */}
      <div className="md:hidden min-h-dvh flex flex-col px-6 pt-14 pb-8 relative">
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
      <div className="hidden md:flex min-h-dvh relative">
        {/* Left brand panel */}
        <motion.div
          className="flex flex-col justify-between"
          style={{
            width: 560,
            padding: '56px 56px',
          }}
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={rise}><OtamaWordmark large /></motion.div>

          <div className="flex flex-col gap-4">
            <motion.div
              variants={rise}
              className="font-semibold uppercase"
              style={{
                fontSize: 11.5,
                color: 'var(--color-accent)',
                letterSpacing: '0.18em',
              }}
            >
              Công cụ ảnh nội bộ · Otama Bedding
            </motion.div>
            <motion.div
              variants={rise}
              className="font-bold"
              style={{
                fontSize: 56,
                color: 'var(--color-text)',
                letterSpacing: '-0.04em',
                lineHeight: 1.02,
                textWrap: 'balance',
              }}
            >
              Chụp ảnh đẹp.<br />
              <span
                style={{
                  background: 'linear-gradient(135deg, var(--color-accent), var(--color-indigo))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Tự động.
              </span>
            </motion.div>
            <motion.div
              variants={rise}
              style={{
                fontSize: 17,
                color: 'var(--color-text-secondary)',
                maxWidth: 380,
                lineHeight: 1.5,
                letterSpacing: '-0.01em',
              }}
            >
              AI tạo ảnh sản phẩm, thay đồ người mẫu và dựng trang chi tiết TMĐT chỉ trong vài giây.
            </motion.div>
            <motion.div variants={rise} className="flex gap-2 mt-2 flex-wrap">
              <Pill tone="accent" icon={Sparkles}>Gemini 3 Pro</Pill>
              <Pill tone="success" icon={Check}>Đồng bộ Cloud</Pill>
              <Pill tone="warning" icon={Bed}>Bedding · Fashion</Pill>
            </motion.div>
          </div>

          <motion.div variants={rise} style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            © 2026 Otama. Made with care in Hà Nội.
          </motion.div>
        </motion.div>

        {/* Right login card */}
        <div className="flex-1 flex items-center justify-center p-10">
          <motion.div
            className="flex flex-col gap-5"
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            style={{
              width: 420,
              padding: 36,
              borderRadius: 22,
              background: 'color-mix(in srgb, var(--color-card) 76%, transparent)',
              backdropFilter: 'blur(24px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
              boxShadow: 'var(--shadow-sheet), inset 0 1px 0 rgba(255,255,255,0.09)',
              border: '1px solid color-mix(in srgb, var(--color-border) 80%, transparent)',
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
          </motion.div>
        </div>
      </div>
    </div>
  );
}
