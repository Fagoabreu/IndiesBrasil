import { useRouter } from "next/router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const UserContext = createContext();

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  /**
   * Estúdios do usuário (`/api/v1/studios?member=me`).
   *
   * Fica no contexto, e não em cada tela, porque quatro listagens precisam
   * decidir o destino do botão "publicar": sem estúdio o caminho é criar um;
   * com um estúdio, publicar na aba certa; com vários, escolher qual. Buscar
   * isso separadamente em cada página daria quatro requisições e quatro
   * decisões que divergem.
   *
   * Começa **`null`** (desconhecido), não `[]`. A diferença é o que separa "a
   * pessoa não tem estúdio" de "ainda não sabemos": com `[]` como valor
   * inicial, `resolveStudioEntry` concluía "sem estúdio" no primeiro render e
   * mandava quem **tem** estúdio para `/estudios/novo` — bastava clicar antes de
   * a requisição responder. Em erro de rede também permanece `null`, porque
   * "não consegui perguntar" nunca deve virar "você não tem".
   */
  const [myStudios, setMyStudios] = useState(null);
  const router = useRouter();

  async function fetchUser() {
    try {
      const res = await fetch("/api/v1/user", {
        method: "GET",
        credentials: "include",
      });

      if (res.status === 200) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
    setLoadingUser(false);
  }

  const logout = useCallback(async () => {
    await fetch("/api/v1/sessions", {
      method: "DELETE",
      credentials: "include",
    });

    setUser(null);
    router.push("/login");
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/user", {
          method: "GET",
          credentials: "include",
        });
        if (!cancelled) {
          if (res.status === 200) {
            const data = await res.json();
            setUser(data);
          } else {
            setUser(null);
          }
        }
      } catch {
        if (!cancelled) setUser(null);
      }
      if (!cancelled) setLoadingUser(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fetch user on route change (e.g. after login/registration)
  useEffect(() => {
    const handleRouteChange = () => {
      setLoadingUser(true);
      (async () => {
        try {
          const res = await fetch("/api/v1/user", { credentials: "include" });
          if (res.status === 200) {
            const data = await res.json();
            setUser(data);
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
        setLoadingUser(false);
      })();
    };
    router.events?.on("routeChangeComplete", handleRouteChange);
    return () => router.events?.off("routeChangeComplete", handleRouteChange);
  }, [router]);

  /**
   * Carrega os estúdios do usuário quando a sessão muda.
   *
   * Depende só de `user?.id`: trocar de estúdio ou editar o nome não precisa
   * refazer a consulta durante a mesma navegação, e uma requisição por mudança
   * de rota seria ruído. `Promise.resolve().then` mantém o `setState` fora do
   * corpo do efeito (`react-hooks/set-state-in-effect` é erro no lint).
   */
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      // Sem sessão não há estúdio a listar: `[]` é a resposta certa, e o botão
      // vai para o login de qualquer forma.
      Promise.resolve().then(() => setMyStudios([]));
      return;
    }

    // Sessão nova (ou troca de conta): volta a "desconhecido" enquanto busca.
    // Sem isto, os estúdios da conta anterior ficariam visíveis até a resposta.
    Promise.resolve().then(() => setMyStudios(null));

    let cancelled = false;
    Promise.resolve()
      .then(() => fetch("/api/v1/studios?member=me", { credentials: "include" }))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        // `null` quando a consulta falhou: continua desconhecido, e o botão fica
        // no destino seguro (`/estudios?member=me`) em vez de afirmar "você não
        // tem estúdio".
        setMyStudios(Array.isArray(data) ? data : null);
      })
      .catch(() => {
        if (!cancelled) setMyStudios(null);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const contextValue = useMemo(
    () => ({ user, setUser, fetchUser, logout, loadingUser, myStudios }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loadingUser, myStudios],
  );

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

export { UserContext };
