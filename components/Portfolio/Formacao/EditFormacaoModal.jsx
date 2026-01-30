import { useState } from "react";
import { Dialog, Button, TextInput, FormControl } from "@primer/react";

export default function EditFormacaoModal({ onClose, onSave, initialData }) {
  const [form, setForm] = useState(() => ({
    nome: initialData?.nome || "",
    instituicao: initialData?.instituicao || "",
    init_date: initialData?.init_date?.slice(0, 10) || "",
    end_date: initialData?.end_date?.slice(0, 10) || "",
  }));

  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setLoading(true);

    await onSave({
      nome: form.nome,
      instituicao: form.instituicao,
      init_date: form.init_date,
      end_date: form.end_date || null,
    });

    setLoading(false);
    onClose();
  }

  return (
    <Dialog onDismiss={onClose} onClose={onClose}>
      <Dialog.Header>Formação acadêmica</Dialog.Header>

      <div
        style={{
          padding: 16,
          display: "flex",
          gap: 12,
          flexDirection: "column",
        }}
      >
        <FormControl>
          <FormControl.Label>Curso</FormControl.Label>
          <TextInput block value={form.nome} onChange={(e) => update("nome", e.target.value)} />
        </FormControl>

        <FormControl>
          <FormControl.Label>Instituição</FormControl.Label>
          <TextInput block value={form.instituicao} onChange={(e) => update("instituicao", e.target.value)} />
        </FormControl>

        <FormControl>
          <FormControl.Label>Início</FormControl.Label>
          <TextInput type="date" block value={form.init_date} onChange={(e) => update("init_date", e.target.value)} />
        </FormControl>

        <FormControl>
          <FormControl.Label>Conclusão</FormControl.Label>
          <TextInput type="date" block value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
        </FormControl>
      </div>

      <Dialog.Footer>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={loading} onClick={handleSave}>
          Salvar
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
