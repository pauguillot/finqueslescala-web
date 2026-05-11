/**
 * Cloudflare Pages Function — recull el formulari de pressupost
 * i envia un email a l'administrador via Resend.
 *
 * Endpoint: POST /api/pressupost
 *
 * Variables d'entorn que cal configurar al panell de Cloudflare Pages:
 *   RESEND_API_KEY      → API key de https://resend.com (comença per "re_")
 *   DESTINATARI_EMAIL   → email que rebrà les sol·licituds
 *   ORIGEN_EMAIL        → "from" (per defecte "onboarding@resend.dev";
 *                         quan el domini estigui verificat a Resend,
 *                         pot ser "web@finqueslescala.com")
 *   ORIGEN_NOM          → nom mostrat al "From"
 *   TURNSTILE_SECRET    → secret key de Cloudflare Turnstile (opcional;
 *                         si no està definida, la verificació es salta)
 *
 * Tres capes anti-spam:
 *   1. Honeypot: camp "website" invisible — si està omplert, és un bot
 *   2. Validació de contingut: rebutja missatges amb ciríl·lic o moltes URLs
 *   3. Cloudflare Turnstile: token verificat amb l'API de Cloudflare
 */

const ERROR_GENERIC = "No s'ha pogut enviar el missatge. Truca'm directament al 607 588 879.";

function teCirilic(text) {
  return /[Ѐ-ӿ]/.test(text);
}

function comptaURLs(text) {
  const matches = text.match(/https?:\/\/|www\./gi);
  return matches ? matches.length : 0;
}

async function verificaTurnstile(token, secret, ip) {
  if (!secret) return true; // Si no hi ha secret configurat, no validar
  if (!token) return false;
  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = await resp.json();
    return data.success === true;
  } catch (e) {
    console.error("Turnstile verify error:", e);
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  let dades;

  try {
    const formData = await request.formData();
    dades = Object.fromEntries(formData.entries());
  } catch (err) {
    return new Response("Petició invàlida.", { status: 400 });
  }

  const { nom, email, telefon, servei, missatge, consentiment, website } = dades;
  const turnstileToken = dades["cf-turnstile-response"];
  const ip = request.headers.get("CF-Connecting-IP") || "?";

  // Capa 1: honeypot. Si està omplert, és un bot. Retornem 200 silenciós
  // perquè el bot no aprengui que l'hem detectat.
  if (website && website.trim() !== "") {
    console.log("Honeypot triggered:", { ip, website });
    return Response.redirect(new URL("/gracies.html", request.url).toString(), 303);
  }

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

  // Capa 2: validació de contingut
  const textComplet = `${nom} ${missatge}`;
  if (teCirilic(textComplet)) {
    console.log("Cyrillic content blocked:", { ip, email });
    return Response.redirect(new URL("/gracies.html", request.url).toString(), 303);
  }
  if (comptaURLs(missatge) > 2) {
    console.log("Too many URLs blocked:", { ip, email });
    return Response.redirect(new URL("/gracies.html", request.url).toString(), 303);
  }

  // Capa 3: Turnstile
  const turnstileOk = await verificaTurnstile(turnstileToken, env.TURNSTILE_SECRET, ip);
  if (!turnstileOk) {
    console.log("Turnstile failed:", { ip, email });
    return new Response("Verificació de seguretat fallida. Torna-ho a provar.", { status: 403 });
  }

  if (!env.RESEND_API_KEY || !env.DESTINATARI_EMAIL) {
    console.error("Falten variables d'entorn (RESEND_API_KEY, DESTINATARI_EMAIL).");
    return new Response(ERROR_GENERIC, { status: 500 });
  }

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
    return new Response(ERROR_GENERIC, { status: 502 });
  }

  return Response.redirect(new URL("/gracies.html", request.url).toString(), 303);
}
