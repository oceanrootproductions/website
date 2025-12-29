import { Link } from "react-router-dom";

type LegalDocumentPageProps = {
  heading: string;
  doc: string;
  badge?: string;
  description?: string;
  relatedLink?: {
    to: string;
    label: string;
  };
};

type ParsedDocument = {
  titleLine: string;
  updatedLine: string;
  sections: string[];
};

function parseDocument(raw: string): ParsedDocument {
  const lines = raw.trim().split(/\r?\n/);
  const titleLine = lines[0] ?? "";
  const updatedLine =
    lines[1] && lines[1].toLowerCase().startsWith("last updated")
      ? lines[1]
      : "";
  const contentStartIndex = updatedLine ? 2 : 1;
  const content = lines.slice(contentStartIndex).join("\n");
  const sections = content
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  return { titleLine, updatedLine, sections };
}

export default function LegalDocumentPage({
  heading,
  doc,
  badge = "Twisted Dark",
  description,
  relatedLink,
}: LegalDocumentPageProps) {
  const parsed = parseDocument(doc);

  return (
    <div className="relative overflow-hidden min-h-screen">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-deep-ocean/25 via-ink to-ink" />
        <div className="absolute -left-16 -top-32 h-64 w-64 rounded-full bg-coral-accent/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-deep-ocean/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-seafoam/80">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-coral-accent"
            />
            <span>{badge}</span>
          </div>
          <h1 className="mt-3 font-heading text-3xl sm:text-4xl text-seafoam">
            {heading}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-white/70">{description}</p>
          ) : null}
          {relatedLink ? (
            <Link
              to={relatedLink.to}
              className="mt-3 inline-flex items-center gap-2 text-sky-200 hover:text-sky-100 transition-colors"
            >
              <span className="text-base">{">"}</span>
              <span className="text-sm sm:text-base">{relatedLink.label}</span>
            </Link>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 shadow-soft backdrop-blur-sm">
          <div className="border-b border-white/5 px-6 py-5 sm:px-8 sm:py-6">
            <p className="text-sm font-semibold text-seafoam">
              {parsed.titleLine}
            </p>
            {parsed.updatedLine ? (
              <p className="mt-1 text-xs text-white/60">{parsed.updatedLine}</p>
            ) : null}
          </div>

          <div className="space-y-5 px-6 py-6 leading-relaxed text-white/80 sm:px-8 sm:py-8">
            {parsed.sections.map((section, index) => (
              <p
                key={index}
                className="whitespace-pre-line text-sm sm:text-base"
              >
                {section}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
