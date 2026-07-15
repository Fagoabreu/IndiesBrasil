// pages/reset-password/new.js
import { useRouter } from "next/router";
import { useState } from "react";
import { TextInput, Button, FormControl } from "@primer/react";
import styles from "./RequestNew.module.css";

export default function ResetNewPassword() {
  const router = useRouter();
  const token_id = router.query.token_id;

  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch(`/api/v1/reset-password/${token_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) setDone(true);
  }

  return (
    <div className={styles.container}>
      <h1>Nova Senha</h1>

      {done ? (
        <p>Senha alterada com sucesso. Você já pode fazer login.</p>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <FormControl>
            <FormControl.Label>Nova senha</FormControl.Label>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormControl>

          <Button type="submit">Alterar Senha</Button>
        </form>
      )}
    </div>
  );
}
