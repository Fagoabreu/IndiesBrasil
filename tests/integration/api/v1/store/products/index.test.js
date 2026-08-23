import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";
import organization from "models/organization.js";
import { authHeaders, createActivatedUserWithSession, createEligibleStudio, VALID_CNPJ } from "tests/helpers/storeTestUtils.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("GET /api/v1/store/products", () => {
  test("Anonymous user receives an empty list", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products`);
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual([]);
  });
});

describe("POST /api/v1/store/products", () => {
  let owner;
  let ownerSessionToken;
  let buyerSessionToken;
  let studio;
  let ineligibleStudioOwner;
  let ineligibleStudioOwnerToken;
  let ineligibleStudio;

  beforeAll(async () => {
    const ownerContext = await createActivatedUserWithSession({
      username: "StoreOwner",
      email: "store.owner@curso.dev",
      password: "Senha@123",
    });
    owner = ownerContext.user;
    ownerSessionToken = ownerContext.sessionToken;

    const buyerContext = await createActivatedUserWithSession({
      username: "StoreBuyer",
      email: "store.buyer@curso.dev",
      password: "Senha@123",
    });
    buyerSessionToken = buyerContext.sessionToken;

    studio = await createEligibleStudio(owner, { name: "Estúdio Loja Teste" });

    // Estúdio sem contato: não é elegível para vender.
    const ineligibleOwnerContext = await createActivatedUserWithSession({
      username: "IneligibleOwner",
      email: "ineligible.owner@curso.dev",
      password: "Senha@123",
    });
    ineligibleStudioOwner = ineligibleOwnerContext.user;
    ineligibleStudioOwnerToken = ineligibleOwnerContext.sessionToken;
    ineligibleStudio = await organization.create(ineligibleStudioOwner, {
      name: "Estúdio Inelegível",
      cnpj: VALID_CNPJ,
      address: {
        street: "Rua Sem Contato",
        city: "Rio de Janeiro",
        state: "RJ",
        zip_code: "20040000",
      },
    });
  });

  test("Eligible studio owner creates a product", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        organizationId: studio.id,
        name: "Chaveiro Indie",
        type: "physical",
        price: "29.90",
        description: "Chaveiro artesanal de acrílico.",
        deliveryNotes: "Envio em até 5 dias úteis.",
      }),
    });
    expect(response.status).toBe(201);
    const responseBody = await response.json();

    expect(responseBody).toMatchObject({
      name: "Chaveiro Indie",
      slug: "chaveiro-indie",
      type: "physical",
      price: "29.90",
      status: "active",
      organization_id: studio.id,
      description: "Chaveiro artesanal de acrílico.",
      delivery_notes: "Envio em até 5 dias úteis.",
      org_slug: "estudio-loja-teste",
      owner_username: "StoreOwner",
    });
  });

  test("Anonymous user lists the active product", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products`);
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toHaveLength(1);
    expect(responseBody[0]).toMatchObject({
      slug: "chaveiro-indie",
      name: "Chaveiro Indie",
      price: "29.90",
      org_name: "Estúdio Loja Teste",
    });
  });

  test("Non-member cannot create a product for another studio", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({
        organizationId: studio.id,
        name: "Produto Indevido",
        type: "physical",
        price: "10.00",
      }),
    });
    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody.name).toBe("ForbiddenError");
  });

  test("Ineligible studio owner cannot create a product", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ineligibleStudioOwnerToken),
      },
      body: JSON.stringify({
        organizationId: ineligibleStudio.id,
        name: "Produto de Estúdio Inelegível",
        type: "digital",
        price: "15.00",
      }),
    });
    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      name: "ForbiddenError",
      message: "Este estúdio ainda não está apto a vender na loja. Complete e valide os dados da empresa (CNPJ, endereço e contato).",
    });
  });

  test("Owner cannot create a product with an invalid type", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        organizationId: studio.id,
        name: "Produto Tipo Inválido",
        type: "nft",
        price: "5.00",
      }),
    });
    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      name: "ValidationError",
      message: "Tipo de produto inválido. Use 'physical' ou 'digital'.",
    });
  });
});
