import { useState, useEffect, useCallback } from "react";
import { ActionMenu, ActionList, IconButton } from "@primer/react";
import { BellIcon } from "@primer/octicons-react";
import PropTypes from "prop-types";
import { useUser } from "@/context/UserContext";
import styles from "./NotificationButton.module.css";

export default function NotificationButton() {
  const { user } = useUser();
  const [userNotifs, setUserNotifs] = useState([]);
  const [postNotifs, setPostNotifs] = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.username) return;
    const [userRes, postRes] = await Promise.all([
      fetch(`/api/v1/users/${user.username}/notifications`, { credentials: "include" }),
      fetch(`/api/v1/users/${user.username}/notifications/post`, { credentials: "include" }),
    ]);
    setUserNotifs(userRes.ok ? await userRes.json() : []);
    setPostNotifs(postRes.ok ? await postRes.json() : []);
  }, [user?.username]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const all = [...userNotifs, ...postNotifs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unreadCount = all.filter((n) => !n.is_read).length;

  return (
    <div className={styles.bellWrapper}>
      <ActionMenu onOpenChange={(open) => open && fetchNotifications()}>
        <ActionMenu.Anchor>
          <IconButton
            icon={BellIcon}
            variant="invisible"
            aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
          />
        </ActionMenu.Anchor>

        <ActionMenu.Overlay width="medium">
          <ActionList>
            {all.length === 0 ? (
              <ActionList.Item disabled>Nenhuma notificação</ActionList.Item>
            ) : (
              all.map((n) => (
                <ActionList.Item key={n.id} className={!n.is_read ? styles.unreadItem : undefined}>
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

NotificationButton.propTypes = {};
