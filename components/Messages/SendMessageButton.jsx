import { useState } from "react";
import { useRouter } from "next/router";
import PropTypes from "prop-types";
import { MailIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./SendMessageButton.module.css";

/**
 * "Enviar mensagem" para um membro ou estúdio.
 *
 * Abre (ou recupera) a conversa e leva o usuário para a **própria** caixa de
 * entrada, já com a conversa aberta. O destino é sempre o próprio perfil: a
 * caixa de entrada é privada, então mostrar a de outra pessoa não existe — nem
 * como rota, nem como efeito deste botão.
 *
 * A aparência vem de fora (`className`), para o botão ficar idêntico aos
 * vizinhos de cada cabeçalho (o perfil e o estúdio usam estilos diferentes).
 */
export default function SendMessageButton({ targetType, targetId, className = "" }) {
  const router = useRouter();
  const { user } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Sem sessão não há caixa de entrada: o caminho é entrar.
  if (!user?.id) {
    return (
      <button type="button" className={className} onClick={() => router.push("/login")}>
        <MailIcon size={14} /> Enviar mensagem
      </button>
    );
  }

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || "Não foi possível abrir a conversa.");
        return;
      }

      router.push(`/perfil/${user.username}?tab=mensagens&conversa=${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={handleClick} disabled={busy} aria-busy={busy}>
        <MailIcon size={14} /> {busy ? "Abrindo…" : "Enviar mensagem"}
      </button>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </>
  );
}

SendMessageButton.propTypes = {
  /** `user` ou `studio`. */
  targetType: PropTypes.string.isRequired,
  /** `id` do usuário ou do estúdio alvo. */
  targetId: PropTypes.string.isRequired,
  /** Classe do cabeçalho que hospeda o botão (perfil e estúdio têm estilos próprios). */
  className: PropTypes.string,
};
