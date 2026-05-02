import Link from 'next/link';

type SidebarItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
};

function IconWrapper({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-stone-50 text-stone-600">{children}</span>;
}

function SidebarIcon({ name }: { name: 'home' | 'bag' | 'heart' | 'pin' | 'user' | 'star' | 'bell' | 'help' | 'logout' }) {
  const cls = 'h-[18px] w-[18px]';
  switch (name) {
    case 'home':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z" strokeLinejoin="round" />
        </svg>
      );
    case 'bag':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M7 7V6a5 5 0 0 1 10 0v1" strokeLinecap="round" />
          <path d="M6 7h12l1 14H5L6 7z" strokeLinejoin="round" />
        </svg>
      );
    case 'heart':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path
            d="M20.5 8.5c0 6-8.5 11-8.5 11S3.5 14.5 3.5 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8.5 2.5z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'pin':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 22s7-4.5 7-12a7 7 0 1 0-14 0c0 7.5 7 12 7 12z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
    case 'user':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M20 21a8 8 0 1 0-16 0" strokeLinecap="round" />
          <circle cx="12" cy="8" r="3.2" />
        </svg>
      );
    case 'star':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 3l2.9 6 6.6.7-5 4.2 1.5 6.4L12 17.9 6 20.3l1.5-6.4-5-4.2 6.6-.7L12 3z" strokeLinejoin="round" />
        </svg>
      );
    case 'bell':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7z" strokeLinejoin="round" />
          <path d="M9.6 20a2.4 2.4 0 0 0 4.8 0" strokeLinecap="round" />
        </svg>
      );
    case 'help':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9.5A2.4 2.4 0 0 1 12 8a2.4 2.4 0 0 1 2.4 2.4c0 1.6-1.4 2.1-2 2.6-.5.4-.7.8-.7 1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'logout':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M10 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-2" strokeLinejoin="round" />
          <path d="M15 12H3m0 0 3-3m-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AccountSidebar({
  activeHref,
  name,
  phone,
  onLogout,
}: {
  activeHref: string;
  name?: string | null;
  phone?: string | null;
  onLogout?: () => void;
}) {
  const items: SidebarItem[] = [
    { href: '/account', label: 'Dashboard', icon: <SidebarIcon name="home" /> },
    { href: '/orders', label: 'My Orders', icon: <SidebarIcon name="bag" /> },
    { href: '/wishlist', label: 'Wishlist', icon: <SidebarIcon name="heart" /> },
    { href: '/addresses', label: 'Addresses', icon: <SidebarIcon name="pin" /> },
    { href: '/profile', label: 'Profile Details', icon: <SidebarIcon name="user" /> },
    { href: '/reviews', label: 'Review & Ratings', icon: <SidebarIcon name="star" /> },
    { href: '/notifications', label: 'Notifications', icon: <SidebarIcon name="bell" /> },
    { href: '/support', label: 'Help & Support', icon: <SidebarIcon name="help" /> },
  ].map((x) => ({ ...x, active: activeHref === x.href }));

  return (
    <aside className="w-full max-w-[280px] rounded-2xl border border-stone-200 bg-main p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.18)]">
      <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-main text-stone-700">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="8" r="3.2" />
            <path d="M20 21a8 8 0 1 0-16 0" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-charcoal">My Account</p>
          {phone?.trim() ? (
            <p className="truncate text-xs text-stone-500">{phone}</p>
          ) : (
            <p className="truncate text-xs text-stone-500"> </p>
          )}
        </div>
      </div>

      <nav className="mt-3 space-y-1">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-3 rounded-xl px-2.5 py-2 transition ${
              it.active ? 'bg-stone-100 text-charcoal' : 'text-stone-600 hover:bg-stone-50 hover:text-charcoal'
            }`}
          >
            <IconWrapper>{it.icon}</IconWrapper>
            <span className="text-sm font-medium">{it.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-4 border-t border-stone-200 pt-3">
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-stone-600 transition hover:bg-stone-50 hover:text-red-600"
          >
            <IconWrapper>
              <SidebarIcon name="logout" />
            </IconWrapper>
            <span className="text-sm font-medium">Logout</span>
          </button>
        ) : (
          <Link
            href="/logout"
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-stone-600 transition hover:bg-stone-50 hover:text-red-600"
          >
            <IconWrapper>
              <SidebarIcon name="logout" />
            </IconWrapper>
            <span className="text-sm font-medium">Logout</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

