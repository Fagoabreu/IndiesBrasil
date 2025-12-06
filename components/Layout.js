import { SplitPageLayout } from "@primer/react";
import HeaderComponent from "./HeaderComponent";
import LeftSidebarComponent from "./LeftSidebarComponent";

export default function Layout({ children, RightSidebar = null }) {
  return (
    <SplitPageLayout>
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
