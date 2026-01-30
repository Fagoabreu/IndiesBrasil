import { Dialog, Button, FormControl, Select, ActionMenu, ActionList } from "@primer/react";
import IconSvg from "@/components/IconSvg/IconSvg";
import { useState } from "react";

const EXPERIENCES = ["Estudante", "Junior", "Pleno", "Senior", "Especialista"];

export default function EditFerramentaModal({ onClose, onSave, tools = [], initialData }) {
  const [form, setForm] = useState(() => ({
    tool_id: initialData?.tool_id || "",
    experience: initialData?.experience || "Estudante",
  }));

  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  const selectedTool = tools.find((t) => t.id === form.tool_id);

  return (
    <Dialog onDismiss={onClose} onClose={onClose}>
      <Dialog.Header>Ferramenta</Dialog.Header>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <FormControl>
          <FormControl.Label>Ferramenta</FormControl.Label>

          <ActionMenu>
            <ActionMenu.Button block>{selectedTool ? selectedTool.name : "Selecionar ferramenta"}</ActionMenu.Button>

            <ActionMenu.Overlay width="medium">
              <ActionList>
                {tools.map((t) => (
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

        <FormControl>
          <FormControl.Label>Nível de experiência</FormControl.Label>
          <Select value={form.experience} onChange={(e) => update("experience", e.target.value)}>
            {EXPERIENCES.map((e) => (
              <Select.Option key={e} value={e}>
                {e}
              </Select.Option>
            ))}
          </Select>
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
