import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Spinner, Flash, Button } from "@primer/react";

export default function ActivationPage() {
  const router = useRouter();
  const { token_id } = router.query;

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token_id) return;

    async function activate() {
      try {
        const response = await fetch(`/api/v1/activations/${token_id}`, {
          method: "PATCH",
        });

        const data = await response.json();

        if (response.status === 200) {
          setStatus("success");
          setMessage(data.message || "Conta ativada com sucesso! Você já pode fazer login.");

          setTimeout(() => router.push("/login"), 2500);
        } else {
          setStatus("error");
          setMessage(data.message || "Não foi possível ativar a conta. Token inválido ou expirado.");
        }
      } catch (error) {
        setStatus("error");
        setMessage("Erro ao conectar com o servidor.");
      }
    }

    activate();
  }, [token_id, router]);

  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "80px auto",
        padding: "24px",
        borderRadius: "8px",
        border: "1px solid var(--borderColor-default, #d0d7de)",
        textAlign: "center",
      }}
    >
      {status === "loading" && (
        <>
          <Spinner size="large" />
          <p>Ativando sua conta, aguarde...</p>
        </>
      )}

      {status !== "loading" && (
        <Flash variant={status === "success" ? "success" : "danger"} sx={{ marginBottom: 3 }}>
          {message}
        </Flash>
      )}

      {status !== "loading" && <Button onClick={() => router.push("/login")}>Ir para Login</Button>}
    </div>
  );
}
