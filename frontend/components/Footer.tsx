import Link from 'next/link';

const links = [
  { href: '/products', label: 'Products' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/login', label: 'Login' },
  { href: '/register', label: 'Register' },
];

export default function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-charcoal text-cream">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
          <Link href="/" className="font-serif text-xl font-semibold tracking-wide">
            BLURE
          </Link>
          <nav className="flex flex-wrap justify-center gap-6" aria-label="Footer">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="font-sans text-sm text-cream/80 transition-colors hover:text-gold-light"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-8 border-t border-stone-600/50 pt-8 text-center font-sans text-sm text-stone-400">
          © {new Date().getFullYear()} BLURE — The Maison Blure.
        </p>
      </div>
    </footer>
  );
}
