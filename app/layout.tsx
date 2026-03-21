// ORDERZ-REPORTS
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
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap"
            rel="stylesheet"
          />
          <style>{`
            @media print {
              .no-print { display: none !important; }
              nav, header { display: none !important; }
            }
          `}</style>
        </head>
        <body style={{ fontFamily: "'DM Sans', system-ui, sans-serif", backgroundColor: '#fff', minHeight: '100vh' }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
