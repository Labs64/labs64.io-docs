// CloudFront Function — viewer request — attached to the labs64.io
// distribution's `/docs` and `/docs/*` cache behaviors.
//
// Why this exists: this repo is served by GitHub Pages, nested at its own
// repo-name path (io.labs64.com/labs64.io-docs/*) — GitHub doesn't let a
// project repo pick a custom nested path. The distribution's `/docs*`
// origin has Origin Path "/labs64.io-docs", and CloudFront always prepends
// Origin Path to the *original* viewer request URI (it does not strip the
// matched cache-behavior path pattern first). Without this rewrite,
// "labs64.io/docs/foo" would forward as
// "io.labs64.com/labs64.io-docs/docs/foo" — a mismatched double segment.
//
// Two things this does:
//
// 1. Strips the leading "/docs" so the forwarded request lands on the real
//    GitHub Pages path once Origin Path is applied:
//      /docs/foo.html  -> /foo.html -> (+ Origin Path) -> /labs64.io-docs/foo.html
//      /docs/          -> /         -> (+ Origin Path) -> /labs64.io-docs/
//
// 2. Redirects a directory-style path missing its trailing slash
//    (e.g. /docs/auditflow) to add one, *before* ever forwarding to origin.
//    Without this, GitHub Pages itself 301s that request to add the slash —
//    but it builds that redirect against its own real hostname
//    (io.labs64.com/labs64.io-docs/auditflow/), which CloudFront then hands
//    straight to the browser, leaking the internal origin URL. Module pages
//    here are all directory permalinks (`permalink: /<module>/`), so this
//    checks "does the last path segment look like a file (has a dot)" to
//    decide whether a redirect is warranted — real files (…/foo.html,
//    …/style.css) are left alone.
//
// Not deployed automatically — this file documents/version-controls the
// function body; publish it to the CloudFront Function by hand (or a
// future Terraform aws_cloudfront_function resource) and attach it to the
// viewer-request event of TWO cache behaviors: path pattern "/docs" and
// path pattern "/docs/*". Two behaviors, not one "/docs*" — CloudFront
// path patterns are plain glob prefixes with no path-segment boundary, so
// a single "/docs*" pattern would also match an unrelated "/docset-foo".
// See AGENTS.md "Production deployment" for the full path and the rest of
// the CloudFront config.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/docs") {
    return redirect("/docs/");
  }

  var afterDocs = uri === "/docs/" ? "" : uri.slice("/docs/".length);
  var lastSegment = afterDocs.split("/").pop();
  var looksLikeFile = lastSegment.indexOf(".") !== -1;

  if (!looksLikeFile && uri.slice(-1) !== "/") {
    return redirect(uri + "/");
  }

  request.uri = uri === "/docs/" ? "/" : uri.slice("/docs".length);

  return request;
}

function redirect(location) {
  return {
    statusCode: 301,
    statusDescription: "Moved Permanently",
    headers: { location: { value: location } },
  };
}
