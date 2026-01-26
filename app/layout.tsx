import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

// Force dynamic rendering for Clerk authentication
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Redan Coupon Admin',
  description: 'Order and Inventory Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/admin"
      signUpFallbackRedirectUrl="/admin"
    >
      <html lang="en">
        <body className="bg-slate-50 min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
