import { useRouter } from "next/router";
import Link from "next/link";
import PropTypes from "prop-types";
import { NavList } from "@primer/react";
import {
  CommentDiscussionIcon,
  CalendarIcon,
  PeopleIcon,
  HomeIcon,
  OrganizationIcon,
  PackageIcon,
  TableIcon,
  BroadcastIcon,
  PersonIcon,
  PaperAirplaneIcon,
  GearIcon,
  GiftIcon,
  TagIcon,
  ToolsIcon,
  ZapIcon,
  ImageIcon,
  CodeIcon,
  FileCodeIcon,
  BookIcon,
  StarIcon,
  LightBulbIcon,
  PulseIcon,
  RocketIcon,
  StackIcon,
  FileIcon,
  VideoIcon,
  ReportIcon,
  ShieldIcon,
  TrashIcon,
  ArchiveIcon,
  ListUnorderedIcon,
  MarkdownIcon,
  SearchIcon,
  PlusIcon,
  InfoIcon,
  MilestoneIcon,
} from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import { resolveStudioEntry } from "@/lib/studioEntry";
import { ABOUT_DOCS } from "@/lib/aboutDocs";
import styles from "./LeftSidebarComponent.module.css";

/**
 * Ícone de cada documento de `/sobre`.
 *
 * Só os que têm ícone próprio; o resto cai em `BookIcon`. Um mapa explícito para
 * cada documento obrigaria a editar o menu a cada arquivo novo — e o ícone não
 * carrega informação que a ausência dele perca.
 */
const ABOUT_DOC_ICONS = {
  roadmap: MilestoneIcon,
};

export default function LeftSidebarComponent({ onNavigate }) {
  const router = useRouter();
  const { user, loadingUser, myStudios } = useUser();

  /**
   * Destino de "Oferecer serviços".
   *
   * Vem de `resolveStudioEntry` — a mesma função das listagens: visitante vai ao
   * login, conta sem estúdio vai criar um, com um estúdio vai direto à aba
   * Serviços, com vários escolhe qual. Decidir isso aqui criaria uma segunda
   * escada de `if` que divergiria do resto do site na primeira mudança.
   *
   * Enquanto `/api/v1/studios?member=me` não responde, `myStudios` é `null` e o
   * destino é a lista dos meus estúdios — nunca a criação. Antes, a lista
   * começava `[]` e quem tinha estúdio era mandado a `/estudios/novo` no
   * primeiro instante da página.
   */
  const offerServicesHref = resolveStudioEntry({ user, loadingUser, studios: myStudios, tab: "services" }).href;

  /**
   * Documento de `/sobre` aberto, ou `""`.
   *
   * `router.pathname` é o **padrão** da rota (`/sobre/[slug]`), não o endereço
   * resolvido: comparar `pathname === "/sobre/roadmap"` nunca casa em rota
   * dinâmica e o item do menu ficaria sem `aria-current` — e é justamente esse
   * atributo que faz o `NavList` abrir o submenu sozinho. O slug vem de
   * `router.query`.
   */
  const currentAboutSlug = router.pathname.startsWith("/sobre") && typeof router.query.slug === "string" ? router.query.slug : "";

  return (
    <div className={styles.sidebar}>
      <NavList>
        <NavList.Item href="#" defaultOpen>
          <NavList.LeadingVisual>
            <PeopleIcon />
          </NavList.LeadingVisual>
          Social
          <NavList.SubNav>
            <NavList.Item as={Link} href="/" aria-current={router.pathname === "/" ? "page" : undefined} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <HomeIcon />
              </NavList.LeadingVisual>
              Home
            </NavList.Item>
            <NavList.Item as={Link} href="/posts" aria-current={router.pathname.startsWith("/posts")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <CommentDiscussionIcon />
              </NavList.LeadingVisual>
              Posts
            </NavList.Item>

            <NavList.Item as={Link} href="/agenda" aria-current={router.pathname.startsWith("/agenda")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <CalendarIcon />
              </NavList.LeadingVisual>
              Agenda
            </NavList.Item>

            <NavList.Item as={Link} href="/membros" aria-current={router.pathname.startsWith("/membros")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <PersonIcon />
              </NavList.LeadingVisual>
              Membros
            </NavList.Item>
          </NavList.SubNav>
        </NavList.Item>
        <NavList.Divider />

        <NavList.Item href="#" defaultOpen>
          <NavList.LeadingVisual>
            <StackIcon />
          </NavList.LeadingVisual>
          Conteúdo
          <NavList.SubNav>
            <NavList.Item as={Link} href="/estudios" aria-current={router.pathname.startsWith("/estudios")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <OrganizationIcon />
              </NavList.LeadingVisual>
              Estúdios
            </NavList.Item>
            <NavList.Item
              as={Link}
              href="/jogos"
              aria-current={router.pathname === "/jogos" || router.pathname.startsWith("/jogos/") ? "page" : undefined}
              onClick={onNavigate}
            >
              <NavList.LeadingVisual>
                <PackageIcon />
              </NavList.LeadingVisual>
              Jogos
            </NavList.Item>
            <NavList.Item as={Link} href="/jogos-de-mesa" aria-current={router.pathname.startsWith("/jogos-de-mesa")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <TableIcon />
              </NavList.LeadingVisual>
              Jogos de Mesa
            </NavList.Item>
            <NavList.Item as={Link} href="/quadrinhos" aria-current={router.pathname.startsWith("/quadrinhos")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <BookIcon />
              </NavList.LeadingVisual>
              Livros e Quadrinhos
            </NavList.Item>
            <NavList.Item as={Link} href="/streams" aria-current={router.pathname.startsWith("/streams")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <BroadcastIcon />
              </NavList.LeadingVisual>
              Live Stream
            </NavList.Item>
            <NavList.Item as={Link} href="/assets" aria-current={router.pathname.startsWith("/assets")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <ArchiveIcon />
              </NavList.LeadingVisual>
              Artes e Assets
            </NavList.Item>
          </NavList.SubNav>
        </NavList.Item>
        <NavList.Divider />

        <NavList.Item href="#" defaultOpen>
          <NavList.LeadingVisual>
            <ToolsIcon />
          </NavList.LeadingVisual>
          Serviços
          <NavList.SubNav>
            <NavList.Item as={Link} href="/servicos" aria-current={router.pathname.startsWith("/servicos") ? "page" : undefined} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <SearchIcon />
              </NavList.LeadingVisual>
              Procurar serviços
            </NavList.Item>
            <NavList.Item as={Link} href={offerServicesHref} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <PlusIcon />
              </NavList.LeadingVisual>
              Oferecer serviços
            </NavList.Item>
          </NavList.SubNav>
        </NavList.Item>
        <NavList.Divider />

        <NavList.Item href="#" defaultOpen>
          <NavList.LeadingVisual>
            <LightBulbIcon />
          </NavList.LeadingVisual>
          Artigos e Estudos
          <NavList.SubNav>
            <NavList.Item as={Link} href="/noticias" aria-current={router.pathname.startsWith("/noticias")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <PaperAirplaneIcon />
              </NavList.LeadingVisual>
              Notícias
            </NavList.Item>
            <NavList.Item as={Link} href="/analises" aria-current={router.pathname === "/analises" ? "page" : undefined} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <StarIcon />
              </NavList.LeadingVisual>
              Análises e Reviews
            </NavList.Item>
            <NavList.Item as={Link} href="/estudos" aria-current={router.pathname.startsWith("/estudos")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <LightBulbIcon />
              </NavList.LeadingVisual>
              Cursos e Estudos
            </NavList.Item>
          </NavList.SubNav>
        </NavList.Item>
        <NavList.Divider />

        {user?.features.includes("read:admin") && (
          <>
            <NavList.Item href="#" defaultOpen>
              <NavList.LeadingVisual>
                <GearIcon />
              </NavList.LeadingVisual>
              Admin
              <NavList.SubNav>
                <NavList.Item as={Link} href="/admin/contact-types" onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <PersonIcon />
                  </NavList.LeadingVisual>
                  Cadastro Contatos
                </NavList.Item>
                <NavList.Item as={Link} href="/admin/tools" onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <GearIcon />
                  </NavList.LeadingVisual>
                  Cadastro Ferramentas
                </NavList.Item>
                <NavList.Item as={Link} href="/admin/professions" onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <TagIcon />
                  </NavList.LeadingVisual>
                  Cadastro Profissões
                </NavList.Item>
                <NavList.Item
                  as={Link}
                  href="/admin/asset-categories"
                  aria-current={router.pathname.startsWith("/admin/asset-categories")}
                  onClick={onNavigate}
                >
                  <NavList.LeadingVisual>
                    <ListUnorderedIcon />
                  </NavList.LeadingVisual>
                  Categorias de Assets
                </NavList.Item>
                <NavList.Item
                  as={Link}
                  href="/admin/services"
                  aria-current={router.pathname.startsWith("/admin/services") ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <NavList.LeadingVisual>
                    <ToolsIcon />
                  </NavList.LeadingVisual>
                  Serviços e Sugestões
                </NavList.Item>
                <NavList.Item
                  as={Link}
                  href="/admin/game-genres"
                  aria-current={router.pathname.startsWith("/admin/game-genres") ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <NavList.LeadingVisual>
                    <TagIcon />
                  </NavList.LeadingVisual>
                  Gêneros de Jogos
                </NavList.Item>
                <NavList.Item as={Link} href="/admin/reports" onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <ReportIcon />
                  </NavList.LeadingVisual>
                  Denúncias
                </NavList.Item>
                <NavList.Item as={Link} href="/admin/moderation" onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <ShieldIcon />
                  </NavList.LeadingVisual>
                  Moderação
                </NavList.Item>
                <NavList.Item as={Link} href="/admin/users" aria-current={router.pathname.startsWith("/admin/users")} onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <TrashIcon />
                  </NavList.LeadingVisual>
                  Excluir conta
                </NavList.Item>
                <NavList.Item as={Link} href="/status" onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <PulseIcon />
                  </NavList.LeadingVisual>
                  Server Status
                </NavList.Item>
              </NavList.SubNav>
            </NavList.Item>
            <NavList.Divider />
          </>
        )}

        <NavList.Item href="#" defaultOpen>
          <NavList.LeadingVisual>
            <ToolsIcon />
          </NavList.LeadingVisual>
          Ferramentas
          <NavList.SubNav>
            <NavList.Item as={Link} href="/ferramentas/qrgen" onClick={onNavigate}>
              <NavList.LeadingVisual>
                <ZapIcon />
              </NavList.LeadingVisual>
              Gerador QR
            </NavList.Item>
            <NavList.Item as={Link} href="/ferramentas/imagecrop" onClick={onNavigate}>
              <NavList.LeadingVisual>
                <ImageIcon />
              </NavList.LeadingVisual>
              Recortar Imagem
            </NavList.Item>
            <NavList.Item as={Link} href="/ferramentas/viewer" onClick={onNavigate}>
              <NavList.LeadingVisual>
                <CodeIcon />
              </NavList.LeadingVisual>
              Visualizador XML/JSON
            </NavList.Item>
            <NavList.Item as={Link} href="/ferramentas/htmlviewer" onClick={onNavigate}>
              <NavList.LeadingVisual>
                <FileCodeIcon />
              </NavList.LeadingVisual>
              Visualizador HTML
            </NavList.Item>
            <NavList.Item as={Link} href="/ferramentas/mdviewer" onClick={onNavigate}>
              <NavList.LeadingVisual>
                <MarkdownIcon />
              </NavList.LeadingVisual>
              Visualizador Markdown
            </NavList.Item>
            <NavList.Item as={Link} href="/ferramentas/imagens-para-pdf" onClick={onNavigate}>
              <NavList.LeadingVisual>
                <FileIcon />
              </NavList.LeadingVisual>
              Imagens para PDF
            </NavList.Item>
            <NavList.Item as={Link} href="/ferramentas/comprimir-video" onClick={onNavigate}>
              <NavList.LeadingVisual>
                <VideoIcon />
              </NavList.LeadingVisual>
              Comprimir Vídeo
            </NavList.Item>
          </NavList.SubNav>
        </NavList.Item>
        <NavList.Divider />

        {/*
         * "Sobre" é grupo de PRIMEIRO nível: o guia de publicação e os
         * documentos de referência ficam no segundo.
         *
         * Antes ele era um item dentro de "Em Construção", o que custava duas
         * coisas: o submenu exigia um terceiro nível de aninhamento (o `NavList`
         * do Primer só vai até três, então não havia para onde crescer) e ficava
         * escondido, porque "Em Construção" abre fechado — os documentos eram
         * inalcançáveis pelo menu até alguém expandir um grupo que, pelo nome,
         * não promete documentação.
         *
         * "Como publicar" veio de "Conteúdo" porque ela é a explicação de como
         * esta plataforma funciona, não um tipo de conteúdo — e é aqui que ela
         * fica ao lado do que descreve a plataforma por dentro.
         *
         * A lista de documentos sai de `lib/aboutDocs.js`, a mesma fonte que a
         * rota `/sobre/[slug]` usa: não existe link no menu sem página, nem
         * página sem link.
         *
         * `aria-current` fica só no item aberto. No item que abre o submenu ele
         * mentiria ("esta é a página atual" para um botão que não navega) e é o
         * `aria-current` do filho que faz o Primer abrir o submenu sozinho.
         */}
        <NavList.Item href="#" defaultOpen>
          <NavList.LeadingVisual>
            <InfoIcon />
          </NavList.LeadingVisual>
          Sobre
          <NavList.SubNav>
            <NavList.Item
              as={Link}
              href="/sobre/como-publicar"
              aria-current={router.pathname.startsWith("/sobre/como-publicar") ? "page" : undefined}
              onClick={onNavigate}
            >
              <NavList.LeadingVisual>
                <LightBulbIcon />
              </NavList.LeadingVisual>
              Como publicar
            </NavList.Item>
            {ABOUT_DOCS.map((doc) => {
              // Documento novo cai em `BookIcon` sem precisar de mapa: o ícone
              // é enfeite, não informação, então errar a escolha não quebra nada.
              const DocIcon = ABOUT_DOC_ICONS[doc.slug] ?? BookIcon;

              return (
                <NavList.Item
                  key={doc.slug}
                  as={Link}
                  href={`/sobre/${doc.slug}`}
                  aria-current={currentAboutSlug === doc.slug ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <NavList.LeadingVisual>
                    <DocIcon />
                  </NavList.LeadingVisual>
                  {doc.title}
                </NavList.Item>
              );
            })}
          </NavList.SubNav>
        </NavList.Item>
        <NavList.Divider />

        <NavList.Item href="#">
          <NavList.LeadingVisual>
            <RocketIcon />
          </NavList.LeadingVisual>
          Em Construção
          <NavList.SubNav>
            <NavList.Item as={Link} href="/loja" aria-current={router.pathname.startsWith("/loja")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <GiftIcon />
              </NavList.LeadingVisual>
              Loja
            </NavList.Item>
            <NavList.Item as={Link} href="/construcao/ajuda" aria-current={router.pathname.startsWith("/construcao/ajuda")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <BroadcastIcon />
              </NavList.LeadingVisual>
              Ajuda Comunidade
            </NavList.Item>
            <NavList.Item as={Link} href="/construcao/suporte" aria-current={router.pathname.startsWith("/construcao/suporte")} onClick={onNavigate}>
              <NavList.LeadingVisual>
                <BroadcastIcon />
              </NavList.LeadingVisual>
              Suporte ao Site
            </NavList.Item>
          </NavList.SubNav>
        </NavList.Item>
      </NavList>
    </div>
  );
}

LeftSidebarComponent.propTypes = {
  onNavigate: PropTypes.func,
};

LeftSidebarComponent.defaultProps = {
  onNavigate: undefined,
};
