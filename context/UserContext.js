import { createContext, useContext, useEffect, useState } from "react";

const UserContext = createContext();

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

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

  async function logout() {
    await fetch("/api/v1/sessions", {
      method: "DELETE",
      credentials: "include",
    });

    setUser(null);
  }

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        fetchUser,
        logout,
        loadingUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

// 🔹 exportação do contexto
export { UserContext };
