import "./globals.css";

export const metadata = {
  title: "SaaS Escala",
  description: "Gestao inteligente de escalas e voluntariado",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
