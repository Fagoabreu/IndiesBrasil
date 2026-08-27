import database from "infra/database";
import { NotFoundError, ValidationError, ForbiddenError } from "infra/errors.js";
import { generateUniqueSlug } from "lib/slug";
import { PRODUCT_TYPES, PRODUCT_STATUSES, ORDER_STATUSES, BUYER_CANCELLABLE_STATUSES, STORE_SALES_ENABLED } from "lib/store-constants";
import organization from "./organization.js";
import user from "./user.js";
import uploadedImages from "./uploadedImages.js";
import notification from "./notification.js";
import email from "infra/email";
import storeOrderReceivedEmailTemplate from "lib/email/templates/storeOrderReceivedEmail";
import storeOrderUpdatedEmailTemplate from "lib/email/templates/storeOrderUpdatedEmail";

const EMAIL_FROM = "Indies Brasil <contato@indies.com.br>";

/* =========================================================
 * Produtos
 * ========================================================= */

async function findAllProducts({ page = 1, limit = 20, search = "", orgSlug = "" } = {}) {
  const offset = (page - 1) * limit;
  const results = await database.query({
    text: `
      SELECT
        p.id, p.slug, p.name, p.description, p.type, p.price, p.delivery_notes,
        p.created_at, p.updated_at,
        ui.secure_url        AS image_url,
        o.slug               AS org_slug,
        o.name               AS org_name,
        ui_logo.secure_url   AS org_logo_url
      FROM store_products p
      JOIN organizations o ON o.id = p.organization_id
      LEFT JOIN uploaded_images ui      ON ui.id = p.image_id
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      WHERE p.status = 'active'
        AND ($3 = '' OR p.name ILIKE '%' || $3 || '%' OR p.description ILIKE '%' || $3 || '%')
        AND ($4 = '' OR o.slug = $4)
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    values: [limit, offset, search, orgSlug],
  });
  return results.rows;
}

async function findProductBySlug(slug) {
  const results = await database.query({
    text: `
      SELECT
        p.*,
        ui.secure_url      AS image_url,
        o.slug             AS org_slug,
        o.name             AS org_name,
        ui_logo.secure_url AS org_logo_url,
        u.username         AS owner_username
      FROM store_products p
      JOIN organizations o ON o.id = p.organization_id
      LEFT JOIN uploaded_images ui      ON ui.id = p.image_id
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN users u ON u.id = o.owner_id
      WHERE p.slug = $1
    `,
    values: [slug],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Produto não encontrado.",
      action: "Verifique o link ou pesquise por outros produtos.",
    });
  }

  return results.rows[0];
}

async function findProductById(id) {
  const results = await database.query({
    text: `
      SELECT
        p.*,
        ui.secure_url      AS image_url,
        o.slug             AS org_slug,
        o.name             AS org_name
      FROM store_products p
      JOIN organizations o ON o.id = p.organization_id
      LEFT JOIN uploaded_images ui ON ui.id = p.image_id
      WHERE p.id = $1
    `,
    values: [id],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({ message: "Produto não encontrado." });
  }

  return results.rows[0];
}

async function findProductsByOrg(orgId) {
  const results = await database.query({
    text: `
      SELECT p.*, ui.secure_url AS image_url
      FROM store_products p
      LEFT JOIN uploaded_images ui ON ui.id = p.image_id
      WHERE p.organization_id = $1
      ORDER BY p.created_at DESC
    `,
    values: [orgId],
  });
  return results.rows;
}

async function findProductImages(productId) {
  const results = await database.query({
    text: `
      SELECT
        spi.id, spi.product_id, spi.image_id, spi.display_order,
        ui.secure_url, ui.width, ui.height, ui.format
      FROM store_product_images spi
      LEFT JOIN uploaded_images ui ON ui.id = spi.image_id
      WHERE spi.product_id = $1
      ORDER BY spi.display_order, spi.id
    `,
    values: [productId],
  });
  return results.rows;
}

/**
 * Faz upload (na ordem) de uma lista de entradas de imagem. Cada entrada pode
 * ser um data URL (string) ou um `{ id }` de imagem já enviada ao Cloudinary.
 * Devolve a lista ordenada de `uploaded_images.id`.
 */
async function uploadProductImages(entries, orgId) {
  const ids = [];
  for (const entry of entries) {
    if (typeof entry === "string") {
      const uploaded = await uploadedImages.uploadDataUrlImage(entry, `store/products/${orgId}`);
      ids.push(uploaded.id);
    } else if (entry && typeof entry === "object" && entry.id) {
      ids.push(entry.id);
    }
  }
  return ids;
}

async function insertProductImages(client, productId, imageIds) {
  for (let i = 0; i < imageIds.length; i += 1) {
    await client.query({
      text: `
        INSERT INTO store_product_images (product_id, image_id, display_order)
        VALUES ($1, $2, $3)
      `,
      values: [productId, imageIds[i], i],
    });
  }
}

async function createProduct(orgId, userId, data) {
  const org = await organization.findById(orgId);
  await assertCanManageProducts(org, userId);

  if (!(await organization.isStoreEligible(org))) {
    throw new ForbiddenError({
      message: "Este estúdio ainda não está apto a vender na loja. Complete e valide os dados da empresa (CNPJ, endereço e contato).",
    });
  }

  const { name, description = "", type = "physical", price, images = [], image = null, imageId = null, deliveryNotes = "" } = data;

  if (!name || name.trim().length < 3) {
    throw new ValidationError({ message: "O nome do produto deve ter pelo menos 3 caracteres." });
  }
  if (!PRODUCT_TYPES.includes(type)) {
    throw new ValidationError({ message: "Tipo de produto inválido. Use 'physical' ou 'digital'." });
  }
  const priceNumber = Number(price);
  if (Number.isNaN(priceNumber) || priceNumber < 0) {
    throw new ValidationError({ message: "Informe um preço válido." });
  }

  const slug = await generateUniqueSlug(name.trim(), "store_products", "slug", null, 100);

  // As imagens (data URLs) só são enviadas ao Cloudinary junto com o produto,
  // evitando imagens órfãs quando o cadastro é cancelado. A primeira é a capa.
  let entries = images;
  if (entries.length === 0) {
    if (image) {
      entries = [image];
    } else if (imageId) {
      entries = [{ id: imageId }];
    }
  }
  const imageIds = await uploadProductImages(entries, orgId);
  const finalImageId = imageIds[0] ?? null;

  const product = await database.transaction(async (client) => {
    const result = await client.query({
      text: `
        INSERT INTO store_products
          (organization_id, slug, name, description, type, price, image_id, delivery_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      values: [orgId, slug, name.trim(), description || null, type, Number(priceNumber.toFixed(2)), finalImageId, deliveryNotes?.trim() || null],
    });
    await insertProductImages(client, result.rows[0].id, imageIds);
    return result.rows[0];
  });

  return findProductBySlug(product.slug);
}

async function updateProduct(slug, userId, data) {
  const product = await findProductBySlug(slug);
  const org = await organization.findById(product.organization_id);
  await assertCanManageProducts(org, userId);

  const { name, description, type, price, images, image, imageId, removeImage, deliveryNotes, status } = data;

  if (type !== undefined && !PRODUCT_TYPES.includes(type)) {
    throw new ValidationError({ message: "Tipo de produto inválido. Use 'physical' ou 'digital'." });
  }
  if (status !== undefined && !PRODUCT_STATUSES.includes(status)) {
    throw new ValidationError({ message: "Status de produto inválido." });
  }

  let priceNumber = null;
  if (price !== undefined) {
    priceNumber = Number(price);
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      throw new ValidationError({ message: "Informe um preço válido." });
    }
    priceNumber = Number(priceNumber.toFixed(2));
  }

  let newSlug = product.slug;
  if (name !== undefined && name.trim() !== product.name) {
    newSlug = await generateUniqueSlug(name.trim(), "store_products", "slug", product.slug, 100);
  }

  const currentGallery = await findProductImages(product.id);
  const nextImageIds = await resolveProductImages({
    images,
    image,
    imageId,
    removeImage,
    orgId: org.id,
    currentImageId: product.image_id,
    currentGalleryIds: currentGallery.map((img) => img.image_id),
  });
  const nextCoverId = nextImageIds === undefined ? product.image_id : (nextImageIds[0] ?? null);

  await database.transaction(async (client) => {
    await client.query({
      text: `
        UPDATE store_products
        SET
          name           = COALESCE($1, name),
          slug           = $2,
          description    = COALESCE($3, description),
          type           = COALESCE($4, type),
          price          = COALESCE($5, price),
          image_id       = $6,
          delivery_notes = COALESCE($7, delivery_notes),
          status         = COALESCE($8, status),
          updated_at     = now()
        WHERE id = $9
      `,
      values: [
        name?.trim() || null,
        newSlug,
        description !== undefined ? description : null,
        type || null,
        priceNumber,
        nextCoverId,
        deliveryNotes !== undefined ? deliveryNotes : null,
        status || null,
        product.id,
      ],
    });

    if (nextImageIds !== undefined) {
      await client.query({ text: `DELETE FROM store_product_images WHERE product_id = $1`, values: [product.id] });
      await insertProductImages(client, product.id, nextImageIds);
    }
  });

  return findProductBySlug(newSlug);
}

/**
 * Resolve a lista ordenada de imagens de um produto na atualização.
 * Aceita `images` (array de data URLs e/ou `{ id }` existentes) ou os campos
 * legados `image`/`imageId`/`removeImage`. Retorna `undefined` quando a imagem
 * não muda. Apaga do Cloudinary as imagens antigas que saíram da lista.
 */
async function resolveProductImages({ images, image, imageId, removeImage, orgId, currentImageId, currentGalleryIds }) {
  if (Array.isArray(images)) {
    const nextImageIds = await uploadProductImages(images, orgId);
    await deleteOrphanProductImages(currentImageId, currentGalleryIds, nextImageIds);
    return nextImageIds;
  }

  if (removeImage) {
    await deleteOrphanProductImages(currentImageId, currentGalleryIds, []);
    return [];
  }

  if (image) {
    const uploaded = await uploadedImages.uploadDataUrlImage(image, `store/products/${orgId}`);
    await deleteOrphanProductImages(currentImageId, currentGalleryIds, [uploaded.id]);
    return [uploaded.id];
  }

  if (imageId) {
    await deleteOrphanProductImages(currentImageId, currentGalleryIds, [imageId]);
    return [imageId];
  }

  return undefined;
}

async function deleteOrphanProductImages(currentImageId, currentGalleryIds, nextImageIds) {
  const previousIds = new Set([currentImageId, ...(currentGalleryIds || [])].filter(Boolean));
  const nextSet = new Set(nextImageIds);
  for (const oldId of previousIds) {
    if (!nextSet.has(oldId)) {
      try {
        await uploadedImages.deleteImage(oldId);
      } catch {
        // best-effort: prossegue mesmo se falhar a remoção da imagem antiga
      }
    }
  }
}

async function deleteProduct(slug, userId) {
  const product = await findProductBySlug(slug);
  const org = await organization.findById(product.organization_id);
  await assertCanManageProducts(org, userId);

  // Coleta todos os ids de imagem (capa + galeria) antes de apagar o produto.
  const gallery = await findProductImages(product.id);
  const imageIds = new Set([product.image_id, ...gallery.map((img) => img.image_id)].filter(Boolean));

  await database.query({
    text: `DELETE FROM store_products WHERE id = $1`,
    values: [product.id],
  });

  // Apaga as imagens do Cloudinary para não deixar órfãs.
  for (const imageId of imageIds) {
    try {
      await uploadedImages.deleteImage(imageId);
    } catch {
      // best-effort: prossegue mesmo se falhar a remoção da imagem
    }
  }
}

async function assertCanManageProducts(org, userId) {
  const isOwner = await organization.isOwner(org, userId);
  const isAdmin = await organization.isAdmin(org.id, userId);
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError({
      message: "Apenas o dono ou administradores do estúdio podem gerenciar produtos.",
    });
  }
}

/* =========================================================
 * Pedidos
 * ========================================================= */

async function createOrder(buyerId, data) {
  if (!STORE_SALES_ENABLED) {
    throw new ForbiddenError({
      message: "A loja está em fase de testes e as vendas estão temporariamente desabilitadas.",
      action: "Volte em breve para fazer pedidos.",
    });
  }

  const { productId, quantity = 1, addressId = null, address = null, buyerNote = "" } = data;

  if (!productId) {
    throw new ValidationError({ message: "Produto é obrigatório." });
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    throw new ValidationError({ message: "Quantidade inválida." });
  }

  const product = await findProductById(productId);
  if (product.status !== "active") {
    throw new ValidationError({ message: "Este produto não está mais disponível." });
  }
  if (product.type === "physical" && !addressId && !address) {
    throw new ValidationError({ message: "Informe um endereço de entrega para produtos físicos." });
  }

  const priceSnapshot = Number(Number(product.price).toFixed(2));
  const total = Number((priceSnapshot * qty).toFixed(2));

  const order = await database.transaction(async (client) => {
    let resolvedAddressId = addressId || null;
    if (!resolvedAddressId && address) {
      resolvedAddressId = await insertAddress(client, address);
    }

    const result = await client.query({
      text: `
        INSERT INTO store_orders
          (product_id, organization_id, buyer_id, status, quantity, address_id, price_snapshot, delivery_cost, total, buyer_note)
        VALUES ($1, $2, $3, 'pending', $4, $5, $6, 0, $7, $8)
        RETURNING *
      `,
      values: [product.id, product.organization_id, buyerId, qty, resolvedAddressId, priceSnapshot, total, buyerNote?.trim() || null],
    });
    const created = result.rows[0];
    await createOrderEvent(client, created.id, "pending", null, buyerId);
    return created;
  });

  try {
    await notifyOrderReceived(order, product);
  } catch (error) {
    console.error("Falha ao notificar pedido recebido", error);
  }

  return findOrderById(order.id);
}

async function insertAddress(client, data) {
  if (!data.city?.trim() || !data.state?.trim()) {
    throw new ValidationError({ message: "Cidade e estado são obrigatórios no endereço de entrega." });
  }

  const result = await client.query({
    text: `
      INSERT INTO addresses
        (street, number, complement, neighborhood, city, state, zip_code, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
    values: [
      data.street?.trim() || null,
      data.number?.trim() || null,
      data.complement?.trim() || null,
      data.neighborhood?.trim() || null,
      data.city.trim(),
      data.state.trim().toUpperCase().slice(0, 2),
      String(data.zip_code || "")
        .replace(/\D/g, "")
        .slice(0, 8) || null,
      data.country?.trim() || "Brasil",
    ],
  });

  return result.rows[0].id;
}

async function findOrderById(orderId) {
  const results = await database.query({
    text: `
      SELECT
        o.id, o.status, o.quantity, o.price_snapshot, o.delivery_cost,
        o.delivery_deadline_days, o.total, o.buyer_note, o.created_at, o.updated_at,
        o.product_id, o.organization_id, o.buyer_id, o.address_id,
        p.name  AS product_name,
        p.type  AS product_type,
        p.slug  AS product_slug,
        ui.secure_url AS product_image_url,
        org.slug AS org_slug,
        org.name AS org_name,
        u.username AS buyer_username,
        a.street, a.number, a.complement, a.neighborhood,
        a.city, a.state, a.zip_code, a.country
      FROM store_orders o
      LEFT JOIN store_products p ON p.id = o.product_id
      LEFT JOIN uploaded_images ui ON ui.id = p.image_id
      LEFT JOIN organizations org ON org.id = o.organization_id
      LEFT JOIN users u ON u.id = o.buyer_id
      LEFT JOIN addresses a ON a.id = o.address_id
      WHERE o.id = $1
    `,
    values: [orderId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({ message: "Pedido não encontrado." });
  }

  return results.rows[0];
}

async function findOrdersByBuyer(buyerId) {
  const results = await database.query({
    text: `
      SELECT
        o.*,
        p.name AS product_name,
        ui.secure_url AS product_image_url,
        org.name AS org_name,
        org.slug AS org_slug
      FROM store_orders o
      LEFT JOIN store_products p ON p.id = o.product_id
      LEFT JOIN uploaded_images ui ON ui.id = p.image_id
      LEFT JOIN organizations org ON org.id = o.organization_id
      WHERE o.buyer_id = $1
      ORDER BY o.created_at DESC
    `,
    values: [buyerId],
  });
  return results.rows;
}

async function findOrdersByOrg(orgId) {
  const results = await database.query({
    text: `
      SELECT
        o.*,
        p.name AS product_name,
        ui.secure_url AS product_image_url,
        u.username AS buyer_username
      FROM store_orders o
      LEFT JOIN store_products p ON p.id = o.product_id
      LEFT JOIN uploaded_images ui ON ui.id = p.image_id
      LEFT JOIN users u ON u.id = o.buyer_id
      WHERE o.organization_id = $1
      ORDER BY o.created_at DESC
    `,
    values: [orgId],
  });
  return results.rows;
}

async function updateOrder(orderId, userId, data) {
  const order = await findOrderById(orderId);
  const { status, deliveryCost, deliveryDeadlineDays, note = null } = data;

  validateOrderStatus(status);

  const org = await organization.findById(order.organization_id);
  const isOwner = await organization.isOwner(org, userId);
  const isAdmin = await organization.isAdmin(org.id, userId);
  const isStudioActor = isOwner || isAdmin;
  const isBuyer = order.buyer_id === userId;

  if (!isStudioActor && !isBuyer) {
    throw new ForbiddenError({ message: "Você não tem permissão para atualizar este pedido." });
  }

  assertBuyerCanUpdate(order, isStudioActor, isBuyer, status);

  const { deliveryCostValue, deliveryDeadlineValue } = resolveDelivery(order, isStudioActor, status, deliveryCost, deliveryDeadlineDays);

  const total = Number((Number(order.price_snapshot) * Number(order.quantity) + deliveryCostValue).toFixed(2));

  await database.transaction(async (client) => {
    await client.query({
      text: `
        UPDATE store_orders
        SET status = $1, delivery_cost = $2, delivery_deadline_days = $3, total = $4, updated_at = now()
        WHERE id = $5
      `,
      values: [status, deliveryCostValue, deliveryDeadlineValue, total, orderId],
    });
    await createOrderEvent(client, orderId, status, note?.trim() || null, userId);
  });

  try {
    await notifyOrderUpdated(order, status, note, userId);
  } catch (error) {
    console.error("Falha ao notificar atualização de pedido", error);
  }

  return findOrderById(orderId);
}

function validateOrderStatus(status) {
  if (!status) {
    throw new ValidationError({ message: "Status é obrigatório." });
  }
  if (!ORDER_STATUSES.includes(status)) {
    throw new ValidationError({ message: "Status de pedido inválido." });
  }
}

function assertBuyerCanUpdate(order, isStudioActor, isBuyer, status) {
  // O comprador só pode cancelar pedidos ainda abertos.
  if (!isBuyer || isStudioActor) return;

  if (status !== "cancelled") {
    throw new ForbiddenError({ message: "O comprador só pode cancelar o pedido." });
  }
  if (!BUYER_CANCELLABLE_STATUSES.includes(order.status)) {
    throw new ValidationError({ message: "Este pedido não pode mais ser cancelado." });
  }
}

function resolveDelivery(order, isStudioActor, status, deliveryCost, deliveryDeadlineDays) {
  let deliveryCostValue = Number(order.delivery_cost ?? 0);
  let deliveryDeadlineValue = order.delivery_deadline_days != null ? Number(order.delivery_deadline_days) : null;

  // Ao enviar orçamento, o estúdio informa frete e prazo de entrega.
  if (isStudioActor && status === "quoted") {
    const cost = Number(deliveryCost);
    const days = Number(deliveryDeadlineDays);
    if (Number.isNaN(cost) || cost < 0) {
      throw new ValidationError({ message: "Informe um custo de entrega válido." });
    }
    if (!Number.isInteger(days) || days < 1) {
      throw new ValidationError({ message: "Informe um prazo de entrega válido (em dias)." });
    }
    deliveryCostValue = Number(cost.toFixed(2));
    deliveryDeadlineValue = days;
  }

  return { deliveryCostValue, deliveryDeadlineValue };
}

async function createOrderEvent(executor, orderId, status, note, createdBy) {
  await executor.query({
    text: `
      INSERT INTO store_order_events (order_id, status, note, created_by)
      VALUES ($1, $2, $3, $4)
    `,
    values: [orderId, status, note || null, createdBy || null],
  });
}

/* =========================================================
 * Notificações / E-mail
 * ========================================================= */

async function notifyOrderReceived(order, product) {
  const org = await organization.findById(order.organization_id);
  const owner = await user.findOneById(org.owner_id);
  const buyer = await user.findOneById(order.buyer_id);

  await notification.createUserNotification({
    user_id: org.owner_id,
    type: "store_order_received",
    source_user_id: order.buyer_id,
    org_slug: org.slug,
  });

  const { html, text } = storeOrderReceivedEmailTemplate({
    studioName: org.name,
    buyerUsername: buyer.username,
    productName: product.name,
    quantity: order.quantity,
    total: order.total,
    note: order.buyer_note,
  });

  await email.send({
    from: EMAIL_FROM,
    to: owner.email,
    subject: `Novo pedido na sua loja — ${product.name}`,
    html,
    text,
  });
}

async function notifyOrderUpdated(order, newStatus, note, actorUserId) {
  const org = await organization.findById(order.organization_id);
  const isBuyer = order.buyer_id === actorUserId;

  const { html, text } = storeOrderUpdatedEmailTemplate({
    productName: order.product_name,
    status: newStatus,
    note,
  });

  if (isBuyer) {
    // Notifica o estúdio sobre o cancelamento do comprador.
    const owner = await user.findOneById(org.owner_id);
    await notification.createUserNotification({
      user_id: org.owner_id,
      type: "store_order_updated",
      source_user_id: actorUserId,
      org_slug: org.slug,
    });
    await email.send({
      from: EMAIL_FROM,
      to: owner.email,
      subject: `Pedido atualizado — ${order.product_name}`,
      html,
      text,
    });
    return;
  }

  // Notifica o comprador sobre a atualização do estúdio.
  const buyer = await user.findOneById(order.buyer_id);
  await notification.createUserNotification({
    user_id: order.buyer_id,
    type: "store_order_updated",
    source_user_id: actorUserId,
    org_slug: org.slug,
  });
  await email.send({
    from: EMAIL_FROM,
    to: buyer.email,
    subject: `Atualização do seu pedido — ${order.product_name}`,
    html,
    text,
  });
}

const store = {
  // Produtos
  findAllProducts,
  findProductBySlug,
  findProductById,
  findProductsByOrg,
  findProductImages,
  createProduct,
  updateProduct,
  deleteProduct,
  // Pedidos
  createOrder,
  findOrderById,
  findOrdersByBuyer,
  findOrdersByOrg,
  updateOrder,
};

export default store;
