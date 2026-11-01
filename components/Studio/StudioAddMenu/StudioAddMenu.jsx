"use client";
import PropTypes from "prop-types";
import { useRouter } from "next/router";
import { ActionList, ActionMenu } from "@primer/react";
import { ArchiveIcon, BookIcon, BroadcastIcon, PackageIcon, PlusIcon, TableIcon } from "@primer/octicons-react";

import styles from "./StudioAddMenu.module.css";

/**
 * Menu "Adicionar" do painel do estúdio.
 *
 * Antes o caminho para publicar era um botão chamado **"Editar"** que abria as
 * configurações na aba "Perfil" — quem queria cadastrar um jogo precisava
 * descobrir sozinho que a aba existia no meio de oito. Publicar é a ação mais
 * frequente de quem tem estúdio, e ela estava escondida atrás de um rótulo que
 * sugere o contrário.
 *
 * Cada item leva direto à aba certa de `/configuracoes` (`?tab=`), o mesmo
 * destino que `resolveStudioEntry` usa nas listagens — duas portas para o mesmo
 * lugar precisam apontar para o mesmo lugar.
 *
 * Componente próprio, e não uma variante de `StudioActionButton`: aquele é
 * `<Link>` (ou `<button disabled>`) com contrato fixado em teste, e um menu não
 * é link nem botão desabilitado.
 */
const ADD_ITEMS = [
  { tab: "games", label: "Jogo digital", icon: PackageIcon },
  { tab: "boardgames", label: "Jogo de mesa", icon: TableIcon },
  { tab: "books", label: "Livro ou quadrinho", icon: BookIcon },
  { tab: "assets", label: "Asset", icon: ArchiveIcon },
  { tab: "streaming", label: "Canal de transmissão", icon: BroadcastIcon },
];

export default function StudioAddMenu({ slug }) {
  const router = useRouter();

  function goToTab(tab) {
    router.push(`/estudios/${slug}/configuracoes?tab=${tab}`);
  }

  return (
    <ActionMenu>
      <ActionMenu.Button leadingVisual={PlusIcon} className={styles.trigger}>
        Adicionar
      </ActionMenu.Button>

      <ActionMenu.Overlay width="medium" align="end">
        <ActionList>
          <ActionList.Group>
            <ActionList.GroupHeading>Publicar no estúdio</ActionList.GroupHeading>
            {ADD_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <ActionList.Item key={item.tab} onSelect={() => goToTab(item.tab)}>
                  <ActionList.LeadingVisual>
                    <Icon />
                  </ActionList.LeadingVisual>
                  {item.label}
                </ActionList.Item>
              );
            })}
          </ActionList.Group>

          <ActionList.Divider />

          <ActionList.Item onSelect={() => router.push(`/estudios/${slug}/configuracoes`)}>Gerenciar estúdio</ActionList.Item>
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}

StudioAddMenu.propTypes = {
  /** Slug do estúdio — o destino é sempre o painel dele. */
  slug: PropTypes.string.isRequired,
};
