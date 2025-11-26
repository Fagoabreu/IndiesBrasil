import "../css/styles.css";
import "@primer/primitives/dist/css/functional/themes/light.css";
import { BaseStyles } from "@primer/react";
import LayoutFinalScroll from "../components/LayoutFinalScroll";
import { UserProvider, useUser } from "@/context/UserContext";
import WhoToFollow from "@/components/WhoToFollow.js";

export default function MyApp({ Component, pageProps }) {
  return (
    <UserProvider>
      <BaseStyles>
        <LayoutFinalScroll user={null} RightSidebar={<WhoToFollow />}>
          <Component {...pageProps} />
        </LayoutFinalScroll>
      </BaseStyles>
    </UserProvider>
  );
}
