"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, LogOut, Menu, Package, Tags, X } from "lucide-react";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname === "/admin/login") return <>{children}</>;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const links = [
    { href: "/admin/products", label: "Produtos", icon: Package },
    { href: "/admin/categories", label: "Categorias", icon: Tags },
  ];

  return (
    <div className="min-h-screen bg-[#F3ECE7]">
      <header className="sticky top-0 z-30 border-b border-[#E9DED6] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 md:px-10">
          <Link href="/admin/products" className="font-display text-[27px] leading-none tracking-[-.04em] text-[#2C2623]">
            Essência <span className="text-[#A37B5C]">de Mulher</span>
            <span className="mt-1 block font-sans text-[9px] font-semibold uppercase tracking-[.25em] text-[#9A8B80]">Painel administrativo</span>
          </Link>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/" target="_blank" className="inline-flex h-10 items-center gap-2 rounded-full border border-[#E9DED6] px-4 text-xs font-semibold text-[#5F534B] transition hover:border-[#A37B5C] hover:text-[#8B5E3C]">
              Ver loja <ArrowUpRight size={15} />
            </Link>
            <button onClick={logout} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#2C2623] px-4 text-xs font-semibold text-white transition hover:bg-[#8B5E3C]">
              <LogOut size={15} /> Sair
            </button>
          </div>
          <button onClick={() => setMenuOpen((open) => !open)} className="rounded-full p-2 text-[#2C2623] md:hidden" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-7 px-4 py-6 md:grid-cols-[228px_minmax(0,1fr)] md:px-10 md:py-10">
        <aside className={`${menuOpen ? "block" : "hidden"} md:block`}>
          <nav className="rounded-xl border border-[#E9DED6] bg-white p-2 md:sticky md:top-[100px]">
            <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#9A8B80]">Gestão da loja</p>
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${active ? "bg-[#F3ECE7] text-[#8B5E3C]" : "text-[#70655E] hover:bg-[#FAF7F4] hover:text-[#2C2623]"}`}>
                  <Icon size={17} strokeWidth={1.8} /> {label}
                </Link>
              );
            })}
            <div className="mt-3 border-t border-[#F0E8E2] pt-3 md:hidden">
              <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-[#70655E]"><ArrowUpRight size={17} /> Ver loja</Link>
              <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-[#70655E]"><LogOut size={17} /> Sair</button>
            </div>
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
