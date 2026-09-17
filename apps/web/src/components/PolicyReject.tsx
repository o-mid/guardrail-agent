import { WarningIcon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type PolicyRejectProps = {
  policyCodes?: string[];
  humanMessages?: string[];
  schemaErrors?: string[];
  title?: string;
};

const CODE_COPY: Record<string, { title: string; blurb: string }> = {
  infinite_approve: {
    title: "Infinite approve blocked",
    blurb:
      "Schema accepted the amount string. Go policy refused max-uint spend. No Approve button. Nothing hits the chain.",
  },
  recipient_not_allowed: {
    title: "Recipient not allowlisted",
    blurb: "Transfer target is outside the policy allowlist. Same reject surface, different rule.",
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
    <Alert
      variant="destructive"
      aria-live="assertive"
      className="motion-safe:animate-reject-enter rounded-none border-x-0 border-y-2 border-destructive px-5 py-5 md:px-6"
    >
      <WarningIcon className="size-4" />
      <AlertTitle className="text-base">{headline.title}</AlertTitle>
      {headline.blurb ? <AlertDescription>{headline.blurb}</AlertDescription> : null}
      {codes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {codes.map((code) => (
            <Badge key={code} variant="destructive">
              {code}
            </Badge>
          ))}
        </div>
      ) : null}
      {humanMessages.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {humanMessages.map((msg) => (
            <li key={msg} className="leading-relaxed">
              {msg}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-xs font-medium text-destructive">
        No approve, no dry-run, no broadcast
      </p>
    </Alert>
  );
}
