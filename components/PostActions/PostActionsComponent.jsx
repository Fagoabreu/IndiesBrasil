import { IconButton, Button } from "@primer/react";
import { HeartIcon, HeartFillIcon, CommentDiscussionIcon } from "@primer/octicons-react";
import styles from "./PostActionsComponent.module.css";
import PropTypes from "prop-types";

PostActionsComponent.propTypes = {
  hasLiked: PropTypes.bool,
  likesCount: PropTypes.number,
  commentsCount: PropTypes.number,
  canInteract: PropTypes.bool,
  onLike: PropTypes.func.isRequired,
  onToggleComments: PropTypes.func.isRequired,
  onReply: PropTypes.func.isRequired,
  actionMessage: PropTypes.string,
};

export default function PostActionsComponent({ hasLiked, likesCount, commentsCount, canInteract, onLike, onToggleComments, onReply, actionMessage }) {
  const LikeIcon = hasLiked ? HeartFillIcon : HeartIcon;

  return (
    <div className={styles.actions}>
      {/* LIKE */}
      {canInteract && (
        <div className={styles.actionItem}>
          <IconButton icon={LikeIcon} aria-label="Curtir" className={`${styles.iconBtn} ${hasLiked ? styles.liked : ""}`} onClick={onLike} />
          <span className={styles.counter}>{likesCount}</span>
        </div>
      )}

      {/* COMENTÁRIOS */}
      <div className={styles.actionItem}>
        <IconButton icon={CommentDiscussionIcon} aria-label="Comentários" className={styles.iconBtn} onClick={onToggleComments} />
        <span className={styles.counter}>{commentsCount}</span>
      </div>

      {/* RESPONDER */}
      {canInteract && (
        <Button variant="invisible" className={styles.replyBtn} onClick={onReply}>
          Comentar
        </Button>
      )}
      {/* Message */}
      {actionMessage && <p>{actionMessage}</p>}
    </div>
  );
}
