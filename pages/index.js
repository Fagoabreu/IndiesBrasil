import HorizontalCardComponent from "@/components/Card/HorizontalCardComponent";
import CarouselComponent from "@/components/Carousel/CarouselComponent";
import styles from "./index.module.css";

function Home() {
  return (
    <main className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <h1>Bem-vindo ao Indies Brasil</h1>
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
          <h2>Links incorporados com YouTube, Twitch e Instagram</h2>
          <p>
            A plataforma permite incorporar vídeos, lives e posts diretamente nas publicações, facilitando o compartilhamento de conteúdo multimídia.
          </p>
        </header>

        <CarouselComponent
          cards={[
            { content: "YouTube Shorts", image_src: "/images/youtubeShorts.png" },
            { content: "YouTube Vídeo", image_src: "/images/youtubeVideo.png" },
            { content: "Instagram Imagem", image_src: "/images/instagramImage.png" },
            { content: "Instagram Vídeo", image_src: "/images/instagramVideo.png" },
            { content: "Canal Twitch", image_src: "/images/twitchChannel.png" },
          ]}
        />
      </section>
    </main>
  );
}

export default Home;
