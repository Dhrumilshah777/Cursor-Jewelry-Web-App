import Link from 'next/link';
import HeroSlider from '@/components/HeroSlider';
import HeroServicesStrip from '@/components/HeroServicesStrip';
import LatestBeautySection from '@/components/LatestBeautySection';
import ViewByCategoriesSection from '@/components/ViewByCategoriesSection';
import HomePageVideoSection from '@/components/HomePageVideoSection';
import KindWordsSection from '@/components/KindWordsSection';
import InstagramSection from '@/components/InstagramSection';

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      <HeroSlider />

      <LatestBeautySection />

      <HomePageVideoSection />

      <ViewByCategoriesSection />

      <HeroServicesStrip />

      <KindWordsSection />

      <div className="full-bleed">
        <InstagramSection />
      </div>

      {/* Rest of page — cream background for contrast */}
      <div className="bg-cream">
        {/* Feature strip */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 text-center sm:grid-cols-3 sm:gap-8">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h2 className="mt-4 font-serif text-lg font-medium text-charcoal">
                  Crafted with care
                </h2>
                <p className="mt-2 font-sans text-sm text-stone">
                  Each piece is made with precision and attention to detail.
                </p>
              </div>
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="mt-4 font-serif text-lg font-medium text-charcoal">
                  Quality assured
                </h2>
                <p className="mt-2 font-sans text-sm text-stone">
                  Premium materials and finishes that stand the test of time.
                </p>
              </div>
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h2 className="mt-4 font-serif text-lg font-medium text-charcoal">
                  Easy returns
                </h2>
                <p className="mt-2 font-sans text-sm text-stone">
                  Not quite right? Return within 30 days, no questions asked.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="contacts" className="border-t border-stone-200 bg-charcoal py-16 text-center text-cream sm:py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl font-light sm:text-4xl">
              Join our world
            </h2>
            <p className="mt-4 font-sans text-cream/80">
              Create an account to save your favourites and get early access to new collections.
            </p>
            <Link
              href="/register"
              className="mt-8 inline-block rounded-sm border border-gold-light px-8 py-3.5 font-sans text-sm font-medium text-gold-light transition-colors hover:bg-gold-light hover:text-charcoal"
            >
              Create account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
