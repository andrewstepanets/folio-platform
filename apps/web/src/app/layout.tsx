import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "folio-platform",
  description: "Virtual crypto portfolio simulator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
