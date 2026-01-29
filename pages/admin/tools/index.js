import { useEffect, useState } from "react";
import { PageLayout, Heading, TextInput, Button, Flash } from "@primer/react";

import "./ContactTypes.css";
import IconSvg from "@/components/IconSvg/IconSvg";

export default function ContactTypesPage() {
  const [name, setName] = useState("");
  const [iconImg, setIconImg] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTypes() {
      const res = await fetch("/api/v1/tools", {
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

    const res = await fetch("/api/v1/tools", {
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
    const refreshed = await fetch("/api/v1/tools", {
      credentials: "include",
    });
    setItems(await refreshed.json());
  }

  async function handleDelete(toolId) {
    const confirmed = window.confirm("Tem certeza que deseja remover esta ferramenta?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/v1/tools/${toolId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao remover tipo de contato");
      }

      // Atualização otimista do estado
      setItems((prev) => prev.filter((item) => item.id !== toolId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <PageLayout>
      <PageLayout.Content width="medium">
        <Heading as="h2">Tipos de Ferramenta</Heading>

        {error && <Flash variant="danger">{error}</Flash>}

        <form onSubmit={handleSubmit} className="contact-form">
          <TextInput placeholder="Nome (ex: Unity)" value={name} onChange={(e) => setName(e.target.value)} />
          <TextInput placeholder="Ícone (ex: Unity)" value={iconImg} onChange={(e) => setIconImg(e.target.value)} />

          <Button type="submit" variant="primary">
            Adicionar
          </Button>
        </form>

        <ul className="contact-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="contact-info">
                <strong>{item.name}</strong>
                <IconSvg src={`/images/tools/${item.icon_img}.svg`} alt={item.name} />
              </div>

              <Button size="small" variant="danger" onClick={() => handleDelete(item.id)}>
                Remover
              </Button>
            </li>
          ))}
        </ul>
      </PageLayout.Content>
    </PageLayout>
  );
}
