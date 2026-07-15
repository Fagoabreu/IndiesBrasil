// pages/reset-password/index.js
import { useState } from "react";
import { TextInput, Button, FormControl } from "@primer/react";
import styles from "./ResetRequest.module.css";

export default function ResetPasswordRequest() {
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    await fetch("/api/v1/reset-password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, cpf }),
    });

    setDone(true);
  }

  return (
    <div className={styles.container}>
      <h1>Redefinir Senha</h1>

      {done ? (
        <p>Se existir uma conta, você receberá um email com instruções.</p>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <FormControl>
            <FormControl.Label>Email</FormControl.Label>
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormControl>

          <FormControl>
            <FormControl.Label>CPF</FormControl.Label>
            <TextInput value={cpf} onChange={(e) => setCpf(e.target.value)} />
          </FormControl>

          <Button type="submit">Enviar</Button>
        </form>
      )}
    </div>
  );
}
