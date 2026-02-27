'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
  colors?: string[];
};

const cards = [
  { href: '/admin/products', title: 'Latest Beauty Products', desc: 'Add, edit, or remove products shown in the Latest Beauty section.' },
  { href: '/admin/hero', title: 'Hero Sliders', desc: 'Manage hero slides (images, video, titles, and CTAs).' },
  { href: '/admin/video', title: 'Home Page Video', desc: 'Set the full-width video that appears on the home page.' },
  { href: '/admin/instagram', title: 'Instagram Section', desc: 'Manage the Instagram feed images.' },
];

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Product[]>('/api/admin/products', true)
      .then((list) => setProducts(Array.isArray(list) ? list : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Dashboard</h1>
      <p className="mt-1 text-stone-600">Manage your BLURE site content.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-medium text-charcoal">{c.title}</h2>
            <p className="mt-1 text-sm text-stone-500">{c.desc}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-charcoal">Listed products</h2>
          <Link
            href="/admin/products"
            className="text-sm font-medium text-charcoal underline hover:no-underline"
          >
            Manage products →
          </Link>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-stone-500">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="mt-4 rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-stone-500">
            No products yet. <Link href="/admin/products" className="text-charcoal underline hover:no-underline">Add products</Link> to show them in Latest Beauty.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <li key={p._id} className="flex gap-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                  {p.image ? (
                    <img
                      src={p.image.startsWith('http') ? p.image : assetUrl(p.image)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-stone-400">—</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-charcoal truncate">{p.name}</p>
                  <p className="text-sm text-stone-500">{p.category}</p>
                  <p className="mt-0.5 text-sm font-medium text-charcoal">{p.price}$</p>
                  <Link
                    href="/admin/products"
                    className="mt-2 inline-block text-xs text-stone-500 underline hover:text-charcoal"
                  >
                    Edit in Products →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
