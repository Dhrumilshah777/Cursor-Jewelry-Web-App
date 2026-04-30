'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-[60vh] bg-white px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-charcoal underline underline-offset-2 hover:no-underline">
          ← Back
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-charcoal">Privacy Policy</h1>
        <p className="mt-3 text-sm text-stone-600">
          Add your privacy policy content here.
        </p>
      </div>
    </main>
  );
}

