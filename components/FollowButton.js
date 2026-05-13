import { useState } from "react";
import { Button } from "@primer/react";
import PropTypes from "prop-types";

export default function FollowButton({ username, isFollowing = false, onToggle = () => {}, className }) {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(isFollowing);

  const handleToggle = async () => {
    const nextFollowing = !following;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${username}/follow`, {
        method: nextFollowing ? "POST" : "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Erro na requisição");

      setFollowing(nextFollowing);
      onToggle(username, nextFollowing);
    } catch (error) {
      console.error("Erro ao seguir/deixar de seguir:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="small" variant={following ? "default" : "primary"} onClick={handleToggle} disabled={loading} className={className}>
      {loading ? "..." : following ? "Seguindo" : "Seguir"}
    </Button>
  );
}

FollowButton.propTypes = {
  username: PropTypes.string.isRequired,
  isFollowing: PropTypes.bool,
  onToggle: PropTypes.func,
  className: PropTypes.string,
};
