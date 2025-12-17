import Image from "next/image";

function Home() {
  return (
    <>
      <h1>Bem vindo ao Indies Brasil</h1>
      <p>O Local dos desenvolvedores, artistas, streamers e jogadores</p>
      <p>
        <Image src="/images/IndiesWhatsApp.jpeg" alt="Qr Code Convite Grupo WhatssApp" width={420} height={500} />
      </p>
    </>
  );
}

export default Home;
