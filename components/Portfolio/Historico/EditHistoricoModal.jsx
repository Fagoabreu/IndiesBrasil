import { useState } from "react";
import { Dialog, Button, TextInput, Textarea, FormControl } from "@primer/react";
import styles from "./EditHistoricoModal.module.css";

export default function EditHistoricoModal({ onClose, onSave, initialData }) {
  const [form, setForm] = useState(() => ({
    cargo: initialData?.cargo || "",
    company: initialData?.company || "",
    cidade: initialData?.cidade || "",
    estado: initialData?.estado || "",
    init_date: initialData?.init_date?.slice(0, 10) || "",
    end_date: initialData?.end_date?.slice(0, 10) || "",
    atribuicoes: Array.isArray(initialData?.atribuicoes) ? initialData.atribuicoes.join("\n") : "",
  }));

  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setLoading(true);

    await onSave({
      cargo: form.cargo,
      company: form.company,
      cidade: form.cidade,
      estado: form.estado,
      init_date: form.init_date,
      end_date: form.end_date || null,
      atribuicoes: form.atribuicoes
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
    });

    setLoading(false);
    onClose();
  }

  return (
    <Dialog onDismiss={onClose} onClose={onClose} aria-labelledby="edit-historico">
      <Dialog.Header id="edit-historico">Histórico profissional</Dialog.Header>

      <div className="modal-body">
        <FormControl>
          <FormControl.Label>Cargo</FormControl.Label>
          <TextInput block value={form.cargo} onChange={(e) => update("cargo", e.target.value)} />
        </FormControl>

        <FormControl>
          <FormControl.Label>Empresa</FormControl.Label>
          <TextInput block value={form.company} onChange={(e) => update("company", e.target.value)} />
        </FormControl>

        <div className={styles.addressRow}>
          <FormControl className={styles.mediumInput}>
            <FormControl.Label>Cidade</FormControl.Label>
            <TextInput block value={form.cidade} onChange={(e) => update("cidade", e.target.value)} />
          </FormControl>

          <FormControl className={styles.smallInput}>
            <FormControl.Label>Estado</FormControl.Label>
            <TextInput block value={form.estado} onChange={(e) => update("estado", e.target.value)} />
          </FormControl>
        </div>

        <div className={styles.dateRow}>
          <FormControl>
            <FormControl.Label>Início</FormControl.Label>
            <TextInput type="date" block value={form.init_date} onChange={(e) => update("init_date", e.target.value)} />
          </FormControl>

          <FormControl>
            <FormControl.Label>Fim</FormControl.Label>
            <TextInput type="date" block value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
          </FormControl>
        </div>

        <FormControl>
          <FormControl.Label>Atribuições</FormControl.Label>
          <Textarea
            rows={5}
            block
            placeholder="Uma atribuição por linha"
            value={form.atribuicoes}
            onChange={(e) => update("atribuicoes", e.target.value)}
          />
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
