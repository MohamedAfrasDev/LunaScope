"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

/** Main-navigation link that marks the current page for sighted and assistive-technology users. */
function Current({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const current = path === href || (href !== "/" && path?.startsWith(`${href}/`));
  return (
    <Link href={href} className="nav-link" aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  // usePathname() reads request data, so it streams in behind a static, fully usable link.
  return (
    <Suspense
      fallback={
        <Link href={href} className="nav-link">
          {children}
        </Link>
      }
    >
      <Current href={href}>{children}</Current>
    </Suspense>
  );
}
