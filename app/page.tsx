'use client';

import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="text-xl font-semibold text-slate-900">Redan Coupon</span>
            </div>
            <div className="flex items-center gap-3">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                    Sign Up
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <button 
                  onClick={() => router.push('/admin')}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  Go to Admin →
                </button>
              </SignedIn>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
            <span className="text-white font-bold text-3xl">R</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Redan Coupon Admin
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Order and Inventory Management System
          </p>
          
          <SignedOut>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SignInButton mode="modal">
                <button className="px-8 py-3 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md hover:shadow-lg">
                  Sign In to Continue
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-8 py-3 text-lg font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-colors shadow-md hover:shadow-lg border border-slate-200">
                  Create Account
                </button>
              </SignUpButton>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Sign in with your email or Google account
            </p>
          </SignedOut>
          
          <SignedIn>
            <button 
              onClick={() => router.push('/admin')}
              className="px-8 py-3 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Continue to Admin Dashboard →
            </button>
          </SignedIn>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          © 2026 Redan Coupon. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
