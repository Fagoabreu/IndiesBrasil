import { ActionBar, Button, Heading, Text } from "@primer/react";
import { ChevronDownIcon, ChevronUpIcon, DiffAddedIcon, PencilIcon, TrashIcon } from "@primer/octicons-react";
import style from "./ListableSectionPanel.module.css";

export default function ListablePanel({
  title,
  items = [],
  canEdit = false,
  emptyText = "Lista Vazia",
  OnAdd,
  OnEdit,
  OnDelete,
  OnMove,
  renderItem,
  variant = "normal",
}) {
  const safeItems = Array.isArray(items) ? items : [];

  const sortedItems = [...safeItems].sort((a, b) => (a?.ordem ?? 0) - (b?.ordem ?? 0));

  return (
    <section className={style.panelCard}>
      <div className={style.panelHeader}>
        <Heading className={style.panelTitle} as="h3" variant="large">
          {title}
        </Heading>

        {canEdit && OnAdd && (
          <Button size="small" variant="primary" onClick={OnAdd}>
            <DiffAddedIcon /> Adicionar
          </Button>
        )}
      </div>

      {items.length === 0 && (
        <Text size="medium" className="profile-muted">
          {emptyText}
        </Text>
      )}

      <ul className={style.panelBody}>
        {sortedItems.map((item, index) => (
          <li key={item.id} className={`${style.panelItem} ${style[variant] || style.normal}`}>
            <div className={variant === "small" ? style.panelItemActionLineSmall : style.panelItemActionLine}>
              {canEdit && (
                <ActionBar className={style.panelItemActions}>
                  {OnMove && (
                    <ActionBar.IconButton
                      icon={ChevronUpIcon}
                      aria-label="Levantar Item"
                      disabled={index === 0}
                      onClick={() => OnMove(index, index - 1)}
                    />
                  )}
                  {OnMove && (
                    <ActionBar.IconButton
                      icon={ChevronDownIcon}
                      aria-label="Baixar Item"
                      disabled={index === sortedItems.length - 1}
                      onClick={() => OnMove(index, index + 1)}
                    />
                  )}
                  <ActionBar.Divider />
                  {OnEdit && <ActionBar.IconButton icon={PencilIcon} variant="primary" aria-label="Editar Item" onClick={() => OnEdit(item)} />}
                  {OnDelete && <ActionBar.IconButton icon={TrashIcon} variant="danger" aria-label="Excluir Item" onClick={() => OnDelete(item)} />}
                </ActionBar>
              )}
            </div>
            <div className="panel-item-content">{renderItem(item)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
