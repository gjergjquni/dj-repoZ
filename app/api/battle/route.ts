import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { composeBattle } from "@/lib/battle";
import { scoutRepo } from "@/lib/scout";
import { JokeTankSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

const FIXTURES = ["student-mess.json", "linux-ish.json", "react-ish.json"];

async function loadFixture(name?: string) {
  const file =
    name && FIXTURES.includes(name + ".json") ? name + ".json" : FIXTURES[0];
  const raw = await fs.readFile(
    path.join(process.cwd(), "fixtures", file),
    "utf8"
  );
  return JokeTankSchema.parse(JSON.parse(raw));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const demo = searchParams.get("demo");
  const owner = searchParams.get("owner")?.trim();
  const repo = searchParams.get("repo")?.trim();

  try {
    let tank;
    if (demo) {
      tank = await loadFixture(searchParams.get("fixture") ?? undefined);
    } else if (owner && repo) {
      try {
        tank = await scoutRepo(owner, repo);
      } catch (e) {
        // Wi-Fi death / rate limit → fixtures still demo
        return NextResponse.json(
          { error: `GitHub fetch failed: ${(e as Error).message}. Try ?demo=1.` },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "pass ?owner=&repo= or ?demo=1" },
        { status: 400 }
      );
    }

    const plan = await composeBattle(tank);
    return NextResponse.json(plan);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
