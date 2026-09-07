import {
  isListingAvailable,
  listingAvailability,
  parseAvailableFlag,
  resolveApplyUrl,
} from "../functions/_shared/turbotenant.js";

let pass = 0;
let fail = 0;

const t = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
    console.log(`       got  ${JSON.stringify(actual)}`);
    console.log(`       want ${JSON.stringify(expected)}`);
  }
};

t("parse true variants", parseAvailableFlag("true"), true);
t("parse 1", parseAvailableFlag("1"), true);
t("parse false", parseAvailableFlag("false"), false);
t("parse empty is null", parseAvailableFlag("  "), null);
t("parse junk is null", parseAvailableFlag("maybe"), null);

t("508 default leased", isListingAvailable({}, "508-avenue-e"), false);
t(
  "508 env override open",
  isListingAvailable({ TURBOTENANT_AVAILABLE_508_AVENUE_E: "true" }, "508-avenue-e"),
  true
);
t(
  "508 env override leased",
  isListingAvailable({ TURBOTENANT_AVAILABLE_508_AVENUE_E: "0" }, "508-avenue-e"),
  false
);

t("1332 stays closed", isListingAvailable({}, "1332-tricou-st"), false);
t("1334 stays open", isListingAvailable({}, "1334-tricou-st"), true);

const listings = listingAvailability({});
t("listings payload 508 leased", listings["508-avenue-e"], { available: false });
t("listings payload 1334 open", listings["1334-tricou-st"], { available: true });

const applyLeased = resolveApplyUrl({}, "508-avenue-e");
t("apply while leased falls back (null)", applyLeased, null);

const applyOpen = resolveApplyUrl(
  { TURBOTENANT_AVAILABLE_508_AVENUE_E: "true" },
  "508-avenue-e"
);
t(
  "apply while open uses listing URL",
  typeof applyOpen === "string" && applyOpen.includes("turbotenant.com"),
  true
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
