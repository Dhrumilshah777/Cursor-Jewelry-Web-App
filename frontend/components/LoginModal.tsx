'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  apiPost,
  clearGuestWishlistStorage,
  getCart,
  getLocalGuestWishlist,
  isUserLoggedIn,
  mergeCartApi,
  mergeWishlistApi,
  refreshUserSession,
  setCart,
  setUserLoggedIn,
  storeUserAuthTokenFallback,
} from '@/lib/api';

const STORAGE_KEY = 'show-login-modal';
const OPEN_EVENT = 'tb:open-login-modal';
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 45;

export function triggerLoginModal(returnTo?: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
    if (returnTo) sessionStorage.setItem(`${STORAGE_KEY}:returnTo`, returnTo);
  } catch (_) {}
  try {
    window.dispatchEvent(new Event(OPEN_EVENT));
  } catch (_) {}
}

function formatIndiaDisplay(phoneRaw: string): string {
  const digits = phoneRaw.replace(/\D/g, '');
  const local = digits.startsWith('91') && digits.length > 10 ? digits.slice(2) : digits;
  const ten = local.slice(-10);
  if (ten.length !== 10) return phoneRaw.trim() || '—';
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}

function formatMmSs(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function BrandMark() {
  return (
    <div className="flex flex-col items-center">
      <div className="font-serif text-4xl font-semibold tracking-wide text-charcoal">TB</div>
      <div className="mt-1 text-[10px] font-medium tracking-[0.32em] text-stone-500">THE BRIDE JEWELRY</div>
    </div>
  );
}

function OtpDigitInputs({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const arr = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || '');

  const focusAt = (i: number) => {
    const el = inputsRef.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))];
    el?.focus();
    el?.select();
  };

  const setFromDigits = (digits: string) => {
    const clean = digits.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(clean);
    if (clean.length < OTP_LENGTH) focusAt(clean.length);
  };

  const onKeyDown = (index: number, e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (arr[index]) {
        const next = value.slice(0, index) + value.slice(index + 1);
        onChange(next);
      } else if (index > 0) {
        focusAt(index - 1);
        const next = value.slice(0, index - 1) + value.slice(index);
        onChange(next);
      }
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      focusAt(index - 1);
      e.preventDefault();
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusAt(index + 1);
      e.preventDefault();
    }
  };

  const onChangeCell = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, '');
    if (!d) {
      const next = value.slice(0, index) + value.slice(index + 1);
      onChange(next);
      return;
    }
    if (d.length > 1) {
      setFromDigits(value.slice(0, index) + d + value.slice(index + 1));
      return;
    }
    const next = (value.slice(0, index) + d + value.slice(index + 1)).slice(0, OTP_LENGTH);
    onChange(next);
    if (index < OTP_LENGTH - 1) focusAt(index + 1);
  };

  const onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    const clean = text.replace(/\D/g, '');
    if (clean.length >= OTP_LENGTH) {
      e.preventDefault();
      setFromDigits(clean);
    }
  };

  return (
    <div className="flex justify-center gap-2.5" onPaste={onPaste}>
      {arr.map((ch, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={index === 0}
          maxLength={1}
          value={ch}
          disabled={disabled}
          onChange={(e) => onChangeCell(index, e)}
          onKeyDown={(e) => onKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          className="h-12 w-10 rounded-md border border-stone-200 bg-white text-center font-sans text-xl font-semibold text-charcoal shadow-sm outline-none transition focus:border-charcoal focus:ring-0 disabled:opacity-50"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

export default function LoginModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState<'idle' | 'sent'>('idle');
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearResendTimer = useCallback(() => {
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  }, []);

  const startResendCooldown = useCallback(() => {
    clearResendTimer();
    setResendIn(RESEND_COOLDOWN_SEC);
    resendTimerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          clearResendTimer();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [clearResendTimer]);

  useEffect(() => {
    const maybeOpen = () => {
      try {
        const v = sessionStorage.getItem(STORAGE_KEY);
        if (v) {
          sessionStorage.removeItem(STORAGE_KEY);
          setOpen(true);
        }
      } catch (_) {}
    };

    maybeOpen();
    window.addEventListener(OPEN_EVENT, maybeOpen);
    return () => window.removeEventListener(OPEN_EVENT, maybeOpen);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setAnimateIn(false);
      return;
    }
    const t = window.setTimeout(() => setAnimateIn(true), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (isUserLoggedIn()) setOpen(false);
  }, [open]);

  useEffect(() => {
    return () => clearResendTimer();
  }, [clearResendTimer]);

  const phoneDigits = phone.replace(/\D/g, '');
  const localTen =
    phoneDigits.startsWith('91') && phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits.slice(-10);
  const phoneOk = localTen.length === 10;

  const resetToPhoneStep = () => {
    setOtpStep('idle');
    setOtp('');
    setError('');
    clearResendTimer();
    setResendIn(0);
  };

  const close = () => {
    setAnimateIn(false);
    window.setTimeout(() => {
      setOpen(false);
      setError('');
      setOtpLoading(false);
    }, 160);
  };

  const handleSendOtp = async () => {
    setError('');
    setOtpLoading(true);
    try {
      await apiPost('/api/auth/whatsapp/request-otp', { phone });
      setOtpStep('sent');
      setOtp('');
      startResendCooldown();
    } catch (e) {
      setError((e as Error)?.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setOtpLoading(true);
    try {
      const otpRes = await apiPost<{ ok?: boolean; token?: string }>('/api/auth/whatsapp/verify-otp', {
        phone,
        code: otp,
      });
      if (otpRes?.token) storeUserAuthTokenFallback(otpRes.token);
      setUserLoggedIn();
      await refreshUserSession().catch(() => {});

      const guestCart = getCart();
      if (guestCart.length > 0) {
        try {
          await mergeCartApi(guestCart);
          setCart([]);
        } catch (_) {}
      }
      const guestWishlist = getLocalGuestWishlist();
      if (guestWishlist.length > 0) {
        try {
          await mergeWishlistApi(guestWishlist);
          clearGuestWishlistStorage();
        } catch (_) {}
      }

      let go = '/';
      try {
        const stored = sessionStorage.getItem(`${STORAGE_KEY}:returnTo`);
        if (stored) {
          sessionStorage.removeItem(`${STORAGE_KEY}:returnTo`);
          go = stored;
        }
      } catch (_) {}

      close();
      router.refresh();
      router.push(go);
    } catch (e) {
      setError((e as Error)?.message || 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center pb-0 pt-10 transition-opacity duration-200 md:items-center md:px-8 md:py-10 ${
        animateIn ? 'bg-black/40 opacity-100' : 'bg-black/0 opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`w-full max-w-4xl overflow-hidden rounded-t-2xl bg-white shadow-xl transition-transform duration-200 md:max-h-[calc(100vh-5rem)] md:rounded-2xl md:overflow-auto ${
          animateIn ? 'translate-y-0 md:scale-100' : 'translate-y-6 md:scale-95'
        }`}
      >
        <div className="relative grid grid-cols-1 md:grid-cols-2">
          {/* Left image panel (desktop) */}
          <div className="relative hidden min-h-[560px] md:block">
            <div className="absolute inset-0 bg-[url('/hero-1.png')] bg-cover bg-center" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-white/0" />
            <div className="absolute bottom-10 left-10">
              <p className="max-w-[220px] font-serif text-xl text-charcoal/90">Timeless Beauty.</p>
              <p className="mt-1 max-w-[220px] font-serif text-xl text-charcoal/90">Crafted for You</p>
            </div>
          </div>

          {/* Right form panel */}
          <div className="relative px-6 py-8 sm:px-10 sm:py-10">
            <button
              type="button"
              onClick={close}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-charcoal hover:bg-stone-200"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <BrandMark />

            {otpStep === 'idle' ? (
              <>
                <h2 className="mt-8 text-center font-serif text-3xl font-semibold tracking-tight text-charcoal">
                  Welcome
                </h2>
                <p className="mt-1 text-center text-[11px] font-medium tracking-[0.28em] text-stone-500">
                  TO THE BRIDE JEWELRY
                </p>

                <div className="mt-8 flex items-center gap-3">
                  <div className="flex h-11 w-[84px] items-center justify-between rounded-xl border border-stone-200 bg-white px-3 text-sm text-charcoal">
                    <span className="font-medium">+91</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="text-stone-400">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <input
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Enter your mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 flex-1 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-charcoal outline-none placeholder:font-normal placeholder:text-stone-400 focus:border-charcoal disabled:opacity-50"
                    disabled={otpLoading}
                    aria-label="Enter mobile number"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading || !phoneOk}
                  className="mt-7 w-full rounded-xl bg-accent py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-accent-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {otpLoading ? 'Sending…' : 'CONTINUE'}
                </button>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-stone-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="text-stone-400">
                    <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Secure login powered by OTP</span>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-4 text-center text-[11px] text-stone-500">
                  <div>
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-400">◆</div>
                    <p className="mt-2 font-medium text-charcoal">Certified</p>
                    <p className="mt-0.5 text-[10px]">Jewelry</p>
                  </div>
                  <div>
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-400">⬡</div>
                    <p className="mt-2 font-medium text-charcoal">Safe</p>
                    <p className="mt-0.5 text-[10px]">Payments</p>
                  </div>
                  <div>
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-400">↺</div>
                    <p className="mt-2 font-medium text-charcoal">Easy</p>
                    <p className="mt-0.5 text-[10px]">Returns</p>
                  </div>
                </div>

                <p className="mt-8 text-center text-xs text-stone-500">
                  New here? <span className="font-medium text-charcoal">Create an account</span>
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-8 text-center font-serif text-3xl font-semibold tracking-tight text-charcoal">
                  Enter OTP
                </h2>
                <p className="mt-2 text-center text-sm text-stone-500">
                  We&apos;ve sent a 6-digit OTP to{' '}
                  <span className="font-medium text-charcoal">{formatIndiaDisplay(phone)}</span>{' '}
                  <button
                    type="button"
                    onClick={resetToPhoneStep}
                    className="ml-1 font-medium text-charcoal underline underline-offset-2"
                  >
                    Change
                  </button>
                </p>

                <div className="mt-8">
                  <OtpDigitInputs value={otp} onChange={setOtp} disabled={otpLoading} />
                </div>

                <p className="mt-6 text-center text-sm text-stone-500">
                  {resendIn > 0 ? (
                    <>Resend OTP in {formatMmSs(resendIn)}</>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpLoading || !phoneOk}
                      className="font-medium text-charcoal underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                  )}
                </p>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otp.length !== OTP_LENGTH}
                  className="mt-7 w-full rounded-xl bg-accent py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-accent-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {otpLoading ? 'Verifying…' : 'VERIFY & CONTINUE'}
                </button>
              </>
            )}

            {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}

            <div className="mt-6 text-center text-xs text-stone-500">
              <Link href="/terms" className="underline underline-offset-2 hover:no-underline" onClick={close}>
                Terms
              </Link>{' '}
              ·{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:no-underline" onClick={close}>
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

