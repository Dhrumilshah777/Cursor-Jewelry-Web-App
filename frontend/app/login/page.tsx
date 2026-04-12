'use client';

import { useEffect, useState } from 'react';
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

export default function LoginPage() {
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  /** E.164 from session: null = loading, '' = no phone on user, else display number. */
  const [accountPhone, setAccountPhone] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState<'idle' | 'sent'>('idle');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpInfo, setOtpInfo] = useState('');
  const router = useRouter();

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

  const handleLogout = async () => {
    try {
      await fetch(`${getApiBase()}/api/auth/logout`, { credentials: 'include' });
    } catch (_) {}
    clearUserToken();
    setAccountPhone(null);
    router.refresh();
  };

  const returnTo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnTo') : null;

  const handleSendOtp = async () => {
    setError('');
    setOtpInfo('');
    setOtpLoading(true);
    try {
      const res = await apiPost<{ ok?: boolean; to?: string }>('/api/auth/whatsapp/request-otp', { phone });
      setOtpStep('sent');
      setOtpInfo(res?.to ? `OTP sent by SMS to ${res.to}` : 'OTP sent by SMS.');
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

  return (
    <main className="min-h-[60vh] px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-sm">
        <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
          Login
        </h1>
        <p className="mt-2 text-stone-600">
          Sign in with your phone number to access your wishlist and more.
        </p>

        {isLoggedIn && (
          <div className="mt-6 rounded border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-sm text-stone-600">You&apos;re logged in.</p>
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
              className="mt-3 text-sm font-medium text-charcoal underline hover:no-underline"
            >
              Log out
            </button>
          </div>
        )}

        {!isLoggedIn && (
        <div className="mt-8 rounded border border-stone-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-sm font-medium text-charcoal">Login with SMS OTP</p>
          <p className="mt-1 text-xs text-stone-500">Enter your Indian number. We’ll send an OTP by SMS.</p>

          <label className="mt-4 block text-xs font-medium text-stone-700" htmlFor="phone">
            Phone number (India)
          </label>
          <input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="e.g. 9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-charcoal"
            disabled={otpLoading}
          />

          {otpStep === 'sent' && (
            <>
              <label className="mt-4 block text-xs font-medium text-stone-700" htmlFor="otp">
                OTP
              </label>
              <input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-charcoal"
                disabled={otpLoading}
              />
            </>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleSendOtp}
              className="flex-1 rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={otpLoading || !phone.trim()}
            >
              {otpLoading && otpStep === 'idle' ? 'Sending…' : otpStep === 'sent' ? 'Resend OTP' : 'Send OTP'}
            </button>
            <button
              type="button"
              onClick={handleVerifyOtp}
              className="flex-1 rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-charcoal hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={otpLoading || otpStep !== 'sent' || !otp.trim()}
            >
              {otpLoading && otpStep === 'sent' ? 'Verifying…' : 'Verify & Login'}
            </button>
          </div>

          {otpInfo && <p className="mt-3 text-xs text-stone-600">{otpInfo}</p>}
        </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {!isLoggedIn && (
        <p className="mt-8 text-center text-sm text-stone-500">
          Don&apos;t have an account? We&apos;ll create one when you verify your phone number.
        </p>
        )}
        <p className="mt-4 text-center">
          <Link href={returnTo || '/'} className="text-sm text-charcoal underline hover:no-underline">
            ← Back to home
          </Link>
          {returnTo && (
            <span className="ml-2">
              <Link href="/cart" className="text-sm text-charcoal underline hover:no-underline">Cart</Link>
            </span>
          )}
        </p>
      </div>
    </main>
  );
}
