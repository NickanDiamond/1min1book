"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/connect", label: "Find a connection" },
];

export default function TopBar() {
  const pathname = usePathname();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5">
      <Link href="/" className="text-sm font-medium tracking-tight text-zinc-900">
        1Min1Book <span className="text-zinc-400">Knowledge Graph</span>
      </Link>
      <nav className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                active ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
