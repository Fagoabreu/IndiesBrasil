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

describeOrders("Store order detail (/api/v1/store/orders/[id])", () => {
  let ownerSessionToken;
  let buyerSessionToken;
  let otherSessionToken;
  let studio;
  let order1;
  let order2;

  beforeAll(async () => {
    const ownerContext = await createActivatedUserWithSession({
      username: "OrderDetailOwner",
      email: "orderdetail.owner@curso.dev",
      password: "Senha@123",
    });
    ownerSessionToken = ownerContext.sessionToken;

    const buyerContext = await createActivatedUserWithSession({
      username: "OrderDetailBuyer",
      email: "orderdetail.buyer@curso.dev",
      password: "Senha@123",
    });
    buyerSessionToken = buyerContext.sessionToken;

    const otherContext = await createActivatedUserWithSession({
      username: "OrderDetailOther",
      email: "orderdetail.other@curso.dev",
      password: "Senha@123",
    });
    otherSessionToken = otherContext.sessionToken;

    studio = await createEligibleStudio(ownerContext.user, { name: "Estúdio Detalhe Pedido" });

    const physicalResponse = await fetch(`${webserver.origin}/api/v1/store/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        organizationId: studio.id,
        name: "Caneca Indie",
        type: "physical",
        price: "59.90",
      }),
    });
    const physicalProduct = await physicalResponse.json();

    const digitalResponse = await fetch(`${webserver.origin}/api/v1/store/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        organizationId: studio.id,
        name: "E-book Indie",
        type: "digital",
        price: "19.90",
      }),
    });
    const digitalProduct = await digitalResponse.json();

    const order1Response = await fetch(`${webserver.origin}/api/v1/store/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({
        productId: physicalProduct.id,
        quantity: 1,
        address: {
          street: "Rua da Caneca",
          city: "Curitiba",
          state: "PR",
          zip_code: "80010000",
        },
      }),
    });
    order1 = await order1Response.json();

    const order2Response = await fetch(`${webserver.origin}/api/v1/store/orders`, {
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
    order2 = await order2Response.json();
  });

  test("Buyer reads their own order", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders/${order1.id}`, {
      headers: authHeaders(buyerSessionToken),
    });
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody.viewer).toEqual({ canManage: false, isBuyer: true });
  });

  test("Studio owner reads the received order", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders/${order1.id}`, {
      headers: authHeaders(ownerSessionToken),
    });
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody.viewer).toEqual({ canManage: true, isBuyer: false });
  });

  test("Unrelated user cannot read the order", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders/${order1.id}`, {
      headers: authHeaders(otherSessionToken),
    });
    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody.name).toBe("ForbiddenError");
  });

  test("Studio owner sends a quote with delivery cost and deadline", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders/${order1.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        status: "quoted",
        deliveryCost: "15.50",
        deliveryDeadlineDays: 7,
        note: "Frete via Correios (PAC).",
      }),
    });
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      status: "quoted",
      delivery_cost: "15.50",
      delivery_deadline_days: 7,
      total: "75.40",
    });
  });

  test("Studio quote without delivery cost is rejected", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders/${order2.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        status: "quoted",
        deliveryDeadlineDays: 7,
      }),
    });
    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      name: "ValidationError",
      message: "Informe um custo de entrega válido.",
    });
  });

  test("Buyer cancels a quoted order", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders/${order1.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody.status).toBe("cancelled");
  });

  test("Buyer cannot set a non-cancellation status", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders/${order2.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({ status: "accepted" }),
    });
    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      name: "ForbiddenError",
      message: "O comprador só pode cancelar o pedido.",
    });
  });

  test("Studio owner accepts an order", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders/${order2.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({ status: "accepted" }),
    });
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody.status).toBe("accepted");
  });

  test("Buyer cannot cancel an order that is no longer open", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/orders/${order2.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      name: "ValidationError",
      message: "Este pedido não pode mais ser cancelado.",
    });
  });
});
