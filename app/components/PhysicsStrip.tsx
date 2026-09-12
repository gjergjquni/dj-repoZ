import type { DJPlan } from "@/lib/types";

type PhysicsStripProps = {
  plan: DJPlan;
};

function PhysicsMetric({
  label,
  value,
  tone,
  title,
  fill,
}: {
  label: string;
  value: string;
  tone: "purple" | "orange" | "text";
  title: string;
  fill?: number;
}) {
  return (
    <div className="physics-metric" title={title}>
      <span className="physics-label">{label}</span>
      <span className={`physics-value physics-value-${tone}`}>{value}</span>
      {fill != null ? (
        <span className="physics-meter" aria-hidden="true">
          <span
            className="physics-meter-fill"
            style={{ width: `${Math.min(Math.max(fill, 0), 1) * 100}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

export function PhysicsStrip({ plan }: PhysicsStripProps) {
  const { analysis, spec } = plan;
  return (
    <div className="physics-strip">
      <PhysicsMetric
        label="SEED"
        value={analysis.seed.toString(16).padStart(8, "0").toUpperCase()}
        tone="purple"
        title="hash32(owner/repo + pushedAt)"
      />
      <PhysicsMetric
        label="BPM"
        value={String(spec.bpm)}
        tone="orange"
        title="tempo from messiness score inside the tier band"
      />
      <PhysicsMetric
        label="MESSINESS"
        value={`${analysis.messiness_score}/100`}
        tone="text"
        title="issues, churn, tree depth, missing tests"
        fill={analysis.messiness_score / 100}
      />
      <PhysicsMetric
        label="GENRE"
        value={spec.genre}
        tone="text"
        title={spec.mood}
      />
      <PhysicsMetric
        label="TYPE"
        value={analysis.project_type.replace(/_/g, " ")}
        tone="text"
        title={analysis.project_signals.join(", ") || "library (no strong signals)"}
      />
      <PhysicsMetric
        label="VELOCITY"
        value={`${analysis.commit_velocity}/d`}
        tone="text"
        title="commits per day across the fetched window"
        fill={Math.min(analysis.commit_velocity / 6, 1)}
      />
    </div>
  );
}
