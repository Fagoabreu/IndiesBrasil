import Image from "next/image";
import PropTypes from "prop-types";
import { QRCodeSVG } from "qrcode.react";
import PrintBar from "./PrintBar";
import { SITE_URL } from "@/lib/seo";
import styles from "./ProductPressKit.module.css";

/**
 * Documento de press kit de um produto (jogo, jogo de mesa, quadrinho/livro).
 *
 * A ordem das seções segue o formato `presskit()` do Rami Ismail, que é o que a
 * imprensa já sabe ler: factsheet no topo, descrição em níveis, mídia, estúdio,
 * equipe e contato. Não há nada aqui que dependa do tipo — o formato vem pronto
 * de `lib/productPressKit.js`; o componente só desenha e some com o que não
 * existe.
 *
 * `unoptimized` em todas as imagens: as URLs vêm do Cloudinary **e** de mídias
 * externas cadastradas pelo estúdio, e o otimizador do Next recusaria qualquer
 * host fora de `remotePatterns`.
 */

function MediaImage({ src, alt, className, fit = "cover" }) {
  return (
    <div className={className}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 720px) 100vw, 380px"
        className={fit === "contain" ? styles.mediaImgContain : styles.mediaImg}
        unoptimized
      />
    </div>
  );
}

MediaImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  className: PropTypes.string,
  fit: PropTypes.oneOf(["cover", "contain"]),
};

function FactRow({ row }) {
  return (
    <div className={styles.factRow}>
      <dt className={styles.factLabel}>{row.label}</dt>
      <dd className={styles.factValue}>
        {row.href ? (
          <a href={row.href} target="_blank" rel="noopener noreferrer" className={styles.link}>
            {row.value}
          </a>
        ) : (
          row.value
        )}
      </dd>
    </div>
  );
}

FactRow.propTypes = {
  row: PropTypes.shape({ label: PropTypes.string, value: PropTypes.node, href: PropTypes.string }).isRequired,
};

export default function ProductPressKit({ data }) {
  const {
    kind,
    kindLabel,
    title,
    subtitle,
    tagline,
    url,
    developer,
    factsheet,
    description,
    features,
    videos,
    images,
    assets,
    storeLinks,
    credits,
    studio,
    pressContact,
    socials,
  } = data;

  const pageUrl = `${SITE_URL}${url}`;
  const keyArt = assets[0]?.url ?? null;
  // Livro e quadrinho têm capa retrato (preset `bookCover`, 2/3) e não key art
  // larga. Exibi-la na caixa 16:9 do jogo cortaria o título da capa — o oposto
  // do que um press kit serve para mostrar.
  const portraitArt = kind === "book";
  const hasAbout = Boolean(description.pitch || description.about);

  return (
    <div className={styles.root}>
      <PrintBar documentTitle={`Press Kit — ${title}`}>
        Press kit de <strong>{title}</strong>
      </PrintBar>

      <main className={styles.page}>
        <header className={portraitArt ? styles.heroPortrait : styles.hero}>
          {keyArt &&
            (portraitArt ? (
              <MediaImage src={keyArt} alt={`Capa de ${title}`} className={styles.bookCoverBox} fit="contain" />
            ) : (
              <MediaImage src={keyArt} alt={`${title} — key art`} className={styles.heroMedia} />
            ))}
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>
              {kindLabel}
              {developer.name && developer.url ? (
                <>
                  {" · "}
                  <a href={developer.url} className={styles.eyebrowLink}>
                    {developer.name}
                  </a>
                </>
              ) : null}
            </p>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            {tagline && <p className={styles.tagline}>{tagline}</p>}
            <p className={styles.heroLinks}>
              <a href={url} className={styles.link}>
                Página do produto
              </a>
              {studio && (
                <>
                  {" · "}
                  <a href={studio.url} className={styles.link}>
                    {studio.name}
                  </a>
                </>
              )}
            </p>
          </div>
        </header>

        {/* Factsheet — primeiro o que a imprensa consulta de imediato. */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Factsheet</h2>
          <dl className={styles.factGrid}>
            {factsheet.map((row) => (
              <FactRow key={row.label} row={row} />
            ))}
          </dl>
        </section>

        {hasAbout && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Descrição</h2>
            {description.pitch && <p className={styles.lead}>{description.pitch}</p>}
            {description.about && (
              <div className={styles.body}>
                {description.about.split("\n").map((paragraph, index) => (paragraph.trim() ? <p key={index}>{paragraph}</p> : null))}
              </div>
            )}
            {features.length > 0 && (
              <ul className={styles.featureList}>
                {features.map((feature) => (
                  <li key={feature} className={styles.featureItem}>
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {videos.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Vídeos</h2>
            <div className={styles.videoList}>
              {videos.map((video) => (
                <figure key={video.id ?? video.url} className={styles.videoItem}>
                  {video.embed ? (
                    <div className={styles.videoFrame}>
                      <iframe src={video.embed.src} title={video.caption ?? title} className={styles.iframe} allowFullScreen />
                    </div>
                  ) : (
                    <p className={styles.videoFallback}>
                      <a href={video.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        Assistir ao vídeo
                      </a>
                    </p>
                  )}
                  {video.caption && <figcaption className={styles.caption}>{video.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        {images.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Imagens</h2>
            <p className={styles.note}>Material para uso editorial. Cada imagem abre no tamanho original, sem recompressão.</p>
            <div className={styles.gallery}>
              {images.map((image) => (
                <figure key={image.id ?? image.url} className={styles.galleryItem}>
                  <a href={image.url} target="_blank" rel="noopener noreferrer" className={styles.galleryLink}>
                    <span className={styles.galleryBox}>
                      <Image
                        src={image.url}
                        alt={image.caption ?? title}
                        fill
                        sizes="(max-width: 720px) 100vw, 380px"
                        className={styles.mediaImgContain}
                        unoptimized
                      />
                    </span>
                  </a>
                  {image.caption && <figcaption className={styles.caption}>{image.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        {assets.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Logos e key art</h2>
            <p className={styles.note}>Para baixar, clique com o botão direito e escolha “Salvar imagem como…”.</p>
            <div className={styles.assetGrid}>
              {assets.map((asset) => (
                <figure key={`${asset.label}-${asset.url}`} className={styles.assetItem}>
                  <span className={styles.assetBox}>
                    <Image src={asset.url} alt={`${title} — ${asset.label}`} fill sizes="220px" className={styles.assetImg} unoptimized />
                  </span>
                  <figcaption className={styles.assetLabel}>{asset.label}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {storeLinks.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Onde comprar</h2>
            <table className={styles.storeTable}>
              <thead>
                <tr>
                  <th>Loja</th>
                  <th>Preço</th>
                  <th>Endereço</th>
                </tr>
              </thead>
              <tbody>
                {storeLinks.map((store) => (
                  <tr key={store.id ?? store.url}>
                    <td>{store.name}</td>
                    <td>{store.price ?? "—"}</td>
                    <td className={styles.storeCell}>
                      <a href={store.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        {store.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {studio && (studio.history || studio.pitch) && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Sobre o estúdio</h2>
            {studio.pitch && <p className={styles.lead}>{studio.pitch}</p>}
            {studio.history && (
              <div className={styles.body}>
                {studio.history.split("\n").map((paragraph, index) => (paragraph.trim() ? <p key={index}>{paragraph}</p> : null))}
              </div>
            )}
            <dl className={styles.factGrid}>
              {studio.foundedAt && (
                <div className={styles.factRow}>
                  <dt className={styles.factLabel}>Fundação</dt>
                  <dd className={styles.factValue}>{studio.foundedAt}</dd>
                </div>
              )}
              {(studio.city || studio.state) && (
                <div className={styles.factRow}>
                  <dt className={styles.factLabel}>Localização</dt>
                  <dd className={styles.factValue}>{[studio.city, studio.state].filter(Boolean).join(" — ")}</dd>
                </div>
              )}
              {studio.website && (
                <div className={styles.factRow}>
                  <dt className={styles.factLabel}>Website</dt>
                  <dd className={styles.factValue}>
                    <a href={studio.website} target="_blank" rel="noopener noreferrer" className={styles.link}>
                      {studio.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {(studio?.members?.length > 0 || credits.length > 0) && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Equipe</h2>
            {credits.length > 0 && (
              <ul className={styles.memberList}>
                {credits.map((credit) => (
                  <li key={credit.id} className={styles.memberItem}>
                    <span className={styles.memberName}>{credit.name}</span>
                    {credit.role && <span className={styles.memberRole}>{credit.role}</span>}
                  </li>
                ))}
              </ul>
            )}
            {studio?.members?.length > 0 && (
              <ul className={styles.memberList}>
                {studio.members.map((member) => (
                  <li key={member.id ?? member.username} className={styles.memberItem}>
                    <span className={styles.memberName}>{member.displayName}</span>
                    {member.roles.length > 0 && <span className={styles.memberRole}>{member.roles.join(", ")}</span>}
                    {member.bio && <span className={styles.memberBio}>{member.bio}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contato de imprensa</h2>
          {pressContact ? (
            <p className={styles.body}>
              <strong>{pressContact.label}:</strong>{" "}
              <a href={pressContact.href} className={styles.pressContact}>
                {pressContact.display}
              </a>
            </p>
          ) : (
            <p className={styles.body}>
              Assuntos de imprensa:{" "}
              <a href={pageUrl} className={styles.link}>
                página do produto
              </a>
              .
            </p>
          )}

          {socials.length > 0 && (
            <div className={styles.socialList}>
              {socials.map((contact) => (
                <a
                  key={contact.id ?? contact.value}
                  href={contact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  title={contact.value}
                >
                  {contact.label}: {contact.display}
                </a>
              ))}
            </div>
          )}

          <div className={styles.qrBlock}>
            <QRCodeSVG value={pageUrl} size={96} bgColor="#ffffff" fgColor="#1a1a2e" />
            <span className={styles.qrLabel}>{pageUrl}</span>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>Gerado em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date())}</span>
          <span>{pageUrl}</span>
        </footer>
      </main>
    </div>
  );
}

ProductPressKit.propTypes = {
  /** Objeto de `lib/productPressKit.js` (`buildGamePressKit` e irmãos). */
  data: PropTypes.shape({
    kind: PropTypes.oneOf(["game", "boardgame", "book"]),
    kindLabel: PropTypes.string,
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    tagline: PropTypes.string,
    url: PropTypes.string.isRequired,
    developer: PropTypes.shape({ name: PropTypes.string, url: PropTypes.string }),
    factsheet: PropTypes.array.isRequired,
    description: PropTypes.shape({
      tagline: PropTypes.string,
      pitch: PropTypes.string,
      about: PropTypes.string,
    }).isRequired,
    features: PropTypes.array.isRequired,
    videos: PropTypes.array.isRequired,
    images: PropTypes.array.isRequired,
    assets: PropTypes.array.isRequired,
    storeLinks: PropTypes.array.isRequired,
    credits: PropTypes.array.isRequired,
    studio: PropTypes.object,
    pressContact: PropTypes.shape({ label: PropTypes.string, display: PropTypes.string, href: PropTypes.string }),
    socials: PropTypes.array.isRequired,
  }).isRequired,
};
