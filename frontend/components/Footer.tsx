import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-body text-text">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12 lg:px-0">
        <div className="grid gap-10 border-b border-border pb-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          {/* Newsletter */}
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-text-muted">
                KEEP IN TOUCH
              </p>
              <p className="mt-3 max-w-xs font-serif text-xl leading-relaxed text-text">
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
                className="min-h-[44px] flex-1 rounded border border-border bg-card px-3 py-2 text-xs uppercase tracking-[0.18em] text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="submit"
                className="shrink-0 rounded bg-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-accent-hover"
              >
                Subscribe
              </button>
            </form>

            <div className="pt-4">
              <p className="text-xs font-semibold tracking-[0.2em] text-text-muted">
                FOLLOW US
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-accent hover:bg-card"
                  aria-label="Visit Facebook"
                >
                  <span className="text-sm">f</span>
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-accent hover:bg-card"
                  aria-label="Visit Instagram"
                >
                  <span className="text-sm">in</span>
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-accent hover:bg-card"
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
              <p className="font-semibold uppercase tracking-[0.18em] text-text">
                Collections
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/products?category=rings" className="text-footer-link hover:text-text">Rings</Link></li>
                <li><Link href="/products?category=earrings" className="text-footer-link hover:text-text">Earrings</Link></li>
                <li><Link href="/products?category=pendants" className="text-footer-link hover:text-text">Pendants</Link></li>
                <li><Link href="/products?category=bracelets" className="text-footer-link hover:text-text">Bracelets</Link></li>
                <li><Link href="/products?category=necklaces" className="text-footer-link hover:text-text">Necklaces</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-text">
                Customer Care
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/shipping" className="text-footer-link hover:text-text">Shipping</Link></li>
                <li><Link href="/warranty" className="text-footer-link hover:text-text">Warranty</Link></li>
                <li><Link href="/contact" className="text-footer-link hover:text-text">Contact Us</Link></li>
                <li><Link href="/returns" className="text-footer-link hover:text-text">Free Returns</Link></li>
                <li><Link href="/returns-policy" className="text-footer-link hover:text-text">Returns Policy</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-text">
                Jewellery Guide
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/guides/zodiac-stones" className="text-footer-link hover:text-text">Zodiac Stones</Link></li>
                <li><Link href="/guides/jewellery-care" className="text-footer-link hover:text-text">Jewellery Care</Link></li>
                <li><Link href="/ring-size-guide" className="text-footer-link hover:text-text">Ring Size Guide</Link></li>
                <li><Link href="/guides/birthstone" className="text-footer-link hover:text-text">Birthstone Guide</Link></li>
                <li><Link href="/guides/diamond-buying" className="text-footer-link hover:text-text">Diamond Buying Guide</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-text">
                Terms &amp; Conditions
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/cookies" className="text-footer-link hover:text-text">Cookie Policy</Link></li>
                <li><Link href="/privacy" className="text-footer-link hover:text-text">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-footer-link hover:text-text">Terms &amp; Conditions</Link></li>
                <li><Link href="/guides/precious-metals" className="text-footer-link hover:text-text">Precious Metal &amp; Hallmarks</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-8 text-[11px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} BLURE. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="hover:text-text">Privacy</Link>
            <Link href="/terms" className="hover:text-text">Terms</Link>
            <Link href="/cookies" className="hover:text-text">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
