import React from "react";
import { PageLayout, Stack, ThemeProvider } from "@primer/react";
import LeftSidebarComponent from "./LeftSidebarComponent";
import HeaderComponent from "./HeaderComponent";

export default function LayoutFinalScroll({ children, user, RightSidebar }) {
  return (
    <ThemeProvider colorMode="auto">
      <PageLayout sx={{ height: "100vh" }}>
        {/* Header */}
        <PageLayout.Header>
          <HeaderComponent user={user} />
        </PageLayout.Header>

        {/* Conteúdo principal */}
        <Stack
          direction="horizontal"
          gap={4}
          sx={{
            flexWrap: { narrow: "wrap", regular: "nowrap" },
            height: "calc(100vh - 80px)", // altura total menos header
            padding: 4,
          }}
        >
          {/* Left Sidebar */}
          <Stack.Item
            sx={{
              flex: { narrow: "1 1 100%", regular: "0 0 250px" },
              display: { narrow: "none", regular: "flex" },
              overflowY: "auto",
              position: "sticky",
              top: 0,
              maxHeight: "100%",
            }}
          >
            <LeftSidebarComponent />
          </Stack.Item>

          {/* Feed principal */}
          <Stack.Item
            sx={{
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              maxHeight: "100%",
              minWidth: 0,
              paddingRight: 2,
              "&::-webkit-scrollbar": { width: "8px" },
              "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(100,100,100,0.3)", borderRadius: "4px" },
            }}
          >
            {children}
          </Stack.Item>

          {/* Right Sidebar opcional */}
          {RightSidebar && (
            <Stack.Item
              sx={{
                flex: { narrow: "0 0 0%", regular: "0 0 300px" },
                display: { narrow: "none", regular: "flex" },
                flexDirection: "column",
                overflowY: "auto",
                position: "sticky",
                top: 0,
                maxHeight: "100%",
                paddingLeft: 2,
              }}
            >
              {RightSidebar}
            </Stack.Item>
          )}
        </Stack>
      </PageLayout>
    </ThemeProvider>
  );
}
