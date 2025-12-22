import { SplitPageLayout } from "@primer/react";
import LeftSidebarComponent from "./LeftSidebarComponent";
import HeaderComponent from "./Header/HeaderComponent";

export default function Layout({ children, RightSidebar = null }) {
  return (
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
  );
}
