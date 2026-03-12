'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiGet, assetUrl } from '@/lib/api';

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
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
  return (
    <div className="group">
      <Link href={`/products/${product._id}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-stone-100">
          <img
            src={productImageSrc(product.image)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="min-h-[4rem] pt-3">
          <h2 className="font-sans text-sm font-medium uppercase tracking-wide text-charcoal line-clamp-2">
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
