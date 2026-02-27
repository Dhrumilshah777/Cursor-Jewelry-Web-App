'use client';

const ICON_CLASS = 'mx-auto h-10 w-10 text-charcoal transition-colors duration-300 group-hover:text-gold sm:h-12 sm:w-12';

function IconHeart() {
  return (
    <svg
      className={`${ICON_CLASS} animate-icon-heartbeat transition-transform duration-300 hover:scale-110`}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function IconPaperPlane() {
  return (
    <svg
      className={`${ICON_CLASS} animate-icon-fly transition-transform duration-300 hover:scale-110`}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg
      className={`${ICON_CLASS} animate-icon-bounce transition-transform duration-300 hover:scale-105`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path strokeLinecap="round" d="M2 10h20" />
      <path strokeLinecap="round" d="M6 15h4" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg
      className={`${ICON_CLASS} animate-icon-pop transition-transform duration-300 hover:rotate-12`}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

const SERVICES = [
  {
    icon: IconHeart,
    title: 'Carefully delivered within 1-3 days',
    detail: 'and packaged with love.',
  },
  {
    icon: IconPaperPlane,
    title: 'Shipped FREE and with love',
    detail: 'on all orders within USA*',
  },
  {
    icon: IconCard,
    title: 'Buy now, pay later',
    detail: 'with PayPal',
  },
  {
    icon: IconCheckCircle,
    title: 'We would love to help you',
    detail: 'info@blure.template',
  },
] as const;

export default function HeroServicesStrip() {
  return (
    <section className="border-b border-stone-100 bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ icon: Icon, title, detail }, index) => (
            <div
              key={index}
              className="group flex flex-col items-center text-center"
            >
              <div className="mb-4 flex items-center justify-center">
                <Icon />
              </div>
              <p className="font-sans text-sm font-semibold text-stone-800 sm:text-base">
                {title}
              </p>
              <p className="mt-1 font-sans text-sm text-stone-500">
                {detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
