import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import PropTypes from "prop-types";
import { NavList } from "@primer/react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  HomeIcon,
  CommentDiscussionIcon,
  CalendarIcon,
  PeopleIcon,
  OrganizationIcon,
  PackageIcon,
  TableIcon,
  BroadcastIcon,
  PersonIcon,
  PaperAirplaneIcon,
  GearIcon,
  TagIcon,
  ZapIcon,
  ImageIcon,
  CodeIcon,
  FileCodeIcon,
  BookIcon,
} from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./LeftSidebarComponent.module.css";

export default function LeftSidebarComponent({ onNavigate }) {
  const router = useRouter();
  const { user } = useUser();

  const [adminOpen, setAdminOpen] = useState(true);
  const [artigosOpen, setArtigosOpen] = useState(true);
  const [construcaoOpen, setConstrucaoOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);

  return (
    <div className={styles.sidebar}>
      <NavList>
        <NavList.Item as={Link} href="/" aria-current={router.pathname === "/"} onClick={onNavigate}>
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
            <PeopleIcon />
          </NavList.LeadingVisual>
          Membros
        </NavList.Item>

        <NavList.Divider />

        <NavList.Item as={Link} href="/estudios" aria-current={router.pathname.startsWith("/estudios")} onClick={onNavigate}>
          <NavList.LeadingVisual>
            <OrganizationIcon />
          </NavList.LeadingVisual>
          Estúdios
        </NavList.Item>

        <NavList.Item
          as={Link}
          href="/jogos"
          aria-current={router.pathname === "/jogos" || router.pathname.startsWith("/jogos/")}
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

        <NavList.Group>
          <NavList.GroupHeading className={styles.groupHeading} onClick={() => setArtigosOpen((v) => !v)} style={{ cursor: "pointer" }}>
            {artigosOpen ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />} Artigos e Estudos
          </NavList.GroupHeading>

          <NavList.Item as={Link} href="/noticias" aria-current={router.pathname.startsWith("/noticias")} onClick={onNavigate}>
            <NavList.LeadingVisual>
              <PaperAirplaneIcon />
            </NavList.LeadingVisual>
            Notícias
          </NavList.Item>
        </NavList.Group>

        {user?.features.includes("read:admin") && (
          <NavList.Group>
            <NavList.GroupHeading className={styles.groupHeading} onClick={() => setAdminOpen((v) => !v)} style={{ cursor: "pointer" }}>
              {adminOpen ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />} Admin
            </NavList.GroupHeading>

            {adminOpen && (
              <>
                <NavList.Item as={Link} href="/admin/contact-types" onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <PersonIcon />
                  </NavList.LeadingVisual>
                  Contatos
                </NavList.Item>
                <NavList.Item as={Link} href="/admin/tools" onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <GearIcon />
                  </NavList.LeadingVisual>
                  Ferramentas
                </NavList.Item>
                <NavList.Item as={Link} href="/admin/professions" onClick={onNavigate}>
                  <NavList.LeadingVisual>
                    <TagIcon />
                  </NavList.LeadingVisual>
                  Profissões
                </NavList.Item>
              </>
            )}
          </NavList.Group>
        )}

        <NavList.Group>
          <NavList.GroupHeading className={styles.groupHeading} onClick={() => setToolsOpen((v) => !v)} style={{ cursor: "pointer" }}>
            {toolsOpen ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />} Ferramentas
          </NavList.GroupHeading>

          {toolsOpen && (
            <>
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
            </>
          )}
        </NavList.Group>

        <NavList.Group>
          <NavList.GroupHeading className={styles.groupHeading} onClick={() => setConstrucaoOpen((v) => !v)} style={{ cursor: "pointer" }}>
            {construcaoOpen ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />} Em Construção
          </NavList.GroupHeading>
          {construcaoOpen && (
            <>
              <NavList.Item as={Link} href="/construcao/analises" aria-current={router.pathname === "/construcao/analises"} onClick={onNavigate}>
                <NavList.LeadingVisual>
                  <BroadcastIcon />
                </NavList.LeadingVisual>
                Análises e Reviews
              </NavList.Item>
              <NavList.Item as={Link} href="/construcao/estudo" aria-current={router.pathname.startsWith("/construcao/estudo")} onClick={onNavigate}>
                <NavList.LeadingVisual>
                  <BroadcastIcon />
                </NavList.LeadingVisual>
                Estudo
              </NavList.Item>

              <NavList.Item as={Link} href="/construcao/ajuda" aria-current={router.pathname.startsWith("/construcao/ajuda")} onClick={onNavigate}>
                <NavList.LeadingVisual>
                  <BroadcastIcon />
                </NavList.LeadingVisual>
                Ajuda Comunidade
              </NavList.Item>
              <NavList.Item
                as={Link}
                href="/construcao/suporte"
                aria-current={router.pathname.startsWith("/construcao/suporte")}
                onClick={onNavigate}
              >
                <NavList.LeadingVisual>
                  <BroadcastIcon />
                </NavList.LeadingVisual>
                Suporte ao Site
              </NavList.Item>
            </>
          )}
        </NavList.Group>
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
