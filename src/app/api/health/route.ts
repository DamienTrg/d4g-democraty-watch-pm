import { query } from "@/lib/db";

// Vérifie que l'app parle bien à la base : GET /api/health
export async function GET() {
  try {
    const [row] = await query<{ now: string; version: string }>(
      "select now() as now, version() as version",
    );
    return Response.json({ status: "ok", database: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ status: "error", message }, { status: 500 });
  }
}
