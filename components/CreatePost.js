import { useState } from "react";
import { Avatar, Textarea, Button, Stack } from "@primer/react";
import styles from "./CreatePost.module.css";

export default function CreatePost({ user, onPost }) {
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

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
      // Envia para PostsPage
      await onPost(content, imagePreview);

      // Limpa campos
      setContent("");
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      console.error("Erro ao criar post:", err);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Stack
      direction="vertical"
      gap={2}
      sx={{
        padding: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "border.default",
        display: "flex",
        marginBottom: 16,
      }}
    >
      <Stack direction="horizontal" gap={2}>
        <Avatar src={user.avatarUrl || "/images/avatar.png"} size={40} />
        <Textarea placeholder="No que você está pensando?" value={content} onChange={(e) => setContent(e.target.value)} disabled={isPosting} sx={{ width: "100%" }} />
      </Stack>

      {/* Input de imagem */}
      <input type="file" accept="image/*" onChange={handleImageSelect} />

      {/* Preview */}
      {imagePreview && (
        <div className={styles.previewBox}>
          <img src={imagePreview} className={styles.previewImg} />
          <button
            className={styles.removeBtn}
            onClick={() => {
              setImagePreview(null);
              setImageFile(null);
            }}
          >
            Remover imagem
          </button>
        </div>
      )}

      <Button onClick={handleSubmit} disabled={!content.trim() || isPosting} sx={{ alignSelf: "flex-end" }}>
        {isPosting ? "Postando..." : "Postar"}
      </Button>
    </Stack>
  );
}
