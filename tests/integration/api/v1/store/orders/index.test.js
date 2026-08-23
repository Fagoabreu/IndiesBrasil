import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";
import { STORE_SALES_ENABLED } from "lib/store-constants";
import { authHeaders, createActivatedUserWithSession, createEligibleStudio } from "tests/helpers/storeTestUtils.js";

// As vendas estão em fase de testes. Enquanto estiverem desabilitadas
// (STORE_SALES_ENABLED = false), os fluxos de pedido são pulados.
const describeOrders = STORE_SALES_ENABLED ? describe : describe.skip;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describeOrders("Store orders (/api/v1/store/orders)", () => {
  let ownerSessionToken;
  let buyerSessionToken;
  let studio;
  let physicalProduct;
  let digitalProduct;

  beforeAll(async () => {
    const ownerContext = await createActivatedUserWithSession({
      username: "OrderOwner",
      email: "order.owner@curso.dev",
      password: "Senha@123",
    });
    ownerSessionToken = ownerContext.sessionToken;

    const buyerContext = await createActivatedUserWithSession({
      username: "OrderBuyer",
      email: "order.buyer@curso.dev",
      password: "Senha@123",
    });
    buyerSessionToken = buyerContext.sessionToken;

    studio = await createEligibleStudio(ownerContext.user, { name: "Estúdio Pedidos Teste" });

    const physicalResponse = await fetch(`${webserver.origin}/api/v1/store/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        organizationId: studio.id,
        name: "Camiseta Indie",
        type: "physical",
        price: "59.90",
      }),
    });
    physicalProduct = await physicalResponse.json();

    const digitalResponse = await fetch(`${webserver.origin}/api/v1/store/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        organizationId: studio.id,
        name: "Trilha Sonora Digital",
        type: "digital",
        price: "19.90",
      }),
    });
    digitalProduct = await digitalResponse.json();
  });

  test("Buyer creates an order for a physical product with address", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({
        productId: physicalProduct.id,
        quantity: 2,
        buyerNote: "Entrega no horário comercial.",
        address: {
          street: "Rua do Comprador",
          number: "45",
          city: "Belo Horizonte",
          state: "MG",
          zip_code: "30130010",
        },
      }),
    });
    expect(response.status).toBe(201);
    const responseBody = await response.json();

    expect(responseBody).toMatchObject({
      status: "pending",
      quantity: 2,
      price_snapshot: "59.90",
      total: "119.80",
      delivery_cost: "0.00",
      product_name: "Camiseta Indie",
      buyer_username: "OrderBuyer",
      city: "Belo Horizonte",
      state: "MG",
      street: "Rua do Comprador",
    });
  });

  test("Buyer creates an order for a digital product without address", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({
        productId: digitalProduct.id,
        quantity: 1,
      }),
    });
    expect(response.status).toBe(201);
    const responseBody = await response.json();

    expect(responseBody).toMatchObject({
      status: "pending",
      quantity: 1,
      total: "19.90",
      product_name: "Trilha Sonora Digital",
      address_id: null,
    });
  });

  test("Physical product order without address is rejected", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({
        productId: physicalProduct.id,
        quantity: 1,
      }),
    });
    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      name: "ValidationError",
      message: "Informe um endereço de entrega para produtos físicos.",
    });
  });

  test("Order with invalid quantity is rejected", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({
        productId: digitalProduct.id,
        quantity: 0,
      }),
    });
    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      name: "ValidationError",
      message: "Quantidade inválida.",
    });
  });

  test("Buyer lists their own orders", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders`, {
      headers: authHeaders(buyerSessionToken),
    });
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toHaveLength(2);
    expect(responseBody.map((order) => order.product_name)).toEqual(expect.arrayContaining(["Camiseta Indie", "Trilha Sonora Digital"]));
  });

  test("Studio owner lists the received orders", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders?org=${studio.slug}`, {
      headers: authHeaders(ownerSessionToken),
    });
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toHaveLength(2);
    expect(responseBody[0]).toMatchObject({
      organization_id: studio.id,
      buyer_username: "OrderBuyer",
    });
  });

  test("Non-member cannot list the studio orders", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders?org=${studio.slug}`, {
      headers: authHeaders(buyerSessionToken),
    });
    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody.name).toBe("ForbiddenError");
  });
});
