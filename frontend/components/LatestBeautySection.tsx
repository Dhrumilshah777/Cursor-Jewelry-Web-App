'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import {
  apiGet,
  assetUrl,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
} from '@/lib/api';

type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  image: string;
};

const MOCK_PRODUCTS: Product[] = [
  { id: 'mock-1', name: 'Circle Necklace', category: 'Accessories', price: '52.00', image: '/instagram-1.jpg' },
  { id: 'mock-2', name: 'Small Earrings', category: 'Accessories', price: '50.00', image: '/instagram-2.jpg' },
  { id: 'mock-3', name: 'Small Earrings', category: 'Accessories', price: '50.00', image: '/instagram-2.jpg' },
  { id: 'mock-4', name: 'Small Earrings', category: 'Accessories', price: '50.00', image: '/instagram-2.jpg' },
  { id: 'mock-5', name: 'Small Earrings', category: 'Accessories', price: '50.00', image: '/instagram-2.jpg' },
];

const AUTOPLAY_MS = 5000;

/* ---------------- PRODUCT CARD ---------------- */

function ProductCard({ product }: { product: Product }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setWishlisted(isInWishlist(product.id));
  }, [product.id]);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    wishlisted ? removeFromWishlist(product.id) : addToWishlist(product);
    setWishlisted(!wishlisted);
  };

  return (
    <article className="mx-auto w-full">
      <Link href={`/products/${product.id}`}>
        <div className="rounded-sm bg-stone-100 shadow-md transition-all hover:shadow-xl">

          {/* 🔥 Bigger Responsive Image */}
          <div className="w-full h-[240px] sm:h-[260px] md:h-[320px] overflow-hidden">
            {!imageError ? (
              <img
                src={
                  product.image.startsWith('http')
                    ? product.image
                    : product.image.startsWith('/uploads/')
                    ? assetUrl(product.image)
                    : product.image
                }
                alt={product.name}
                className="w-full h-full object-cover object-center transition-transform duration-500 hover:scale-105"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-stone-200 text-stone-400">
                Image not available
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* TEXT */}
      <div className="mt-3">
        <h3 className="text-base font-semibold uppercase tracking-wide text-charcoal line-clamp-1">
          {product.name}
        </h3>
        <p className="text-sm text-stone-500">{product.category}</p>

        <div className="mt-2 flex justify-between items-center">
          <span className="text-base font-semibold">{product.price}$</span>

          <button onClick={toggleWishlist}>
            <svg
              className="h-5 w-5"
              fill={wishlisted ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733
                   -.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25
                   c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------------- SLIDER LOGIC ---------------- */

const BREAKPOINT_LG = 1024;
const BREAKPOINT_MD = 768;

const VISIBLE_DESKTOP = 4;
const VISIBLE_TABLET = 3;
const VISIBLE_MOBILE = 2;

const SLIDE_GAP_PX = 16;
const MAX_CARD_WIDTH_PX_DESKTOP = 340;

function getVisibleCount(width: number) {
  if (width >= BREAKPOINT_LG) return VISIBLE_DESKTOP;
  if (width >= BREAKPOINT_MD) return VISIBLE_TABLET;
  return VISIBLE_MOBILE;
}

/* ---------------- MAIN SECTION ---------------- */

export default function LatestBeautySection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_MOBILE);
  const [containerWidth, setContainerWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resize = () => {
      const width = el.getBoundingClientRect().width;
      setContainerWidth(width);
      setVisibleCount(getVisibleCount(width));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    apiGet<Product[]>('/api/products')
      .then((list) => {
        const mapped = list.map((p: any) => ({
          id: String(p._id),
          name: p.name,
          category: p.category,
          price: p.price,
          image: p.image,
        }));

        setProducts([...mapped, ...MOCK_PRODUCTS]);
      })
      .catch(() => setProducts(MOCK_PRODUCTS));
  }, []);

  const maxIndex = Math.max(0, products.length - visibleCount);

  useEffect(() => {
    if (products.length <= visibleCount) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [products, visibleCount, maxIndex]);

  // 🔥 Responsive width calculation
  const baseWidth =
    containerWidth > 0
      ? (containerWidth - SLIDE_GAP_PX * (visibleCount - 1)) / visibleCount
      : 260;

  const slideWidth =
    visibleCount === VISIBLE_DESKTOP
      ? Math.min(baseWidth, MAX_CARD_WIDTH_PX_DESKTOP)
      : baseWidth;

  return (
    <section className="bg-cream py-16">
      <h2 className="text-center text-3xl font-thin uppercase mb-12">
        Latest Beauty
      </h2>

      <div
        ref={containerRef}
        className="overflow-hidden max-w-7xl mx-auto px-4"
      >
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{
            gap: SLIDE_GAP_PX,
            transform: `translateX(-${
              currentIndex * (slideWidth + SLIDE_GAP_PX)
            }px)`,
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              style={{
                width: slideWidth,
                minWidth: slideWidth,
              }}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}