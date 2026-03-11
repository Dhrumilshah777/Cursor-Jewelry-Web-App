'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiGet, assetUrl, addToCart } from '@/lib/api';

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

function ProductCard({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  return (
    <li className="group flex flex-col overflow-hidden border border-stone-200 bg-white">
      <Link href={`/products/${product._id}`} className="block flex-1">
        <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
          <img
            src={productImageSrc(product.image)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="p-3 sm:p-4">
          <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal line-clamp-2">
            {product.name}
          </h2>
          <p className="mt-1 text-xs text-stone-500">{product.category}</p>
          <p className="mt-2 font-sans text-sm font-semibold text-charcoal">₹{product.price}</p>
        </div>
      </Link>
      <div className="border-t border-stone-100 p-3">
        <button
          type="button"
          onClick={() => {
            addToCart({ id: product._id, name: product.name, price: product.price, image: product.image });
            setAdded(true);
            setTimeout(() => setAdded(false), 2500);
          }}
          className="w-full border border-stone-300 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-stone-50"
        >
          {added ? 'Added to cart' : 'Add to cart'}
        </button>
      </div>
    </li>
  );
}

export default function BestSellingCarousel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    apiGet<Product[]>('/api/site/best-selling')
      .then((list) => setProducts(Array.isArray(list) ? list : []))
      .catch(() => setProducts([]))
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
        <h2 className="mb-6 text-center text-3xl font-thin uppercase text-[#1e3a5f]">
          Our Best Selling Jewelery
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

        {slideCount > 1 && (
          <div className="mt-6 flex justify-center gap-1.5">
            {Array.from({ length: slideCount }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToSlide(i)}
                className={`h-2 rounded-full transition-all ${
                  i === slideIndex ? 'w-6 bg-[#1e3a5f]' : 'w-2 bg-[#bfd5f2]'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
