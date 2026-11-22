/**
 * @jest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import PostCardComponent from "@/components/PostCard/PostCardComponent";

/**
 * Exclusão de post pede confirmação.
 *
 * O botão "Deletar" agia na primeira batida: um clique errado no feed apagava o
 * post e os comentários dele, sem desfazer. Este teste fixa o contrato da UX —
 * clicar em "Deletar" **não** chama `onDelete`; a exclusão só acontece no botão
 * do diálogo. É o tipo de regressão que não aparece em teste de API: a rota
 * continua correta, o que muda é a quantidade de cliques até o dado sumir.
 *
 * `jsdom` porque a verificação é de interação: o diálogo do Primer é renderizado
 * em portal, e `renderToStaticMarkup` não monta portal nenhum.
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom não implementa as APIs de medição de layout que o Primer usa em efeitos
// (`useOverflow` cria um `ResizeObserver`). Um stub basta: o teste verifica a
// interação, não o layout — sem ele, o render estoura antes do primeiro clique.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const basePost = {
  id: 1,
  content: "Post do autor",
  author_username: "autor",
  created_at: new Date().toISOString(),
  is_current_user: true,
  likes_count: 0,
  comments_count: 0,
};

function buttonsByText(text) {
  return Array.from(document.querySelectorAll("button")).filter((button) => button.textContent.trim() === text);
}

function click(element) {
  return act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function renderPost(onDelete) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<PostCardComponent post={basePost} canInteract onDelete={onDelete} />);
  });

  return {
    cleanup: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("components/PostCard — confirmação de exclusão", () => {
  test("clicar em Deletar abre o diálogo e não apaga o post", async () => {
    const onDelete = jest.fn();
    const { cleanup } = await renderPost(onDelete);

    const deleteButton = buttonsByText("Deletar")[0];
    expect(deleteButton).toBeTruthy();

    await click(deleteButton);

    expect(onDelete).not.toHaveBeenCalled();
    // O diálogo é renderizado em portal, no body.
    expect(document.body.textContent).toContain("Tem certeza de que quer deletar este post?");

    await cleanup();
  });

  test("cancelar fecha o diálogo sem chamar onDelete", async () => {
    const onDelete = jest.fn();
    const { cleanup } = await renderPost(onDelete);

    await click(buttonsByText("Deletar")[0]);

    const cancelButton = buttonsByText("Cancelar")[0];
    expect(cancelButton).toBeTruthy();

    await click(cancelButton);

    expect(onDelete).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Tem certeza de que quer deletar este post?");

    await cleanup();
  });

  test("confirmar no diálogo chama onDelete uma única vez", async () => {
    const onDelete = jest.fn().mockResolvedValue(true);
    const { cleanup } = await renderPost(onDelete);

    await click(buttonsByText("Deletar")[0]);

    // Dois botões "Deletar" agora: o do card e o do diálogo. O do diálogo é o
    // que está dentro de [role="alertdialog"].
    const dialog = document.querySelector('[role="alertdialog"]');
    const confirmButton = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent.trim() === "Deletar");
    expect(confirmButton).toBeTruthy();

    await click(confirmButton);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(basePost.id);

    await cleanup();
  });

  test("falha da API mantém o diálogo aberto com a mensagem", async () => {
    const onDelete = jest.fn().mockResolvedValue(false);
    const { cleanup } = await renderPost(onDelete);

    await click(buttonsByText("Deletar")[0]);

    const dialog = document.querySelector('[role="alertdialog"]');
    const confirmButton = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent.trim() === "Deletar");
    await click(confirmButton);

    expect(document.body.textContent).toContain("Não foi possível deletar o post");

    await cleanup();
  });
});
