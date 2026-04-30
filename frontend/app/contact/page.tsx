'use client';

import Link from 'next/link';

export default function ContactPage() {
  return (
    <main className="min-h-[60vh] bg-white px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-charcoal underline underline-offset-2 hover:no-underline">
          ← Back to home
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-charcoal">Contact Us</h1>
        <p className="mt-3 text-sm text-stone-600">
          Add your contact details here (WhatsApp, phone, email, address).
        </p>
      </div>
    </main>
  );
}

