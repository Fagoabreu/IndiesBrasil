import Head from "next/head";
import { Header, PageLayout, Text } from "@primer/react";

export default function Layout({ children }) {
  return (
    <>
      <Head>
        <title>Indies do Brasil</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <PageLayout>
        <Header>
          <Header.Item>
            <Header.Link href="/" fontSize={2}>
              Indies do Brasil
            </Header.Link>
          </Header.Item>
          <Header.Item full />
          <Header.Item>
            <Header.Link href="/">Home</Header.Link>
          </Header.Item>
          <Header.Item>
            <Header.Link href="/status">Server Status</Header.Link>
          </Header.Item>
        </Header>

        <PageLayout.Content>{children}</PageLayout.Content>
        <Text>&copy; {new Date().getFullYear()} Indies Brasil.</Text>
      </PageLayout>
    </>
  );
}
