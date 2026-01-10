import HorizontalCardComponent from "@/components/Card/HorizontalCardComponent";
import CarouselComponent from "@/components/Carousel/CarouselComponent";
import styles from "./index.module.css";
import { Heading } from "@primer/react";
import VerticalCardComponent from "@/components/Card/VerticalCardComponent";

function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <Heading as="h4">Atenção - ambiente de testes</Heading>
        <p>Esta pagina está em versão de testes Beta, todo conteúdo aqui postado será apagado quando lançarmos a versão final</p>
      </section>

      {/* HERO */}
      <section className={styles.hero}>
        <Heading as="h1">Bem-vindo ao Indies Brasil</Heading>
        <p>
          A rede social feita para artistas, desenvolvedores de jogos e programadores. Conecte-se, compartilhe projetos, construa portfólio e colabore
          com quem vive de criar tecnologia e experiências digitais.
        </p>
      </section>

      {/* COMUNIDADE */}
      <section className={styles.section}>
        <HorizontalCardComponent
          image="/images/IndiesWhatsApp.jpeg"
          alt="Qr Code Convite Grupo WhatsApp"
          title="Conheça nossa comunidade"
          description="Grupo focado em desenvolvedores independentes de jogos brasileiros. Compartilhamos dicas, recursos, oportunidades e apoio para fomentar a indústria nacional."
        />
      </section>

      {/* DEMONSTRAÇÃO */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2>Links incorporados com YouTube, Twitch, Instagram e Steam</h2>
          <p>
            A plataforma permite incorporar vídeos, lives e posts diretamente nas publicações, facilitando o compartilhamento de conteúdo multimídia.
          </p>
        </header>

        <CarouselComponent
          cards={[
            { content: "Instagram Imagem", image_src: "/images/instagramimage.png" },
            { content: "Instagram Vídeo", image_src: "/images/instagramvideo.png" },
            { content: "Steam Widget", image_src: "/images/steamwidget.png" },
            { content: "Canal Twitch", image_src: "/images/twitchchannel.png" },
            { content: "YouTube Shorts", image_src: "/images/youtubeshorts.png" },
            { content: "YouTube Vídeo", image_src: "/images/youtubevideo.png" },
          ]}
        />
      </section>
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2>Sistema de Tags</h2>
          <p>Tags para identificar o assunto ou uma trending do post.</p>
        </header>
        <VerticalCardComponent
          image="/images/sistematags.png"
          alt="ranqueamento Tags"
          title="Tags"
          description="ranqueamento e localização de posts através de tags que auxiliam a classificação do assunto podendo iniciar uma trend ou uma conversa"
        />
      </section>
    </main>
  );
}

export default Home;
