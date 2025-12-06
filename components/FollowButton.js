import { useState } from "react";
import { Button } from "@primer/react";

export default function FollowButton({ username, isFollowing = false, onToggle = () => {} }) {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(isFollowing);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${username}/follow`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Erro na requisição");

      setFollowing((prev) => !prev);
      onToggle(username, !following); // avisa o componente pai
    } catch (error) {
      console.error("Erro ao seguir/deixar de seguir:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="small" variant={following ? "default" : "primary"} onClick={handleToggle} disabled={loading} sx={{ width: 100 }}>
      {loading ? "..." : following ? "Seguindo" : "Seguir"}
    </Button>
  );
}
