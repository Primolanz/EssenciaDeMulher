"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, Pencil, Plus, Tags, Trash2, X } from "lucide-react";

type Category = { id: string; name: string; slug: string; createdAt: string; _count?: { products: number } };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCategories() {
    setLoading(true);
    try {
      const response = await fetch("/api/categories", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar as categorias.");
      setCategories(result.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as categorias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCategories(); }, []);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível criar a categoria.");
      setName(""); setSuccess(`Categoria “${result.category.name}” criada.`); await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a categoria.");
    } finally { setSaving(false); }
  }

  async function updateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCategory) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/categories/${editingCategory.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível atualizar a categoria.");
      setEditingCategory(null); setName(""); setSuccess(`Categoria “${result.category.name}” atualizada.`); await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a categoria.");
    } finally { setSaving(false); }
  }

  function startEditing(category: Category) {
    setEditingCategory(category); setName(category.name); setError(""); setSuccess("");
  }

  function cancelEditing() {
    setEditingCategory(null); setName(""); setError("");
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Excluir a categoria “${category.name}”?`)) return;
    setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível excluir a categoria.");
      if (editingCategory?.id === category.id) cancelEditing();
      setSuccess(`Categoria “${category.name}” excluída.`); await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a categoria.");
    }
  }

  return (
    <div>
      <div className="mb-7"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#A37B5C]">Organização</p><h1 className="font-display text-4xl tracking-[-.035em]">Categorias</h1><p className="mt-2 text-sm text-[#70655E]">Agrupe suas peças para facilitar a descoberta.</p></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,.75fr)_minmax(0,1.25fr)]">
        <section className="h-fit rounded-xl border border-[#E9DED6] bg-white p-5 sm:p-6">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#F3ECE7] text-[#8B5E3C]"><Plus size={20} /></div>
          <h2 className="font-display text-2xl">Nova categoria</h2>
          <p className="mt-1 text-xs leading-5 text-[#81756D]">O endereço da categoria é criado automaticamente a partir do nome.</p>
          <form onSubmit={createCategory} className="mt-6">
            <label className="mb-5 block"><span className="admin-label">Nome</span><input className="admin-field" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Conjuntos" /></label>
            {error && !editingCategory && <p role="alert" className="mb-4 rounded-lg bg-[#FBF0ED] px-3 py-2.5 text-sm text-[#9B493D]">{error}</p>}
            {success && <p className="mb-4 rounded-lg bg-[#EAF2E9] px-3 py-2.5 text-sm text-[#597952]">{success}</p>}
            <button type="submit" disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#8B5E3C] px-5 text-sm font-semibold text-white hover:bg-[#765033]">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}{saving ? "Criando…" : "Criar categoria"}</button>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#E9DED6] bg-white">
          <div className="flex items-center justify-between border-b border-[#F0E8E2] px-5 py-4"><div><h2 className="font-display text-2xl">Categorias da loja</h2><p className="mt-1 text-xs text-[#81756D]">{categories.length} {categories.length === 1 ? "categoria cadastrada" : "categorias cadastradas"}</p></div><Tags className="text-[#A37B5C]" size={20} /></div>
          {error && !editingCategory && <p role="alert" className="mx-5 mt-4 rounded-lg bg-[#FBF0ED] px-3 py-2.5 text-sm text-[#9B493D]">{error}</p>}
          {loading ? <div className="flex h-48 items-center justify-center text-[#9A8B80]"><LoaderCircle size={21} className="animate-spin" /></div> : categories.length ? <div className="divide-y divide-[#F0E8E2]">{categories.map((category) => <div key={category.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><h3 className="font-display text-xl">{category.name}</h3><p className="mt-1 text-xs text-[#9A8B80]">/{category.slug}</p></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-[#F7F2EE] px-3 py-1.5 text-[10px] font-semibold text-[#75675C]">{category._count?.products ?? 0} produtos</span><button onClick={() => startEditing(category)} aria-label={`Editar ${category.name}`} className="rounded-full p-2 text-[#81756D] hover:bg-[#F7F2EE] hover:text-[#8B5E3C]"><Pencil size={15} /></button><button onClick={() => void deleteCategory(category)} aria-label={`Excluir ${category.name}`} className="rounded-full p-2 text-[#A1948B] hover:bg-[#FBF0ED] hover:text-[#9B493D] "><Trash2 size={15} /></button></div></div>)}</div> : <div className="px-5 py-14 text-center"><p className="font-display text-xl">Nenhuma categoria ainda</p><p className="mt-1 text-xs text-[#81756D]">Crie uma categoria para organizar seus produtos.</p></div>}
        </section>
      </div>

      <AnimatePresence>
        {editingCategory && <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#201813]/50 p-4 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) cancelEditing(); }}>
          <motion.section role="dialog" aria-modal="true" aria-labelledby="edit-category-title" className="w-full max-w-[440px] rounded-2xl border border-[#F0E8E2] bg-white p-6 shadow-[0_28px_90px_rgba(32,24,19,.22)] sm:p-8" initial={{ opacity: 0, scale: 0.94, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}>
            <div className="mb-6 flex items-start justify-between"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.2em] text-[#A37B5C]">Categorias</p><h2 id="edit-category-title" className="font-display text-3xl">Editar categoria</h2><p className="mt-2 text-xs text-[#81756D]">O endereço será atualizado junto com o nome.</p></div><button type="button" disabled={saving} onClick={cancelEditing} aria-label="Fechar" className="rounded-full p-2 text-[#70655E] hover:bg-[#F7F2EE]"><X size={18} /></button></div>
            <form onSubmit={updateCategory}>
              <label className="mb-5 block"><span className="admin-label">Nome da categoria</span><input className="admin-field" autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Conjuntos" /></label>
              {error && <p role="alert" className="mb-4 rounded-lg bg-[#FBF0ED] px-3 py-2.5 text-sm text-[#9B493D]">{error}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={cancelEditing} className="h-11 rounded-full border border-[#E9DED6] px-5 text-sm font-semibold text-[#70655E] hover:bg-[#FAF7F4]">Cancelar</button><button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#8B5E3C] px-5 text-sm font-semibold text-white hover:bg-[#765033]">{saving && <LoaderCircle size={15} className="animate-spin" />}{saving ? "Salvando…" : "Salvar alterações"}</button></div>
            </form>
          </motion.section>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}
