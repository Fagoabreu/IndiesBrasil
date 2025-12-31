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
        description="Grupo focado em desenvolvedores independentes de jogos brasileiros. Compartilhamos dicas, recursos, oportunidades e apoio para fomentar a indústria de jogos nacional."
      />
      <HorizontalCardComponent
        image="/images/integraInstagram.png"
        alt="Qr Code Convite Grupo WhatssApp"
        title="Integração com o YouTube/Twitch/Instagram"
        description="A aplicação agora suporta incorporação de vídeos do YouTube, transmissões ao vivo da Twitch e postagens do Instagram diretamente nas suas publicações. Compartilhe seu conteúdo multimídia favorito com facilidade!"
      />
    </>
  );
}

export default Home;
