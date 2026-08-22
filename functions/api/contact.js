const RECIPIENT_EMAIL = "info@reignpropertyholdings.com";
const RECIPIENT_NAME = "Reign Property Holdings";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch (err) {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
  }

  const name = (data.name || "").toString().trim();
  const email = (data.email || "").toString().trim();
  const phone = (data.phone || "").toString().trim();
  const property = (data.property || "General Inquiry").toString().trim();
  const message = (data.message || "").toString().trim();
  const honeypot = (data.company || "").toString().trim();

  // Bots fill hidden fields; pretend success without sending anything.
  if (honeypot) {
    return jsonResponse({ ok: true });
  }

  if (!name || !email || !message) {
    return jsonResponse({ ok: false, error: "Please fill in your name, email, and message." }, 400);
  }

  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ ok: false, error: "Please enter a valid email address." }, 400);
  }

  if (!env.SENDGRID_API_KEY) {
    return jsonResponse({ ok: false, error: "The contact form isn't set up yet. Please call or email us directly." }, 500);
  }

  const lines = [
    "New message from the reignpropertyholdings.com contact form",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    `Property of interest: ${property}`,
    "",
    "Message:",
    message,
  ].filter(Boolean);

  try {
    const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: RECIPIENT_EMAIL, name: RECIPIENT_NAME }] }],
        from: { email: RECIPIENT_EMAIL, name: "Reign Property Holdings Website" },
        reply_to: { email, name },
        subject: `Website inquiry: ${property}`,
        content: [{ type: "text/plain", value: lines.join("\n") }],
      }),
    });

    if (!sgResponse.ok) {
      console.error("SendGrid error", sgResponse.status, await sgResponse.text().catch(() => ""));
      return jsonResponse({ ok: false, error: "We couldn't send your message right now. Please call or email us directly." }, 502);
    }
  } catch (err) {
    console.error("SendGrid request failed", err);
    return jsonResponse({ ok: false, error: "We couldn't send your message right now. Please call or email us directly." }, 502);
  }

  return jsonResponse({ ok: true });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
