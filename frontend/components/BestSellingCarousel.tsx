'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiGet, assetUrl, addToWishlist, removeFromWishlist, isInWishlist } from '@/lib/api';
import { productHref } from '@/lib/productLink';

type Product = {
  _id: string;
  slug?: string;
  name: string;
  category: string;
  price: string;
  image: string;
  stock?: number;
};

function productImageSrc(image: string): string {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

const PRODUCTS_PER_SLIDE = 4; // desktop: 4 in a row; mobile: 2x2

/** Mock products when API returns empty (e.g. localhost / no admin config yet) */
const MOCK_PRODUCTS: Product[] = [
  { _id: 'mock-bs-1', name: 'Classic Gold Hoops', category: 'Earrings', price: '12,499', image: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600' },
  { _id: 'mock-bs-2', name: 'Pearl Drop Earrings', category: 'Earrings', price: '8,999', image: 'https://images.unsplash.com/photo-1596944920636-eb8c2d2c2e0e?w=600' },
  { _id: 'mock-bs-3', name: 'Diamond Stud Bracelet', category: 'Bracelets', price: '24,999', image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343a?w=600' },
  { _id: 'mock-bs-4', name: 'Solitaire Ring', category: 'Rings', price: '18,500', image: 'https://images.unsplash.com/photo-1603561586110-d6a5dc2d2478?w=600' },
  { _id: 'mock-bs-5', name: 'Layered Gold Necklace', category: 'Necklaces', price: '15,299', image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600' },
  { _id: 'mock-bs-6', name: 'Emerald Pendant', category: 'Necklaces', price: '22,999', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600' },
];

function ProductCard({ product }: { product: Product }) {
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    const sync = () => setWishlisted(isInWishlist(product._id));
    sync();
    window.addEventListener('wishlist-updated', sync);
    window.addEventListener('auth-updated', sync);
    return () => {
      window.removeEventListener('wishlist-updated', sync);
      window.removeEventListener('auth-updated', sync);
    };
  }, [product._id]);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (wishlisted) removeFromWishlist(product._id);
    else
      addToWishlist({
        id: product._id,
        slug: product.slug,
        name: product.name,
        category: product.category,
        price: product.price,
        image: product.image,
      });
    setWishlisted(!wishlisted);
  };

  return (
    <div className="group">
      <Link href={productHref(product)} className="block">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-stone-100">
          <img
            src={productImageSrc(product.image)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {(product.stock ?? 1) <= 0 && (
            <div className="absolute left-2 top-2 rounded bg-black/80 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              Out of stock
            </div>
          )}

          <button
            type="button"
            onClick={toggleWishlist}
            className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border bg-white/80 backdrop-blur transition-colors ${
              wishlisted
                ? 'border-blue-200 text-blue-600 hover:border-blue-300 hover:text-blue-700'
                : 'border-stone-200 text-stone-500 hover:border-stone-400 hover:text-charcoal'
            }`}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <svg className="h-4 w-4" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </button>
        </div>

        <div className="min-h-[4rem] pt-3">
          <h2 className="min-w-0 font-sans text-sm font-medium uppercase tracking-wide text-charcoal line-clamp-2">
            {product.name}
          </h2>
          <p className="mt-2 font-sans text-sm font-semibold text-charcoal">₹{product.price}</p>
        </div>
      </Link>
    </div>
  );
}

export default function BestSellingCarousel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const isLocalhost =
      typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    apiGet<Product[]>('/api/site/best-selling')
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setProducts(arr.length > 0 ? arr : isLocalhost ? MOCK_PRODUCTS : []);
      })
      .catch(() => setProducts(isLocalhost ? MOCK_PRODUCTS : []))
      .finally(() => setLoading(false));
  }, []);

  const slides = Array.from(
    { length: Math.ceil(products.length / PRODUCTS_PER_SLIDE) },
    (_, i) => products.slice(i * PRODUCTS_PER_SLIDE, (i + 1) * PRODUCTS_PER_SLIDE)
  );
  const slideCount = slides.length;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || products.length === 0) return;
    const onScroll = () => {
      const width = el.offsetWidth;
      const i = Math.round(el.scrollLeft / width);
      setSlideIndex(Math.min(Math.max(0, i), slideCount - 1));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [products.length, slideCount]);

  const goToSlide = (i: number) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: i * el.offsetWidth, behavior: 'smooth' });
    setSlideIndex(i);
  };

  if (loading) return null;
  if (products.length === 0) return null;

  return (
    <section className="bg-cream py-10 sm:py-12">
      <div className="container mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <h2 className="mt-6 mb-12 text-center text-3xl font-thin uppercase tracking-wide text-[#1e3a5f]">
          Our bestellers
        </h2>

        <div
          ref={scrollRef}
          className="scrollbar-hide flex overflow-x-auto snap-x snap-mandatory gap-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {slides.map((slideProducts, slideIdx) => (
            <div
              key={slideIdx}
              className="grid w-full flex-shrink-0 grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 snap-start px-0.5"
              style={{ minWidth: '100%' }}
            >
              {slideProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
