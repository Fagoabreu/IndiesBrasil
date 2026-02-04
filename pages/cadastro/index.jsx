import React, { useState } from "react";
import { useRouter } from "next/router";
import { Heading, Button, FormControl, TextInput, Stack, Spinner, ProgressBar, IconButton } from "@primer/react";
import { EyeIcon, EyeClosedIcon } from "@primer/octicons-react";
import PasswordRule from "@/components/PasswordRule.js";
import styles from "./Cadastro.module.css";
import StatusMessageComponent from "@/components/StatusMessage/StatusMessageComponent";

export default function Cadastro() {
  const router = useRouter();

  // form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // UI
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(true);

  // messages
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // ======================================================
  // CPF MASK
  function formatCPF(value) {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .substring(0, 14);
  }

  // ======================================================
  // CPF VALIDATION (ALGORITHM)
  function isValidCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, "");
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let sum = 0;

    for (let i = 1; i <= 9; i++) sum += parseInt(cpf[i - 1]) * (11 - i);

    let remainder = (sum * 10) % 11;
    if (remainder >= 10) remainder = 0;
    if (remainder !== parseInt(cpf[9])) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cpf[i - 1]) * (12 - i);

    remainder = (sum * 10) % 11;
    if (remainder >= 10) remainder = 0;

    return remainder === parseInt(cpf[10]);
  }

  // ======================================================
  // PASSWORD STRENGTH
  function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }

  const strength = getPasswordStrength(password);

  const strengthInfo = {
    0: { label: "Muito fraca", percent: 0 },
    1: { label: "Muito fraca", percent: 20 },
    2: { label: "Fraca", percent: 40 },
    3: { label: "Aceitável", percent: 60 },
    4: { label: "Forte", percent: 80 },
    5: { label: "Muito forte", percent: 100 },
  };

  const strongEnough = strength >= 3;

  // ======================================================
  // SUBMIT
  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) return;

    setErrorMsg("");
    setSuccessMsg("");
    setFieldErrors({});
    setLoading(true);

    const newErrors = {};

    if (!username) {
      newErrors.username = "Informe um nome de usuário.";
    } else if (username.length < 3) {
      newErrors.username = "O nome de usuário deve ter ao menos 3 caracteres.";
    }
    if (!email) newErrors.email = "Informe um email.";

    if (!password) {
      newErrors.password = "Informe uma senha.";
    } else if (!strongEnough) {
      newErrors.password = "A senha está muito fraca.";
    }

    if (password !== confirmPass) {
      newErrors.confirmPass = "As senhas não coincidem.";
    }

    if (!cpf) {
      newErrors.cpf = "Informe o CPF.";
    } else if (!isValidCPF(cpf)) {
      newErrors.cpf = "CPF inválido.";
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setLoading(false);
      return;
    }

    const rawCpf = cpf.replace(/\D/g, "");

    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, cpf: rawCpf }),
      });

      if (response.status === 201) {
        setSuccessMsg("Sua conta criada com sucesso!\no Link de ativação foi enviado ao email informado.");
        setShowForm(false);
        setTimeout(() => router.push("/login"), 10000);
      } else {
        const data = await response.json();
        setErrorMsg({
          statusCode: data.status_code,
          message: data.message,
          action: data.action,
        });
        setShowForm(true);
      }
    } catch {
      setErrorMsg("Erro ao conectar ao servidor.");
    }

    setLoading(false);
  }

  function cleanFieldError(field) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  // ======================================================
  // VALIDATION STATUS
  const statusUser = username ? "success" : undefined;
  const statusEmail = !fieldErrors.email && email ? "success" : undefined;
  const statusCpf = cpf && isValidCPF(cpf) ? "success" : undefined;
  const statusPass = password && strongEnough ? "success" : undefined;
  const statusConfirm = confirmPass && confirmPass === password ? "success" : undefined;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Heading as="h1" className={styles.title}>
          Criar Conta
        </Heading>

        <form onSubmit={handleSubmit}>
          <Stack gap={4}>
            <StatusMessageComponent errorMsg={errorMsg} successMsg={successMsg} />

            {/* USERNAME */}
            {showForm && (
              <FormControl required validationStatus={fieldErrors.username ? "error" : statusUser}>
                <FormControl.Label>Nome de usuário</FormControl.Label>
                <TextInput
                  block
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    cleanFieldError("username");
                  }}
                />
                {fieldErrors.username && <FormControl.Validation variant="error">{fieldErrors.username}</FormControl.Validation>}
              </FormControl>
            )}

            {/* EMAIL */}
            {showForm && (
              <FormControl required validationStatus={fieldErrors.email ? "error" : statusEmail}>
                <FormControl.Label>Email</FormControl.Label>
                <TextInput
                  type="email"
                  block
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    cleanFieldError("email");
                  }}
                />
                {fieldErrors.email && <FormControl.Validation variant="error">{fieldErrors.email}</FormControl.Validation>}
              </FormControl>
            )}

            {/* CPF */}
            {showForm && (
              <FormControl required validationStatus={fieldErrors.cpf ? "error" : statusCpf}>
                <FormControl.Label>CPF</FormControl.Label>
                <TextInput
                  block
                  maxLength={14}
                  value={cpf}
                  onChange={(e) => {
                    setCpf(formatCPF(e.target.value));
                    cleanFieldError("cpf");
                  }}
                  placeholder="000.000.000-00"
                />
                {fieldErrors.cpf && <FormControl.Validation variant="error">{fieldErrors.cpf}</FormControl.Validation>}
              </FormControl>
            )}

            {/* PASSWORD */}
            {showForm && (
              <FormControl required validationStatus={fieldErrors.password ? "error" : statusPass}>
                <FormControl.Label>Senha</FormControl.Label>
                <TextInput
                  block
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    cleanFieldError("password");
                    cleanFieldError("confirmPass");
                  }}
                  trailingAction={
                    <IconButton
                      variant="invisible"
                      aria-label="Mostrar senha"
                      icon={showPass ? EyeClosedIcon : EyeIcon}
                      onClick={() => setShowPass(!showPass)}
                    />
                  }
                />

                {/* RULES */}
                <div className={styles.rules}>
                  <PasswordRule ok={password.length >= 8} label="Mínimo de 8 caracteres" />
                  <PasswordRule ok={/[A-Z]/.test(password)} label="Letra maiúscula" />
                  <PasswordRule ok={/[0-9]/.test(password)} label="Número" />
                  <PasswordRule ok={/[^A-Za-z0-9]/.test(password)} label="Caractere especial" />
                </div>

                {/* STRENGTH */}
                <div className={styles.strength}>
                  <span className={styles.strengthLabel} aria-live="polite">
                    Força: {strengthInfo[strength].label}
                  </span>

                  <ProgressBar
                    progress={strengthInfo[strength].percent}
                    barSize="large"
                    aria-label="Força da senha"
                    sx={{
                      bg: "var(--borderColor-muted)",
                      color: strength <= 1 ? "var(--fgColor-danger)" : strength === 2 ? "var(--fgColor-attention)" : "var(--fgColor-success)",
                    }}
                  />
                </div>

                {fieldErrors.password && <FormControl.Validation variant="error">{fieldErrors.password}</FormControl.Validation>}
              </FormControl>
            )}

            {/* CONFIRM */}
            {showForm && (
              <FormControl required validationStatus={fieldErrors.confirmPass ? "error" : statusConfirm}>
                <FormControl.Label>Confirmar Senha</FormControl.Label>
                <TextInput
                  block
                  type={showConfirmPass ? "text" : "password"}
                  value={confirmPass}
                  onChange={(e) => {
                    setConfirmPass(e.target.value);
                    cleanFieldError("confirmPass");
                  }}
                  trailingAction={
                    <IconButton
                      variant="invisible"
                      aria-label="Mostrar senha"
                      icon={showConfirmPass ? EyeClosedIcon : EyeIcon}
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                    />
                  }
                />
                {fieldErrors.confirmPass && <FormControl.Validation variant="error">{fieldErrors.confirmPass}</FormControl.Validation>}
              </FormControl>
            )}

            {showForm && (
              <Button type="submit" variant="primary" block disabled={loading}>
                {loading ? <Spinner size="small" /> : "Criar Conta"}
              </Button>
            )}
            {!showForm && (
              <Button
                onClick={() => {
                  router.push("/login");
                }}
                variant="primary"
              >
                Voltar
              </Button>
            )}
          </Stack>
        </form>
      </div>
    </div>
  );
}
