function PasswordRule({ ok, label }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "0.25s",
        opacity: ok ? 1 : 0.55,
        color: ok ? "var(--fgColor-success)" : "var(--fgColor-muted)",
      }}
    >
      {ok ? "✔" : "❌"} {label}
    </div>
  );
}

export default PasswordRule;
