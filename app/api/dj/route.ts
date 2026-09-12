import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { analyzeSnapshot, fetchSnapshot } from "@/services/github-analyzer";
import { mapToAudioSpec } from "@/services/dj-sound-mapper";
import { DJPlanSchema, RawRepoSnapshotSchema } from "@/lib/types";

export const dynamic = "force-dynamic";

const FIXTURES = ["clean-lib", "ml-lab", "student-mess"];

async function loadFixture(name?: string) {
  const file = name && FIXTURES.includes(name) ? name : FIXTURES[0];
  const raw = await fs.readFile(
    path.join(process.cwd(), "fixtures", `${file}.json`),
    "utf8"
  );
  return RawRepoSnapshotSchema.parse(JSON.parse(raw));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const demo = searchParams.get("demo");
  const owner = searchParams.get("owner")?.trim();
  const repo = searchParams.get("repo")?.trim();

  try {
    let snapshot;
    if (demo) {
      snapshot = await loadFixture(searchParams.get("fixture") ?? undefined);
    } else if (owner && repo) {
      try {
        snapshot = await fetchSnapshot(owner, repo);
      } catch (e) {
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

    const analysis = analyzeSnapshot(snapshot);
    const spec = mapToAudioSpec(analysis);
    return NextResponse.json(DJPlanSchema.parse({ analysis, spec }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
