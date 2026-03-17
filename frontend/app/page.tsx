import Link from 'next/link';
import HeroSlider from '@/components/HeroSlider';
// import CategoryCardsSection from '@/components/CategoryCardsSection';
import ShopByCategoryGrid from '@/components/ShopByCategoryGrid';
import ShopByStyleCarousel from '@/components/ShopByStyleCarousel';
import BestSellingCarousel from '@/components/BestSellingCarousel';
import PromoCardsSection from '@/components/PromoCardsSection';
import HeroServicesStrip from '@/components/HeroServicesStrip';
import GiftForEveryOccasionSection from '@/components/GiftForEveryOccasionSection';
import HomePageVideoSection from '@/components/HomePageVideoSection';
import HomePageImageSection from '@/components/HomePageImageSection';
import BeautyInMotionSection from '@/components/BeautyInMotionSection';
import KindWordsSection from '@/components/KindWordsSection';

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      <HeroSlider />

      <ShopByCategoryGrid />

      <HomePageVideoSection />

      <ShopByStyleCarousel />

      <HomePageImageSection />

      <BeautyInMotionSection />

      <BestSellingCarousel />

      <PromoCardsSection />

      <HeroServicesStrip />

      <GiftForEveryOccasionSection />

      {/* <CategoryCardsSection /> */}

      <KindWordsSection />
    </main>
  );
}
