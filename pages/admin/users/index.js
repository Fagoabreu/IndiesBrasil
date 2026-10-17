import { useState } from "react";
import { Button, Flash, FormControl, Heading, PageLayout, Radio, RadioGroup, Select, Spinner, TextInput } from "@primer/react";
import { AlertIcon, OrganizationIcon, PersonIcon, TrashIcon, XCircleIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./index.module.css";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Rótulos de papel do estúdio para a lista de membros. */
function roleLabel(member) {
  if (member.is_owner) return "Responsável";
  if (member.roles.includes("admin")) return "Administrador";
  return "Membro";
}

/**
 * Exclusão definitiva de conta, pelo email.
 *
 * A tela tem **dois passos** de propósito: primeiro o administrador busca a
 * conta e vê de quem se trata (username, data de cadastro, se já foi ativada),
 * depois repete o email numa segunda caixa. A confirmação não é um "tem certeza?"
 * — é a digitação do endereço exato, que o servidor também valida
 * (`POST /api/v1/admin/users/purge`, campo `confirm_email`). É o que impede que
 * a última edição do campo de busca exclua outra conta por engano.
 *
 * A tela não decide o que pode ser apagado: conta admin, histórico de moderação
 * e criador de reunião são recusados pelo model, e a mensagem vem de lá.
 *
 * Quando a conta é **titular de um estúdio**, aparece um terceiro bloco: o
 * estúdio e os membros ativos com seus papéis, e a escolha obrigatória entre
 * excluir o estúdio com as obras (confirmando o **slug**) ou transferir a
 * responsabilidade para outro membro. Sem essa escolha a exclusão é recusada —
 * um estúdio sem responsável não pode ser administrado por ninguém.
 */
export default function AdminUsersPage() {
  const { user, loadingUser } = useUser();
  const isAdmin = Boolean(user?.features?.includes("read:admin"));

  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState(null);
  const [looking, setLooking] = useState(false);

  const [confirmEmail, setConfirmEmail] = useState("");
  const [studioAction, setStudioAction] = useState("delete");
  const [confirmStudioSlug, setConfirmStudioSlug] = useState("");
  const [transferToUserId, setTransferToUserId] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Outros membros do estúdio: o titular não pode "transferir para si mesmo", e
  // um estúdio só com ele não tem para quem transferir.
  const studio = lookup?.studio ?? null;
  const transferCandidates = studio ? studio.members.filter((member) => !member.is_owner) : [];

  const studioSlugMatches = studio ? confirmStudioSlug.trim() === studio.slug : false;
  const studioDecisionReady = !studio ? true : studioAction === "delete" ? studioSlugMatches : Boolean(transferToUserId);

  function resetLookup() {
    setLookup(null);
    setConfirmEmail("");
    setConfirmStudioSlug("");
    setTransferToUserId("");
    setStudioAction("delete");
  }

  async function handleLookup(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    resetLookup();

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Informe o email da conta.");
      return;
    }

    setLooking(true);
    try {
      const response = await fetch(`/api/v1/admin/users?email=${encodeURIComponent(trimmed)}`, { credentials: "include" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || "Não foi possível consultar a conta.");
      }

      setLookup(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLooking(false);
    }
  }

  async function handlePurge(event) {
    event.preventDefault();
    if (!lookup) return;

    setError(null);
    setSuccess(null);
    setDeleting(true);

    const payload = { email: lookup.email, confirm_email: confirmEmail };

    // Só envia os campos do estúdio quando existe um: o model recusa a ação
    // quando o valor não corresponde ao que está no banco.
    if (lookup.studio) {
      payload.studio_action = studioAction;
      if (studioAction === "delete") payload.confirm_studio_slug = confirmStudioSlug.trim();
      else payload.transfer_to_user_id = transferToUserId;
    }

    try {
      const response = await fetch("/api/v1/admin/users/purge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || "Não foi possível excluir a conta.");
      }

      let message =
        `Conta "${data.user.username}" (${data.user.email}) excluída definitivamente. ` +
        `${data.removed.posts} post(s), ${data.removed.comments} comentário(s), ` +
        `${data.removed.conversations} conversa(s) e ${data.removed.sessions} sessão(ões) removidos.`;

      if (data.studio?.action === "delete") {
        const removed = data.studio.removed;
        message +=
          ` Estúdio "${data.studio.studio.name}" excluído com ` +
          `${removed.games} jogo(s), ${removed.boardgames} jogo(s) de mesa e ${removed.books} livro(s)/quadrinho(s).`;
      } else if (data.studio?.action === "transfer") {
        message += ` Estúdio "${data.studio.studio.name}" transferido para outro membro.`;
      }

      setSuccess(message);
      setEmail("");
      resetLookup();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (loadingUser) {
    return (
      <PageLayout>
        <PageLayout.Content width="large" className={styles.center}>
          <Spinner />
        </PageLayout.Content>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return (
      <PageLayout>
        <PageLayout.Content width="large">
          <Flash variant="danger">Acesso restrito a administradores.</Flash>
        </PageLayout.Content>
      </PageLayout>
    );
  }

  const confirmationMatches = Boolean(lookup) && confirmEmail.trim().toLowerCase() === lookup.email.toLowerCase();

  return (
    <PageLayout>
      <PageLayout.Content width="large">
        <Heading as="h2">Excluir conta</Heading>

        <p className={styles.intro}>
          Remove a conta e todo o conteúdo dela do banco. <strong>Não há como desfazer</strong> — o email, o CPF e o username voltam a ficar livres
          para um novo cadastro.
        </p>

        {error && <Flash variant="danger">{error}</Flash>}
        {success && <Flash variant="success">{success}</Flash>}

        <section className={styles.card}>
          <Heading as="h3">1. Localizar a conta</Heading>
          <form onSubmit={handleLookup} className={styles.form}>
            <FormControl>
              <FormControl.Label>Email da conta</FormControl.Label>
              <TextInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="conta@exemplo.com"
                autoComplete="off"
                block
              />
            </FormControl>

            <div className={styles.actions}>
              <Button type="submit" disabled={looking}>
                {looking ? "Buscando…" : "Buscar conta"}
              </Button>
              {lookup && (
                <Button type="button" variant="invisible" onClick={resetLookup}>
                  Limpar
                </Button>
              )}
            </div>
          </form>
        </section>

        {lookup && (
          <section className={`${styles.card} ${styles.dangerCard}`}>
            <Heading as="h3">2. Confirmar a exclusão</Heading>

            <dl className={styles.summary}>
              <div className={styles.summaryRow}>
                <dt>Username</dt>
                <dd>{lookup.username}</dd>
              </div>
              <div className={styles.summaryRow}>
                <dt>Email</dt>
                <dd>{lookup.email}</dd>
              </div>
              <div className={styles.summaryRow}>
                <dt>Cadastro</dt>
                <dd>{formatDate(lookup.created_at)}</dd>
              </div>
              <div className={styles.summaryRow}>
                <dt>Situação</dt>
                <dd className={styles.summaryStatus}>
                  {lookup.activated ? (
                    <>
                      <PersonIcon size={14} /> ativada
                    </>
                  ) : (
                    <>
                      <XCircleIcon size={14} /> nunca ativada
                    </>
                  )}
                  {lookup.is_admin && (
                    <>
                      {" · "}
                      <AlertIcon size={14} /> administrador (não pode ser excluída)
                    </>
                  )}
                </dd>
              </div>
            </dl>

            {studio && (
              <div className={styles.studioBlock}>
                <Heading as="h4" className={styles.studioHeading}>
                  <OrganizationIcon size={16} /> Estúdio: {studio.name}
                </Heading>
                <p className={styles.studioHint}>
                  Esta conta é a responsável por <span className={styles.mono}>{studio.slug}</span>. Um estúdio não pode ficar sem responsável —
                  escolha o que fazer com ele antes de excluir a conta.
                </p>

                <h5 className={styles.membersTitle}>Membros e papéis</h5>
                <ul className={styles.members}>
                  {studio.members.map((member) => (
                    <li key={member.id} className={styles.member}>
                      <span className={styles.memberName}>{member.username}</span>
                      <span className={`${styles.memberRole} ${member.is_owner ? styles.memberRoleOwner : ""}`}>{roleLabel(member)}</span>
                    </li>
                  ))}
                </ul>

                <RadioGroup name="studio-action" onChange={(next) => setStudioAction(next)} value={studioAction}>
                  <RadioGroup.Label className={styles.radioGroupLabel}>O que fazer com o estúdio</RadioGroup.Label>

                  <FormControl>
                    <Radio value="delete" checked={studioAction === "delete"} />
                    <FormControl.Label>Excluir o estúdio e as obras</FormControl.Label>
                    <FormControl.Caption>Apaga jogos, jogos de mesa, livros e os posts publicados em nome do estúdio.</FormControl.Caption>
                  </FormControl>

                  <FormControl disabled={transferCandidates.length === 0}>
                    <Radio value="transfer" checked={studioAction === "transfer"} disabled={transferCandidates.length === 0} />
                    <FormControl.Label>Transferir a responsabilidade</FormControl.Label>
                    <FormControl.Caption>
                      {transferCandidates.length === 0
                        ? "Não há outro membro ativo no estúdio — só resta excluir o estúdio."
                        : "A conta deixa de ser titular; o estúdio e as obras continuam."}
                    </FormControl.Caption>
                  </FormControl>
                </RadioGroup>

                <div className={styles.studioExtra}>
                  {studioAction === "delete" ? (
                    <FormControl>
                      <FormControl.Label>Digite o endereço do estúdio para confirmar a exclusão</FormControl.Label>
                      <TextInput
                        value={confirmStudioSlug}
                        onChange={(event) => setConfirmStudioSlug(event.target.value)}
                        placeholder={studio.slug}
                        autoComplete="off"
                        block
                      />
                      <FormControl.Caption>
                        Precisa ser exatamente <span className={styles.mono}>{studio.slug}</span>. O servidor confere.
                      </FormControl.Caption>
                    </FormControl>
                  ) : (
                    <FormControl>
                      <FormControl.Label>Novo responsável</FormControl.Label>
                      <Select value={transferToUserId} onChange={(event) => setTransferToUserId(event.target.value)} block>
                        <Select.Option value="">Selecione um membro</Select.Option>
                        {transferCandidates.map((member) => (
                          <Select.Option key={member.id} value={member.id}>
                            {member.username} — {roleLabel(member)}
                          </Select.Option>
                        ))}
                      </Select>
                      <FormControl.Caption>O novo responsável precisa ser membro ativo do estúdio.</FormControl.Caption>
                    </FormControl>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handlePurge} className={styles.form}>
              <FormControl>
                <FormControl.Label>Digite o email novamente para confirmar</FormControl.Label>
                <TextInput
                  type="email"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  placeholder={lookup.email}
                  autoComplete="off"
                  block
                />
                <FormControl.Caption>Os dois endereços precisam ser idênticos; o servidor também confere.</FormControl.Caption>
              </FormControl>

              <div className={styles.actions}>
                <Button
                  type="submit"
                  variant="danger"
                  leadingVisual={TrashIcon}
                  disabled={!confirmationMatches || !studioDecisionReady || deleting || lookup.is_admin}
                >
                  {deleting ? "Excluindo…" : "Excluir conta definitivamente"}
                </Button>
              </div>
            </form>
          </section>
        )}
      </PageLayout.Content>
    </PageLayout>
  );
}
