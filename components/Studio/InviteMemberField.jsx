import { useEffect, useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import { PersonIcon, SearchIcon } from "@primer/octicons-react";
import { MEMBER_SUGGEST_MIN_LENGTH, normalizeMemberQuery, useUserSuggest } from "@/context/dataHooks/UseUserSuggest";
import styles from "./InviteMemberField.module.css";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Campo de convite de membro com busca/autocomplete.
 *
 * Antes era um `<input>` de username puro: quem convida precisava saber o
 * username exato de cor, e errar uma letra devolvia "usuário não encontrado"
 * sem nenhuma pista de quem existe. Aqui o campo busca enquanto digita e mostra
 * o nome de exibição, que é como as pessoas se reconhecem.
 *
 * **Continua aceitando texto livre.** O convite é por username e a busca é só
 * um atalho; prender o envio a uma sugestão escolhida quebraria o fluxo de quem
 * já sabe o username e nunca toca na lista.
 *
 * O `@` é tratado como prefixo de exibição: pode ser digitado, aparece na lista
 * e é removido antes de virar valor (`normalizeMemberQuery`).
 */
export default function InviteMemberField({ value, onChange, members, pendingInvites, disabled, onSubmit }) {
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const { data, isLoading } = useUserSuggest(debounced);
  const term = normalizeMemberQuery(value);

  // Debounce próprio: o SWR já deduplica a chave, mas sem isto cada tecla
  // criaria uma chave nova e uma requisição — a busca é em tabela inteira.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const memberNames = new Set((members ?? []).map((member) => member.username));
  const invitedNames = new Set((pendingInvites ?? []).map((invite) => invite.invited_username));

  const candidates = data?.items ?? [];
  // Sugestão longa demais não é "apoio": some quando não há nada a mostrar.
  const showList = open && term.length >= MEMBER_SUGGEST_MIN_LENGTH && (isLoading || candidates.length > 0);
  const activeIndex = candidates.length > 0 ? Math.min(highlighted, candidates.length - 1) : -1;

  useEffect(() => {
    if (!showList) return;
    // Mantém a opção destacada à vista quando se navega pelo teclado.
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [showList, activeIndex]);

  function select(candidate) {
    if (memberNames.has(candidate.username) || invitedNames.has(candidate.username)) return;

    onChange(`@${candidate.username}`);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!showList || candidates.length === 0) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted((previous) => (previous + delta + candidates.length) % candidates.length);
      return;
    }

    if (event.key === "Enter") {
      // Com a lista aberta, Enter escolhe a sugestão destacada em vez de enviar
      // o formulário — enviar no meio da escolha é o erro clássico do
      // autocomplete. Sem sugestão, Enter envia normalmente.
      if (showList && activeIndex >= 0) {
        event.preventDefault();
        select(candidates[activeIndex]);
        return;
      }

      event.preventDefault();
      onSubmit?.();
    }
  }

  const listId = useId();
  const optionId = (index) => `${listId}-option-${index}`;

  return (
    <div className={styles.wrapper}>
      <div className={styles.field}>
        <span className={styles.icon} aria-hidden="true">
          <SearchIcon size={14} />
        </span>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder="Username, nome ou @"
          value={value}
          disabled={disabled}
          autoComplete="off"
          maxLength={60}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          // Fecha com o clique fora, mas não antes do clique na opção: o
          // `onMouseDown` da lista previne o blur.
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {showList && (
        <ul ref={listRef} id={listId} role="listbox" className={styles.list} aria-label="Sugestões de membros">
          {candidates.map((candidate, index) => {
            const isMember = memberNames.has(candidate.username);
            const isInvited = invitedNames.has(candidate.username);
            const unavailable = isMember || isInvited;

            return (
              <li
                key={candidate.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                aria-disabled={unavailable}
                data-active={index === activeIndex}
                className={`${styles.option} ${index === activeIndex ? styles.optionActive : ""} ${unavailable ? styles.optionDisabled : ""}`}
                // `onMouseDown` + preventDefault: sem isso o `blur` do input
                // fecharia a lista antes do clique chegar.
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(candidate);
                }}
                onMouseEnter={() => setHighlighted(index)}
              >
                <span className={styles.optionName}>
                  <PersonIcon size={14} />@{candidate.username}
                </span>
                {candidate.resumo && <span className={styles.optionResumo}>{candidate.resumo}</span>}
                {unavailable && <span className={styles.optionFlag}>{isMember ? "já é membro" : "convite pendente"}</span>}
              </li>
            );
          })}

          {isLoading && candidates.length === 0 && <li className={styles.loading}>Buscando…</li>}
        </ul>
      )}
    </div>
  );
}

InviteMemberField.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  /** Membros atuais (`{ username }`), para marcar quem já está no estúdio. */
  members: PropTypes.arrayOf(PropTypes.shape({ username: PropTypes.string })),
  /** Convites pendentes (`{ invited_username }`). */
  pendingInvites: PropTypes.arrayOf(PropTypes.shape({ invited_username: PropTypes.string })),
  disabled: PropTypes.bool,
  /** Enter sem sugestão destacada — o formulário de convite envia por aqui. */
  onSubmit: PropTypes.func,
};
