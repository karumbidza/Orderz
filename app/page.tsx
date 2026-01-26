'use client';

import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Truck, BarChart3, Shield, ArrowRight, Boxes, ClipboardList } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-slate-700/20 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Boxes className="w-7 h-7 text-blue-500" />
              <span className="text-xl font-bold text-white">Redan Coupon</span>
            </div>
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="default" size="sm">
                  Sign In
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Button onClick={() => router.push('/admin')} size="sm">
                Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
              <Shield className="w-4 h-4" />
              Secure Inventory Management
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
              Redan Coupon
              <span className="block text-slate-400 text-2xl sm:text-3xl lg:text-4xl font-normal mt-3">
                Order & Inventory System
              </span>
            </h1>
            
            {/* Description */}
            <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
              Streamline your warehouse operations with real-time stock tracking, 
              order management, and seamless dispatch control.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button size="lg" className="group">
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Button size="lg" onClick={() => router.push('/admin')} className="group">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </SignedIn>
            </div>
            
            <SignedOut>
              <p className="mt-6 text-sm text-slate-500">
                Secure authentication powered by Google
              </p>
            </SignedOut>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-24">
            <Card className="group hover:border-blue-500/30 transition-colors">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-blue-600/10 flex items-center justify-center mb-4 group-hover:bg-blue-600/20 transition-colors">
                  <Package className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Stock Management</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Track inventory levels in real-time across all warehouses with automated alerts and reports.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:border-blue-500/30 transition-colors">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-blue-600/10 flex items-center justify-center mb-4 group-hover:bg-blue-600/20 transition-colors">
                  <ClipboardList className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Order Processing</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Receive and process orders from sites with easy approval workflows and status tracking.
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:border-blue-500/30 transition-colors">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-blue-600/10 flex items-center justify-center mb-4 group-hover:bg-blue-600/20 transition-colors">
                  <Truck className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Dispatch Control</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Manage dispatches with printable vouchers and complete delivery tracking.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Stats Section */}
          <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '84+', label: 'SKU Items' },
              { value: '10+', label: 'Sites' },
              { value: 'Real-time', label: 'Stock Updates' },
              { value: '100%', label: 'Secure' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          © 2026 Redan Coupon. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
