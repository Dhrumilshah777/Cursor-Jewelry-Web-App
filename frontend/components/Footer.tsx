import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10 bg-cta text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12 lg:px-0">
        <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          {/* Newsletter */}
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-white/70">
                KEEP IN TOUCH
              </p>
              <p className="mt-3 max-w-xs font-serif text-xl leading-relaxed text-white">
                Hear About Our
                <br />
                Latest Collections And News.
              </p>
            </div>

            <form
              className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row sm:items-stretch"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="ENTER YOUR EMAIL"
                className="min-h-[44px] flex-1 rounded border border-white/20 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white placeholder:text-white/60 outline-none focus:border-white/50 focus:ring-1 focus:ring-white/30"
              />
              <button
                type="submit"
                className="shrink-0 rounded bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-cta transition hover:bg-white/90"
              >
                Subscribe
              </button>
            </form>

            <div className="pt-4">
              <p className="text-xs font-semibold tracking-[0.2em] text-white/70">
                FOLLOW US
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white transition hover:bg-white/10"
                  aria-label="Visit Facebook"
                >
                  <span className="text-sm">f</span>
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white transition hover:bg-white/10"
                  aria-label="Visit Instagram"
                >
                  <span className="text-sm">in</span>
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white transition hover:bg-white/10"
                  aria-label="Visit YouTube"
                >
                  <span className="text-sm">yt</span>
                </button>
              </div>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid gap-8 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-white">
                Collections
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/products?category=rings" className="text-white/70 transition hover:text-white">Rings</Link></li>
                <li><Link href="/products?category=earrings" className="text-white/70 transition hover:text-white">Earrings</Link></li>
                <li><Link href="/products?category=pendants" className="text-white/70 transition hover:text-white">Pendants</Link></li>
                <li><Link href="/products?category=bracelets" className="text-white/70 transition hover:text-white">Bracelets</Link></li>
                <li><Link href="/products?category=necklaces" className="text-white/70 transition hover:text-white">Necklaces</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-white">
                Customer Care
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/shipping" className="text-white/70 transition hover:text-white">Shipping</Link></li>
                <li><Link href="/warranty" className="text-white/70 transition hover:text-white">Warranty</Link></li>
                <li><Link href="/contact" className="text-white/70 transition hover:text-white">Contact Us</Link></li>
                <li><Link href="/returns" className="text-white/70 transition hover:text-white">Free Returns</Link></li>
                <li><Link href="/returns-policy" className="text-white/70 transition hover:text-white">Returns Policy</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-white">
                Jewellery Guide
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/guides/zodiac-stones" className="text-white/70 transition hover:text-white">Zodiac Stones</Link></li>
                <li><Link href="/guides/jewellery-care" className="text-white/70 transition hover:text-white">Jewellery Care</Link></li>
                <li><Link href="/ring-size-guide" className="text-white/70 transition hover:text-white">Ring Size Guide</Link></li>
                <li><Link href="/guides/birthstone" className="text-white/70 transition hover:text-white">Birthstone Guide</Link></li>
                <li><Link href="/guides/diamond-buying" className="text-white/70 transition hover:text-white">Diamond Buying Guide</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-white">
                Terms &amp; Conditions
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/cookies" className="text-white/70 transition hover:text-white">Cookie Policy</Link></li>
                <li><Link href="/privacy" className="text-white/70 transition hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-white/70 transition hover:text-white">Terms &amp; Conditions</Link></li>
                <li><Link href="/guides/precious-metals" className="text-white/70 transition hover:text-white">Precious Metal &amp; Hallmarks</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-8 text-[11px] text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} BLURE. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/cookies" className="transition hover:text-white">Cookies</Link>
          </div>
        </div>
      </div>

      <div className="relative h-44 w-full overflow-hidden sm:h-56" aria-hidden="true">
        <div className="absolute inset-0 bg-[url('/footer-bg.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-cta via-cta/35 to-transparent" />
      </div>
    </footer>
  );
}
