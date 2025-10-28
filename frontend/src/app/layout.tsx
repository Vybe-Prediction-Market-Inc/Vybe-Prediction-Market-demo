'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sepolia } from 'wagmi/chains';
import { http } from 'viem';
import '@rainbow-me/rainbowkit/styles.css';
import CustomWalletButton from '@/components/CustomWalletButton';

const wagmiConfig = getDefaultConfig({
  appName: 'Vybe Prediction Market',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
  ssr: true,
});

const queryClient = new QueryClient();

function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = (
    <>
      <Link href="/" className="text-[var(--muted)] hover:text-[var(--fg)] transition" onClick={() => setMobileMenuOpen(false)}>
        Home
      </Link>
      <Link href="/explore" className="text-[var(--muted)] hover:text-[var(--fg)] transition" onClick={() => setMobileMenuOpen(false)}>
        Explore
      </Link>
      <Link href="/dashboard" className="text-[var(--muted)] hover:text-[var(--fg)] transition" onClick={() => setMobileMenuOpen(false)}>
        Dashboard
      </Link>
      {/* <Link href="/profile" className="text-[var(--muted)] hover:text-[var(--fg)] transition">
        Profile
      </Link> */}
    </>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[var(--bg)]/70 backdrop-blur-md border-b border-white/10">
      <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Vybe logo"
              width={32}
              height={32}
              className="rounded-md"
              priority
            />
            <span className="font-semibold text-[var(--fg)] text-lg">Vybe</span>
          </Link>
        </div>

        {/* Middle: Links */}
        <div className="hidden sm:flex items-center gap-6">
          {navLinks}
        </div>

        {/* Right: Wallet */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="sm:hidden inline-flex items-center justify-center rounded-md border border-white/10 bg-white/10 px-2.5 py-1.5 text-sm text-[var(--fg)] hover:bg-white/20 transition"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation"
            onClick={() => setMobileMenuOpen(open => !open)}
          >
            <span className="sr-only">Toggle navigation</span>
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={mobileMenuOpen ? 'M6 6l8 8M6 14L14 6' : 'M3 6h14M3 10h14M3 14h14'}
              />
            </svg>
          </button>
          <CustomWalletButton />
        </div>
      </nav>
      {mobileMenuOpen && (
        <div
          id="mobile-nav"
          className="sm:hidden border-t border-white/10 bg-[var(--bg)]/95"
        >
          <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-4">
            {navLinks}
          </div>
        </div>
      )}
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider initialChain={sepolia}>
              <NavBar />
              <main className="pt-20">{children}</main>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
