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

   const [openSections, setOpenSections] = useState({
     style: true,
     priceRadio: true,
     priceSlider: true,
     colors: true,
   });

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

  const priceBuckets = [
    { id: 'under-20k', label: 'Under 20,000', min: undefined as number | undefined, max: 20000 },
    { id: '20-50k', label: '20,000 - 50,000', min: 20000, max: 50000 },
    { id: '50-100k', label: '50,000 - 1,00,000', min: 50000, max: 100000 },
    { id: 'above-100k', label: 'Above 1,00,000', min: 100000, max: undefined as number | undefined },
  ];

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
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() =>
              setOpenSections((s) => ({ ...s, style: !s.style }))
            }
          >
            <h3 className="font-sans text-sm font-semibold text-charcoal">
              Shop By Style
            </h3>
            <span className="text-lg leading-none text-stone-500">
              {openSections.style ? '−' : '+'}
            </span>
          </button>

          {openSections.style && (
            <ul className="mt-3 space-y-1">
              <li>
                <Link
                  href="/products"
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                    !category
                      ? 'bg-cream font-medium text-charcoal'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-charcoal'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      !category
                        ? 'border-[#00324e] bg-[#00324e]'
                        : 'border-stone-300 bg-white'
                    }`}
                  >
                    {!category && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span>All ({facets.totalProducts ?? totalCount})</span>
                </Link>
              </li>
              {categories.map((cat) => {
                const isActive = category === cat.slug;
                return (
                  <li key={cat.slug}>
                    <Link
                      href={`/products${buildQuery(searchParams.toString(), { category: cat.slug })}`}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                        isActive
                          ? 'bg-cream font-medium text-charcoal'
                          : 'text-stone-600 hover:bg-stone-50 hover:text-charcoal'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          isActive
                            ? 'border-[#00324e] bg-[#00324e]'
                            : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span>{cat.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {priceRange.max > priceRange.min && (
        <div className="border-b border-stone-100 py-4">
          {/* Shop By price – preset ranges */}
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() =>
              setOpenSections((s) => ({ ...s, priceRadio: !s.priceRadio }))
            }
          >
            <h3 className="font-sans text-sm font-semibold text-charcoal">
              Shop By price
            </h3>
            <span className="text-lg leading-none text-stone-500">
              {openSections.priceRadio ? '−' : '+'}
            </span>
          </button>

          {openSections.priceRadio && (
            <ul className="mt-3 space-y-1">
              {priceBuckets.map((bucket) => {
                const min = bucket.min ?? '';
                const max = bucket.max ?? '';
                const isSelected =
                  (minPriceParam || '') === (min ? String(min) : '') &&
                  (maxPriceParam || '') === (max ? String(max) : '');
                const href = `/products${buildQuery(searchParams.toString(), {
                  minPrice: min ? String(min) : '',
                  maxPrice: max ? String(max) : '',
                })}`;
                return (
                  <li key={bucket.id}>
                    <Link
                      href={href}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                        isSelected
                          ? 'bg-cream font-medium text-charcoal'
                          : 'text-stone-600 hover:bg-stone-50 hover:text-charcoal'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-[#00324e] bg-[#00324e]'
                            : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span>{bucket.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Filter By Price – slider */}
          <div className="mt-5 border-t border-stone-100 pt-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() =>
                setOpenSections((s) => ({
                  ...s,
                  priceSlider: !s.priceSlider,
                }))
              }
            >
              <h3 className="font-sans text-sm font-semibold text-charcoal">
                Filter By Price
              </h3>
              <span className="text-lg leading-none text-stone-500">
                {openSections.priceSlider ? '−' : '+'}
              </span>
            </button>

            {openSections.priceSlider && (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={priceRange.min}
                    max={priceRange.max}
                    value={minPriceInput || priceRange.min}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-stone-200"
                  />
                  <input
                    type="range"
                    min={priceRange.min}
                    max={priceRange.max}
                    value={maxPriceInput || priceRange.max}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-stone-200"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-charcoal">
                  <span>₹ {minPriceInput || priceRange.min}</span>
                  <span>₹ {maxPriceInput || priceRange.max}</span>
                </div>
                <Link
                  href={applyPriceRange() || '/products'}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#00324e] px-4 py-2 text-sm font-medium text-white hover:bg-[#00263b]"
                >
                  Filter
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div className="py-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() =>
              setOpenSections((s) => ({ ...s, colors: !s.colors }))
            }
          >
            <h3 className="font-sans text-sm font-semibold text-charcoal">
              Color
            </h3>
            <span className="text-lg leading-none text-stone-500">
              {openSections.colors ? '−' : '+'}
            </span>
          </button>

          {openSections.colors && (
            <ul className="mt-3 space-y-1">
              {colors.map((c) => {
                const isSelected = selectedColors.includes(c.name);
                const href = `/products${toggleColor(c.name)}`;
                return (
                  <li key={c.name}>
                    <Link
                      href={href}
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                        isSelected
                          ? 'bg-cream font-medium text-charcoal'
                          : 'text-stone-600 hover:bg-stone-50 hover:text-charcoal'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-[#00324e] bg-[#00324e]'
                            : 'border-stone-300 bg-white'
                        }`}
                        aria-hidden
                      >
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span>
                        {c.name} ({c.count})
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
