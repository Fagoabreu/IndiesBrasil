import { useEffect, useState } from "react";
import { PageLayout, Heading, TextInput, Button, Flash } from "@primer/react";

import "./ContactTypes.css";
import IconSvg from "@/components/IconSvg/IconSvg";

export default function ContactTypesPage() {
  const [iconKey, setIconKey] = useState("");
  const [iconImg, setIconImg] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTypes() {
      const res = await fetch("/api/v1/contact-types", {
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

    if (!iconKey || !iconImg) {
      setError("Nome e ícone são obrigatórios.");
      return;
    }

    const res = await fetch("/api/v1/contact-types", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icon_key: iconKey, icon_img: iconImg }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.message || "Erro ao salvar");
      return;
    }

    setIconKey("");
    setIconImg("");

    // recarrega lista
    const refreshed = await fetch("/api/v1/contact-types", {
      credentials: "include",
    });
    setItems(await refreshed.json());
  }

  async function handleDelete(contactTypeId) {
    const confirmed = window.confirm("Tem certeza que deseja remover este tipo de contato?");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/v1/contact-types/${contactTypeId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao remover tipo de contato");
      }

      // Atualização otimista do estado
      setItems((prev) => prev.filter((item) => item.id !== contactTypeId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <PageLayout>
      <PageLayout.Content width="medium">
        <Heading as="h2">Tipos de Contato</Heading>

        {error && <Flash variant="danger">{error}</Flash>}

        <form onSubmit={handleSubmit} className="contact-form">
          <TextInput placeholder="Nome (ex: LinkedIn)" value={iconKey} onChange={(e) => setIconKey(e.target.value)} />
          <TextInput placeholder="Ícone (ex: linkedin)" value={iconImg} onChange={(e) => setIconImg(e.target.value)} />

          <Button type="submit" variant="primary">
            Adicionar
          </Button>
        </form>

        <ul className="contact-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="contact-info">
                <strong>{item.icon_key}</strong>
                <IconSvg src={`/images/contacts/${item.icon_img}.svg`} alt={item.icon_key} />
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
