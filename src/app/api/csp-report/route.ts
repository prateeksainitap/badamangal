import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receiver for Content-Security-Policy-Report-Only violation reports.
 *
 * The browser sends a JSON POST to this endpoint every time the
 * candidate CSP would have blocked a resource. We log a compact
 * one-line summary so the team can sweep the server logs after a few
 * days of real traffic and tune the policy before flipping it from
 * "Report-Only" to "Enforcing".
 *
 * Two report formats are handled:
 *   • Legacy `report-uri`: { "csp-report": { ... } }
 *   • Modern `report-to` (Reporting API): { type: "csp-violation", body: { ... } }
 *
 * The endpoint always returns 204; nothing the browser does with the
 * response matters and we don't want to leak our own errors back via
 * the logger.
 */

type LegacyReport = {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "original-policy"?: string;
  };
};

type ModernReport = {
  type?: string;
  body?: {
    documentURL?: string;
    effectiveDirective?: string;
    blockedURL?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    originalPolicy?: string;
  };
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // Both formats normalised to a small flat shape.
  const reports: Array<{
    document: string;
    directive: string;
    blocked: string;
    source: string;
  }> = [];

  // Modern Reporting API delivers an array.
  const arr = Array.isArray(body) ? body : [body];
  for (const r of arr) {
    const legacy = r as LegacyReport;
    const modern = r as ModernReport;
    if (legacy["csp-report"]) {
      const x = legacy["csp-report"];
      reports.push({
        document: x["document-uri"] ?? "",
        directive: x["effective-directive"] ?? x["violated-directive"] ?? "",
        blocked: x["blocked-uri"] ?? "",
        source: [x["source-file"], x["line-number"], x["column-number"]]
          .filter(Boolean)
          .join(":"),
      });
    } else if (modern.type === "csp-violation" && modern.body) {
      const x = modern.body;
      reports.push({
        document: x.documentURL ?? "",
        directive: x.effectiveDirective ?? "",
        blocked: x.blockedURL ?? "",
        source: [x.sourceFile, x.lineNumber, x.columnNumber]
          .filter(Boolean)
          .join(":"),
      });
    }
  }

  for (const r of reports) {
    // Single-line, grep-friendly. Rotate by date in your log
    // aggregator (Netlify functions logs / Vercel runtime logs).
    // eslint-disable-next-line no-console
    console.warn(
      `[CSP-RO] ${r.directive} blocked=${r.blocked} on=${r.document} src=${r.source}`,
    );
  }

  return new NextResponse(null, { status: 204 });
}
