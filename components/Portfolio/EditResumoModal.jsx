import { useState } from "react";
import { Dialog, Button, Textarea, TextInput, FormControl, Select } from "@primer/react";

export default function EditResumoModal({ onClose, initVisibility, initResume, initBio, onSave }) {
  const [visibility, setVisibility] = useState(initVisibility || "public");
  const [resume, setResume] = useState(initResume || "");
  const [bio, setBio] = useState(initBio || "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);

    await onSave({
      resumo: resume,
      visibility,
      bio,
    });

    setLoading(false);
    onClose();
  }

  return (
    <Dialog onDismiss={onClose} onClose={onClose} aria-labelledby="edit-resumo">
      <Dialog.Header id="edit-resumo">Editar resumo e bio</Dialog.Header>

      <div
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <FormControl>
          <FormControl.Label>Visibilidade</FormControl.Label>
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <Select.Option value="public">Público</Select.Option>
            <Select.Option value="followers">Seguidores</Select.Option>
            <Select.Option value="private">Privado</Select.Option>
          </Select>
        </FormControl>

        <FormControl>
          <FormControl.Label>Resumo profissional</FormControl.Label>
          <TextInput block value={resume} onChange={(e) => setResume(e.target.value)} />
        </FormControl>

        <FormControl>
          <FormControl.Label>Bio</FormControl.Label>
          <Textarea block rows={5} value={bio} onChange={(e) => setBio(e.target.value)} />
        </FormControl>
      </div>

      <Dialog.Footer>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSave} loading={loading}>
          Salvar
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
