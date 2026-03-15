import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PrototypeParts = {
  styles: string;
  body: string;
  script: string;
};

type Row = Record<string, unknown>;

type DashboardLiveData = {
  displayName: string;
  initials: string;
  tier: string;
  metrics: {
    carolFitness: string;
    arxOutput: string;
    leanMass: string;
    whoopRecovery: string;
  };
};

async function loadPrototypeParts(): Promise<PrototypeParts> {
  try {
    const html = await fs.readFile(path.join(process.cwd(), "index.html"), "utf8");

    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    const bodyMatch = html.match(/<body>([\s\S]*?)<script>/i);
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/i);

    if (!styleMatch || !bodyMatch || !scriptMatch) {
      throw new Error("Could not parse prototype index.html.");
    }

    return {
      styles: styleMatch[1],
      body: bodyMatch[1],
      script: scriptMatch[1],
    };
  } catch {
    return {
      styles: "",
      body: `
        <main style="min-height:100vh;padding:24px;background:#1e2b1b;color:#f2e8dd;font-family:Arial,Helvetica,sans-serif;">
          <h2 style="margin:0 0 8px 0;">Dashboard template missing</h2>
          <p style="margin:0;">Could not load <code>/index.html</code>.</p>
        </main>
      `,
      script: "",
    };
  }
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickString(row: Row | null, keys: string[]): string | null {
  if (!row) return null;
  for (const key of keys) {
    const value = toStringValue(row[key]);
    if (value) return value;
  }
  return null;
}

function pickNumber(row: Row | null, keys: string[]): number | null {
  if (!row) return null;
  for (const key of keys) {
    const value = toNumberValue(row[key]);
    if (value !== null) return value;
  }
  return null;
}

function initialsFromName(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "MB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

async function queryOneByFilter(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  table: string,
  column: string,
  value: string,
): Promise<Row | null> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq(column, value)
    .limit(1);

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }
  return (data[0] as Row) ?? null;
}

async function queryLatestRow(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  tableNames: string[],
  filters: Array<{ column: string; value: string }>,
): Promise<Row | null> {
  const orderColumns = [
    "session_date",
    "performed_at",
    "scan_date",
    "recorded_at",
    "created_at",
    "updated_at",
    "date",
    "id",
  ];

  for (const table of tableNames) {
    for (const filter of filters) {
      for (const orderColumn of orderColumns) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq(filter.column, filter.value)
          .order(orderColumn, { ascending: false })
          .limit(1);

        if (!error && Array.isArray(data) && data.length > 0) {
          return (data[0] as Row) ?? null;
        }
      }
    }
  }

  return null;
}

async function loadDashboardLiveData(
  userId: string,
): Promise<{ role: "member" | "coach"; data: DashboardLiveData }> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const clerkName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "Member";

  const supabase = await createSupabaseServerClient();
  let profileRow: Row | null = null;

  if (supabase) {
    const profileTables = ["members", "profiles", "member_profiles"];
    const profileFilters = [
      { column: "clerk_user_id", value: userId },
      { column: "user_id", value: userId },
      { column: "auth_user_id", value: userId },
      ...(email ? [{ column: "email", value: email }] : []),
    ];

    for (const table of profileTables) {
      for (const filter of profileFilters) {
        profileRow = await queryOneByFilter(
          supabase,
          table,
          filter.column,
          filter.value,
        );
        if (profileRow) break;
      }
      if (profileRow) break;
    }
  }

  const profileRole = pickString(profileRow, ["role", "account_role", "user_role"]);
  const metadataRole = toStringValue(
    (user?.publicMetadata as Record<string, unknown> | undefined)?.role ??
      (user?.unsafeMetadata as Record<string, unknown> | undefined)?.role,
  );

  const isCoach =
    [profileRole, metadataRole]
      .filter(Boolean)
      .some((role) => role?.toLowerCase().includes("coach")) ||
    email.toLowerCase().includes("dustin");

  const role: "member" | "coach" = isCoach ? "coach" : "member";

  const displayName =
    pickString(profileRow, ["full_name", "name", "member_name"]) ??
    (role === "coach" ? clerkName || "Dustin Weaver" : clerkName || "Member");
  const tier =
    pickString(profileRow, ["tier", "membership_tier"]) ??
    (role === "coach" ? "Head Coach" : "Premier");
  const initials = initialsFromName(displayName);

  const profileId = pickString(profileRow, ["id", "member_id", "profile_id"]);
  const tableFilters = [
    ...(profileId
      ? [
          { column: "member_id", value: profileId },
          { column: "profile_id", value: profileId },
        ]
      : []),
    { column: "clerk_user_id", value: userId },
    { column: "user_id", value: userId },
    ...(email
      ? [
          { column: "member_email", value: email },
          { column: "email", value: email },
        ]
      : []),
  ];

  let carolRow: Row | null = null;
  let arxRow: Row | null = null;
  let scanRow: Row | null = null;
  let wearableRow: Row | null = null;

  if (supabase) {
    carolRow = await queryLatestRow(supabase, ["carol_sessions", "carol_rides"], tableFilters);
    arxRow = await queryLatestRow(supabase, ["arx_sessions"], tableFilters);
    scanRow = await queryLatestRow(supabase, ["fit3d_scans", "body_scans"], tableFilters);
    wearableRow = await queryLatestRow(
      supabase,
      ["wearable_data", "wearables_daily", "wearable_metrics"],
      tableFilters,
    );
  }

  const carolFitness = pickNumber(carolRow, [
    "fitness_score",
    "carol_fitness_score",
    "score",
  ]);
  const arxOutput = pickNumber(arxRow, [
    "leg_press_output",
    "concentric_max",
    "max_output",
    "output",
  ]);
  const leanMass = pickNumber(scanRow, [
    "lean_mass_lbs",
    "lean_mass",
    "lean_mass_lb",
    "lean_mass_kg",
  ]);
  const recovery = pickNumber(wearableRow, [
    "whoop_recovery",
    "recovery_score",
    "recovery",
  ]);

  const leanMassDisplay =
    leanMass !== null
      ? `${leanMass > 110 ? leanMass.toFixed(1) : (leanMass * 2.20462).toFixed(1)}`
      : "159.6";

  return {
    role,
    data: {
      displayName,
      initials,
      tier,
      metrics: {
        carolFitness:
          carolFitness !== null ? carolFitness.toFixed(1) : "36.5",
        arxOutput:
          arxOutput !== null ? Math.round(arxOutput).toString() : "699",
        leanMass: leanMassDisplay,
        whoopRecovery:
          recovery !== null ? Math.round(recovery).toString() : "74",
      },
    },
  };
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const prototype = await loadPrototypeParts();

  if (!userId) {
    return null;
  }

  const live = await loadDashboardLiveData(userId);
  const payload = JSON.stringify(live).replace(/</g, "\\u003c");
  const bootstrapScript = `
    (() => {
      const payload = ${payload};
      const role = payload.role === "coach" ? "coach" : "member";
      const data = payload.data || {};

      const firstName = (name) => {
        if (!name || typeof name !== "string") return "Member";
        return name.trim().split(" ")[0] || "Member";
      };

      const setText = (selector, value) => {
        if (!value) return;
        const el = document.querySelector(selector);
        if (el) el.textContent = String(value);
      };

      const setStatCardValue = (labelFragment, value) => {
        if (!value) return;
        const cards = Array.from(document.querySelectorAll(".stat-card"));
        const card = cards.find((item) => {
          const label = item.querySelector(".stat-label");
          const text = label && label.textContent ? label.textContent.toLowerCase() : "";
          return text.includes(labelFragment.toLowerCase());
        });
        if (!card) return;
        const valueEl = card.querySelector(".stat-val");
        if (valueEl) valueEl.textContent = String(value);
      };

      if (typeof setMode === "function") {
        setMode(role);
      }

      setText("#user-name", data.displayName);
      setText("#user-av", data.initials);
      setText("#user-tier", data.tier);
      setText("#top-title", "Good morning, " + firstName(data.displayName) + ".");

      if (data.metrics) {
        setStatCardValue("CAROL fitness score", data.metrics.carolFitness);
        setStatCardValue("ARX leg press output", data.metrics.arxOutput);
        setStatCardValue("Lean mass", data.metrics.leanMass);
        setStatCardValue("Whoop recovery", data.metrics.whoopRecovery);
      }
    })();
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: prototype.styles }} />
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(30,43,27,0.9)",
          border: "1px solid rgba(175,189,165,0.22)",
          borderRadius: 999,
          padding: "6px 10px",
          backdropFilter: "blur(2px)",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#afbda5",
            textDecoration: "none",
            fontSize: 12,
            letterSpacing: "0.04em",
          }}
        >
          Back
        </Link>
        <div style={{ width: 1, height: 14, background: "rgba(175,189,165,0.25)" }} />
        <UserButton />
      </div>

      <div dangerouslySetInnerHTML={{ __html: prototype.body }} />
      {prototype.script ? (
        <script
          // This script powers prototype view switching and date rendering.
          dangerouslySetInnerHTML={{ __html: prototype.script }}
        />
      ) : null}
      <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
    </>
  );
}
