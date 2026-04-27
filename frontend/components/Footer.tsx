import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-[#08284a] text-cream">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12 lg:px-0">
        <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          {/* Left: newsletter + socials */}
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-cream/70">
                KEEP IN TOUCH
              </p>
              <p className="mt-3 max-w-xs font-serif text-xl leading-relaxed text-white">
                Hear About Our
                <br />
                Latest Collections And News.
              </p>
            </div>

            <form
              className="mt-4 flex max-w-xs items-center border-b border-white/40 pb-2 text-sm"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="ENTER YOUR EMAIL"
                className="mr-4 w-full bg-transparent text-xs uppercase tracking-[0.18em] text-cream/80 placeholder:text-cream/60 focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-cream transition hover:bg-accent/90"
              >
                Subscribe
              </button>
            </form>

            <div className="pt-4">
              <p className="text-xs font-semibold tracking-[0.2em] text-cream/70">
                FOLLOW US
              </p>
              <div className="mt-3 flex gap-3 text-white/80">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 hover:bg-white/10"
                  aria-label="Visit Facebook"
                >
                  <span className="text-sm">f</span>
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 hover:bg-white/10"
                  aria-label="Visit Instagram"
                >
                  <span className="text-sm">in</span>
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 hover:bg-white/10"
                  aria-label="Visit YouTube"
                >
                  <span className="text-sm">yt</span>
                </button>
              </div>
            </div>

          </div>

          {/* Right: columns */}
          <div className="grid gap-8 text-xs text-cream/80 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-cream">
                Collections
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/products?category=rings" className="hover:text-white">Rings</Link></li>
                <li><Link href="/products?category=earrings" className="hover:text-white">Earrings</Link></li>
                <li><Link href="/products?category=pendants" className="hover:text-white">Pendants</Link></li>
                <li><Link href="/products?category=bracelets" className="hover:text-white">Bracelets</Link></li>
                <li><Link href="/products?category=necklaces" className="hover:text-white">Necklaces</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-cream">
                Customer Care
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/shipping" className="hover:text-white">Shipping</Link></li>
                <li><Link href="/warranty" className="hover:text-white">Warranty</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact Us</Link></li>
                <li><Link href="/returns" className="hover:text-white">Free Returns</Link></li>
                <li><Link href="/returns-policy" className="hover:text-white">Returns Policy</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-cream">
                Jewellery Guide
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/guides/zodiac-stones" className="hover:text-white">Zodiac Stones</Link></li>
                <li><Link href="/guides/jewellery-care" className="hover:text-white">Jewellery Care</Link></li>
                <li><Link href="/ring-size-guide" className="hover:text-white">Ring Size Guide</Link></li>
                <li><Link href="/guides/birthstone" className="hover:text-white">Birthstone Guide</Link></li>
                <li><Link href="/guides/diamond-buying" className="hover:text-white">Diamond Buying Guide</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="font-semibold uppercase tracking-[0.18em] text-cream">
                Terms &amp; Conditions
              </p>
              <ul className="space-y-1.5">
                <li><Link href="/cookies" className="hover:text-white">Cookie Policy</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms &amp; Conditions</Link></li>
                <li><Link href="/guides/precious-metals" className="hover:text-white">Precious Metal &amp; Hallmarks</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Full-width image banner below content with blue fade overlay */}
        <div className="mt-8 w-full">
          <div className="relative h-40 w-full overflow-hidden sm:h-52 md:h-60">
            <Image
              src="https://ik.imagekit.io/dqel2bwws/Jewelry%20Images/105fe2a6cb2f29758ea942fb717a74114c421791%20(2).png"
              alt="Blure jewelry collection"
              fill
              priority
              className="object-cover"
            />
            {/* Blue fade from image into footer background */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#08284a]/40 to-[#08284a]" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 text-[11px] text-cream/70">
          <p>© {year} BLURE. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
