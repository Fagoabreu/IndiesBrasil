import { useState } from "react";
import { Button } from "@primer/react";
import PropTypes from "prop-types";
import baseStyles from "./FollowButton.module.css";

export default function FollowButton({
  username,
  endpoint,
  isFollowing = false,
  onToggle = () => {},
  className,
}) {
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(isFollowing);

  const handleToggle = async () => {
    const nextFollowing = !following;
    setLoading(true);
    try {
      const url = endpoint ?? `/api/v1/users/${username}/follow`;
      const res = await fetch(url, {
        method: nextFollowing ? "POST" : "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Erro na requisição");

      setFollowing(nextFollowing);
      if (endpoint) {
        onToggle(nextFollowing);
      } else {
        onToggle(username, nextFollowing);
      }
    } catch (error) {
      console.error("Erro ao seguir/deixar de seguir:", error);
    } finally {
      setLoading(false);
    }
  };

  const btnClass = [baseStyles.btn, className].filter(Boolean).join(" ");

  let label = following ? "Seguindo" : "Seguir";
  if (loading) label = "...";

  return (
    <Button
      size="small"
      variant={following ? "default" : "primary"}
      onClick={handleToggle}
      disabled={loading}
      className={btnClass}
    >
      {label}
    </Button>
  );
}

FollowButton.propTypes = {
  username: PropTypes.string,
  endpoint: PropTypes.string,
  isFollowing: PropTypes.bool,
  onToggle: PropTypes.func,
  className: PropTypes.string,
};
