type PolicyRejectProps = {
  policyCodes?: string[];
  humanMessages?: string[];
  schemaErrors?: string[];
  title?: string;
};

export function PolicyReject({
  policyCodes = [],
  humanMessages = [],
  schemaErrors = [],
  title = "Plan rejected",
}: PolicyRejectProps) {
  const codes = policyCodes.length > 0 ? policyCodes : schemaErrors;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="motion-safe:animate-reject-enter -mx-6 border-y-2 border-danger bg-danger-bg px-6 py-5 md:-mx-8 md:px-8"
    >
      <p className="font-display text-lg font-semibold text-danger">{title}</p>
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
    </div>
  );
}
