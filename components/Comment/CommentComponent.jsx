import { Avatar, Button } from "@primer/react";
import styles from "./CommentComponent.module.css";
import PropTypes from "prop-types";
import { markdownToHtml } from "@/utils/markdown";

// Handler puro de DOM para toggle de spoilers — não depende de estado/props
function handleSpoilerClick(e) {
  const spoiler = e.target.closest(".spoiler");
  if (!spoiler) return;
  spoiler.classList.toggle("revealed");
  if (e.target.tagName === "A" && !spoiler.classList.contains("revealed")) {
    e.preventDefault();
  }
}

function handleSpoilerKeyDown(e) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    handleSpoilerClick(e);
  }
}

CommentComponent.propTypes = {
  comment: PropTypes.shape({
    author_avatar_image: PropTypes.string,
    author_username: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    is_current_user: PropTypes.bool.isRequired,
  }).isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default function CommentComponent({ comment, onDelete }) {
  const commentHtml = markdownToHtml(comment.content);

  return (
    <div className={styles.commentDiv}>
      <Avatar src={comment.author_avatar_image || "/images/avatar.png"} size={32} />
      <div className={styles.commentBody}>
        <span className={styles.commentUser}>@{comment.author_username}</span>
        <div // NOSONAR
          className={styles.commentContent}
          onClick={handleSpoilerClick}
          onKeyDown={handleSpoilerKeyDown}
          /* dangerouslySetInnerHTML: markdown convertido para HTML com
           * sanitização de tags. Conteúdo vindo de usuário autenticado. */
          dangerouslySetInnerHTML={{
            __html: commentHtml,
          }}
        />
      </div>
      {comment.is_current_user && (
        <Button variant="invisible" className={styles.deleteBtn} onClick={onDelete}>
          Deletar
        </Button>
      )}
    </div>
  );
}
