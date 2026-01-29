import { Dialog, Button, Text } from "@primer/react";

export default function DeleteConfirm({ itemName, onConfirm, onCancel, loading }) {
  function handleCancel() {
    if (typeof onCancel === "function") {
      onCancel();
    }
  }

  return (
    <Dialog onDismiss={handleCancel} onClose={handleCancel} aria-labelledby="delete-historico">
      <Dialog.Header id="deleteHeader">Confirmação Exclusão</Dialog.Header>

      <div style={{ padding: 16 }}>
        <Text size="medium">
          Tem certeza que deseja excluir o item <strong>{itemName}</strong>?
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
