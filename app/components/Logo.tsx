type LogoProps = {
  size?: "sm" | "lg";
};

export function Logo({ size = "sm" }: LogoProps) {
  const mark = (
    <>
      REPO<span className="logo-slashes">//</span>DJ
    </>
  );
  return (
    <span className={`logo logo-${size}`}>
      <span className="logo-text">{mark}</span>
      {size === "lg" ? (
        <span className="logo-glitch" aria-hidden="true">
          {mark}
        </span>
      ) : null}
    </span>
  );
}
