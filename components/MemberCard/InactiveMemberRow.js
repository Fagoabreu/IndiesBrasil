import PropTypes from "prop-types";
import { ClockIcon, MailIcon, PersonIcon } from "@primer/octicons-react";
import styles from "./InactiveMemberRow.module.css";

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Linha da lista de contas não ativadas (aba "Inativos", só para admin).
 *
 * Não reaproveita o `MemberCard` de propósito: aquele é o cartão público do
 * diretório (avatar, bio, reputação, link para o perfil) e a conta em questão
 * não tem perfil público — o que o administrador precisa ver é **e-mail**,
 * quando o token venceu e se há um pedido de redefinição mantendo o cadastro
 * vivo. Campo e propósito diferentes, componente diferente.
 */
export default function InactiveMemberRow({ member }) {
  return (
    <li className={styles.row}>
      <div className={styles.identity}>
        <span className={styles.username}>
          <PersonIcon size={14} />
          {member.username}
        </span>
        <a className={styles.email} href={`mailto:${member.email}`}>
          <MailIcon size={14} />
          {member.email}
        </a>
      </div>

      <div className={styles.dates}>
        <span className={styles.dateLabel}>Cadastro</span>
        <span className={styles.dateValue}>{formatDateTime(member.created_at)}</span>
      </div>

      <div className={styles.dates}>
        <span className={styles.dateLabel}>
          <ClockIcon size={12} /> Token expirou
        </span>
        <span className={styles.dateValue}>{formatDateTime(member.activation_expires_at)}</span>
      </div>

      <div className={styles.flags}>
        {member.has_other_token ? (
          <span className={styles.flagKeep} title="Pediu redefinição de senha: a limpeza automática não remove este cadastro.">
            tem pedido de reset
          </span>
        ) : (
          <span className={styles.flagFree} title="Nenhum outro token: um novo cadastro com estes dados libera o registro automaticamente.">
            liberável no próximo cadastro
          </span>
        )}
      </div>
    </li>
  );
}

InactiveMemberRow.propTypes = {
  member: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
    created_at: PropTypes.string,
    activation_expires_at: PropTypes.string,
    has_other_token: PropTypes.bool,
  }).isRequired,
};
