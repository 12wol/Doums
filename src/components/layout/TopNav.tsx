"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "仪表盘" },
  { href: "/warehouses", label: "豆仓" },
  { href: "/wish", label: "想拼" },
  { href: "/building", label: "正在拼" },
  { href: "/completed", label: "拼完了" },
  { href: "/consume", label: "拼豆" },
  { href: "/restock", label: "补豆" },
  { href: "/colors", label: "色号" },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean) {
  return cn(
    "rounded-pill px-4 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-ink text-on-primary"
      : "text-ink/50 hover:bg-surface-soft hover:text-ink/80"
  );
}

export function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Doums
        </Link>

        <nav className="hidden items-center gap-1 overflow-x-auto lg:flex">
          {links.map((l) => {
            const active = isNavActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={navLinkClass(active)}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="菜单"
        >
          <span className="text-lg">{open ? "×" : "☰"}</span>
        </button>
      </div>

      {open && (
        <nav className="border-t border-hairline bg-canvas px-4 py-3 lg:hidden">
          {links.map((l) => {
            const active = isNavActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(navLinkClass(active), "mb-1 block last:mb-0")}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
