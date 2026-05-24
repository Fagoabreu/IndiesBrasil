import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { NavList } from "@primer/react";
import { ChevronDownIcon, ChevronRightIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";
import styles from "./LeftSidebarComponent.module.css";

export default function LeftSidebarComponent() {
  const router = useRouter();
  const { user } = useUser();

  const [adminOpen, setAdminOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);

  return (
    <div className={styles.sidebar}>
      <NavList>
        <NavList.Item as={Link} href="/" aria-current={router.pathname === "/"}>
          Home
        </NavList.Item>

        <NavList.Item as={Link} href="/posts" aria-current={router.pathname.startsWith("/posts")}>
          Posts
        </NavList.Item>

        <NavList.Item as={Link} href="/agenda" aria-current={router.pathname.startsWith("/agenda")}>
          Agenda
        </NavList.Item>

        <NavList.Item as={Link} href="/membros" aria-current={router.pathname.startsWith("/membros")}>
          Membros
        </NavList.Item>

        <NavList.Item as={Link} href="/estudios" aria-current={router.pathname.startsWith("/estudios")}>
          Estúdios
        </NavList.Item>

        {user?.features.includes("read:admin") && (
          <NavList.Group>
            <NavList.GroupHeading className={styles.groupHeading} onClick={() => setAdminOpen((v) => !v)} style={{ cursor: "pointer" }}>
              {adminOpen ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />} Admin
            </NavList.GroupHeading>

            {adminOpen && (
              <>
                <NavList.Item as={Link} href="/admin/contact-types">
                  Contatos
                </NavList.Item>
                <NavList.Item as={Link} href="/admin/tools">
                  Ferramentas
                </NavList.Item>
                <NavList.Item as={Link} href="/admin/professions">
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
              <NavList.Item as={Link} href="/ferramentas/qrgen">
                Gerador QR
              </NavList.Item>
              <NavList.Item as={Link} href="/ferramentas/imagecrop">
                Recortar Imagem
              </NavList.Item>
              <NavList.Item as={Link} href="/ferramentas/viewer">
                Visualizador XML/JSON
              </NavList.Item>
              <NavList.Item as={Link} href="/ferramentas/htmlviewer">
                Visualizador HTML
              </NavList.Item>
            </>
          )}
        </NavList.Group>
      </NavList>
    </div>
  );
}
