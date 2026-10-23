"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Heart, Search, ShoppingBag, SlidersHorizontal, Sparkles, User, X } from "lucide-react";
import { CartDrawer, type CartItem } from "../components/CartDrawer";

type Category = { id: string; name: string; slug: string };
type Variant = { id: string; size: string; color: string; stock: number };
type Product = {
  id: string; name: string; description: string; price: string | number; active: boolean; featured: boolean;
  category: Category; variants: Variant[]; images: { id: string; url: string; publicId: string; isMain: boolean }[];
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const productGridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.075 } },
};
const productCardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" } },
};

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = [...product.images].sort((a, b) => Number(b.isMain) - Number(a.isMain));
  const currentImage = images[imageIndex]?.url;

  function changeImage(direction: number) {
    setImageIndex((current) => (current + direction + images.length) % images.length);
  }

  return (
    <motion.article variants={productCardVariants} whileHover={{ y: -4 }} transition={{ duration: 0.22 }} className="group min-w-0 rounded-lg transition-shadow duration-300 hover:shadow-[0_12px_32px_rgba(44,38,35,.09)]">
      <div className="relative aspect-[.76] overflow-hidden rounded-lg bg-[#F3ECE7]">
        <button onClick={() => onAdd(product)} className="absolute inset-0 z-[1]" aria-label={`Ver opções de ${product.name}`} />
        {currentImage && <img src={currentImage} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />}
        <span className="absolute left-2 top-2 z-[2] rounded-full border border-[#E9D9CC] bg-[#F3ECE7]/95 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.1em] text-[#765033] sm:left-3 sm:top-3 sm:text-[9px]">Novidade</span>
        {images.length > 1 && <>
          <button type="button" onClick={(event) => { event.stopPropagation(); changeImage(-1); }} className="absolute left-2 top-1/2 z-[3] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#2C2623] opacity-100 shadow-sm transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Foto anterior de ${product.name}`}><ArrowLeft size={15} /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); changeImage(1); }} className="absolute right-2 top-1/2 z-[3] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#2C2623] opacity-100 shadow-sm transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Próxima foto de ${product.name}`}><ArrowRight size={15} /></button>
          <div className="absolute bottom-3 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-1.5" aria-label={`Foto ${imageIndex + 1} de ${images.length}`}>
            {images.map((image, index) => <button key={image.id} type="button" onClick={(event) => { event.stopPropagation(); setImageIndex(index); }} className={`h-1.5 rounded-full shadow-sm transition-all ${index === imageIndex ? "w-4 bg-white" : "w-1.5 bg-white/65"}`} aria-label={`Ver foto ${index + 1}`} />)}
          </div>
        </>}
        <button onClick={() => onAdd(product)} className="absolute bottom-2 right-2 z-[2] flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2C2623] shadow-sm transition hover:bg-[#8B5E3C] hover:text-white sm:bottom-3 sm:right-3" aria-label={`Adicionar ${product.name} à sacola`}><ShoppingBag size={16} strokeWidth={1.7} /></button>
      </div>
      <div className="pt-3 sm:pt-4"><p className="text-[9px] font-semibold uppercase tracking-[.15em] text-[#A37B5C]">{product.category?.name}</p><h3 className="mt-1 line-clamp-2 font-display text-lg leading-5 sm:text-[22px]">{product.name}</h3><div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs font-semibold sm:text-sm">{currency.format(Number(product.price))}</span></div></div>
    </motion.article>
  );
}

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [chosenProduct, setChosenProduct] = useState<Product | null>(null);
  const [chosenVariant, setChosenVariant] = useState("");
  const [quickError, setQuickError] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("essencia-cart-v1");
      if (saved) setCartItems(JSON.parse(saved) as CartItem[]);
    } catch { localStorage.removeItem("essencia-cart-v1"); }
    finally { setCartReady(true); }
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    localStorage.setItem("essencia-cart-v1", JSON.stringify(cartItems));
  }, [cartItems, cartReady]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setLoadError(false);
      const params = new URLSearchParams({ limit: "100" });
      if (activeCategory) params.set("category", activeCategory);
      if (search.trim()) params.set("search", search.trim());
      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          fetch(`/api/products?${params.toString()}`, { cache: "no-store", signal: controller.signal }),
          fetch("/api/categories", { cache: "no-store", signal: controller.signal }),
        ]);
        if (!productsResponse.ok || !categoriesResponse.ok) throw new Error("Catalog unavailable");
        const [productsData, categoriesData] = await Promise.all([productsResponse.json(), categoriesResponse.json()]);
        if (!cancelled) { setProducts(productsData.products ?? []); setCategories(categoriesData.categories ?? []); }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) setLoadError(true);
      } finally { if (!cancelled) setLoading(false); }
    }, search ? 180 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [activeCategory, search]);

  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);

  function openQuickAdd(product: Product) {
    setChosenProduct(product); setChosenVariant(""); setQuickError("");
  }

  function addToCart() {
    if (!chosenProduct) return;
    const variant = chosenProduct.variants.find((item) => item.id === chosenVariant);
    if (chosenProduct.variants.length && !variant) { setQuickError("Escolha tamanho e cor antes de continuar."); return; }
    const image = chosenProduct.images.find((item) => item.isMain)?.url ?? chosenProduct.images[0]?.url ?? "";
    const key = `${chosenProduct.id}:${variant?.id ?? "default"}`;
    setCartItems((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { key, productId: chosenProduct.id, name: chosenProduct.name, price: Number(chosenProduct.price), image, size: variant?.size, color: variant?.color, quantity: 1 }];
    });
    setChosenProduct(null); setCartOpen(true);
  }

  function changeQuantity(key: string, quantity: number) {
    setCartItems((current) => quantity < 1 ? current.filter((item) => item.key !== key) : current.map((item) => item.key === key ? { ...item, quantity } : item));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); document.getElementById("colecao")?.scrollIntoView({ behavior: "smooth" }); }

  return (
    <main className="min-h-screen bg-[#F3ECE7] text-[#2C2623]">
      <div className="flex min-h-9 items-center justify-center bg-[#A37B5C] px-4 text-center text-[9px] font-semibold uppercase tracking-[.14em] text-white sm:text-[10px] sm:tracking-[.2em]">Novidades novas sempre chegando</div>
      <header className="sticky top-0 z-40 border-b border-[#E9DED6] bg-[#FFFEFC]/95 backdrop-blur-md">
        <div className="mx-auto grid h-[74px] max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-8 lg:h-[88px] lg:px-12">
          <nav className="hidden items-center gap-6 text-[10px] font-semibold uppercase tracking-[.13em] text-[#70655E] lg:flex"><a href="#colecao" className="transition hover:text-[#8B5E3C]">Coleção</a><a href="#manifesto" className="transition hover:text-[#8B5E3C]">Nossa essência</a></nav>
          <a href="#topo" className="col-start-2 text-center font-display text-[25px] leading-[.84] tracking-[-.055em] sm:text-[29px] lg:text-[34px]">Essência <span className="text-[#A37B5C]">de Mulher</span><span className="mt-1.5 block font-sans text-[7px] font-semibold uppercase tracking-[.3em] text-[#9A8B80] sm:text-[8px]">Vista o que faz sentido</span></a>
          <div className="col-start-3 flex items-center justify-end gap-1 sm:gap-3"><form onSubmit={handleSearch} className="hidden items-center border-b border-[#DCCFC5] lg:flex"><input aria-label="Buscar produtos" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" className="w-28 bg-transparent py-2 text-xs outline-none placeholder:text-[#A1948B]" /><button aria-label="Buscar"><Search size={16} className="text-[#70655E]" /></button></form><a href="/admin" className="flex h-10 w-10 items-center justify-center rounded-full text-[#70655E] transition hover:bg-[#F3ECE7] hover:text-[#8B5E3C]" aria-label="Área administrativa" title="Área administrativa"><User size={18} strokeWidth={1.5} /></a><button onClick={() => setCartOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-[#F3ECE7]" aria-label={`Abrir sacola, ${cartCount} itens`}><ShoppingBag size={19} strokeWidth={1.5} />{cartCount > 0 && <span className="absolute right-0 top-0 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#8B5E3C] px-1 text-[9px] font-bold text-white">{cartCount}</span>}</button></div>
        </div>
      </header>

      <section id="topo" className="hero-image relative flex min-h-[540px] items-center bg-cover bg-[center_42%] px-6 py-16 text-white sm:min-h-[620px] sm:px-12 lg:min-h-[680px] lg:px-[10%]">
        <div className="relative z-10 max-w-[620px] py-8"><p className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.25em] text-[#F4E4D8]"><Sparkles size={14} /> Movimento com intenção</p><h1 className="font-display text-[58px] leading-[.91] tracking-[-.045em] sm:text-[76px] lg:text-[94px]">Vista a sua <em className="font-normal text-[#E8CDB9]">essência.</em></h1><p className="mt-6 max-w-[380px] text-sm leading-6 text-white/85 sm:text-base sm:leading-7">Peças que acompanham o seu ritmo e lembram você de se sentir bem, em cada movimento.</p><a href="#colecao" style={{ backgroundColor: "#8B5E3C", color: "#FFFFFF" }} className="mt-8 inline-flex h-12 items-center gap-3 rounded-full px-6 text-[11px] font-bold uppercase tracking-[.14em] shadow-sm transition hover:brightness-95">Conheça nossa coleção <ArrowRight size={16} /></a></div>
        <div className="absolute bottom-6 right-6 hidden items-center gap-2 text-[9px] uppercase tracking-[.2em] text-white/75 sm:flex lg:right-12"><span className="h-px w-8 bg-white/60" />Essência em movimento</div>
      </section>

      <section id="manifesto" className="mx-auto grid max-w-[1440px] gap-5 px-5 py-12 sm:grid-cols-3 sm:gap-8 sm:px-10 sm:py-16 lg:px-16">
        {[{ n: "01", title: "Conforto que acompanha", text: "Liberdade para ser você, em todos os momentos." }, { n: "02", title: "Detalhes com intenção", text: "Escolhas cuidadosas, do toque ao caimento." }, { n: "03", title: "O seu ritmo, sempre", text: "Uma coleção para se mover com confiança." }].map((item) => <article key={item.n} className="flex gap-4 border-b border-[#DCCFC5] pb-5 sm:block sm:border-b-0 sm:pb-0"><span className="font-display text-xl italic text-[#A37B5C]">{item.n}</span><div><h2 className="font-display text-xl sm:mt-3 sm:text-2xl">{item.title}</h2><p className="mt-1.5 max-w-[255px] text-xs leading-5 text-[#81756D]">{item.text}</p></div></article>)}
      </section>

      <section id="colecao" className="bg-[#FFFEFC] px-4 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16 lg:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.22em] text-[#A37B5C]">Feita para você</p><h2 className="font-display text-[38px] leading-none tracking-[-.035em] sm:text-5xl">Escolhas da coleção</h2></div><p className="max-w-[350px] text-xs leading-5 text-[#81756D]">Peças para vestir sua rotina de conforto, leveza e autenticidade.</p></div>
          <div className="soft-scrollbar -mx-1 mt-7 flex gap-2 overflow-x-auto px-1 pb-2"><button onClick={() => setActiveCategory("")} className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-semibold transition ${!activeCategory ? "border-[#2C2623] bg-[#2C2623] text-white" : "border-[#E4D8CE] text-[#70655E] hover:border-[#A37B5C]"}`}>Todas as peças</button>{categories.map((category) => <button key={category.id} onClick={() => setActiveCategory(category.slug)} className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-semibold transition ${activeCategory === category.slug ? "border-[#2C2623] bg-[#2C2623] text-white" : "border-[#E4D8CE] text-[#70655E] hover:border-[#A37B5C]"}`}>{category.name}</button>)}</div>
          <form onSubmit={handleSearch} className="mt-4 flex items-center gap-2 rounded-lg border border-[#E9DED6] px-3 lg:hidden"><Search size={16} className="text-[#9A8B80]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na coleção" className="h-10 min-w-0 flex-1 bg-transparent text-xs outline-none" /><SlidersHorizontal size={15} className="text-[#9A8B80]" /></form>

          {loadError ? <div className="mt-10 rounded-xl bg-[#F7F2EE] px-6 py-12 text-center"><p className="font-display text-2xl">Não foi possível carregar a coleção</p><p className="mt-2 text-xs text-[#81756D]">Tente novamente em instantes.</p><button onClick={() => setSearch((value) => `${value} `)} className="mt-5 rounded-full border border-[#DCCFC5] px-4 py-2 text-xs font-semibold">Tentar novamente</button></div> : loading ? <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="animate-pulse"><div className="aspect-[.76] rounded-lg bg-[#F3ECE7]" /><div className="mt-3 h-3 w-2/3 rounded bg-[#F3ECE7]" /><div className="mt-2 h-3 w-1/3 rounded bg-[#F3ECE7]" /></div>)}</div> : products.length ? <AnimatePresence mode="wait"><motion.div key={activeCategory + ":" + search} variants={productGridVariants} initial="hidden" animate="visible" exit={{ opacity: 0, y: 8 }} className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4 lg:gap-x-6">{products.map((product) => <ProductCard key={product.id} product={product} onAdd={openQuickAdd} />)}</motion.div></AnimatePresence> : <div className="mt-8 rounded-xl bg-[#F7F2EE] px-6 py-16 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#A37B5C]"><Heart size={19} /></div><h3 className="font-display text-2xl">Novidades chegando para você</h3><p className="mt-2 text-xs text-[#81756D]">Ainda não há produtos nesta seleção. Volte em breve para conhecer a coleção.</p>{activeCategory && <button onClick={() => setActiveCategory("")} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#8B5E3C]">Ver todas as peças <ArrowRight size={14} /></button>}</div>}
        </div>
      </section>

      <footer className="bg-[#2C2623] px-5 py-12 text-white sm:px-10 sm:py-16"><div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-8 sm:flex-row sm:items-end"><div><a href="#topo" className="font-display text-3xl tracking-[-.04em]">Essência <span className="text-[#C49A78]">de Mulher</span></a><p className="mt-3 max-w-[340px] text-xs leading-5 text-white/55">Vista o que faz sentido. Sinta-se em casa na sua própria essência.</p><a href="/admin" className="mt-4 inline-block text-[10px] uppercase tracking-[.14em] text-white/45 transition hover:text-[#D6B89F]">Área Administrativa</a></div><div className="flex flex-col gap-2 text-[10px] uppercase tracking-[.15em] text-white/55 sm:items-end"><span>© {new Date().getFullYear()} Essência de Mulher</span><span className="normal-case tracking-normal">Desenvolvido por <a href="https://primolanweb.netlify.app" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#D6B89F] transition hover:text-white">PrimolanWebDev</a></span></div></div></footer>

      <AnimatePresence>{chosenProduct && <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#201813]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setChosenProduct(null); }}><motion.section role="dialog" aria-modal="true" aria-labelledby="quick-title" className="relative grid max-h-[90vh] w-full max-w-[750px] overflow-y-auto rounded-t-2xl bg-white sm:grid-cols-2 sm:rounded-2xl" initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}>{chosenProduct.images[0]?.url && <div className="hidden min-h-[420px] bg-[#F3ECE7] sm:block"><img src={chosenProduct.images.find((image) => image.isMain)?.url ?? chosenProduct.images[0].url} alt={chosenProduct.name} className="h-full w-full object-cover" /></div>}<div className="p-6 sm:px-8 sm:py-10"><button onClick={() => setChosenProduct(null)} className="absolute right-4 top-4 rounded-full bg-white p-2 text-[#70655E] shadow-sm" aria-label="Fechar"><X size={17} /></button><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#A37B5C]">{chosenProduct.category?.name}</p><h2 id="quick-title" className="mt-2 pr-8 font-display text-3xl leading-8">{chosenProduct.name}</h2><p className="mt-3 font-semibold">{currency.format(Number(chosenProduct.price))}</p><p className="mt-4 text-xs leading-5 text-[#81756D]">{chosenProduct.description}</p>{chosenProduct.variants.length > 0 && <div className="mt-6"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.14em]">Tamanho e cor</span><span className="text-[10px] text-[#9A8B80]">Selecione uma opção</span></div><div className="space-y-2">{chosenProduct.variants.filter((variant) => variant.stock > 0).map((variant) => <button key={variant.id} onClick={() => { setChosenVariant(variant.id); setQuickError(""); }} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs transition ${chosenVariant === variant.id ? "border-[#8B5E3C] bg-[#FAF7F4] text-[#765033]" : "border-[#E9DED6] text-[#70655E]"}`}><span>{variant.size} <span className="mx-1 text-[#B7A69A]">·</span> {variant.color}</span><span className="flex items-center gap-1 text-[10px] text-[#9A8B80]">{variant.stock} disponíveis {chosenVariant === variant.id && <Check size={13} className="text-[#8B5E3C]" />}</span></button>)}</div>{chosenProduct.variants.every((variant) => variant.stock < 1) && <p className="mt-3 text-xs text-[#9B493D]">Este produto está sem estoque no momento.</p>}</div>}{quickError && <p role="alert" className="mt-4 text-xs text-[#9B493D]">{quickError}</p>}<button onClick={addToCart} disabled={chosenProduct.variants.length > 0 && chosenProduct.variants.every((variant) => variant.stock < 1)} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#8B5E3C] text-xs font-bold uppercase tracking-[.1em] text-white hover:bg-[#765033]">Adicionar à sacola <ArrowRight size={15} /></button></div></motion.section></motion.div>}</AnimatePresence>

      <CartDrawer open={cartOpen} items={cartItems} onClose={() => setCartOpen(false)} onChangeQuantity={changeQuantity} onRemove={(key) => setCartItems((current) => current.filter((item) => item.key !== key))} />
    </main>
  );
}
