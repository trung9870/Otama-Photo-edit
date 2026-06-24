// useNotify — runtime browser notifications for gen completion across all tabs.
// - Permission flow: opt-in only (default OFF). After the first successful gen,
//   App.tsx surfaces a one-time modal asking the user to enable notifications.
// - Title badge: when the tab is hidden, document.title gets a (N) unread counter
//   so the user sees something even if they declined OS notifications.
// - Coalesce: multiple notify() calls within COALESCE_MS are merged into one
//   OS notification (avoids spamming 5 popups when 5 concurrent batches all
//   finish within a second).
// - Sound: small Web Audio API ding (no asset file needed).
//
// Persistence (localStorage):
//   notiEnabled        '1' | '0'  — user master toggle (default '0')
//   notiSoundEnabled   '1' | '0'  — sound option (default '0')
//   notiAsked          '1' | '0'  — has the one-time ask modal been shown?

import { useCallback, useEffect, useRef, useState } from 'react';

const COALESCE_MS = 1500;
const DEFAULT_TITLE = 'Otama Photo Editor';
const LS_ENABLED = 'notiEnabled';
const LS_SOUND = 'notiSoundEnabled';
const LS_ASKED = 'notiAsked';

const supportsNotifications =
  typeof window !== 'undefined' && 'Notification' in window;

function readLsBool(key: string, def: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return def;
    return raw === '1';
  } catch {
    return def;
  }
}

function writeLsBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {}
}

export interface NotifyHookValue {
  /** Master toggle (persists to localStorage). When false, no OS notifications fire. */
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** Play a short ding alongside the notification. */
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  /** Current browser permission state. 'unsupported' if Notification API missing. */
  permission: NotificationPermission | 'unsupported';
  /** Request OS-level permission. Returns the new permission state. */
  requestPermission: () => Promise<NotificationPermission | 'unsupported'>;
  /** Whether the one-time "do you want notifications?" prompt has been dismissed. */
  asked: boolean;
  markAsked: () => void;
  /** Fire a notification. Coalesces if called repeatedly within ~1.5s. */
  notify: (title: string, body: string) => void;
  /** Read-only count of unread completions (for the document title badge). */
  unreadCount: number;
}

export function useNotify(): NotifyHookValue {
  const [enabled, setEnabledState] = useState<boolean>(() => readLsBool(LS_ENABLED, false));
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => readLsBool(LS_SOUND, false));
  const [asked, setAsked] = useState<boolean>(() => readLsBool(LS_ASKED, false));
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    supportsNotifications ? Notification.permission : 'unsupported'
  );
  const [unreadCount, setUnreadCount] = useState(0);

  // Pending coalesce window — keeps the latest title + accumulated body lines.
  const pendingRef = useRef<{ title: string; lines: string[] } | null>(null);
  const timerRef = useRef<number | null>(null);

  // === Persistence wrappers ===
  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    writeLsBool(LS_ENABLED, v);
  }, []);
  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    writeLsBool(LS_SOUND, v);
  }, []);
  const markAsked = useCallback(() => {
    setAsked(true);
    writeLsBool(LS_ASKED, true);
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (!supportsNotifications) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return Notification.permission;
    }
  }, []);

  // === Document title badge ===
  // While the tab is hidden, prefix the title with (N) unread completions.
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${DEFAULT_TITLE}`;
    } else {
      document.title = DEFAULT_TITLE;
    }
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [unreadCount]);

  // Clear the badge as soon as the user comes back to the tab.
  useEffect(() => {
    const clearOnFocus = () => {
      if (!document.hidden) setUnreadCount(0);
    };
    window.addEventListener('focus', clearOnFocus);
    document.addEventListener('visibilitychange', clearOnFocus);
    return () => {
      window.removeEventListener('focus', clearOnFocus);
      document.removeEventListener('visibilitychange', clearOnFocus);
    };
  }, []);

  // === Sound ===
  // Tiny ascending two-note ding via Web Audio API. No asset, no autoplay issue
  // because notify() is only ever called from a state update that follows a
  // user-triggered async gen — counts as user-gestured.
  const playDing = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const tones = [880, 1320]; // A5, E6
      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.25);
      });
      setTimeout(() => ctx.close(), 600);
    } catch {
      // Audio policy can block silent contexts; ignore.
    }
  }, [soundEnabled]);

  // === Fire / coalesce ===
  const fireNow = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    timerRef.current = null;
    if (!pending) return;
    const { title, lines } = pending;
    const body = lines.length > 1
      ? `${lines.length} sự kiện:\n• ${lines.join('\n• ')}`
      : lines[0];

    // Only fire an OS notification when the tab is hidden AND permission granted.
    if (document.hidden && supportsNotifications && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body,
          icon: '/favicon.svg',
          // 'badge' and 'renotify' are supported in some browsers but not in the
          // strict NotificationOptions TS lib — pass via cast.
          tag: 'otama-gen',
          ...(lines.length > 1 ? { renotify: true } as any : {}),
        } as NotificationOptions);
        n.onclick = () => {
          window.focus();
          try { n.close(); } catch {}
        };
      } catch {
        // If Notification constructor throws (some Safari builds), silently skip.
      }
    }
    playDing();
  }, [playDing]);

  const notify = useCallback((title: string, body: string) => {
    if (!enabled) return;
    // Always bump the in-tab badge so even users who decline OS notifications
    // get a visual cue in the title bar when the tab is hidden.
    if (document.hidden) {
      setUnreadCount((c) => c + 1);
    }
    if (!pendingRef.current) {
      pendingRef.current = { title, lines: [body] };
    } else {
      pendingRef.current.title = title; // latest title wins
      pendingRef.current.lines.push(body);
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(fireNow, COALESCE_MS);
  }, [enabled, fireNow]);

  // === Cross-component event bridge ===
  // Children (PicsetTab etc) that can't import this hook directly dispatch a
  // CustomEvent on window — App.tsx listens and forwards to notify().
  // The hook itself doesn't subscribe here; App wires it.

  return {
    enabled,
    setEnabled,
    soundEnabled,
    setSoundEnabled,
    permission,
    requestPermission,
    asked,
    markAsked,
    notify,
    unreadCount,
  };
}

/**
 * Dispatch helper for components that don't directly call notify().
 * App.tsx listens for 'otama:gen-done' and forwards to its notify().
 */
export function dispatchGenDoneEvent(source: string, title: string, body: string) {
  try {
    window.dispatchEvent(
      new CustomEvent('otama:gen-done', {
        detail: { source, title, body },
      })
    );
  } catch {}
}
