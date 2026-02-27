import AdminGuard from './AdminGuard';

export const metadata = {
  title: 'Admin — BLURE',
  description: 'BLURE admin dashboard',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
