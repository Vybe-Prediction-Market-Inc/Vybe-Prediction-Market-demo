'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { localhost, sepolia } from 'wagmi/chains';
import { http } from 'viem';
import '@rainbow-me/rainbowkit/styles.css';
import CustomWalletButton from '@/components/CustomWalletButton';

const wagmiConfig = getDefaultConfig({
  appName: 'Vybe Prediction Market',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [localhost, sepolia],
  transports: {
    [localhost.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
  ssr: true,
});

const queryClient = new QueryClient();

function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = (
    <>
      {['Home', 'Explore', 'Dashboard', 'Profile'].map((name, i) => (
        <Link
          key={i}
          href={name === 'Home' ? '/' : `/${name.toLowerCase()}`}
          onClick={() => setMobileMenuOpen(false)}
          className="relative text-[var(--muted)] hover:text-[var(--fg)] transition font-medium group"
        >
          {name}
          <span className="absolute left-0 bottom-[-3px] w-0 h-[1.5px] bg-[var(--fg)] transition-all duration-300 group-hover:w-full"></span>
        </Link>
      ))}
    </>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[var(--bg)]/70 backdrop-blur-md border-b border-white/10">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="Vybe logo"
            width={36}
            height={36}
            className="rounded-md"
            priority
          />
          <span className="font-semibold text-[var(--fg)] text-lg tracking-tight">Vybe</span>
        </Link>

        {/* Middle: Links */}
        <div className="hidden sm:flex items-center gap-8">
          {navLinks}
        </div>

        {/* Right: Wallet + Menu */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="sm:hidden inline-flex items-center justify-center rounded-md border border-white/10 bg-white/10 px-2.5 py-1.5 text-sm text-[var(--fg)] hover:bg-white/20 transition"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={
                  mobileMenuOpen
                    ? 'M6 6l8 8M6 14L14 6'
                    : 'M3 6h14M3 10h14M3 14h14'
                }
              />
            </svg>
          </button>
          <CustomWalletButton />
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`sm:hidden transition-all duration-300 ease-out overflow-hidden ${
          mobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        } border-t border-white/10 bg-[var(--bg)]/95 shadow-lg`}
      >
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-4">
          {navLinks}
        </div>
      </div>
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
              <main className="pt-20">
                {children}
              </main>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
