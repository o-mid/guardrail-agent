type PolicyRejectProps = {
  policyCodes?: string[];
  humanMessages?: string[];
  schemaErrors?: string[];
  title?: string;
};

const CODE_COPY: Record<string, { title: string; blurb: string }> = {
  infinite_approve: {
    title: "Infinite approve blocked",
    blurb: "Schema accepted the amount string; Go policy refused max-uint spend. No Approve button — nothing hits the chain.",
  },
  recipient_not_allowed: {
    title: "Recipient not allowlisted",
    blurb: "Transfer target is outside the policy allowlist. Loud reject with a stable code — same product surface as infinite approve.",
  },
  amount_over_cap: {
    title: "Amount over policy cap",
    blurb: "Requested amount exceeds the configured spend cap. Plan stops before human approve.",
  },
};

function pickHeadline(codes: string[], fallback: string): { title: string; blurb?: string } {
  for (const code of codes) {
    const hit = CODE_COPY[code];
    if (hit) return hit;
  }
  return { title: fallback };
}

export function PolicyReject({
  policyCodes = [],
  humanMessages = [],
  schemaErrors = [],
  title = "Plan rejected",
}: PolicyRejectProps) {
  const codes = policyCodes.length > 0 ? policyCodes : schemaErrors;
  const headline = pickHeadline(codes, title);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="motion-safe:animate-reject-enter -mx-6 border-y-2 border-danger bg-danger-bg px-6 py-5 md:-mx-8 md:px-8"
    >
      <p className="font-display text-lg font-semibold text-danger">{headline.title}</p>
      {headline.blurb ? <p className="mt-2 max-w-2xl text-sm text-danger/90">{headline.blurb}</p> : null}
      {codes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {codes.map((code) => (
            <code
              key={code}
              className="rounded-sm border border-danger/30 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-danger"
            >
              {code}
            </code>
          ))}
        </div>
      ) : null}
      {humanMessages.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-sm text-danger">
          {humanMessages.map((msg) => (
            <li key={msg} className="leading-relaxed">
              {msg}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-danger/70">
        No approve · no dry-run · no broadcast
      </p>
    </div>
  );
}
