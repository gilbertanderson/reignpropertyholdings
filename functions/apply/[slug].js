import { handleApply } from "../_shared/turbotenant.js";

// /apply/<slug>  -> that listing's TurboTenant application
// /apply/start   -> account-wide TurboTenant application
//
// The bare /apply path is left to the static apply.html page, which explains
// the process before sending anyone off-site.
//
// Keeping the TurboTenant URLs behind this route means every "Apply" button on
// the site is a stable internal link: listings can be re-pointed by changing an
// environment variable instead of editing markup.
export function onRequestGet(context) {
  return handleApply(context.env, context.params.slug);
}

// Link checkers and some crawlers probe with HEAD; without this they get a 405
// on every Apply link. Same redirect, and the platform drops the (empty) body.
export const onRequestHead = onRequestGet;
