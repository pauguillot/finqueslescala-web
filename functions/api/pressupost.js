/**
 * Cloudflare Pages Function — recull el formulari de pressupost
 * i envia un email a l'administrador via Resend.
 *
 * Endpoint: POST /api/pressupost
 *
 * Variables d'entorn que cal configurar al panell de Cloudflare Pages:
 *   RESEND_API_KEY     → API key obtinguda a https://resend.com (comença per "re_")
 *   DESTINATARI_EMAIL  → email que rebrà les sol·licituds (ex: pauguillot@pauguillot.com)
 *   ORIGEN_EMAIL       → email "from". Per defecte "onboarding@resend.dev" (Resend de prova,
 *                        funciona només per enviar a l'email amb què t'has registrat a Resend).
 *                        Quan tinguis el domini finqueslescala.com verificat a Resend
 *                        (DNS DKIM + SPF), pots posar "web@finqueslescala.com".
 *   ORIGEN_NOM         → nom mostrat al "From" (ex: "Web finqueslescala.com")
 */

export async function onRequestPost({ request, env }) {
  let dades;

  try {
    const formData = await request.formData();
    dades = Object.fromEntries(formData.entries());
  } catch (err) {
    return new Response("Petició invàlida.", { status: 400 });
  }

  const { nom, email, telefon, servei, missatge, consentiment } = dades;

  if (!nom || !email || !servei || !missatge || consentiment !== "1") {
    return new Response("Falten camps obligatoris o consentiment.", { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response("Correu electrònic invàlid.", { status: 400 });
  }

  if (nom.length > 200 || email.length > 200 || (telefon || "").length > 50 ||
      missatge.length > 5000) {
    return new Response("Camps massa llargs.", { status: 400 });
  }

  if (!env.RESEND_API_KEY || !env.DESTINATARI_EMAIL) {
    console.error("Falten variables d'entorn (RESEND_API_KEY, DESTINATARI_EMAIL).");
    return new Response("Servei no configurat. Truca'm directament al 607 588 879.", {
      status: 500,
    });
  }

  const ip = request.headers.get("CF-Connecting-IP") || "?";
  const ua = request.headers.get("User-Agent") || "?";
  const data = new Date().toISOString();

  const text = [
    `Nova sol·licitud de pressupost`,
    `─────────────────────────────`,
    `Nom:       ${nom}`,
    `Email:     ${email}`,
    `Telèfon:   ${telefon || "(no facilitat)"}`,
    `Servei:    ${servei}`,
    ``,
    `Missatge:`,
    missatge,
    ``,
    `─────────────────────────────`,
    `Data: ${data}`,
    `IP:   ${ip}`,
    `UA:   ${ua}`,
  ].join("\n");

  const fromEmail = env.ORIGEN_EMAIL || "onboarding@resend.dev";
  const fromName = env.ORIGEN_NOM || "Web finqueslescala.com";

  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: [env.DESTINATARI_EMAIL],
    reply_to: `${nom} <${email}>`,
    subject: `[finqueslescala.com] Pressupost · ${servei} · ${nom}`,
    text: text,
  };

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resposta.ok) {
    const detall = await resposta.text();
    console.error("Resend error:", resposta.status, detall);
    return new Response("No s'ha pogut enviar el missatge. Truca'm directament al 607 588 879.", {
      status: 502,
    });
  }

  return Response.redirect(new URL("/gracies.html", request.url).toString(), 303);
}
