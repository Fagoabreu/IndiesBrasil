import { Dialog, Button, Text } from "@primer/react";

export default function DeleteHistoricoConfirm({ cargo, onConfirm, onCancel, loading }) {
  return (
    <Dialog onDismiss={onCancel} aria-labelledby="delete-historico">
      <Dialog.Header id="delete-historico">Excluir experiência</Dialog.Header>

      <div style={{ padding: 16 }}>
        <Text size="medium">
          Tem certeza que deseja excluir a experiência <strong>{cargo}</strong>?
        </Text>
      </div>

      <Dialog.Footer>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          Excluir
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
