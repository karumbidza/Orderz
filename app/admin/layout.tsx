'use client';

import { UserButton, useUser } from '@clerk/nextjs';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Header with User Profile */}
      <header className="bg-slate-900 shadow-lg">
        <div className="w-full max-w-[1536px] mx-auto px-6 lg:px-[24px]">
          <div className="flex justify-between items-center h-14 ml-0">
            {/* Logo / Title */}
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-white">Redan</span>
              <span className="text-slate-500 text-sm hidden sm:block">Admin</span>
            </div>
            
            {/* User Profile */}
            <div className="flex items-center gap-3">
              {user && (
                <span className="text-sm text-slate-300 hidden sm:block">
                  {user.primaryEmailAddress?.emailAddress}
                </span>
              )}
              <UserButton 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 border-2 border-slate-700",
                    userButtonPopoverCard: "shadow-xl",
                    userButtonPopoverActionButton: "text-slate-700 hover:bg-slate-100",
                  }
                }}
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
