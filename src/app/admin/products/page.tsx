"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, LoaderCircle, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";

type Category = { id: string; name: string; slug: string };
type Variant = { id?: string; size: string; color: string; stock: number };
type SavedImage = { url: string; publicId: string; isMain: boolean };
type Product = {
  id: string; name: string; description: string; price: string | number; active: boolean; featured: boolean;
  category: Category; variants: Variant[]; images: SavedImage[];
};
type ImageDraft = SavedImage & { file?: File; preview: string };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const blankForm = { name: "", description: "", price: "", categoryId: "", active: true, featured: false };
const toTitleCase = (value: string) => value.toLocaleLowerCase("pt-BR").replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase("pt-BR")}`);

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(blankForm);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/products?limit=100", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
      ]);
      if (!productsResponse.ok || !categoriesResponse.ok) throw new Error("Não foi possível carregar os dados da loja.");
      const [productsData, categoriesData] = await Promise.all([productsResponse.json(), categoriesResponse.json()]);
      setProducts(productsData.products ?? []);
      setCategories(categoriesData.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = `${product.name} ${product.category?.name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? product.active : !product.active);
    return matchesSearch && matchesStatus;
  }), [products, query, statusFilter]);

  function releaseImagePreviews() {
    images.forEach((image) => { if (image.file) URL.revokeObjectURL(image.preview); });
  }

  function openCreate() {
    setEditing(null); setForm({ ...blankForm, categoryId: categories[0]?.id ?? "" });
    setVariants([]); setImages([]); setFormError(""); setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({ name: product.name, description: product.description, price: String(product.price), categoryId: product.category.id, active: product.active, featured: product.featured });
    setVariants(product.variants.map(({ size, color, stock }) => ({ size, color, stock })));
    setImages(product.images.map((image) => ({ ...image, preview: image.url })));
    setFormError(""); setModalOpen(true);
  }

  function closeModal() {
    releaseImagePreviews(); setModalOpen(false); setEditing(null);
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length) {
      setImages((current) => [...current, ...selected.map((file) => ({ url: "", publicId: "", isMain: current.length === 0, file, preview: URL.createObjectURL(file) }))]);
    }
    event.target.value = "";
  }

  function removeImage(index: number) {
    setImages((current) => {
      const removed = current[index];
      if (removed?.file) URL.revokeObjectURL(removed.preview);
      return current.filter((_, imageIndex) => imageIndex !== index).map((image, imageIndex) => ({ ...image, isMain: imageIndex === 0 ? image.isMain || !current.some((item) => item.isMain && item !== removed) : image.isMain }));
    });
  }

  function setMainImage(index: number) {
    setImages((current) => current.map((image, imageIndex) => ({ ...image, isMain: index === imageIndex })));
  }

  function updateVariant(index: number, field: keyof Variant, value: string) {
    const sanitizedValue = field === "stock"
      ? Number(value)
      : field === "size"
        ? value.slice(0, 4).toLocaleUpperCase("pt-BR")
        : toTitleCase(value.slice(0, 20));
    setVariants((current) => current.map((variant, variantIndex) => variantIndex === index ? { ...variant, [field]: sanitizedValue } : variant));
  }

  async function uploadPendingImages(): Promise<SavedImage[]> {
    const pending = images.filter((image) => image.file);
    if (!pending.length) return images.map(({ url, publicId, isMain }) => ({ url, publicId, isMain }));
    const data = new FormData();
    pending.forEach((image) => data.append("images", image.file as File));
    let response: Response;
    try {
      response = await fetch("/api/upload", { method: "POST", body: data });
    } catch {
      throw new Error("Não foi possível conectar ao serviço de upload. Verifique sua conexão e tente novamente.");
    }

    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : `O upload falhou (código ${response.status}).`;
      throw new Error(message);
    }

    const uploadedImages = result && typeof result === "object" && "images" in result && Array.isArray(result.images)
      ? result.images
      : null;
    if (!uploadedImages || uploadedImages.length !== pending.length) {
      throw new Error("O upload não retornou todas as imagens. Confira os arquivos e tente novamente.");
    }
    if (uploadedImages.some((image) => !image || typeof image !== "object" || !("url" in image) || typeof image.url !== "string" || !("publicId" in image) || typeof image.publicId !== "string")) {
      throw new Error("O serviço de upload retornou dados incompletos para uma imagem.");
    }

    let uploadedIndex = 0;
    return images.map((image) => image.file
      ? { url: uploadedImages[uploadedIndex].url as string, publicId: uploadedImages[uploadedIndex++].publicId as string, isMain: image.isMain }
      : { url: image.url, publicId: image.publicId, isMain: image.isMain });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      if (!form.categoryId) throw new Error("Cadastre uma categoria antes de criar produtos.");
      const savedImages = await uploadPendingImages();
      const payload = {
        ...form,
        name: toTitleCase(form.name).slice(0, 60),
        description: form.description.slice(0, 500),
        price: Number(form.price.replace(",", ".")),
        variants: variants.map(({ size, color, stock }) => ({ size: size.trim().slice(0, 4).toLocaleUpperCase("pt-BR"), color: toTitleCase(color.trim().slice(0, 20)), stock: Number(stock) })),
        images: savedImages,
      };
      const response = await fetch(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar o produto.");
      closeModal(); await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível salvar o produto.");
    } finally { setSaving(false); }
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Excluir “${product.name}”? Esta ação não pode ser desfeita.`)) return;
    const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json(); setError(result.error ?? "Não foi possível excluir o produto."); return;
    }
    await loadData();
  }

  const activeCount = products.filter((product) => product.active).length;

  return (
    <div>
      <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#A37B5C]">Seu catálogo</p><h1 className="font-display text-4xl tracking-[-.035em] text-[#2C2623]">Produtos</h1><p className="mt-2 text-sm text-[#70655E]">Organize as peças que compõem a sua coleção.</p></div>
        <button onClick={openCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#8B5E3C] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#765033]"><Plus size={17} /> Novo produto</button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E9DED6] bg-white p-4"><p className="text-xs text-[#8E8177]">Produtos cadastrados</p><p className="mt-1 font-display text-3xl">{products.length}</p></div>
        <div className="rounded-xl border border-[#E9DED6] bg-white p-4"><p className="text-xs text-[#8E8177]">Ativos na loja</p><p className="mt-1 font-display text-3xl">{activeCount}</p></div>
        <div className="rounded-xl border border-[#E9DED6] bg-white p-4"><p className="text-xs text-[#8E8177]">Categorias</p><p className="mt-1 font-display text-3xl">{categories.length}</p></div>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#E9DED6] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#F0E8E2] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative w-full sm:max-w-[320px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1948B]" /><input className="admin-field h-10 pl-9 text-sm" placeholder="Buscar produto..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <select aria-label="Filtrar por status" className="admin-field h-10 w-full text-sm sm:w-[170px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select>
        </div>
        {error && <div className="mx-5 mt-4 rounded-lg bg-[#FBF0ED] px-4 py-3 text-sm text-[#9B493D]">{error}</div>}
        {loading ? <div className="flex h-52 items-center justify-center text-[#9A8B80]"><LoaderCircle className="animate-spin" size={22} /></div> : visibleProducts.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F7F2EE] text-[#A37B5C]"><Package size={23} /></div><h2 className="font-display text-2xl">{products.length ? "Nenhum resultado encontrado" : "Sua coleção começa aqui"}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#81756D]">{products.length ? "Tente outro termo ou ajuste o filtro de status." : "Cadastre o primeiro produto e ele aparecerá no catálogo da loja."}</p>{!products.length && <button onClick={openCreate} className="mt-5 rounded-full bg-[#8B5E3C] px-5 py-2.5 text-sm font-semibold text-white">Adicionar produto</button>}</div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(230px,1.7fr)_1fr_120px_110px_80px] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-[.15em] text-[#A1948B] lg:grid"><span>Produto</span><span>Categoria</span><span>Preço</span><span>Status</span><span className="text-right">Ações</span></div>
            <div className="divide-y divide-[#F0E8E2]">
              {visibleProducts.map((product) => <article key={product.id} className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(230px,1.7fr)_1fr_120px_110px_80px] lg:items-center lg:gap-4">
                <div className="flex min-w-0 items-center gap-3"><div className="h-[68px] w-[58px] shrink-0 overflow-hidden rounded-lg bg-[#F3ECE7]">{product.images[0]?.url && <img src={product.images.find((image) => image.isMain)?.url ?? product.images[0].url} alt={product.name} className="h-full w-full object-cover" />}</div><div className="min-w-0"><h2 className="line-clamp-2 font-display text-xl leading-5">{product.name}</h2><p className="mt-1 text-[11px] text-[#978A80]">{product.variants.length} {product.variants.length === 1 ? "variante" : "variantes"}{product.featured ? " · Destaque" : ""}</p></div></div>
                <p className="text-xs text-[#70655E] lg:text-sm">{product.category?.name ?? "Sem categoria"}</p><p className="text-sm font-semibold text-[#2C2623]">{currency.format(Number(product.price))}</p>
                <span className={`w-fit rounded-full px-3 py-1 text-[10px] font-bold ${product.active ? "bg-[#EAF2E9] text-[#597952]" : "bg-[#F3ECE7] text-[#837468]"}`}>{product.active ? "Ativo" : "Inativo"}</span>
                <div className="flex gap-1 lg:justify-end"><button onClick={() => openEdit(product)} aria-label={`Editar ${product.name}`} className="rounded-full p-2 text-[#81756D] hover:bg-[#F7F2EE] hover:text-[#8B5E3C]"><Pencil size={16} /></button><button onClick={() => void removeProduct(product)} aria-label={`Excluir ${product.name}`} className="rounded-full p-2 text-[#A1948B] hover:bg-[#FBF0ED] hover:text-[#9B493D]"><Trash2 size={16} /></button></div>
              </article>)}
            </div>
          </>
        )}
      </section>

      <AnimatePresence>
      {modalOpen && <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-[#201813]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) closeModal(); }}>
        <motion.section role="dialog" aria-modal="true" aria-labelledby="product-modal-title" className="max-h-[94vh] w-full max-w-[790px] overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F0E8E2] bg-white px-5 py-4 sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[.19em] text-[#A37B5C]">Catálogo</p><h2 id="product-modal-title" className="font-display text-2xl">{editing ? "Editar produto" : "Novo produto"}</h2></div><button type="button" disabled={saving} onClick={closeModal} className="rounded-full p-2 text-[#81756D] hover:bg-[#F7F2EE]" aria-label="Fechar"><X size={19} /></button></div>
          <form onSubmit={saveProduct} className="space-y-7 p-5 sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="admin-label">Nome do produto</span><input className="admin-field font-display text-xl" required maxLength={60} value={form.name} onChange={(event) => setForm({ ...form, name: toTitleCase(event.target.value.slice(0, 60)) })} placeholder="Ex.: Conjunto Serena" /><span className="mt-1 block text-right text-[10px] text-[#9A8B80]">{form.name.length}/60</span></label>
              <label className="sm:col-span-2"><span className="admin-label">Descrição</span><textarea className="admin-field min-h-24 resize-y text-sm leading-6" required maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value.slice(0, 500) })} placeholder="Conte o que torna esta peça especial..." /><span className="mt-1 block text-right text-[10px] text-[#9A8B80]">{form.description.length}/500</span></label>
              <label><span className="admin-label">Preço (R$)</span><input className="admin-field" type="number" min="0" step="0.01" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="0,00" /></label>
              <label><span className="admin-label">Categoria</span><select className="admin-field" required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            </div>

            <div><div className="mb-3 flex items-center justify-between"><div><h3 className="font-display text-xl">Fotos do produto</h3><p className="mt-1 text-xs text-[#81756D]">Escolha a imagem de capa. O envio ocorre ao salvar.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E9DED6] px-4 py-2 text-xs font-semibold text-[#765033] hover:bg-[#FAF7F4]"><ImagePlus size={15} /> Adicionar<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="sr-only" onChange={addFiles} /></label></div>
              {images.length ? <div className="soft-scrollbar flex gap-3 overflow-x-auto pb-2">{images.map((image, index) => <div key={`${image.publicId || image.preview}-${index}`} className="relative h-28 w-24 shrink-0 overflow-hidden rounded-lg bg-[#F3ECE7]"><img src={image.preview} alt={`Imagem ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => setMainImage(index)} className={`absolute bottom-1 left-1 rounded-full px-2 py-1 text-[9px] font-bold ${image.isMain ? "bg-white text-[#8B5E3C]" : "bg-[#2C2623]/70 text-white"}`}>{image.isMain ? "Capa" : "Definir capa"}</button><button type="button" aria-label="Remover imagem" onClick={() => removeImage(index)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-[#6D5142]"><X size={13} /></button></div>)}</div> : <div className="rounded-lg border border-dashed border-[#DCCFC5] px-4 py-6 text-center text-xs text-[#9A8B80]">Ainda não há fotos selecionadas.</div>}
            </div>

            <div><div className="mb-3 flex items-center justify-between"><div><h3 className="font-display text-xl">Tamanhos e cores</h3><p className="mt-1 text-xs text-[#81756D]">Controle o estoque de cada combinação.</p></div><button type="button" onClick={() => setVariants((current) => [...current, { size: "", color: "", stock: 0 }])} className="inline-flex items-center gap-1.5 rounded-full border border-[#E9DED6] px-3 py-2 text-xs font-semibold text-[#765033]"><Plus size={14} /> Variante</button></div>
              <p className="mb-3 rounded-lg bg-[#FAF7F4] px-3 py-2.5 text-xs leading-5 text-[#81756D]">Cada linha representa uma combinação de tamanho e cor. Informe no estoque quantas unidades dessa variante estão disponíveis.</p>
              <div className="space-y-3">{variants.map((variant, index) => <div key={index} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_100px_40px]"><label><span className="admin-label">Tamanho</span><input className="admin-field h-10 text-sm" placeholder="P, M, G, 38, 40" maxLength={4} value={variant.size} onChange={(event) => updateVariant(index, "size", event.target.value)} /></label><label><span className="admin-label">Cor</span><input className="admin-field h-10 text-sm" placeholder="Terracota, Areia, Preto" maxLength={20} value={variant.color} onChange={(event) => updateVariant(index, "color", event.target.value)} /></label><label><span className="admin-label">Estoque</span><input className="admin-field h-10 text-sm" type="number" min="0" step="1" placeholder="0" value={variant.stock} onChange={(event) => updateVariant(index, "stock", event.target.value)} /></label><button type="button" aria-label="Remover variante" onClick={() => setVariants((current) => current.filter((_, variantIndex) => variantIndex !== index))} className="mb-0.5 flex h-10 items-center justify-center rounded-lg text-[#A1948B] hover:bg-[#FBF0ED] hover:text-[#9B493D]"><X size={17} /></button></div>)}</div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl bg-[#FAF7F4] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Visibilidade e destaque</p><p className="mt-1 text-xs text-[#81756D]">Defina como o produto aparece no catálogo.</p></div><div className="flex gap-5"><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="accent-[#8B5E3C]" /> Ativo</label><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} className="accent-[#8B5E3C]" /> Destaque</label></div></div>
            {formError && <p role="alert" className="rounded-lg bg-[#FBF0ED] px-3 py-2.5 text-sm text-[#9B493D]">{formError}</p>}
            <div className="flex flex-col-reverse gap-2 border-t border-[#F0E8E2] pt-4 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={closeModal} className="h-11 rounded-full border border-[#E9DED6] px-5 text-sm font-semibold text-[#70655E]">Cancelar</button><button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#8B5E3C] px-6 text-sm font-semibold text-white hover:bg-[#765033]">{saving && <LoaderCircle size={15} className="animate-spin" />}{saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar produto"}</button></div>
          </form>
        </motion.section>
      </motion.div>}
      </AnimatePresence>
    </div>
  );
}
