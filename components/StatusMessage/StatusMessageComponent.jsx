import { Flash } from "@primer/react";
import PropTypes from "prop-types";

StatusMessageComponent.propTypes = {
  errorMsg: PropTypes.shape({
    message: PropTypes.string.isRequired,
    action: PropTypes.string,
  }),
  successMsg: PropTypes.string,
};

export default function StatusMessageComponent({ errorMsg, successMsg }) {
  return (
    <div>
      {errorMsg && (
        <Flash variant="danger">
          <strong>{errorMsg.message}</strong>
          {errorMsg.action && <div style={{ marginTop: 4 }}>{errorMsg.action}</div>}
        </Flash>
      )}
      {successMsg && (
        <Flash variant="success" style={{ whiteSpace: "pre-line" }}>
          {successMsg}
        </Flash>
      )}
    </div>
  );
}
