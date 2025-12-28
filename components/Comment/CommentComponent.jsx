import { Avatar, Button } from "@primer/react";
import styles from "./CommentComponent.module.css";

export default function CommentComponent({ comment, onDelete }) {
  return (
    <div className={styles.commentDiv}>
      <Avatar src={comment.author_avatar_image || "/images/avatar.png"} size={32} />
      <div className={styles.commentBody}>
        <span className={styles.commentUser}>@{comment.author_username}</span>
        <p className={styles.commentText}>{comment.content}</p>
      </div>
      {comment.is_current_user && (
        <Button variant="invisible" className={styles.deleteBtn} onClick={onDelete}>
          Deletar
        </Button>
      )}
    </div>
  );
}
