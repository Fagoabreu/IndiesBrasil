import { useState } from "react";
import { Button } from "@primer/react";

export default function FollowButton({ userId, onFollow }) {
  const [loading, setLoading] = useState(false);

  async function handleFollow() {
    try {
      setLoading(true);

      const res = await fetch("/api/v1/users/follow", {
        method: "POST",
        credentials: "include", // Envia session_id automaticamente
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        console.error("Erro ao seguir usuário");
        return;
      }

      // Se o componente pai quiser remover da lista
      if (onFollow) onFollow(userId);
    } catch (error) {
      console.error("Erro ao seguir:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleFollow} disabled={loading} size="small" variant="primary" sx={{ width: 90 }}>
      {loading ? "..." : "Seguir"}
    </Button>
  );
}
