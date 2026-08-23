import webserver from "infra/webserver.js";
import orchestrator from "tests/orchestrator.js";
import { authHeaders, createActivatedUserWithSession, createEligibleStudio } from "tests/helpers/storeTestUtils.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
  await orchestrator.deleteAllEmails();
});

describe("Store product detail (/api/v1/store/products/[slug])", () => {
  let ownerSessionToken;
  let buyerSessionToken;
  let studio;
  let productSlug;

  beforeAll(async () => {
    const ownerContext = await createActivatedUserWithSession({
      username: "ProductOwner",
      email: "product.owner@curso.dev",
      password: "Senha@123",
    });
    ownerSessionToken = ownerContext.sessionToken;

    const buyerContext = await createActivatedUserWithSession({
      username: "ProductBuyer",
      email: "product.buyer@curso.dev",
      password: "Senha@123",
    });
    buyerSessionToken = buyerContext.sessionToken;

    studio = await createEligibleStudio(ownerContext.user, { name: "Estúdio Produto Teste" });

    const createResponse = await fetch(`${webserver.origin}/api/v1/store/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        organizationId: studio.id,
        name: "Poster Assinado",
        type: "physical",
        price: "39.90",
        description: "Poster autografado pela equipe.",
      }),
    });
    if (createResponse.status !== 201) {
      throw new Error(`Falha ao criar produto no setup: ${createResponse.status} ${await createResponse.text()}`);
    }
    const createdProduct = await createResponse.json();
    productSlug = createdProduct.slug;
  });

  test("Anonymous user reads the product without management rights", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products/${productSlug}`);
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      slug: productSlug,
      name: "Poster Assinado",
      price: "39.90",
      viewer: null,
    });
  });

  test("Studio owner reads the product with management rights", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products/${productSlug}`, {
      headers: authHeaders(ownerSessionToken),
    });
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody.viewer).toEqual({ canManage: true });
  });

  test("Studio owner updates the product", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products/${productSlug}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(ownerSessionToken),
      },
      body: JSON.stringify({
        name: "Poster Assinado Edição Limitada",
        price: "49.90",
      }),
    });
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      slug: "poster-assinado-edicao-limitada",
      name: "Poster Assinado Edição Limitada",
      price: "49.90",
    });

    // O slug anterior deixa de existir após a renomeação.
    productSlug = responseBody.slug;
    const oldSlugResponse = await fetch(`${webserver.origin}/api/v1/store/products/poster-assinado`);
    expect(oldSlugResponse.status).toBe(404);
  });

  test("Non-member cannot update the product", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products/${productSlug}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(buyerSessionToken),
      },
      body: JSON.stringify({ price: "1.00" }),
    });
    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody.name).toBe("ForbiddenError");
  });

  test("Non-member cannot delete the product", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products/${productSlug}`, {
      method: "DELETE",
      headers: authHeaders(buyerSessionToken),
    });
    expect(response.status).toBe(403);
  });

  test("Studio owner deletes the product", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products/${productSlug}`, {
      method: "DELETE",
      headers: authHeaders(ownerSessionToken),
    });
    expect(response.status).toBe(204);
  });

  test("Deleted product returns 404", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/store/products/${productSlug}`);
    expect(response.status).toBe(404);
    const responseBody = await response.json();
    expect(responseBody).toMatchObject({
      name: "NotFoundError",
      message: "Produto não encontrado.",
    });
  });
});
