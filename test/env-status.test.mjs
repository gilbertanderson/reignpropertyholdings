import { envStatus } from "../functions/_shared/env-status.js";

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

const empty = envStatus({});
t("empty env is not ok", empty.ok, false);
t("sendgrid required", empty.missingRequired, ["SENDGRID_API_KEY"]);
t("analytics unset", empty.analytics, false);

const partial = envStatus({
  SENDGRID_API_KEY: "sg.test",
  STAYS_ICAL_1332_AIRBNB: "https://www.airbnb.com/calendar/ical/123.ics",
});
t("partial env ok when required set", partial.ok, true);
t("partial stays 1332 incomplete", partial.stays["1332-tricou-st"], false);
t("partial stays 1334 incomplete", partial.stays["1334-tricou-st"], false);

const stays = envStatus({
  SENDGRID_API_KEY: "sg.test",
  STAYS_ICAL_1332_VRBO: "https://www.vrbo.com/icalendar/1.ics",
  STAYS_ICAL_1332_AIRBNB: "https://www.airbnb.com/calendar/ical/1.ics",
  STAYS_ICAL_1334_VRBO: "https://www.vrbo.com/icalendar/2.ics",
  STAYS_ICAL_1334_AIRBNB: "https://www.airbnb.com/calendar/ical/2.ics",
});
t("both stay slugs complete", stays.stays["1332-tricou-st"], true);
t("both stay slugs complete 1334", stays.stays["1334-tricou-st"], true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
