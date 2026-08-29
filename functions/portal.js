import { redirect, resolvePortalUrl } from "./_shared/turbotenant.js";

// /portal -> TurboTenant resident portal, where current residents pay rent and
// submit maintenance requests.
export function onRequestGet(context) {
  return redirect(resolvePortalUrl(context.env));
}

export const onRequestHead = onRequestGet;
