import { useState } from "react";
import { useRouter } from "next/router";
import { NavList } from "@primer/react";
import { ChevronDownIcon, ChevronRightIcon } from "@primer/octicons-react";
import { useUser } from "@/context/UserContext";

export default function LeftSidebarComponent() {
  const router = useRouter();
  const { user } = useUser();

  const [adminOpen, setAdminOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);

  return (
    <NavList>
      <NavList.Item href="/" aria-current={router.pathname === "/"}>
        Home
      </NavList.Item>

      <NavList.Item href="/posts" aria-current={router.pathname.startsWith("/posts")}>
        Posts
      </NavList.Item>

      <NavList.Item href="/membros" aria-current={router.pathname.startsWith("/membros")}>
        Membros
      </NavList.Item>

      {user?.features.includes("read:admin") && (
        <NavList.Group>
          <NavList.GroupHeading onClick={() => setAdminOpen((v) => !v)} style={{ cursor: "pointer" }}>
            {adminOpen ? <ChevronDownIcon /> : <ChevronRightIcon />} Admin
          </NavList.GroupHeading>

          {adminOpen && (
            <>
              <NavList.Item href="/admin/contact-types">Contact Types</NavList.Item>
              <NavList.Item href="/admin/tools">Tools</NavList.Item>
            </>
          )}
        </NavList.Group>
      )}

      <NavList.Group>
        <NavList.GroupHeading onClick={() => setToolsOpen((v) => !v)} style={{ cursor: "pointer" }}>
          {toolsOpen ? <ChevronDownIcon /> : <ChevronRightIcon />} Ferramentas
        </NavList.GroupHeading>

        {toolsOpen && <NavList.Item href="/ferramentas/qrgen">Gerador QR</NavList.Item>}
      </NavList.Group>
    </NavList>
  );
}
