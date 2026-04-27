'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getApiBase,
  isUserLoggedIn,
  clearUserToken,
  apiGet,
  apiPost,
  refreshUserSession,
  setUserLoggedIn,
  getCart,
  setCart,
  mergeCartApi,
  getLocalGuestWishlist,
  mergeWishlistApi,
  clearGuestWishlistStorage,
  storeUserAuthTokenFallback,
} from '@/lib/api';

/** Twilio Verify SMS is typically 6 digits (configurable in Twilio console). */
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 45;

function formatIndiaDisplay(phoneRaw: string): string {
  const digits = phoneRaw.replace(/\D/g, '');
  const local = digits.startsWith('91') && digits.length > 10 ? digits.slice(2) : digits;
  const ten = local.slice(-10);
  if (ten.length !== 10) return phoneRaw.trim() || '—';
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}

function OtpIllustration({ variant }: { variant: 'send' | 'inbox' }) {
  return (
    <div className="relative mx-auto flex h-[200px] w-[220px] items-center justify-center">
      <div
        className="absolute inset-[18%] rounded-[45%] bg-brand-mint/90 blur-[2px]"
        aria-hidden
      />
      <svg
        className="absolute left-2 top-10 h-5 w-5 text-emerald-500"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M12 2L2 22h20L12 2z" />
      </svg>
      <svg
        className="absolute bottom-8 right-4 h-4 w-4 text-sky-500"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
      </svg>
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative rounded-[2rem] border-[10px] border-charcoal/90 bg-white px-5 py-6 shadow-lg">
          <div className="mx-auto h-1 w-10 rounded-full bg-charcoal/15" />
          {variant === 'send' ? (
            <div className="mt-4 flex flex-col items-center gap-2">
              <svg className="h-10 w-10 text-brand-purple" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 11l18-8-8 18-2-7-8-3z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="font-mono text-xs font-semibold tracking-[0.35em] text-charcoal/50">****</p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-1">
              <svg className="h-11 w-11 text-brand-purple" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 8l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <div className="flex gap-1 pt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-charcoal/35" />
                <span className="h-1.5 w-1.5 rounded-full bg-charcoal/35" />
                <span className="h-1.5 w-1.5 rounded-full bg-charcoal/35" />
              </div>
            </div>
          )}
        </div>
      </div>
      <span
        className="absolute right-10 top-14 flex h-2 w-2 rounded-full bg-amber-400"
        aria-hidden
      />
      <span className="absolute bottom-14 left-8 h-1.5 w-1.5 rounded-full bg-orange-400" aria-hidden />
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

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
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
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={onPaste}>
      {arr.map((ch, index) => (
        <div key={index} className="flex flex-col items-center">
          <input
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
            className="h-11 w-9 border-0 border-b-2 border-stone-300 bg-transparent text-center font-sans text-xl font-semibold text-charcoal outline-none transition-colors focus:border-brand-purple disabled:opacity-50 sm:h-12 sm:w-10 sm:text-2xl"
            aria-label={`Digit ${index + 1}`}
          />
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [accountPhone, setAccountPhone] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState<'idle' | 'sent'>('idle');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpInfo, setOtpInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const router = useRouter();
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearResendTimer = useCallback(() => {
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const err = params?.get('error');
    const returnTo = params?.get('returnTo');
    if (returnTo && typeof window !== 'undefined') {
      try {
        localStorage.setItem('login-return-to', returnTo);
      } catch (_) {}
    }
    if (err === 'server_error') setError('Something went wrong. Please try again.');
  }, []);

  const isLoggedIn = mounted && isUserLoggedIn();

  useEffect(() => {
    if (!mounted) return;
    refreshUserSession().catch(() => {});
  }, [mounted]);

  useEffect(() => {
    if (!isLoggedIn) {
      setAccountPhone(null);
      return;
    }
    setAccountPhone(null);
    apiGet<{ user?: { phoneE164?: string | null } }>('/api/auth/me', { user: true })
      .then((me) => {
        const p = me?.user?.phoneE164;
        setAccountPhone(typeof p === 'string' && p.trim() ? p.trim() : '');
      })
      .catch(() => setAccountPhone(''));
  }, [isLoggedIn]);

  useEffect(() => {
    return () => clearResendTimer();
  }, [clearResendTimer]);

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

  const handleLogout = async () => {
    try {
      await fetch(`${getApiBase()}/api/auth/logout`, { credentials: 'include' });
    } catch (_) {}
    clearUserToken();
    setAccountPhone(null);
    router.refresh();
  };

  const returnTo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnTo') : null;
  const backHref = returnTo && returnTo.startsWith('/') ? returnTo : '/';

  const handleSendOtp = async () => {
    setError('');
    setOtpInfo('');
    setOtpLoading(true);
    try {
      const res = await apiPost<{ ok?: boolean; to?: string }>('/api/auth/whatsapp/request-otp', { phone });
      setOtpStep('sent');
      setOtp('');
      setOtpInfo(res?.to ? `OTP sent by SMS to ${res.to}` : 'OTP sent by SMS.');
      startResendCooldown();
    } catch (e) {
      setError((e as Error)?.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setOtpInfo('');
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

      const storedReturnTo = typeof window !== 'undefined' ? localStorage.getItem('login-return-to') : null;
      if (storedReturnTo && typeof window !== 'undefined') {
        localStorage.removeItem('login-return-to');
        router.push(storedReturnTo);
      } else {
        router.push(returnTo || '/');
      }
    } catch (e) {
      setError((e as Error)?.message || 'Invalid OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const resetToPhoneStep = () => {
    setOtpStep('idle');
    setOtp('');
    setOtpInfo('');
    setError('');
    clearResendTimer();
    setResendIn(0);
  };

  const phoneDigits = phone.replace(/\D/g, '');
  const localTen =
    phoneDigits.startsWith('91') && phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits.slice(-10);
  const phoneOk = localTen.length === 10;

  return (
    <main className="min-h-[70vh] bg-cream px-4 py-8 pb-24 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-white/80"
            aria-label="Go back"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {isLoggedIn && (
          <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
            <p className="font-sans text-sm font-medium text-charcoal">You&apos;re logged in.</p>
            {accountPhone === null ? (
              <p className="mt-2 text-xs text-stone-500">Loading your number…</p>
            ) : accountPhone ? (
              <p className="mt-2 font-mono text-sm font-medium text-charcoal">{accountPhone}</p>
            ) : (
              <p className="mt-2 text-xs text-stone-500">
                No phone number on this account. Log out and sign in with SMS OTP to link a number.
              </p>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-cream transition hover:bg-accent/90"
            >
              Log out
            </button>
          </div>
        )}

        {!isLoggedIn && (
          <div className="rounded-3xl border border-stone-200/60 bg-white px-5 pb-8 pt-2 shadow-[0_12px_40px_-12px_rgba(28,25,23,0.12)] sm:px-8">
            <OtpIllustration variant={otpStep === 'idle' ? 'send' : 'inbox'} />

            <h1 className="mt-2 text-center font-sans text-2xl font-bold tracking-tight text-charcoal">
              OTP Verification
            </h1>

            {otpStep === 'idle' ? (
              <>
                <p className="mx-auto mt-3 max-w-[280px] text-center font-sans text-sm leading-relaxed text-stone-500">
                  We will send you an <span className="font-semibold text-charcoal">One Time Password</span> on this
                  mobile number
                </p>

                <div className="mt-8">
                  <label className="block font-sans text-xs font-medium text-stone-500" htmlFor="phone">
                    Enter Mobile Number
                  </label>
                  <input
                    id="phone"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full border-0 border-b-2 border-stone-300 bg-transparent py-2 font-sans text-base font-semibold text-charcoal outline-none transition-colors placeholder:font-normal placeholder:text-stone-400 focus:border-accent disabled:opacity-50"
                    disabled={otpLoading}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading || !phoneOk}
                  className="mt-10 w-full rounded-2xl bg-accent py-3.5 font-sans text-sm font-bold uppercase tracking-wide text-accent-cream shadow-md shadow-accent/20 transition hover:bg-accent/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {otpLoading ? 'Sending…' : 'Get OTP'}
                </button>
              </>
            ) : (
              <>
                <p className="mx-auto mt-3 max-w-[300px] text-center font-sans text-sm leading-relaxed text-stone-500">
                  Enter the OTP sent to{' '}
                  <span className="font-semibold text-charcoal">{formatIndiaDisplay(phone)}</span>
                </p>

                <div className="mt-8">
                  <OtpDigitInputs value={otp} onChange={setOtp} disabled={otpLoading} />
                </div>

                <p className="mt-6 text-center font-sans text-sm text-stone-500">
                  Don&apos;t receive the OTP?{' '}
                  {resendIn > 0 ? (
                    <span className="text-stone-400">Resend in {resendIn}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpLoading || !phoneOk}
                      className="font-bold text-brand-coral hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      RESEND OTP
                    </button>
                  )}
                </p>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otp.length !== OTP_LENGTH}
                  className="mt-8 w-full rounded-2xl bg-accent py-3.5 font-sans text-sm font-bold uppercase tracking-wide text-accent-cream shadow-md shadow-accent/20 transition hover:bg-accent/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {otpLoading ? 'Verifying…' : 'Verify & Proceed'}
                </button>

                <button
                  type="button"
                  onClick={resetToPhoneStep}
                  className="mt-4 w-full text-center font-sans text-xs font-medium text-stone-500 underline-offset-2 hover:text-charcoal hover:underline"
                >
                  Change number
                </button>
              </>
            )}

            {otpInfo && otpStep === 'sent' && (
              <p className="mt-4 text-center font-sans text-xs text-stone-500">{otpInfo}</p>
            )}
            {error && <p className="mt-4 text-center font-sans text-sm text-red-600">{error}</p>}
          </div>
        )}

        {!isLoggedIn && otpStep === 'idle' && (
          <p className="mt-8 text-center font-sans text-sm text-stone-500">
            Don&apos;t have an account? We&apos;ll create one when you verify your phone number.
          </p>
        )}

        <p className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center font-sans text-sm text-stone-500">
          <Link href={returnTo || '/'} className="text-charcoal underline-offset-2 hover:text-brand-purple hover:underline">
            ← Back to home
          </Link>
          <span aria-hidden className="text-stone-300">
            ·
          </span>
          <Link href="/orders" className="text-charcoal underline-offset-2 hover:text-brand-purple hover:underline">
            My orders
          </Link>
          {returnTo && (
            <>
              <span aria-hidden className="text-stone-300">
                ·
              </span>
              <Link href="/cart" className="text-charcoal underline-offset-2 hover:text-brand-purple hover:underline">
                Cart
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
