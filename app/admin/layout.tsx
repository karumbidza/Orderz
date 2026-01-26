'use client';

import { UserButton } from '@clerk/nextjs';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {/* Admin Header with User Profile */}
      <header className="bg-slate-900 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Title */}
            <div>
              <h1 className="text-lg font-semibold text-white">Redan Coupon</h1>
              <p className="text-xs text-slate-400">Admin Portal</p>
            </div>
            
            {/* User Profile */}
            <div className="flex items-center gap-4">
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10",
                    userButtonPopoverCard: "shadow-xl",
                    userButtonPopoverActionButton: "text-slate-700 hover:bg-slate-100",
                  }
                }}
                showName={true}
              />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
}
