import React, { useState } from "react";
import { PageLayout, Stack, ThemeProvider } from "@primer/react";
import RightSidebarComponent from "./RightSidebarComponent.js";
import LeftSidebarComponent from "./LeftSidebarComponent.js";
import HeaderComponent from "./HeaderComponent.js";

export default function Layout({ children, user }) {
  return (
    <ThemeProvider colorMode="auto">
      <PageLayout>
        {/* Header */}
        <PageLayout.Header>
          <HeaderComponent user={user} />
        </PageLayout.Header>

        {/* Content */}
        <Stack direction="horizontal" gap={4} sx={{ flexWrap: { narrow: "wrap", regular: "nowrap" }, padding: 4, display: "flex" }}>
          {/* Left Sidebar */}
          <LeftSidebarComponent />

          {/* Main Feed */}
          <Stack.Item sx={{ flex: "1 1 auto", display: "flex", overflowY: "auto", maxHeight: "calc(100vh - 80px)", paddingRight: 2 }}>{children}</Stack.Item>

          {/* Right Sidebar */}
          <RightSidebarComponent />
        </Stack>
      </PageLayout>
    </ThemeProvider>
  );
}
