import { useState } from "react";
import PropTypes from "prop-types";
import { SplitPageLayout } from "@primer/react";
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
        <LeftSidebarComponent />
      </nav>

      <SplitPageLayout className="layout-body">
        <SplitPageLayout.Header>
          <HeaderComponent onMenuClick={() => setMobileNavOpen((v) => !v)} />
        </SplitPageLayout.Header>

        <SplitPageLayout.Pane position="start" className="desktop-sidebar-pane">
          <LeftSidebarComponent />
        </SplitPageLayout.Pane>

        <SplitPageLayout.Content className="main-content">{children}</SplitPageLayout.Content>

        {RightSidebar && <SplitPageLayout.Pane position="end">{RightSidebar}</SplitPageLayout.Pane>}
      </SplitPageLayout>
    </>
  );
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  RightSidebar: PropTypes.node,
};
