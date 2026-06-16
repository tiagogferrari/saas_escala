export default function HomePage() {
  return (
    <main
      style={{
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section style={{ maxWidth: 720 }}>
        <p style={{ color: "var(--color-brand)", fontWeight: 700 }}>
          SaaS Escala
        </p>
        <h1 style={{ fontSize: 44, lineHeight: 1.05, margin: "8px 0" }}>
          Gestao inteligente de escalas e voluntariado
        </h1>
        <p style={{ color: "var(--color-muted)", fontSize: 18 }}>
          Base inicial da PWA. O primeiro fluxo sera criar uma escala,
          publicar e confirmar participacao.
        </p>
      </section>
    </main>
  );
}
