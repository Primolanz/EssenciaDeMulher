"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle, MessageCircle, Plus, Search, X } from "lucide-react";

type Variant = { id: string; size: string; color: string; stock: number; product: { name: string; images: { url: string; isMain: boolean }[] } };
type Item = { id: string; variantId: string; quantity: number; outcome: string; variant: Variant };
type Conditional = { id: string; customerName: string; customerPhone: string; address?: string | null; status: string; dueDate: string; sentAt: string; items: Item[] };
type Product = { id: string; name: string; images: Variant["product"]["images"]; variants: (Variant & { product?: { name: string; images: Variant["product"]["images"] } })[] };

const field = "admin-field h-11 text-sm";
const statusText: Record<string, string> = { IN_TRIAL: "Em prova", COMPLETED: "Finalizado", CANCELED: "Cancelado" };
function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const split = digits.length > 10 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

export default function ConditionalsPage() {
  const [rows, setRows] = useState<Conditional[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [settle, setSettle] = useState<Conditional | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ customerName: "", customerPhone: "", address: "", dueDate: "" });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [productSearch, setProductSearch] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([fetch("/api/conditionals", { cache: "no-store" }), fetch("/api/products?limit=100", { cache: "no-store" })]);
      const [data, products] = await Promise.all([a.json(), b.json()]);
      if (!a.ok || !b.ok) throw new Error("Não foi possível carregar as provas.");
      setRows(data.conditionals ?? []);
      setVariants((products.products as Product[]).flatMap((product) => product.variants.map((variant) => ({ ...variant, product: { name: product.name, images: product.images ?? [] } }))));
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const active = useMemo(() => rows.filter((item) => item.status === "IN_TRIAL"), [rows]);
  const productsWithStock = useMemo(() => {
    const grouped = new Map<string, { name: string; images: Variant["product"]["images"]; variants: Variant[] }>();
    variants.filter((variant) => variant.stock > 0).forEach((variant) => {
      const key = variant.product.name;
      const product = grouped.get(key) ?? { name: key, images: variant.product.images, variants: [] };
      product.variants.push(variant);
      grouped.set(key, product);
    });
    return [...grouped.entries()].map(([name, product]) => ({ id: name, ...product })).filter((product) => product.name.toLocaleLowerCase("pt-BR").includes(productSearch.trim().toLocaleLowerCase("pt-BR")));
  }, [variants, productSearch]);
  const selectedVariants = variants.filter((variant) => (quantities[variant.id] ?? 0) > 0);
  const todayValue = new Date();
  const today = `${todayValue.getFullYear()}-${String(todayValue.getMonth() + 1).padStart(2, "0")}-${String(todayValue.getDate()).padStart(2, "0")}`;
  function setQuantity(variant: Variant, value: number) {
    setQuantities((current) => ({ ...current, [variant.id]: Math.max(0, Math.min(variant.stock, value)) }));
  }
  async function create(event: FormEvent) {
    event.preventDefault(); setError("");
    if (draft.customerPhone.replace(/\D/g, "").length < 10) { setError("Informe um WhatsApp com pelo menos 10 dígitos."); return; }
    setSaving(true);
    try {
      const items = Object.entries(quantities).filter(([, q]) => q > 0).map(([variantId, quantity]) => ({ variantId, quantity }));
      const response = await fetch("/api/conditionals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, items }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCreateOpen(false); setDraft({ customerName: "", customerPhone: "", address: "", dueDate: "" }); setQuantities({}); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  async function finish(action: "CLOSE" | "CANCEL") {
    if (!settle) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/conditionals/${settle.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, outcomes: settle.items.map((item) => ({ itemId: item.id, outcome: outcomes[item.id] })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSettle(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível encerrar."); }
    finally { setSaving(false); }
  }
  function whatsapp(row: Conditional) {
    const pieces = row.items.map((item) => `• ${item.quantity}x ${item.variant.product.name} — ${item.variant.size} / ${item.variant.color}`).join("\n");
    const text = `Olá, ${row.customerName}! Tudo bem? Passando para falar sobre suas peças da prova em casa:\n${pieces}\n\nComo ficou a sua escolha?`;
    window.open(`https://wa.me/${row.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
  const todayDate = new Date(`${today}T00:00:00`);

  return <div>
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#A37B5C]">Atendimento especial</p><h1 className="font-display text-4xl tracking-[-.035em] text-[#2C2623]">Prova em Casa</h1><p className="mt-2 text-sm text-[#70655E]">Acompanhe as peças enviadas e registre o acerto de cada cliente.</p></div><button onClick={() => { setError(""); setCreateOpen(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#8B5E3C] px-5 text-sm font-semibold text-white"><Plus size={17} /> Nova prova</button></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#E9DED6] bg-white p-4"><p className="text-xs text-[#8E8177]">Clientes com peças em casa</p><p className="mt-1 font-display text-3xl">{active.length}</p></div><div className="rounded-xl border border-[#E9DED6] bg-white p-4"><p className="text-xs text-[#8E8177]">Total histórico de provas</p><p className="mt-1 font-display text-3xl">{rows.length}</p></div></div>
    {error && !createOpen && !settle && <p className="mb-4 rounded-lg bg-[#FBF0ED] px-4 py-3 text-sm text-[#9B493D]">{error}</p>}
    <section className="overflow-hidden rounded-xl border border-[#E9DED6] bg-white"><div className="border-b border-[#F0E8E2] px-5 py-4"><h2 className="font-display text-xl">Provas registradas</h2></div>{loading ? <div className="flex h-40 items-center justify-center text-[#9A8B80]"><LoaderCircle className="animate-spin" size={22} /></div> : rows.length ? <div className="divide-y divide-[#F0E8E2]">{rows.map((row) => {
      const late = row.status === "IN_TRIAL" && new Date(row.dueDate) < todayDate;
      return <article key={row.id} className="p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl">{row.customerName}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${late ? "bg-[#FBF0ED] text-[#A23F35]" : row.status === "IN_TRIAL" ? "bg-[#FAF3EA] text-[#8B5E3C]" : "bg-[#F3F0ED] text-[#70655E]"}`}>{late ? "Atrasado" : statusText[row.status]}{row.status === "IN_TRIAL" ? ` · retorno ${new Date(row.dueDate).toLocaleDateString("pt-BR")}` : ""}</span></div><p className="mt-1 text-xs text-[#81756D]">WhatsApp: {row.customerPhone}{row.address ? ` · ${row.address}` : ""}</p></div><div className="flex flex-wrap gap-2">{row.status === "IN_TRIAL" && <button onClick={() => whatsapp(row)} className="inline-flex h-9 items-center gap-2 rounded-full border border-[#E9DED6] px-3 text-xs font-semibold text-[#765033]"><MessageCircle size={14} /> Cobrar / Falar</button>}{row.status === "IN_TRIAL" && <button onClick={() => { setSettle(row); setOutcomes(Object.fromEntries(row.items.map((i) => [i.id, "RETURNED"]))); }} className="h-9 rounded-full bg-[#8B5E3C] px-4 text-xs font-semibold text-white">Dar baixa / Acerto</button>}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{row.items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg bg-[#FAF7F4] p-2.5"><div className="h-12 w-10 overflow-hidden rounded bg-[#F3ECE7]">{item.variant.product.images[0]?.url && <img src={item.variant.product.images.find((image) => image.isMain)?.url ?? item.variant.product.images[0].url} className="h-full w-full object-cover" alt="" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.quantity}x {item.variant.product.name}</p><p className="text-[10px] text-[#81756D]">{item.variant.size} · {item.variant.color}</p></div>{item.outcome !== "PENDING" && <span className="text-[10px] font-bold text-[#8B5E3C]">{item.outcome === "PURCHASED" ? "[Comprou]" : "[Devolveu]"}</span>}</div>)}</div></article>;
    })}</div> : <p className="px-5 py-12 text-center text-sm text-[#81756D]">Nenhuma prova em casa registrada.</p>}</section>

    <AnimatePresence>{(createOpen || settle) && <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-[#201813]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) { setCreateOpen(false); setSettle(null); } }}><motion.section role="dialog" aria-modal="true" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl sm:p-7" initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}><header className="mb-5 flex items-center justify-between"><h2 className="font-display text-2xl">{settle ? "Dar baixa / Acerto" : "Nova prova em casa"}</h2><button onClick={() => { setCreateOpen(false); setSettle(null); }} aria-label="Fechar" className="rounded-full p-2 hover:bg-[#F7F2EE]"><X size={18} /></button></header>
      {error && <p className="mb-4 rounded-lg bg-[#FBF0ED] px-4 py-3 text-sm text-[#9B493D]">{error}</p>}
      {settle ? <><p className="mb-4 text-sm text-[#70655E]">Defina o destino de cada peça de {settle.customerName}.</p><div className="space-y-3">{settle.items.map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 rounded-lg bg-[#FAF7F4] p-3 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">{item.quantity}x {item.variant.product.name}</p><p className="text-xs text-[#81756D]">{item.variant.size} · {item.variant.color}</p></div><div className="flex gap-2">{[["RETURNED", "Devolveu"], ["PURCHASED", "Comprou"]].map(([value, label]) => <button key={value} onClick={() => setOutcomes({ ...outcomes, [item.id]: value })} className={`rounded-full border px-3 py-2 text-xs font-semibold ${outcomes[item.id] === value ? "border-[#8B5E3C] bg-[#8B5E3C] text-white" : "border-[#E9DED6] text-[#70655E]"}`}>{label}</button>)}</div></div>)}</div><div className="mt-6 flex flex-col-reverse justify-between gap-2 sm:flex-row"><button onClick={() => void finish("CANCEL")} disabled={saving} className="h-11 rounded-full border border-[#E9DED6] px-5 text-sm font-semibold text-[#70655E]">Cancelar prova</button><button onClick={() => void finish("CLOSE")} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#8B5E3C] px-5 text-sm font-semibold text-white">{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} Salvar acerto</button></div></> : <form onSubmit={create} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label><span className="admin-label">Nome da cliente</span><input required className={field} value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} /></label><label><span className="admin-label">WhatsApp</span><input required type="tel" inputMode="numeric" maxLength={15} className={field} value={draft.customerPhone} onChange={(e) => setDraft({ ...draft, customerPhone: formatPhone(e.target.value) })} /></label><label className="sm:col-span-2"><span className="admin-label">Endereço (opcional)</span><input className={field} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></label><label className="sm:col-span-2"><span className="admin-label">Data prevista de retorno</span><input required type="date" min={today} className={field} value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></label></div><div><span className="admin-label">Peças e quantidades</span><div className="relative mt-2"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A8B80]" /><input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar produto pelo nome" className="admin-field h-10 pl-9 text-sm" /></div><div className="mt-2 max-h-64 space-y-2 overflow-y-auto">{productsWithStock.map((product) => <div key={product.id} className="overflow-hidden rounded-lg border border-[#F0E8E2]"><button type="button" onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)} className="flex w-full min-w-0 items-center gap-3 p-3 text-left hover:bg-[#FAF7F4]"><span className="h-12 w-10 shrink-0 overflow-hidden rounded bg-[#F3ECE7]">{product.images[0]?.url && <img src={product.images.find((image) => image.isMain)?.url ?? product.images[0].url} className="h-full w-full object-cover" alt="" />}</span><span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold">{product.name}</span><span className="shrink-0 rounded-full bg-[#F3ECE7] px-2 py-1 text-[10px] font-semibold text-[#765033]">{product.variants.length} variações</span></button>{expandedProduct === product.id && <div className="space-y-2 border-t border-[#F0E8E2] bg-[#FFFEFC] p-2">{product.variants.map((variant) => <div key={variant.id} className="flex min-w-0 items-center gap-2 rounded-md bg-[#FAF7F4] px-2 py-2"><span className="min-w-0 flex-1 truncate text-xs font-medium">{variant.size} <span className="text-[#A1948B]">·</span> {variant.color}</span><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-[#765033]">Disp.: {variant.stock}</span><div className="flex h-8 w-24 shrink-0 items-center justify-between rounded-md border border-[#E9DED6] bg-white"><button type="button" onClick={() => setQuantity(variant, (quantities[variant.id] ?? 0) - 1)} disabled={!quantities[variant.id]} className="h-full w-7 text-[#8B5E3C] disabled:text-[#C9BDB4]">-</button><span className="w-8 text-center text-xs font-semibold">{quantities[variant.id] ?? 0}</span><button type="button" onClick={() => setQuantity(variant, (quantities[variant.id] ?? 0) + 1)} disabled={(quantities[variant.id] ?? 0) >= variant.stock} className="h-full w-7 text-[#8B5E3C] disabled:text-[#C9BDB4]">+</button></div></div>)}</div>}</div>)}</div>{selectedVariants.length > 0 && <div className="mt-3 rounded-lg bg-[#FAF7F4] p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8B5E3C]">Peças selecionadas</p><div className="space-y-1">{selectedVariants.map((variant) => <div key={variant.id} className="flex min-w-0 items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{quantities[variant.id]}x {variant.product.name} · {variant.size} / {variant.color}</span><button type="button" onClick={() => setQuantity(variant, 0)} aria-label={`Remover ${variant.product.name} ${variant.size}`} className="shrink-0 rounded-full p-1 text-[#9A8B80] hover:bg-white hover:text-[#9B493D]"><X size={13} /></button></div>)}</div></div>}</div><button disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#8B5E3C] text-sm font-semibold text-white">{saving && <LoaderCircle size={15} className="animate-spin" />} Registrar prova</button></form>}
    </motion.section></motion.div>}</AnimatePresence>
  </div>;
}


