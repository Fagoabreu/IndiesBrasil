import { Button, ButtonGroup, Textarea } from "@primer/react";
import { useState } from "react";
import styles from "./CommentPanelComponent.module.css";
import CommentComponent from "../Comment/CommentComponent";

export default function CommentPanelComponent({ comments, showCommentBox, showComments, onCloseCommentBox, onSubmitComment, onDeleteComment }) {
  const [newComment, setNewComment] = useState("");

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onSubmitComment(newComment);
    setNewComment("");
  };

  return (
    <div>
      {/* CAIXA DE COMENTÁRIO */}
      {showCommentBox && (
        <div className={styles.commentBox}>
          <Textarea placeholder="Adicionar comentário..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          <ButtonGroup className={styles.commentActions} disabled={!newComment.trim()}>
            <Button variant="danger" onClick={onCloseCommentBox}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!newComment.trim()} onClick={handleSubmit}>
              Comentar
            </Button>
          </ButtonGroup>
        </div>
      )}

      {/* LISTA DE COMENTÁRIOS */}
      {showComments && (
        <div className={styles.commentList}>
          {comments.map((comment) => (
            <CommentComponent key={comment.id} comment={comment} onDelete={() => onDeleteComment(comment.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
