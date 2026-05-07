import { HealthResponseSchema, type HealthResponse } from "@folio/shared";

async function getHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(
      `${process.env.API_URL ?? "http://localhost:3001"}/health`,
      { cache: "no-store" },
    );
    const data: unknown = await res.json();
    return HealthResponseSchema.parse(data);
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await getHealth();

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>folio-platform</h1>
      {health ? (
        <p>
          API status: <strong>{health.status}</strong> — commit:{" "}
          <code>{health.commit}</code>
        </p>
      ) : (
        <p>API is unreachable</p>
      )}
    </main>
  );
}
