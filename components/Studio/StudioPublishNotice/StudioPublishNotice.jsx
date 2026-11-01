"use client";
import Link from "next/link";
import PropTypes from "prop-types";
import { InfoIcon } from "@primer/octicons-react";

import { useUser } from "@/context/UserContext";
import { HOW_TO_PUBLISH_PATH, STUDIO_ENTRY_KINDS, resolveStudioEntry } from "@/lib/studioEntry";
import styles from "./StudioPublishNotice.module.css";

/**
 * Explica, **dentro da listagem**, que publicar exige um estúdio.
 *
 * O problema que ele resolve: a navegação é por tipo de conteúdo (Jogos,
 * Assets, Streams), mas o modelo é por estúdio — nenhum produto existe fora de
 * um. Quem chega numa listagem querendo publicar não encontrava nenhuma ação e
 * concluía que o site não aceita contribuição. Só `/streams` dizia isso, com um
 * link genérico para a lista de estúdios.
 *
 * Duas variantes, porque são dois momentos diferentes:
 *
 *   `inline` — faixa acima dos filtros, na listagem com conteúdo. Lembra que a
 *              publicação existe e leva ao lugar certo.
 *   `empty`  — dentro do estado vazio, quando não há nenhum item. Aqui a pessoa
 *              está exatamente no ponto de intenção ("quero publicar"), então o
 *              texto vira instrução e o botão fica em destaque.
 *
 * O destino não é decidido aqui: vem de `resolveStudioEntry`, que distingue
 * visitante, conta sem estúdio, um estúdio e vários. Uma escada de `if` em cada
 * listagem divergiria na primeira vez que alguém editasse uma delas.
 */
export default function StudioPublishNotice({ tab, variant = "inline", className }) {
  const { user, loadingUser, myStudios } = useUser();
  const entry = resolveStudioEntry({ user, loadingUser, studios: myStudios, tab });

  const isCreate = entry.kind === STUDIO_ENTRY_KINDS.CREATE;
  const isPublish = entry.kind === STUDIO_ENTRY_KINDS.PUBLISH;

  if (variant === "empty") {
    return (
      <div className={`${styles.emptyBlock} ${className || ""}`}>
        <p className={styles.emptyTitle}>Tudo aqui é publicado por um estúdio</p>
        <p className={styles.emptyText}>
          {isPublish ? entry.hint : "Crie o seu estúdio para publicar o primeiro item. Você pode convidar a equipe depois — ou publicar sozinho."}
        </p>

        <div className={styles.emptyActions}>
          <Link href={entry.href} className={styles.primaryAction}>
            {entry.label}
          </Link>
          <Link href={HOW_TO_PUBLISH_PATH} className={styles.linkAction}>
            Como funciona
          </Link>
        </div>
      </div>
    );
  }

  return (
    <aside className={`${styles.inlineNotice} ${className || ""}`} aria-label="Como publicar nesta seção">
      <InfoIcon size={16} className={styles.inlineIcon} />

      <div className={styles.inlineBody}>
        <p className={styles.inlineTitle}>Publicar aqui exige um estúdio</p>
        <p className={styles.inlineText}>
          Jogos, jogos de mesa, publicações, assets e canais são publicados por um estúdio — nunca pelo perfil pessoal.
          {isCreate ? " Criar o seu leva menos de um minuto." : ""}
        </p>
      </div>

      <div className={styles.inlineActions}>
        <Link href={entry.href} className={styles.primaryAction}>
          {entry.label}
        </Link>
        <Link href={HOW_TO_PUBLISH_PATH} className={styles.linkAction}>
          Como funciona
        </Link>
      </div>
    </aside>
  );
}

StudioPublishNotice.propTypes = {
  /** Aba de `/configuracoes` do estúdio usada pelo destino (`games`, `assets`…). */
  tab: PropTypes.oneOf(["games", "boardgames", "books", "assets", "streaming"]),
  variant: PropTypes.oneOf(["inline", "empty"]),
  className: PropTypes.string,
};
