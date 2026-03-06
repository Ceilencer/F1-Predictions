"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  displayName: string;
  isAdmin: boolean;
}

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/predict", label: "Predict" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/history", label: "History" },
];

export default function Navbar({ displayName, isAdmin }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const links = isAdmin
    ? [...NAV_LINKS, { href: "/admin", label: "Admin" }]
    : NAV_LINKS;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="bg-surface border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-accent font-extrabold text-lg tracking-tight">F1</span>
          <span className="font-semibold text-white text-sm">Predictions</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(href)
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop user */}
        <div className="hidden md:flex items-center gap-4">
          <span className="text-sm text-muted truncate max-w-[160px]">{displayName}</span>
          <button
            onClick={signOut}
            className="text-sm text-muted hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden w-10 h-10 flex items-center justify-center text-muted hover:text-white"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/5 px-4 py-3 flex flex-col gap-1 bg-surface">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`px-3 py-3 rounded-md text-sm font-medium ${
                isActive(href)
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="mt-2 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-muted truncate">{displayName}</span>
            <button
              onClick={signOut}
              className="text-sm text-red-400 hover:text-red-300 py-2 px-3"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
