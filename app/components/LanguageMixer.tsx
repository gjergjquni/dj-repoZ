import { langsForChannel, MIXER_CHANNELS, type Mixer } from "@/lib/mixer";

type LanguageMixerProps = {
  mixer: Mixer;
  languages: Record<string, number>;
  pulse: number;
};

function MixerChannel({
  name,
  gain,
  caption,
  pulse,
}: {
  name: keyof Mixer;
  gain: number;
  caption: string;
  pulse: number;
}) {
  const opacity = name === "kick" ? 1 - pulse * 0.25 : 1;
  return (
    <div className="mixer-channel">
      <div className="mixer-channel-head">
        <span className="mixer-channel-name">{name}</span>
        <span className="mixer-channel-val">{gain.toFixed(2)}</span>
      </div>
      <div className="mixer-track">
        <div
          className={`mixer-fill mixer-fill-${name}`}
          style={{ width: `${Math.min(gain, 1) * 100}%`, opacity }}
        />
      </div>
      <div className="mixer-caption">{caption || "—"}</div>
    </div>
  );
}

export function LanguageMixer({ mixer, languages, pulse }: LanguageMixerProps) {
  return (
    <aside className="language-mixer">
      <div className="panel-head">MIXER // LANGUAGES</div>
      <div className="mixer-body">
        {MIXER_CHANNELS.map((ch) => (
          <MixerChannel
            key={ch}
            name={ch}
            gain={mixer[ch]}
            caption={langsForChannel(ch, languages)}
            pulse={pulse}
          />
        ))}
      </div>
    </aside>
  );
}
