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
   */
  const [myStudios, setMyStudios] = useState([]);
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
      Promise.resolve().then(() => setMyStudios([]));
      return;
    }

    let cancelled = false;
    Promise.resolve()
      .then(() => fetch("/api/v1/studios?member=me", { credentials: "include" }))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setMyStudios(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setMyStudios([]);
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
