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

  const fetchUser = useCallback(async () => {
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
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/v1/sessions", {
      method: "DELETE",
      credentials: "include",
    });

    setUser(null);
    router.push("/login");
  }, [router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const contextValue = useMemo(
    () => ({ user, setUser, fetchUser, logout, loadingUser }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loadingUser],
  );

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

export { UserContext };
