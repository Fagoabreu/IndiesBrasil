import { Button, ButtonGroup, Heading } from "@primer/react";
import { ChevronDownIcon, ChevronUpIcon, DiffAddedIcon, PencilIcon, TrashIcon } from "@primer/octicons-react";
import PropTypes from "prop-types";
import style from "./ListableSectionPanel.module.css";

/**
 * Painel de lista com título — usado pelo perfil para histórico, formação,
 * estúdios, contatos, especializações e ferramentas.
 *
 * `variant="small"` é para a coluna lateral: além do espaçamento, rebaixa o
 * título um nível, criando a hierarquia entre conteúdo principal e navegação
 * que antes não existia (os dois usavam `variant="large"`).
 */
export default function ListablePanel({
  title,
  items = [],
  canEdit = false,
  emptyText = null,
  OnAdd,
  OnEdit,
  OnDelete,
  OnMove,
  renderItem,
  variant = "normal",
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const sortedItems = [...safeItems].sort((a, b) => (a?.ordem ?? 0) - (b?.ordem ?? 0));

  // Sem `emptyText` o painel some quando vazio. É assim que o perfil esconde de
  // um visitante os blocos que o dono ainda não preencheu, em vez de mostrar
  // "Nenhum contato cadastrado" para quem está só olhando.
  if (safeItems.length === 0 && !emptyText) return null;

  return (
    <section className={style.panelCard}>
      <div className={style.panelHeader}>
        <Heading className={style.panelTitle} as="h3" variant={variant === "small" ? "small" : "large"}>
          {title}
        </Heading>

        {canEdit && OnAdd && (
          <Button size="small" variant="primary" onClick={OnAdd}>
            <DiffAddedIcon /> Adicionar
          </Button>
        )}
      </div>

      {safeItems.length === 0 && <p className={style.panelEmpty}>{emptyText}</p>}

      <ul className={style.panelBody}>
        {sortedItems.map((item, index) => (
          <li key={item.id} className={`${style.panelItem} ${style[variant] || style.normal}`}>
            {/* A barra de ações era renderizada sempre, criando um bloco vazio
                alinhado à direita mesmo para quem não pode editar. */}
            {canEdit && (
              <div className={style.panelItemActionLine}>
                <ButtonGroup className={style.panelItemActions}>
                  {OnMove && (
                    <Button
                      size="small"
                      icon={ChevronUpIcon}
                      aria-label="Levantar Item"
                      disabled={index === 0}
                      onClick={() => OnMove(index, index - 1)}
                    />
                  )}
                  {OnMove && (
                    <Button
                      size="small"
                      icon={ChevronDownIcon}
                      aria-label="Baixar Item"
                      disabled={index === sortedItems.length - 1}
                      onClick={() => OnMove(index, index + 1)}
                    />
                  )}
                  {OnEdit && <Button size="small" icon={PencilIcon} variant="primary" aria-label="Editar Item" onClick={() => OnEdit(item)} />}
                  {OnDelete && <Button size="small" icon={TrashIcon} variant="danger" aria-label="Excluir Item" onClick={() => OnDelete(item)} />}
                </ButtonGroup>
              </div>
            )}

            <div>{renderItem(item)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

ListablePanel.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.array,
  canEdit: PropTypes.bool,
  /** Texto do estado vazio. Sem ele, o painel não é renderizado quando vazio. */
  emptyText: PropTypes.string,
  OnAdd: PropTypes.func,
  OnEdit: PropTypes.func,
  OnDelete: PropTypes.func,
  OnMove: PropTypes.func,
  renderItem: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(["normal", "small"]),
};
