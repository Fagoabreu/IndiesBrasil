import { SplitPageLayout } from "@primer/react";
import LeftSidebarComponent from "./LeftSidebarComponent";
import HeaderComponent from "./Header/HeaderComponent";
import Head from "next/head";

export default function Layout({ children, RightSidebar = null }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Indies Brasil</title>
      </Head>
      <SplitPageLayout className="layout-body">
        <SplitPageLayout.Header>
          <HeaderComponent />
        </SplitPageLayout.Header>

        <SplitPageLayout.Pane position="start">
          <LeftSidebarComponent />
        </SplitPageLayout.Pane>

        <SplitPageLayout.Content>
          <div className="main-content">{children}</div>
        </SplitPageLayout.Content>

        {RightSidebar && <SplitPageLayout.Pane position="end">{RightSidebar}</SplitPageLayout.Pane>}
      </SplitPageLayout>
    </>
  );
}
