import HorizontalCardComponent from "@/components/Card/HorizontalCardComponent";

function Home() {
  return (
    <>
      <h1>Bem vindo ao Indies Brasil</h1>
      <p>
        A rede social feita para artistas, desenvolvedores de jogos e programadores. Conecte-se, compartilhe projetos, construa portfólio e colabore
        com pessoas que vivem de criar tecnologia, arte e experiências digitais.
      </p>

      <HorizontalCardComponent
        image="/images/IndiesWhatsApp.jpeg"
        alt="Qr Code Convite Grupo WhatssApp"
        title="Conheça nossa comunidade"
        description="Grupo focado em desenvolvedores independentes de jogos brasileiros. Compartilhamos dicas, recursos, oportunidades e apoio para ajudar você a crescer na indústria de jogos."
      />
    </>
  );
}

export default Home;
