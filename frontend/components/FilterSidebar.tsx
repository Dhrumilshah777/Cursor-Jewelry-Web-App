'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export type Facets = {
  totalProducts?: number;
  categories: { slug: string; name: string; count: number }[];
  priceRange: { min: number; max: number };
  colors: { name: string; count: number }[];
};

type FilterSidebarProps = {
  facets: Facets;
  totalCount: number;
  className?: string;
};

function buildQuery(
  base: URLSearchParams | string,
  updates: { category?: string; minPrice?: string; maxPrice?: string; colors?: string[] }
) {
  const p = new URLSearchParams(typeof base === 'string' ? base : base.toString());
  if (updates.category !== undefined) {
    if (updates.category) p.set('category', updates.category);
    else p.delete('category');
  }
  if (updates.minPrice !== undefined) {
    if (updates.minPrice) p.set('minPrice', updates.minPrice);
    else p.delete('minPrice');
  }
  if (updates.maxPrice !== undefined) {
    if (updates.maxPrice) p.set('maxPrice', updates.maxPrice);
    else p.delete('maxPrice');
  }
  if (updates.colors !== undefined) {
    p.delete('color');
    if (updates.colors.length) p.set('color', updates.colors.join(','));
  }
  const q = p.toString();
  return q ? `?${q}` : '';
}

export default function FilterSidebar({ facets, totalCount, className = '' }: FilterSidebarProps) {
  const searchParams = useSearchParams();
  const category = searchParams.get('category') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const colorParam = searchParams.get('color') || '';
  const selectedColors = colorParam ? colorParam.split(',').map((c) => c.trim()).filter(Boolean) : [];

  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);
  useEffect(() => {
    setMinPriceInput(minPriceParam);
    setMaxPriceInput(maxPriceParam);
  }, [minPriceParam, maxPriceParam]);

  const { categories, priceRange, colors } = facets;
  const hasFilters = category || minPriceParam || maxPriceParam || selectedColors.length > 0;

  const toggleColor = useCallback(
    (name: string) => {
      const next = selectedColors.includes(name)
        ? selectedColors.filter((c) => c !== name)
        : [...selectedColors, name];
      return buildQuery(searchParams.toString(), { colors: next });
    },
    [searchParams, selectedColors]
  );

  const applyPriceRange = () => {
    const q = buildQuery(searchParams.toString(), {
      minPrice: minPriceInput.trim() || undefined,
      maxPrice: maxPriceInput.trim() || undefined,
    });
    return q;
  };

  return (
    <aside
      className={`w-full flex-shrink-0 rounded border border-stone-200 bg-white p-5 lg:w-64 ${className}`}
      role="navigation"
      aria-label="Filter products"
    >
      <div className="flex items-center justify-between border-b border-stone-200 pb-3">
        <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">
          Filters
        </h2>
        {hasFilters && (
          <Link
            href="/products"
            className="text-xs text-charcoal underline hover:no-underline"
          >
            Clear all
          </Link>
        )}
      </div>

      {categories.length > 0 && (
        <div className="border-b border-stone-100 py-4">
          <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-stone-600">
            Category
          </h3>
          <ul className="space-y-1">
            <li>
              <Link
                href="/products"
                className={`block py-1 text-sm ${!category ? 'font-medium text-charcoal' : 'text-stone-600 hover:text-charcoal'}`}
              >
                All ({facets.totalProducts ?? totalCount})
              </Link>
            </li>
            {categories.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/products${buildQuery(searchParams.toString(), { category: cat.slug })}`}
                  className={`block py-1 text-sm ${category === cat.slug ? 'font-medium text-charcoal' : 'text-stone-600 hover:text-charcoal'}`}
                >
                  {cat.name} ({cat.count})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {priceRange.max > priceRange.min && (
        <div className="border-b border-stone-100 py-4">
          <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-stone-600">
            Price range
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={priceRange.min}
              max={priceRange.max}
              step="100"
              placeholder={`Min ${priceRange.min}`}
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              className="w-24 rounded border border-stone-300 px-2 py-1.5 text-sm"
            />
            <span className="text-stone-400">–</span>
            <input
              type="number"
              min={priceRange.min}
              max={priceRange.max}
              step="100"
              placeholder={`Max ${priceRange.max}`}
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              className="w-24 rounded border border-stone-300 px-2 py-1.5 text-sm"
            />
          </div>
          <Link
            href={applyPriceRange()}
            className="mt-2 inline-block text-xs font-medium text-charcoal underline hover:no-underline"
          >
            Apply
          </Link>
        </div>
      )}

      {colors.length > 0 && (
        <div className="py-4">
          <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-stone-600">
            Color
          </h3>
          <ul className="space-y-1">
            {colors.map((c) => {
              const isSelected = selectedColors.includes(c.name);
              const href = `/products${toggleColor(c.name)}`;
              return (
                <li key={c.name}>
                  <Link
                    href={href}
                    className={`flex items-center gap-2 py-1 text-sm ${isSelected ? 'font-medium text-charcoal' : 'text-stone-600 hover:text-charcoal'}`}
                  >
                    <span
                      className="h-4 w-4 flex-shrink-0 rounded-full border border-stone-300"
                      style={{
                        backgroundColor:
                          c.name.toLowerCase() === 'gold'
                            ? '#d4af37'
                            : c.name.toLowerCase() === 'silver'
                              ? '#c0c0c0'
                              : c.name.toLowerCase() === 'rose gold'
                                ? '#b76e79'
                                : c.name.toLowerCase() === 'white'
                                  ? '#f5f5f5'
                                  : undefined,
                      }}
                      aria-hidden
                    />
                    {c.name} ({c.count})
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}
