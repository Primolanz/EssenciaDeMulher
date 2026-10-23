"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível entrar.");
      router.replace("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3ECE7] px-4 py-10">
      <section className="w-full max-w-[450px] rounded-xl border border-[#F0E8E2] bg-white px-7 py-9 shadow-[0_24px_80px_rgba(65,45,32,.08)] sm:px-12 sm:py-12">
        <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-medium text-[#8B7B70] transition hover:text-[#8B5E3C]"><ArrowLeft size={14} /> Voltar para a loja</Link>
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full bg-[#F3ECE7] text-[#8B5E3C]"><LockKeyhole size={20} strokeWidth={1.6} /></div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.24em] text-[#A37B5C]">Área restrita</p>
        <h1 className="font-display text-[42px] leading-[.98] tracking-[-.035em] text-[#2C2623]">Acesso Administrativo</h1>
        <p className="mt-4 text-sm leading-6 text-[#70655E]">Entre com as credenciais da sua loja para continuar.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block"><span className="admin-label">E-mail</span><input className="admin-field" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" /></label>
          <label className="block"><span className="admin-label">Senha</span><span className="relative block"><input className="admin-field pr-12" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9A8B80]" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          {error && <p role="alert" className="rounded-lg bg-[#FBF0ED] px-3 py-2.5 text-sm text-[#9B493D]">{error}</p>}
          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center rounded-full bg-[#8B5E3C] px-5 text-sm font-semibold text-white transition hover:bg-[#765033]">{loading ? "Entrando…" : "Entrar"}</button>
        </form>
        <p className="mt-8 border-t border-[#F0E8E2] pt-5 text-center text-[11px] text-[#A1948B]">Essência de Mulher · Painel seguro</p>
      </section>
    </main>
  );
}
