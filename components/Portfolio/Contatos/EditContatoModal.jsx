import { useEffect, useState } from "react";
import { Dialog, Button, TextInput, FormControl, Select, Spinner } from "@primer/react";

async function fetchJSON(url) {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Erro");
  return data;
}

export default function EditContatoModal({ onClose, onSave, initialData }) {
  const [types, setTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  const [form, setForm] = useState({
    contact_type_id: "",
    contact_value: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadTypes() {
      try {
        const data = await fetchJSON("/api/v1/contact-types");
        setTypes(data);
      } finally {
        setLoadingTypes(false);
      }
    }
    loadTypes();
  }, []);

  useEffect(() => {
    if (initialData) {
      setForm({
        contact_type_id: initialData.contact_type_id,
        contact_value: initialData.contact_value,
      });
    }
  }, [initialData]);

  function update(field, value) {
    setForm((s) => ({ ...s, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);

    await onSave({
      contact_type_id: form.contact_type_id,
      contact_value: form.contact_value,
    });

    setSaving(false);
    onClose();
  }

  return (
    <Dialog onDismiss={onClose} onClose={onClose}>
      <Dialog.Header>Contato</Dialog.Header>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {loadingTypes ? (
          <Spinner />
        ) : (
          <FormControl>
            <FormControl.Label>Tipo de contato</FormControl.Label>
            <Select value={form.contact_type_id} onChange={(e) => update("contact_type_id", e.target.value)}>
              <Select.Option value="">Selecione</Select.Option>
              {types.map((t) => (
                <Select.Option key={t.id} value={t.id}>
                  {t.icon_key}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl>
          <FormControl.Label>Contato</FormControl.Label>
          <TextInput block value={form.contact_value} onChange={(e) => update("contact_value", e.target.value)} />
        </FormControl>
      </div>

      <Dialog.Footer>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} disabled={!form.contact_type_id || !form.contact_value} onClick={handleSave}>
          Salvar
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
