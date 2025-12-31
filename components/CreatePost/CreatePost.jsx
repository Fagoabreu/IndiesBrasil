import { useState, useRef } from "react";
import { Avatar, Textarea, Button, Stack, IconButton } from "@primer/react";
import { ImageIcon, TrashIcon } from "@primer/octicons-react";
import Image from "next/image";
import styles from "./CreatePost.module.css";
import PropTypes from "prop-types";

CreatePost.propTypes = {
  user: PropTypes.shape({
    avatarUrl: PropTypes.string,
  }).isRequired,

  onPost: PropTypes.func.isRequired,
};

export default function CreatePost({ user, onPost }) {
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsPosting(true);
    try {
      await onPost(content, imageFile);
      setContent("");
      setImagePreview(null);
      setImageFile(null);
    } catch (err) {
      console.error("Erro ao criar post:", err);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className={styles.container}>
      <Stack direction="horizontal" gap={2} align="flex-start">
        <Avatar src={user.avatarUrl || "/images/avatar.png"} size={40} />

        <div className={styles.contentArea}>
          <Textarea
            placeholder="No que você está pensando?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isPosting}
            className={styles.textarea}
          />

          {imagePreview && (
            <div className={styles.previewBox}>
              <Image src={imagePreview} alt="Pré-visualização da imagem" width={300} height={300} unoptimized className={styles.previewImg} />

              <IconButton icon={TrashIcon} aria-label="Remover imagem" className={styles.removeImageBtn} onClick={() => setImagePreview(null)} />
            </div>
          )}

          <div className={styles.actionBar}>
            <div>
              <IconButton icon={ImageIcon} aria-label="Adicionar imagem" onClick={() => fileInputRef.current.click()} />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className={styles.fileInput} />
            </div>

            <Button variant="primary" disabled={(!content.trim() && !imagePreview) || isPosting} onClick={handleSubmit}>
              {isPosting ? "Postando..." : "Postar"}
            </Button>
          </div>
        </div>
      </Stack>
    </div>
  );
}
