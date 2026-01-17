import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Orderz API',
  description: 'Inventory & Ordering System Backend',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
