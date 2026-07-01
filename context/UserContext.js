import { useRouter } from "next/router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const UserContext = createContext();

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
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

  const contextValue = useMemo(
    () => ({ user, setUser, fetchUser, logout, loadingUser }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loadingUser],
  );

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

export { UserContext };
