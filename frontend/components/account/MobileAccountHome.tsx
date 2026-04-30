'use client';

import Link from 'next/link';

function fmtPhone(phoneE164?: string | null) {
  const raw = String(phoneE164 || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('91') && digits.length > 10 ? digits.slice(2) : digits;
  const ten = local.slice(-10);
  if (ten.length !== 10) return raw;
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}

function Row({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-charcoal">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p> : null}
      </div>
      <span className="text-stone-400" aria-hidden>
        ›
      </span>
    </Link>
  );
}

export default function MobileAccountHome({
  name,
  email,
  phoneE164,
  onLogout,
}: {
  name?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  onLogout: () => void;
}) {
  const displayName = String(name || '').trim();
  const phone = fmtPhone(phoneE164);
  const headline = displayName ? `Hey, ${displayName}` : phone ? `Hello, ${phone}` : 'My account';

  return (
    <section className="mx-auto max-w-md px-4 pb-28 pt-4 md:hidden">
      <div className="rounded-2xl border border-stone-200 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-charcoal">
            <span className="text-xs font-semibold">
              {(displayName || email || phone || 'U').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-charcoal">{headline}</p>
            <p className="truncate text-xs text-stone-500">{email?.trim() ? email : phone || ' '}</p>
          </div>
        </div>

        <div className="divide-y divide-stone-100">
          <Row href="/rewards" title="Rewards" subtitle="Earn rewards on every order" />
          <Row href="/addresses" title="Address Book" subtitle="Manage your saved addresses" />
          <Row href="/orders" title="Order History" subtitle="View my past orders" />
        </div>
      </div>

      <div className="mt-5 space-y-2 px-1 text-sm text-stone-700">
        <Link href="/shipping" className="block py-1">
          Shipping &amp; Delivery Policy
        </Link>
        <Link href="/returns-policy" className="block py-1">
          Return &amp; Exchange Policy
        </Link>
        <Link href="/returns" className="block py-1">
          Returns &amp; Exchange Policy
        </Link>
        <Link href="/privacy" className="block py-1">
          Privacy Policy
        </Link>
        <Link href="/terms" className="block py-1">
          Terms &amp; Conditions
        </Link>
        <Link href="/contact" className="block py-1">
          Contact Us
        </Link>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="mt-8 w-full rounded-xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600"
      >
        Log out
      </button>
    </section>
  );
}

