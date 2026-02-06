import { useEffect, useState } from "react";
import { Dialog, Button, FormControl, ActionMenu, ActionList } from "@primer/react";
import IconSvg from "@/components/IconSvg/IconSvg";
import StarExperienceSelector from "@/components/Selectors/StarExperienceSelector";
import styles from "./EditFerramentaModal.module.css";

export default function EditFerramentaModal({ onClose, onSave, initialData }) {
  const [toolsCatalog, setToolsCatalog] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(() => ({
    tool_id: initialData?.tool_id || null,
    experience: initialData?.experience || "Estudante",
  }));

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch("/api/v1/tools", {
          credentials: "include",
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        setToolsCatalog(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      }
    }

    loadCatalog();
  }, []);

  const selectedTool = toolsCatalog.find((t) => t.id === form.tool_id);

  function update(field, value) {
    setForm((s) => ({ ...s, [field]: value }));
  }

  async function handleSave() {
    setLoading(true);

    await onSave({
      portfolio_tool_id: form.tool_id,
      experience: form.experience,
    });

    setLoading(false);
    onClose();
  }

  return (
    <Dialog onDismiss={onClose}>
      <Dialog.Header>Ferramenta</Dialog.Header>

      {error && <p>{error}</p>}

      <div className={styles.body}>
        <FormControl className={styles.formControl}>
          <FormControl.Label>Ferramenta</FormControl.Label>
          <ActionMenu>
            <ActionMenu.Button block>{selectedTool ? selectedTool.name : "Selecionar ferramenta"}</ActionMenu.Button>
            <ActionMenu.Overlay className={styles.toolsOverlay}>
              <ActionList>
                {toolsCatalog.map((t) => (
                  <ActionList.Item key={t.id} selected={form.tool_id === t.id} onSelect={() => update("tool_id", t.id)}>
                    <ActionList.LeadingVisual>
                      <IconSvg src={`/images/tools/${t.icon_img}.svg`} alt={t.name} size={16} />
                    </ActionList.LeadingVisual>
                    {t.name}
                  </ActionList.Item>
                ))}
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
        </FormControl>

        <FormControl className={styles.formControl}>
          <FormControl.Label>Nível de experiência</FormControl.Label>
          <StarExperienceSelector value={form.experience} onChange={(v) => update("experience", v)} />
        </FormControl>
      </div>

      <Dialog.Footer>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={loading} disabled={!form.tool_id} onClick={handleSave}>
          Salvar
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
