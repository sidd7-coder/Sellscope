import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Nav() {
  return (
    <header className="border-b border-surface-border bg-white dark:bg-neutral-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
        >
          <span className="h-7 w-7 shrink-0 rounded-md bg-neutral-900 dark:bg-neutral-100" aria-hidden />
          SELLSCOPE
        </Link>
        <div className="flex items-center gap-3">
          <nav className="flex gap-6 text-sm text-muted-fg">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-accent transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
