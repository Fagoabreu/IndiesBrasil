import { useState } from "react";
import { useRouter } from "next/router";
import { IconButton } from "@primer/react";
import { HeartIcon, HeartFillIcon, CommentDiscussionIcon } from "@primer/octicons-react";
import CommentPanelComponent from "../CommentPanel/CommentPanelComponent";
import styles from "./ContentEngagement.module.css";
import PropTypes from "prop-types";

ContentEngagement.propTypes = {
  apiBase: PropTypes.string.isRequired,
  initialLikesCount: PropTypes.number,
  initialCommentsCount: PropTypes.number,
  initialLiked: PropTypes.bool,
  user: PropTypes.object,
};

export default function ContentEngagement({ apiBase, initialLikesCount = 0, initialCommentsCount = 0, initialLiked = false, user }) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  async function handleLike() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await fetch(`${apiBase}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ liked: !liked }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikesCount((count) => {
          if (data.action === "created") return count + 1;
          if (data.action === "removed") return Math.max(0, count - 1);
          return count;
        });
      }
    } finally {
      setLikeLoading(false);
    }
  }

  function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next) loadComments();
  }

  async function loadComments() {
    if (commentsLoading) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(`${apiBase}/comments`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setComments(list);
        setCommentsCount(list.length);
      }
    } finally {
      setCommentsLoading(false);
    }
  }

  function handleReply() {
    if (!user) {
      router.push("/login");
      return;
    }
    setShowCommentBox(true);
    setShowComments(true);
  }

  async function handleSubmitComment(content) {
    const res = await fetch(`${apiBase}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const comment = await res.json();
      setComments((prev) => [comment, ...prev]);
      setCommentsCount((count) => count + 1);
      setShowCommentBox(false);
      setShowComments(true);
    }
  }

  async function handleDeleteComment(commentId) {
    const res = await fetch(`${apiBase}/comments/${commentId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      setCommentsCount((count) => Math.max(0, count - 1));
    }
  }

  const LikeIcon = liked ? HeartFillIcon : HeartIcon;

  return (
    <div className={styles.engagement}>
      <div className={styles.actions}>
        <div className={styles.actionItem}>
          <IconButton icon={LikeIcon} aria-label="Curtir" className={`${styles.iconBtn} ${liked ? styles.liked : ""}`} onClick={handleLike} />
          <span className={styles.counter}>{likesCount}</span>
        </div>

        <div className={styles.actionItem}>
          <IconButton icon={CommentDiscussionIcon} aria-label="Comentários" className={styles.iconBtn} onClick={toggleComments} />
          <span className={styles.counter}>{commentsCount}</span>
        </div>

        <button type="button" className={styles.replyBtn} onClick={handleReply}>
          Comentar
        </button>
      </div>

      <CommentPanelComponent
        comments={comments}
        showCommentBox={showCommentBox}
        showComments={showComments}
        onCloseCommentBox={() => setShowCommentBox(false)}
        onSubmitComment={handleSubmitComment}
        onDeleteComment={handleDeleteComment}
      />
    </div>
  );
}
