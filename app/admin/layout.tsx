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
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Redan Coupon</h1>
                <p className="text-xs text-slate-500">Admin Portal</p>
              </div>
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
