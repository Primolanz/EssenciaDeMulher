"use client";

import { MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type CartItem = {
  key: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  size?: string;
  color?: string;
  quantity: number;
};

type CartDrawerProps = {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onChangeQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CartDrawer({ open, items, onClose, onChangeQuantity, onRemove }: CartDrawerProps) {
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderText = [
    "Olá! Quero finalizar este pedido:",
    ...items.map((item) => `• ${item.quantity}x ${item.name}${item.size ? ` — tam. ${item.size}` : ""}${item.color ? ` — ${item.color}` : ""} (${currency.format(item.price * item.quantity)})`),
    `Total dos produtos: ${currency.format(total)}`,
  ].join("\n");
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const checkoutUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(orderText)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(orderText)}`;

  return (
    <AnimatePresence>
      {open && <motion.div className="fixed inset-0 z-[70] bg-[#201813]/45 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.aside role="dialog" aria-modal="true" aria-labelledby="cart-title" className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
        <div className="flex items-center justify-between border-b border-[#F0E8E2] px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#A37B5C]">Sua seleção</p><h2 id="cart-title" className="font-display text-2xl">Sacola <span className="font-sans text-sm text-[#9A8B80]">({count})</span></h2></div><button onClick={onClose} aria-label="Fechar sacola" className="rounded-full p-2 text-[#70655E] hover:bg-[#F7F2EE]"><X size={20} /></button></div>
        {items.length ? <>
          <div className="soft-scrollbar flex-1 overflow-y-auto px-5 py-2">{items.map((item) => <article key={item.key} className="flex gap-4 border-b border-[#F0E8E2] py-5"><div className="h-[112px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-[#F3ECE7]">{item.image && <img src={item.image} alt={item.name} className="h-full w-full object-cover" />}</div><div className="flex min-w-0 flex-1 flex-col"><div className="flex items-start justify-between gap-2"><div><h3 className="font-display text-xl leading-5">{item.name}</h3><p className="mt-2 text-[11px] text-[#81756D]">{[item.size && `Tam. ${item.size}`, item.color].filter(Boolean).join(" · ") || "Peça selecionada"}</p></div><button onClick={() => onRemove(item.key)} aria-label={`Remover ${item.name}`} className="rounded-full p-1.5 text-[#A1948B] hover:bg-[#FBF0ED] hover:text-[#9B493D]"><Trash2 size={15} /></button></div><div className="mt-auto flex items-end justify-between pt-3"><div className="flex items-center gap-3 rounded-full border border-[#E9DED6] px-2 py-1"><button onClick={() => onChangeQuantity(item.key, item.quantity - 1)} aria-label="Diminuir quantidade" className="p-0.5 text-[#70655E]"><Minus size={13} /></button><span className="min-w-3 text-center text-xs">{item.quantity}</span><button onClick={() => onChangeQuantity(item.key, item.quantity + 1)} aria-label="Aumentar quantidade" className="p-0.5 text-[#70655E]"><Plus size={13} /></button></div><span className="text-sm font-semibold">{currency.format(item.price * item.quantity)}</span></div></div></article>)}</div>
          <div className="border-t border-[#F0E8E2] px-6 pb-6 pt-5"><div className="mb-4 flex items-center justify-between"><span className="text-sm text-[#70655E]">Subtotal</span><span className="font-display text-2xl">{currency.format(total)}</span></div><p className="mb-4 text-[10px] leading-4 text-[#9A8B80]">Frete e formas de pagamento serão confirmados pelo WhatsApp.</p><a href={checkoutUrl} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#8B5E3C] text-sm font-semibold text-white transition hover:bg-[#765033]"><MessageCircle size={17} /> Finalizar pedido via WhatsApp</a></div>
        </> : <div className="flex flex-1 flex-col items-center justify-center px-8 text-center"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F2EE] text-[#A37B5C]"><ShoppingBag size={25} strokeWidth={1.5} /></div><h3 className="font-display text-2xl">Sua sacola está vazia</h3><p className="mt-2 text-sm text-[#81756D]">Escolha uma peça para começar a montar seu pedido.</p><button onClick={onClose} className="mt-6 rounded-full border border-[#DCCFC5] px-5 py-2.5 text-xs font-semibold text-[#765033]">Continuar explorando</button></div>}
      </motion.aside>
      </motion.div>}
    </AnimatePresence>
  );
}
