type ErrorBannerProps = {
  message: string;
};

function classify(message: string): { title: string; suggestFixture: boolean } {
  const m = message.toLowerCase();
  if (
    m.includes("unparseable") ||
    m.includes("paste owner") ||
    m.includes("expected owner")
  ) {
    return { title: "ERROR // EXPECTED OWNER/REPO OR GITHUB URL", suggestFixture: false };
  }
  if (m.includes("no commits") || m.includes("insufficient")) {
    return { title: "ERROR // INSUFFICIENT SOURCE MATERIAL", suggestFixture: false };
  }
  if (m.includes("no target") || m.includes("pass ?owner")) {
    return { title: "ERROR // NO TARGET SPECIFIED", suggestFixture: false };
  }
  if (m.includes("502") || m.includes("fetch failed") || m.includes("unreachable")) {
    return { title: "ERROR // REPOSITORY UNREACHABLE", suggestFixture: true };
  }
  return { title: "ERROR // REPOSITORY UNREACHABLE", suggestFixture: true };
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  const { title, suggestFixture } = classify(message);
  return (
    <div className="error-banner" role="alert">
      <div className="error-title">{title}</div>
      <div className="error-raw">{message}</div>
      {suggestFixture ? <div className="error-hint">TRY A FIXTURE BELOW</div> : null}
    </div>
  );
}
