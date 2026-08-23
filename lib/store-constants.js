/**
 * Constantes do módulo de Loja (marketplace intermediado).
 * A venda é conduzida diretamente pelo estúdio; a plataforma cadastra
 * produtos e registra pedidos.
 */

/**
 * Alavanca para habilitar/desabilitar as vendas na loja.
 * Enquanto a loja estiver em fase de testes, mantenha desabilitada (padrão).
 *
 * Para habilitar, defina `NEXT_PUBLIC_STORE_SALES_ENABLED=true` no ambiente.
 * Quando desabilitada, os pedidos são bloqueados no servidor e um aviso
 * de "sem validade" é exibido na interface.
 */
export const STORE_SALES_ENABLED = process.env.NEXT_PUBLIC_STORE_SALES_ENABLED === "true";

export const PRODUCT_TYPES = ["physical", "digital"];

export const PRODUCT_TYPE_LABELS = {
  physical: "Produto físico",
  digital: "Produto digital",
};

export const PRODUCT_STATUSES = ["active", "inactive"];

export const ORDER_STATUSES = ["pending", "quoted", "accepted", "paid", "shipped", "delivered", "cancelled", "declined"];

export const ORDER_STATUS_LABELS = {
  pending: "Pendente",
  quoted: "Orçamento enviado",
  accepted: "Aceito",
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  declined: "Recusado",
};

/** Status nos quais o comprador ainda pode cancelar o pedido. */
export const BUYER_CANCELLABLE_STATUSES = ["pending", "quoted"];
