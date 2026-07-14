import { Dialog, Text } from "@primer/react";
import PropTypes from "prop-types";

export default function DeleteConfirm({
  itemName,
  onConfirm,
  onCancel,
  loading,
}) {
  return (
    <Dialog
      title="Confirmação de Exclusão"
      onClose={onCancel}
      footerButtons={[
        {
          buttonType: "default",
          content: "Cancelar",
          onClick: onCancel,
          disabled: loading,
        },
        {
          buttonType: "danger",
          content: "Excluir",
          onClick: onConfirm,
          loading,
          disabled: loading,
        },
      ]}
    >
      <div style={{ padding: 16 }}>
        <Text size="medium">
          Tem certeza que deseja excluir o item <strong>{itemName}</strong>?
        </Text>
      </div>
    </Dialog>
  );
}

DeleteConfirm.propTypes = {
  itemName: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};
