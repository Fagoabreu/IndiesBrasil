import { useState, useRef } from "react";
import { Avatar, Textarea, Button, Stack, IconButton } from "@primer/react";
import { ImageIcon, TrashIcon, PlusIcon, XIcon } from "@primer/octicons-react";
import Image from "next/image";
import styles from "./CreatePost.module.css";
import PropTypes from "prop-types";
import { useTagSuggest } from "@/context/dataHooks/UseTagSuggest";

CreatePost.propTypes = {
  user: PropTypes.shape({
    avatar_image: PropTypes.string,
  }).isRequired,

  onPost: PropTypes.func.isRequired,
};

export default function CreatePost({ user, onPost }) {
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);

  // Poll state
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const match = content.match(/#(\w{2,})$/);
  const query = match ? match[1] : null;
  const { data: suggestions } = useTagSuggest(query);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const addPollOption = () => {
    if (pollOptions.length < 10) setPollOptions([...pollOptions, ""]);
  };

  const removePollOption = (index) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  const updatePollOption = (index, value) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  const resetPoll = () => {
    setShowPoll(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile && !showPoll) return;

    setIsPosting(true);
    try {
      const formData = new FormData();
      formData.append("content", content);

      if (imageFile) {
        formData.append("file", imageFile);
      }

      if (showPoll && pollQuestion.trim()) {
        formData.append("poll_question", pollQuestion.trim());
        const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        formData.append("poll_options", JSON.stringify(validOptions));
      }

      await onPost(content, imageFile, formData);
      setContent("");
      setImagePreview(null);
      setImageFile(null);
      resetPoll();
    } catch (err) {
      console.error("Erro ao criar post:", err);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className={styles.container}>
      <Stack direction="horizontal" gap={2} align="flex-start">
        <div className={styles.avatarRing}>
          <Avatar src={user.avatar_image || "/images/avatar.png"} size={40} />
        </div>

        <div className={styles.contentArea}>
          <Textarea
            placeholder="No que você está pensando?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isPosting}
            className={styles.textarea}
          />

          {suggestions?.length > 0 && (
            <ul className={styles.tagSuggest}>
              {suggestions.map((tag) => (
                <li key={tag.name}>
                  <button
                    type="button"
                    className={styles.tagSuggestItem}
                    onClick={() =>
                      setContent((prev) =>
                        prev.replace(/#\w*$/, `#${tag.name} `),
                      )
                    }
                  >
                    #{tag.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {imagePreview && (
            <div className={styles.previewBox}>
              <Image
                src={imagePreview}
                alt="Pré-visualização da imagem"
                width={300}
                height={300}
                unoptimized
                className={styles.previewImg}
              />

              <IconButton
                icon={TrashIcon}
                aria-label="Remover imagem"
                className={styles.removeImageBtn}
                onClick={() => setImagePreview(null)}
              />
            </div>
          )}

          {/* ─── Poll Area ─── */}
          {showPoll && (
            <div className={styles.pollArea}>
              <input
                className={styles.pollInput}
                placeholder="Pergunta da enquete"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                disabled={isPosting}
              />

              {pollOptions.map((option, index) => (
                <div key={index} className={styles.pollOptionRow}>
                  <input
                    className={styles.pollInput}
                    placeholder={`Opção ${index + 1}`}
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                    disabled={isPosting}
                  />
                  {pollOptions.length > 2 && (
                    <IconButton
                      icon={XIcon}
                      aria-label="Remover opção"
                      size="small"
                      variant="invisible"
                      onClick={() => removePollOption(index)}
                    />
                  )}
                </div>
              ))}

              {pollOptions.length < 10 && (
                <button
                  type="button"
                  className={styles.addOptionBtn}
                  onClick={addPollOption}
                  disabled={isPosting}
                >
                  <PlusIcon size={12} /> Adicionar opção
                </button>
              )}
            </div>
          )}

          <div className={styles.actionBar}>
            <Stack direction="horizontal" gap={1}>
              <IconButton
                icon={ImageIcon}
                aria-label="Adicionar imagem"
                onClick={() => fileInputRef.current.click()}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className={styles.fileInput}
              />

              <button
                type="button"
                className={`${styles.pollToggleBtn} ${showPoll ? styles.pollToggleActive : ""}`}
                onClick={() => setShowPoll(!showPoll)}
                disabled={isPosting}
              >
                Enquete
              </button>
            </Stack>

            <Button
              variant="primary"
              disabled={
                (!content.trim() && !imagePreview && !showPoll) || isPosting
              }
              onClick={handleSubmit}
            >
              {isPosting ? "Postando..." : "Postar"}
            </Button>
          </div>
        </div>
      </Stack>
    </div>
  );
}
