import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PageLayout, Heading, Spinner, Flash, Button } from "@primer/react";

export default function ActivationPage() {
  const router = useRouter();
  const { token_id } = router.query;

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token_id) return;

    async function activate() {
      try {
        const response = await fetch(`/api/v1/activations/${token_id}`, {
          method: "PATCH",
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || "Conta ativada com sucesso! Você já pode fazer login.");
          // redireciona automaticamente após 2.5s
          setTimeout(() => router.push("/login"), 2500);
        } else {
          setStatus("error");
          setMessage(data.message || "Não foi possível ativar a conta. Token inválido ou expirado.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Erro ao conectar com o servidor. {}", err.message);
      }
    }

    activate();
  }, [token_id, router]);

  return (
    <PageLayout padding="spacious">
      <PageLayout.Content width="medium">
        <div
          style={{
            padding: 32,
            marginTop: 48,
            borderRadius: 12,
            border: "1px solid var(--borderColor-default, #d0d7de)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Heading as="h2" sx={{ fontSize: 3 }}>
            Ativação de conta
          </Heading>

          {status === "loading" && (
            <>
              <Spinner size="large" />
              <div>Aguarde enquanto ativamos sua conta...</div>
            </>
          )}

          {status !== "loading" && (
            <>
              <Flash variant={status === "success" ? "success" : "danger"} sx={{ width: "100%" }}>
                {message}
              </Flash>

              <div style={{ display: "flex", gap: 12 }}>
                <Button variant="primary" onClick={() => router.push("/login")}>
                  Ir para Login
                </Button>
                <Button variant="invisible" onClick={() => router.push("/")}>
                  Ir para Home
                </Button>
              </div>
            </>
          )}
        </div>
      </PageLayout.Content>
    </PageLayout>
  );
}
