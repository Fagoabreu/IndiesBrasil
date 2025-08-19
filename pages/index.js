import Link from "next/link";
function Home() {
  return (
    <>
      <h1>Bem Vindo comunidade dos desenvolvedores indies do Brasil</h1>
      Contruindo um espaço de desenvolvedores para desenvolvedores e para o
      publico. O intuito é trabalharmos em conjunto para superar as barreiras
      existentes para os desenvolvedores. Estamos neste exato momento
      construindo uma nova pagina para crescemos em comunidade.
      <br />
      <code>- meta atual: criação de usuário e autenticação</code>
      <br />
      <br />
      <Link href="/social" className="btn btn-success btn-lg">
        Pagina de Testes
      </Link>
    </>
  );
}

export default Home;
