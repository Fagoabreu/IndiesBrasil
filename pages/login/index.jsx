import React, { useState } from "react";
import { useRouter } from "next/router";
import { Heading, Button, FormControl, TextInput, Stack, Spinner } from "@primer/react";
import { useUser } from "@/context/UserContext";
import styles from "./Login.module.css";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";

export default function Login() {
  const router = useRouter();
  const { fetchUser } = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // erro padronizado
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        await fetchUser();
        router.push("/");
        return;
      }

      const data = await response.json();
      setError({
        name: data.name,
        message: data.message,
        action: data.action,
        status_code: data.status_code,
      });
    } catch {
      setError({
        name: "NetworkError",
        message: "Erro de conexão com o servidor.",
        action: "Verifique sua conexão com a internet e tente novamente.",
        status_code: 0,
      });
    }

    setLoading(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Heading as="h1" className={styles.title}>
          Login
        </Heading>

        <form onSubmit={handleSubmit}>
          <Stack gap={4}>
            {/* 🔴 ERRO GLOBAL */}
            <StatusMessageComponent errorMsg={error} />

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

            <div className={styles.links}>
              <Button variant="invisible" onClick={() => router.push("/cadastro")}>
                Criar conta
              </Button>

              <Button variant="invisible" onClick={() => router.push("/cadastro/reset-password")}>
                Esqueci a senha
              </Button>
            </div>
          </Stack>
        </form>
      </div>
    </div>
  );
}
