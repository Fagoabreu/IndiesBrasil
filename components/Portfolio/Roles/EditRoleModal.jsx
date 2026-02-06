import { useEffect, useState } from "react";
import { Button, Dialog, FormControl, ActionMenu, ActionList } from "@primer/react";
import IconSvg from "@/components/IconSvg/IconSvg";
import StarExperienceSelector from "@/components/Selectors/StarExperienceSelector";
import styles from "./EditRoleModal.module.css";

export default function EditRoleModal({ initialData, onSave, onClose }) {
  const [professionsCatalog, setProfessionsCatalog] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(() => ({
    name: initialData?.name || "",
    experience: initialData?.experience || "Estudante",
  }));

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch("/api/v1/professions", {
          credentials: "include",
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Erro de API");

        setProfessionsCatalog(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      }
    }

    loadCatalog();
  }, []);

  function update(field, value) {
    setForm((s) => ({ ...s, [field]: value }));
  }

  async function handleSave() {
    setLoading(true);

    await onSave({
      name: form.name,
      experience: form.experience,
    });

    setLoading(false);
    onClose();
  }

  const selectedProfession = professionsCatalog.find((p) => p.name === form.name);

  return (
    <Dialog onDismiss={onClose}>
      <Dialog.Header>Especialização</Dialog.Header>

      {error && <p>{error}</p>}

      <div className={styles.body}>
        <FormControl className={styles.formControl}>
          <FormControl.Label>Especialização</FormControl.Label>

          <ActionMenu>
            <ActionMenu.Button block>{selectedProfession ? selectedProfession.name : "Selecionar especialização"}</ActionMenu.Button>

            <ActionMenu.Overlay className={styles.professionsOverlay}>
              <ActionList>
                {professionsCatalog.map((p) => (
                  <ActionList.Item key={p.name} selected={form.name === p.name} onSelect={() => update("name", p.name)}>
                    <ActionList.LeadingVisual>
                      <IconSvg src={`/images/professions/${p.icon_img}.png`} alt={p.name} size={16} />
                    </ActionList.LeadingVisual>
                    {p.name}
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
        <Button variant="primary" loading={loading} disabled={!form.name} onClick={handleSave}>
          Salvar
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
