import React, { useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Button, FormControl, TextInput, Flash, Stack, Spinner } from "@primer/react";
import { useUser } from "@/context/UserContext.js";

export default function Login() {
  const router = useRouter();
  const { fetchUser } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrMsg("");
    setLoading(true);

    try {
      const response = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.status === 201) {
        await fetchUser();
        router.push("/");
      } else {
        const data = await response.json();
        setErrMsg(data.message || "Credenciais inválidas.");
      }
    } catch (error) {
      setErrMsg("Erro de conexão com o servidor.");
    }

    setLoading(false);
  }

  return (
    <PageLayout padding="spacious">
      <PageLayout.Header>
        <Heading as="h2">Login</Heading>
      </PageLayout.Header>

      <PageLayout.Content width="medium">
        <form onSubmit={handleSubmit}>
          <Stack gap={4}>
            {errMsg && <Flash variant="danger">{errMsg}</Flash>}

            {/* EMAIL */}
            <FormControl required>
              <FormControl.Label>Email</FormControl.Label>
              <TextInput type="email" block value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormControl>

            {/* PASSWORD */}
            <FormControl required>
              <FormControl.Label>Senha</FormControl.Label>
              <TextInput type="password" block value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormControl>

            <Button type="submit" variant="primary" block disabled={loading}>
              {loading ? <Spinner size="small" /> : "Entrar"}
            </Button>

            <Button variant="invisible" block onClick={() => router.push("/cadastro")}>
              Criar conta
            </Button>
          </Stack>
        </form>
      </PageLayout.Content>
    </PageLayout>
  );
}
