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
import AccountSidebar from '@/components/account/AccountSidebar';
import OrdersView, { type Order } from '@/components/account/OrdersView';
import { triggerLoginModal } from '@/components/LoginModal';
import MobileAccountHome from '@/components/account/MobileAccountHome';

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

function BrandMark() {
  return (
    <div className="flex flex-col items-center">
      <div className="font-serif text-4xl font-semibold tracking-wide text-charcoal">TB</div>
      <div className="mt-1 text-[10px] font-medium tracking-[0.32em] text-stone-500">THE BRIDE JEWELRY</div>
    </div>
  );
}

function formatMmSs(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
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
    <div className="flex justify-center gap-2.5" onPaste={onPaste}>
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
            className="h-12 w-10 rounded-md border border-stone-200 bg-white text-center font-sans text-xl font-semibold text-charcoal shadow-sm outline-none transition focus:border-charcoal focus:ring-0 disabled:opacity-50"
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
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
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
    if (!mounted) return;
    if (!isUserLoggedIn()) {
      const returnTo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnTo') : null;
      const safe = returnTo && returnTo.startsWith('/') ? returnTo : '/';
      triggerLoginModal(safe);
      router.replace(safe);
    }
  }, [mounted, router]);

  useEffect(() => {
    if (!isLoggedIn) {
      setAccountPhone(null);
      setAccountName(null);
      setAccountEmail(null);
      return;
    }
    setAccountPhone(null);
    setAccountName(null);
    setAccountEmail(null);
    apiGet<{ user?: { phoneE164?: string | null; name?: string | null; email?: string | null } }>('/api/auth/me', { user: true })
      .then((me) => {
        const p = me?.user?.phoneE164;
        const n = me?.user?.name;
        const e = me?.user?.email;
        setAccountPhone(typeof p === 'string' && p.trim() ? p.trim() : '');
        setAccountName(typeof n === 'string' && n.trim() ? n.trim() : '');
        setAccountEmail(typeof e === 'string' && e.trim() ? e.trim() : '');
      })
      .catch(() => {
        setAccountPhone('');
        setAccountName('');
        setAccountEmail('');
      });
  }, [isLoggedIn]);

  useEffect(() => {
    if (!mounted || !isLoggedIn) return;
    let cancelled = false;
    setOrdersLoading(true);
    apiGet<Order[]>('/api/orders', { user: true })
      .then((list) => {
        if (cancelled) return;
        const raw = Array.isArray(list) ? list : [];
        setOrders(raw.filter((o) => !['pending_payment', 'payment_cancelled'].includes(String(o?.status || ''))));
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, mounted]);

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

  if (!isLoggedIn) return null;

  return (
    <main className="min-h-[70vh] bg-white px-4 py-6 pb-20 sm:py-10">
      <div className="mx-auto max-w-6xl">
        {isLoggedIn ? (
          <>
            <MobileAccountHome
              name={accountName}
              email={accountEmail}
              phoneE164={accountPhone}
              onLogout={handleLogout}
            />

            <div className="hidden md:grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
              <div className="lg:sticky lg:top-24">
                <AccountSidebar
                  activeHref="/orders"
                  name={accountName}
                  phone={accountPhone}
                  onLogout={handleLogout}
                />
              </div>
              {ordersLoading ? (
                <section className="min-w-0">
                  <p className="text-stone-500">Loading your orders…</p>
                </section>
              ) : (
                <OrdersView orders={orders} />
              )}
            </div>
          </>
        ) : (
          <section className="relative mx-auto max-w-md">
            <div className="absolute left-0 top-0">
              {otpStep === 'sent' ? (
                <button
                  type="button"
                  onClick={resetToPhoneStep}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-stone-100"
                  aria-label="Go back"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <Link
                  href={backHref}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-stone-100"
                  aria-label="Go back"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
            </div>

            <div className="pt-8">
              <BrandMark />

              {otpStep === 'idle' ? (
                <>
                  <h1 className="mt-8 text-center font-serif text-3xl font-semibold tracking-tight text-charcoal">
                    Welcome Back
                  </h1>
                  <p className="mt-2 text-center text-sm text-stone-500">Enter your mobile number to continue</p>

                  <div className="mt-10 flex items-center gap-3">
                    <div className="flex h-11 w-[84px] items-center justify-between rounded-xl border border-stone-200 bg-white px-3 text-sm text-charcoal">
                      <span className="font-medium">+91</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="text-stone-400">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <input
                      id="phone"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Enter mobile number"
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
                    className="mt-8 w-full rounded-xl bg-accent py-3.5 text-sm font-semibold uppercase tracking-wide text-cta transition hover:bg-accent-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {otpLoading ? 'Sending…' : 'GET OTP'}
                  </button>

                  <div className="mt-5 flex items-center justify-center gap-2 text-xs text-stone-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="text-stone-400">
                      <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="5" y="11" width="14" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Secure login powered by OTP</span>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="mt-8 text-center font-serif text-3xl font-semibold tracking-tight text-charcoal">
                    Enter OTP
                  </h1>
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
                    className="mt-8 w-full rounded-xl bg-accent py-3.5 text-sm font-semibold uppercase tracking-wide text-cta transition hover:bg-accent-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {otpLoading ? 'Verifying…' : 'VERIFY & CONTINUE'}
                  </button>

                  <div className="mt-5 flex items-center justify-center gap-2 text-xs text-stone-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="text-stone-400">
                      <path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Your information is safe with us</span>
                  </div>
                </>
              )}

              {otpInfo && otpStep === 'sent' && <p className="mt-4 text-center text-xs text-stone-500">{otpInfo}</p>}
              {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
