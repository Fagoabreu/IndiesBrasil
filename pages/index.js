import Image from "next/image";
import styles from "./index.module.css";

function Home() {
  return (
    <>
      <h1>Bem vindo ao Indies Brasil</h1>
      <p>O Local dos desenvolvedores, artistas, streamers e jogadores</p>
      <p>Conheça nossa comunidade no WhatssApp</p>
      <p>
        <Image src="/images/IndiesWhatsApp.jpeg" alt="Qr Code Convite Grupo WhatssApp" width={260} height={260} />
      </p>
    </>
  );
}

export default Home;
