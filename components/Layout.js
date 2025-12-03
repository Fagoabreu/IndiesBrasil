import React from "react";
import { PageLayout, Stack } from "@primer/react";
import LeftSidebarComponent from "./LeftSidebarComponent";
import HeaderComponent from "./HeaderComponent";

export default function Layout({ children, user, RightSidebar }) {
  return (
    <PageLayout sx={{ height: "page-layout" }}>
      <PageLayout.Header>
        <HeaderComponent user={user} />
      </PageLayout.Header>

      <Stack direction="horizontal" gap={4}>
        <Stack.Item>
          <LeftSidebarComponent />
        </Stack.Item>

        <Stack.Item className="main-content">{children}</Stack.Item>

        {RightSidebar && <Stack.Item>{RightSidebar}</Stack.Item>}
      </Stack>
    </PageLayout>
  );
}
