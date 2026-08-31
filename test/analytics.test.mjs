import { injectAnalytics } from "../functions/_shared/analytics.js";

let pass = 0;
let fail = 0;

const t = (name, actual, expected) => {
  if (actual === expected) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
    console.log(`       got  ${JSON.stringify(actual)}`);
    console.log(`       want ${JSON.stringify(expected)}`);
  }
};

const sampleHtml =
  "<head>" +
  '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "REPLACE_WITH_CLOUDFLARE_ANALYTICS_TOKEN"}\'></script>' +
  "</head>";

t(
  "injects token",
  injectAnalytics(sampleHtml, "abc123"),
  sampleHtml.replaceAll("REPLACE_WITH_CLOUDFLARE_ANALYTICS_TOKEN", "abc123")
);

t(
  "strips beacon when token missing",
  injectAnalytics(sampleHtml, ""),
  "<head></head>"
);

t("no-op without placeholder", injectAnalytics("<html></html>", "abc123"), "<html></html>");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
