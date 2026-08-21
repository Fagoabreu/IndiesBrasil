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
  ReportIcon,
  ShieldIcon,
} from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./LeftSidebarComponent.module.css";

export default function LeftSidebarComponent({ onNavigate }) {
  const router = useRouter();
  const { user } = useUser();

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
            <NavList.Item as={Link} href="/ferramentas/imagens-para-pdf" onClick={onNavigate}>
              <NavList.LeadingVisual>
                <FileIcon />
              </NavList.LeadingVisual>
              Imagens para PDF
            </NavList.Item>
          </NavList.SubNav>
        </NavList.Item>
        <NavList.Divider />

        <NavList.Item href="#">
          <NavList.LeadingVisual>
            <RocketIcon />
          </NavList.LeadingVisual>
          Em Construção
          <NavList.SubNav>
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
