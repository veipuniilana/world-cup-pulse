import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Fixture = {
  id: string;
  homeTeam: { name: string; tla: string };
  awayTeam: { name: string; tla: string };
  utcDate: string;
  stage?: string;
  score?: {
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("FOOTBALL_DATA_API_KEY");
    const baseUrl = Deno.env.get("FOOTBALL_DATA_BASE_URL") || "https://api.football-data.org/v4";
    const competitionCode = Deno.env.get("FOOTBALL_DATA_COMP") || "WC";

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing FOOTBALL_DATA_API_KEY" }), { status: 500 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const response = await fetch(`${baseUrl}/competitions/${competitionCode}/matches`, {
      headers: { "X-Auth-Token": apiKey }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Upstream API error" }), { status: 502 });
    }

    const body = await response.json();
    const fixtures: Fixture[] = body.matches || [];

    const rows = fixtures.map((m) => ({
      source_match_id: String(m.id),
      home_team: m.homeTeam?.name || "Unknown",
      away_team: m.awayTeam?.name || "Unknown",
      home_code: m.homeTeam?.tla || "XX",
      away_code: m.awayTeam?.tla || "XX",
      stage: m.stage || "Group Stage",
      kickoff_at: m.utcDate,
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null
    }));

    const { error } = await supabase.from("matches").upsert(rows, { onConflict: "source_match_id" });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ synced: rows.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
