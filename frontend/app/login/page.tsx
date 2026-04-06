'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getApiBase, isUserLoggedIn, clearUserToken, apiGet, apiPost, refreshUserSession, setUserLoggedIn } from '@/lib/api';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState<string>('');
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
    if (err === 'google_denied') setError('Google sign-in was cancelled or failed.');
    else if (err === 'google_not_configured') setError('Google sign-in is not configured.');
    else if (err === 'no_email') setError('Could not get your email from Google.');
    else if (err === 'server_error') setError('Something went wrong. Please try again.');
  }, []);

  const isLoggedIn = mounted && isUserLoggedIn();

  useEffect(() => {
    if (!mounted) return;
    refreshUserSession().catch(() => {});
  }, [mounted]);

  useEffect(() => {
    if (!isLoggedIn) {
      setEmail('');
      return;
    }
    apiGet<{ user?: { email?: string } }>('/api/auth/me', { user: true })
      .then((me) => setEmail((me?.user?.email || '').toString()))
      .catch(() => setEmail(''));
  }, [isLoggedIn]);

  const handleLogout = async () => {
    try {
      await fetch(`${getApiBase()}/api/auth/logout`, { credentials: 'include' });
    } catch (_) {}
    clearUserToken();
    setEmail('');
    router.refresh();
  };

  const googleLoginUrl = `${getApiBase()}/api/auth/google`;
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
      await apiPost<{ ok?: boolean }>('/api/auth/whatsapp/verify-otp', { phone, code: otp });
      setUserLoggedIn();
      await refreshUserSession().catch(() => {});

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
          Sign in with Google or with your phone number to access your wishlist and more.
        </p>

        {isLoggedIn && (
          <div className="mt-6 rounded border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-sm text-stone-600">You&apos;re already logged in.</p>
            {email && <p className="mt-1 text-xs text-stone-500">{email}</p>}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 text-sm font-medium text-charcoal underline hover:no-underline"
            >
              Log out
            </button>
          </div>
        )}

        <a
          href={googleLoginUrl}
          className={`flex w-full items-center justify-center gap-3 rounded border border-stone-300 bg-white px-4 py-3.5 font-sans text-sm font-medium text-charcoal shadow-sm transition-colors hover:bg-stone-50 ${isLoggedIn ? 'mt-6' : 'mt-8'}`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </a>

        <div className="mt-6 rounded border border-stone-200 bg-white px-4 py-4 shadow-sm">
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

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <p className="mt-8 text-center text-sm text-stone-500">
          Don&apos;t have an account? You&apos;ll create one when you sign in with Google.
        </p>
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
