import { useState } from "react";
import PropTypes from "prop-types";
import { XIcon } from "@primer/octicons-react";
import LeftSidebarComponent from "./LeftSidebarComponent";
import HeaderComponent from "./Header/HeaderComponent";
import Head from "next/head";

export default function Layout({ children, RightSidebar = null }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Indies Brasil</title>
      </Head>

      {/* Mobile sidebar drawer */}
      {mobileNavOpen && <div className="mobile-drawer-overlay" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />}
      <nav className={`mobile-drawer${mobileNavOpen ? " open" : ""}`} aria-label="Menu de navegação">
        <button className="mobile-drawer-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu">
          <XIcon size={20} />
        </button>
        <LeftSidebarComponent onNavigate={() => setMobileNavOpen(false)} />
      </nav>

      <div className="layout-body">
        <div className="layout-header">
          <HeaderComponent onMenuClick={() => setMobileNavOpen((v) => !v)} />
        </div>
        <div className="layout-row">
          <div className="desktop-sidebar-pane">
            <LeftSidebarComponent />
          </div>
          <main className="main-content">{children}</main>
          {RightSidebar && <div className="layout-right-pane">{RightSidebar}</div>}
        </div>
      </div>
    </>
  );
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  RightSidebar: PropTypes.node,
};
