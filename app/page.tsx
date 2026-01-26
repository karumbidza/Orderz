'use client';

import { SignIn } from '@clerk/nextjs';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-10">
            <h1 className="text-5xl font-bold text-white tracking-tight">
              Redan
            </h1>
          </div>
          
          {/* Sign In */}
          <SignedOut>
            <SignIn 
              appearance={{
                elements: {
                  rootBox: "mx-auto w-full",
                  card: "shadow-2xl border border-slate-800 bg-slate-900 w-full",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "bg-white hover:bg-slate-100 text-slate-900 border-0 font-medium",
                  socialButtonsBlockButtonText: "font-medium",
                  dividerLine: "bg-slate-700",
                  dividerText: "text-slate-500",
                  formFieldLabel: "text-slate-300",
                  formFieldInput: "bg-slate-800 border-slate-700 text-white placeholder-slate-500",
                  formButtonPrimary: "bg-blue-600 hover:bg-blue-700 font-medium",
                  footerActionLink: "text-blue-400 hover:text-blue-300",
                  footerActionText: "text-slate-500",
                  identityPreviewEditButton: "text-blue-400",
                  formFieldInputShowPasswordButton: "text-slate-400",
                  otpCodeFieldInput: "bg-slate-800 border-slate-700 text-white",
                }
              }}
              routing="hash"
              forceRedirectUrl="/admin"
            />
          </SignedOut>
          
          <SignedIn>
            <div className="text-center">
              <p className="text-slate-400 mb-6">You are signed in</p>
              <button 
                onClick={() => router.push('/admin')}
                className="px-8 py-3 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Go to Dashboard →
              </button>
            </div>
          </SignedIn>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-600">
        © 2026 Redan Coupon
      </footer>
    </div>
  );
}
