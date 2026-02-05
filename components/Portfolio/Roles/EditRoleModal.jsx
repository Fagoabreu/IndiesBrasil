import { useEffect, useState } from "react";
import { Button, Dialog, FormControl, ActionMenu, ActionList } from "@primer/react";
import ExperienceSelector from "@/components/Selectors/ExperienceSelector";
import IconSvg from "@/components/IconSvg/IconSvg";

export default function EditRoleModal({ initialData, onSave, onClose }) {
  const [professionsCatalog, setProfessionsCatalog] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch("/api/v1/professions", {
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Erro de API");
        }

        setProfessionsCatalog(data);
      } catch (err) {
        setError(err.message);
      }
    }

    loadCatalog();
  }, []);

  const [form, setForm] = useState(() => ({
    name: initialData?.name || "",
    experience: initialData?.experience || "Estudante",
    icon: initialData?.icon_img || "",
  }));

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  const selectedProfession = professionsCatalog.find((t) => t.name === form.name);

  return (
    <Dialog onDismiss={onClose} onClose={onClose}>
      <Dialog.Header>Ferramenta</Dialog.Header>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <FormControl>
          <FormControl.Label>Ferramenta</FormControl.Label>

          <ActionMenu>
            <ActionMenu.Button block>{selectedProfession ? selectedProfession.name : "Selecionar ferramenta"}</ActionMenu.Button>

            <ActionMenu.Overlay width="medium">
              <ActionList>
                {professionsCatalog.map((t) => (
                  <ActionList.Item key={t.id} selected={form.profession_name === t.name} onSelect={() => update("name", t.name)}>
                    <ActionList.LeadingVisual>
                      <IconSvg src={`/images/professions/${t.icon_img}.png`} alt={t.name} size={16} />
                    </ActionList.LeadingVisual>
                    {t.name}
                  </ActionList.Item>
                ))}
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
        </FormControl>

        <FormControl>
          <FormControl.Label>Nível de experiência</FormControl.Label>
          <ExperienceSelector value={form.experience} onChange={(val) => update("experience", val)} />
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
