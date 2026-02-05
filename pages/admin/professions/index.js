import { useEffect, useState } from "react";
import { PageLayout, Heading, TextInput, Button, Flash } from "@primer/react";

import IconSvg from "@/components/IconSvg/IconSvg";
import "./Professions.css";

export default function ContactTypesPage() {
  const [name, setName] = useState("");
  const [iconImg, setIconImg] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTypes() {
      const res = await fetch("/api/v1/professions", {
        credentials: "include",
      });

      const data = await res.json();

      if (isMounted) {
        setItems(data || []);
      }
    }

    loadTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!name || !iconImg) {
      setError("Nome e ícone são obrigatórios.");
      return;
    }

    const res = await fetch("/api/v1/professions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, icon_img: iconImg }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.message || "Erro ao salvar");
      return;
    }

    setName("");
    setIconImg("");

    // recarrega lista
    const refreshed = await fetch("/api/v1/professions", {
      credentials: "include",
    });
    setItems(await refreshed.json());
  }

  async function handleDelete(name) {
    const confirmed = window.confirm("Tem certeza que deseja remover esta profissão?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/v1/professions/${name}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao remover tipo de contato");
      }

      // Atualização otimista do estado
      setItems((prev) => prev.filter((item) => item.name !== name));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <PageLayout>
      <PageLayout.Content width="medium">
        <Heading as="h2">Profissões</Heading>

        {error && <Flash variant="danger">{error}</Flash>}

        <form onSubmit={handleSubmit} className="contact-form">
          <TextInput placeholder="Profissão (ex: 2d Artist)" value={name} onChange={(e) => setName(e.target.value)} />
          <TextInput placeholder="Ícone (ex: 2DArtist)" value={iconImg} onChange={(e) => setIconImg(e.target.value)} />

          <Button type="submit" variant="primary">
            Adicionar
          </Button>
        </form>

        <ul className="contact-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="contact-info">
                <IconSvg src={`/images/professions/${item.icon_img}.png`} alt={item.name} />
                <strong>{item.name}</strong>

                <Button size="small" variant="danger" onClick={() => handleDelete(item.name)}>
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </PageLayout.Content>
    </PageLayout>
  );
}
