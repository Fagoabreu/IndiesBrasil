import React from "react";
import { PageLayout, Stack } from "@primer/react";
import LeftSidebarComponent from "./LeftSidebarComponent";
import HeaderComponent from "./HeaderComponent";

export default function Layout({ children, user, RightSidebar }) {
  return (
    <PageLayout sx={{ height: "100vh" }}>
      <PageLayout.Header>
        <HeaderComponent user={user} />
      </PageLayout.Header>

      <Stack
        direction="horizontal"
        gap={4}
        sx={{
          flexWrap: { narrow: "wrap", regular: "nowrap" },
          height: "calc(100vh - 80px)",
          padding: 4,
        }}
      >
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

        <Stack.Item
          sx={{
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            maxHeight: "100%",
            paddingRight: 2,
          }}
        >
          {children}
        </Stack.Item>

        {RightSidebar && (
          <Stack.Item
            sx={{
              flex: { narrow: "0", regular: "0 0 300px" },
              display: { narrow: "none", regular: "flex" },
              flexDirection: "column",
              overflowY: "auto",
              position: "sticky",
              top: 0,
              maxHeight: "100%",
            }}
          >
            {RightSidebar}
          </Stack.Item>
        )}
      </Stack>
    </PageLayout>
  );
}
