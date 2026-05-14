import { useState, useEffect } from "react";
import { ActionMenu, ActionList, IconButton } from "@primer/react";
import { BellIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./NotificationButton.module.css";

async function loadNotifications(username) {
  const [userRes, postRes] = await Promise.all([
    fetch(`/api/v1/users/${username}/notifications`, { credentials: "include" }),
    fetch(`/api/v1/users/${username}/notifications/post`, { credentials: "include" }),
  ]);
  return {
    userNotifs: userRes.ok ? await userRes.json() : [],
    postNotifs: postRes.ok ? await postRes.json() : [],
  };
}

export default function NotificationButton() {
  const { user } = useUser();
  const [userNotifs, setUserNotifs] = useState([]);
  const [postNotifs, setPostNotifs] = useState([]);

  useEffect(() => {
    if (!user?.username) return;
    let active = true;
    loadNotifications(user.username).then(({ userNotifs: u, postNotifs: p }) => {
      if (!active) return;
      setUserNotifs(u);
      setPostNotifs(p);
    });
    return () => {
      active = false;
    };
  }, [user?.username]);

  function handleMenuOpen(open) {
    if (!open || !user?.username) return;
    loadNotifications(user.username).then(({ userNotifs: u, postNotifs: p }) => {
      setUserNotifs(u);
      setPostNotifs(p);
    });
  }

  const all = [...userNotifs, ...postNotifs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unreadCount = all.filter((n) => !n.is_read).length;

  return (
    <div className={styles.bellWrapper}>
      <ActionMenu onOpenChange={handleMenuOpen}>
        <ActionMenu.Anchor>
          <IconButton icon={BellIcon} variant="invisible" aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`} />
        </ActionMenu.Anchor>

        <ActionMenu.Overlay width="medium">
          <ActionList>
            {all.length === 0 ? (
              <ActionList.Item disabled>Nenhuma notificação</ActionList.Item>
            ) : (
              all.map((n) => (
                <ActionList.Item
                  key={`${n.user_id}_${n.type}_${n.source_user_id}${n.post_id != null ? `_${n.post_id}` : ""}`}
                  className={!n.is_read ? styles.unreadItem : undefined}
                >
                  <span className={styles.notifTitle}>{n.title || n.type}</span>
                  {n.message && <ActionList.Description variant="block">{n.message}</ActionList.Description>}
                  <ActionList.TrailingVisual>
                    <span className={styles.notifDate}>
                      {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(n.created_at))}
                    </span>
                  </ActionList.TrailingVisual>
                </ActionList.Item>
              ))
            )}
          </ActionList>
        </ActionMenu.Overlay>
      </ActionMenu>

      {unreadCount > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </div>
  );
}
