import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Fixture = {
  id: string;
  homeTeam: { name: string; tla?: string; shortName?: string };
  awayTeam: { name: string; tla?: string; shortName?: string };
  utcDate: string;
  stage?: string;
  status?: string;
  score?: {
    fullTime?: {
      home?: number | null;
      away?: number | null;
    };
    regularTime?: {
      home?: number | null;
      away?: number | null;
    };
    extraTime?: {
      home?: number | null;
      away?: number | null;
    };
    penalties?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

const TLA_TO_ISO: Record<string, string> = {
  POR: "PT",
  ARG: "AR",
  BRA: "BR",
  FRA: "FR",
  GER: "DE",
  ESP: "ES",
  ENG: "GB",
  USA: "US",
  MAR: "MA",
  JPN: "JP",
  NED: "NL",
  CRO: "HR",
  SUI: "CH",
  BEL: "BE",
  DEN: "DK",
  POL: "PL",
  MEX: "MX",
  URU: "UY",
  KOR: "KR",
  AUS: "AU",
  SEN: "SN",
  TUN: "TN",
  KSA: "SA",
  SRB: "RS",
  CMR: "CM",
  GHA: "GH",
  NGA: "NG",
  EGY: "EG"
};

function normalizeCountryCode(input?: string): string {
  const value = (input || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(value)) return value;
  if (/^[A-Z]{3}$/.test(value)) return TLA_TO_ISO[value] || "XX";
  return "XX";
}

function matchScore(m: Fixture): { home: number | null; away: number | null } {
  const full = m.score?.fullTime;
  const regular = m.score?.regularTime;
  const extra = m.score?.extraTime;

  const home = full?.home ?? extra?.home ?? regular?.home ?? null;
  const away = full?.away ?? extra?.away ?? regular?.away ?? null;
  return { home, away };
}

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

    const rows = fixtures.map((m) => {
      const score = matchScore(m);
      return {
        source_match_id: String(m.id),
        home_team: m.homeTeam?.name || "Unknown",
        away_team: m.awayTeam?.name || "Unknown",
        home_code: normalizeCountryCode(m.homeTeam?.tla),
        away_code: normalizeCountryCode(m.awayTeam?.tla),
        stage: m.stage || "Group Stage",
        kickoff_at: m.utcDate,
        home_score: score.home,
        away_score: score.away
      };
    });

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
