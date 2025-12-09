import { useEffect, useState } from "react";
import { PageLayout, Heading, TextInput, Stack } from "@primer/react";
import MemberCard from "@/components/MemberCard/MemberCard";
import styles from "./MembersPage.module.css";

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/users", { credentials: "include" });
        const data = await res.json();
        setMembers(data || []);
        setFiltered(data || []);
      } catch (e) {
        console.error("Erro ao carregar membros", e);
      }
    }

    load();
  }, []);

  function handleSearch(value) {
    setSearch(value);
    const term = value.toLowerCase();

    const results = members.filter((u) => u.name?.toLowerCase().includes(term) || u.username?.toLowerCase().includes(term));

    setFiltered(results);
  }

  return (
    <PageLayout padding="spacious">
      <PageLayout.Header>
        <Heading as="h2">Membros ({filtered.length.toLocaleString()})</Heading>
      </PageLayout.Header>

      <PageLayout.Content width="full">
        <Stack direction="horizontal" gap={2} sx={{ marginBottom: 3 }}>
          <TextInput placeholder="Pesquisar por nome..." value={search} onChange={(e) => handleSearch(e.target.value)} leadingVisual="search" sx={{ width: 300 }} />
        </Stack>

        {/* GRID DE CARDS */}
        <div className={styles.grid}>
          {filtered.map((user) => (
            <MemberCard key={user.id} user={user} />
          ))}
        </div>
      </PageLayout.Content>
    </PageLayout>
  );
}
