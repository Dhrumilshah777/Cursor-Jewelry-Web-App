import type { Metadata } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const raw = typeof params?.slug === 'string' ? decodeURIComponent(params.slug) : '';
  if (!raw) {
    return { title: 'Product' };
  }

  let title = 'Product';
  let canonicalSlug = raw;

  try {
    const res = await fetch(`${API}/api/products/${encodeURIComponent(raw)}`, {
      next: { revalidate: 120 },
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as { name?: string; slug?: string; canonicalSlug?: string };
      if (typeof data.name === 'string' && data.name.trim()) title = data.name.trim();
      if (typeof data.canonicalSlug === 'string' && data.canonicalSlug.trim()) {
        canonicalSlug = data.canonicalSlug.trim();
      } else if (typeof data.slug === 'string' && data.slug.trim()) {
        canonicalSlug = data.slug.trim();
      }
    }
  } catch {
    // offline / misconfigured API — still emit a canonical using the URL segment
  }

  const canonical = `${SITE}/products/${encodeURIComponent(canonicalSlug)}`;

  return {
    title: `${title} | BLURE`,
    alternates: { canonical },
    openGraph: {
      title,
      url: canonical,
    },
  };
}

export default function ProductSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
