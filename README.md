# finqueslescala.com — web pública

Lloc estàtic + Cloudflare Pages Function per al formulari de pressupost.

## Estructura

```
web/
  index.html          Portada
  avis-legal.html     Avís legal LSSI
  privacitat.html     Política de privacitat RGPD
  gracies.html        Confirmació post-formulari
  styles.css          Tokens de marca (DM Sans, navy/lime)
  assets/             Logos i favicon
  functions/api/
    pressupost.js     Pages Function (rep el formulari, envia email)
```

## Desplegament a Cloudflare Pages

### 1 · Crear el projecte

1. Entrar a <https://dash.cloudflare.com/> → Workers & Pages → Create.
2. **Pages → Direct Upload**: pujar tot el contingut de `web/` (no la carpeta web sencera, sinó el seu interior).
3. Nom del projecte: `finqueslescala`.

### 2 · Configurar variables d'entorn

A "Settings → Environment variables" del projecte:

| Variable | Valor |
|----------|-------|
| `RESEND_API_KEY`    | API key obtinguda a <https://resend.com> (comença per `re_`) |
| `DESTINATARI_EMAIL` | `pauguillot@pauguillot.com` |
| `ORIGEN_EMAIL`      | `onboarding@resend.dev` (per defecte) o `web@finqueslescala.com` quan el domini estigui verificat (DNS DKIM/SPF) |
| `ORIGEN_NOM`        | `Web finqueslescala.com` |

### 3 · Connectar el domini finqueslescala.com

A "Custom domains" del projecte → Add custom domain → `finqueslescala.com` i `www.finqueslescala.com`.

Cloudflare proporcionarà registres DNS (CNAME) que cal afegir al panell del registrador del domini (Nominalia o on sigui). Si transferim el DNS del domini a Cloudflare és més senzill — passa a fer-ho automàticament.

### 4 · Verificar email amb MailChannels

Perquè `ORIGEN_EMAIL` (web@finqueslescala.com) pugui enviar correus via MailChannels, afegir aquests registres TXT al DNS:

```
TXT @           v=spf1 include:relay.mailchannels.net ~all
TXT _mailchannels  v=mc1 cfid=<el_teu_subdomini_pages>.pages.dev
```

(Cloudflare Pages assigna un subdomini `*.pages.dev` quan crees el projecte. El veuràs al panell.)

Documentació MailChannels: <https://support.mailchannels.com/hc/en-us/articles/16918954360845>

### 5 · Provar

Un cop desplegat:
- Obrir `https://finqueslescala.com/`
- Provar el formulari amb dades reals
- Comprovar que arriba l'email a `pauguillot@pauguillot.com`
- Comprovar que apareix la pàgina `gracies.html` després d'enviar

## Manteniment

- **Editar contingut**: modificar els `.html` i `.css` directament. Cada push al projecte de Cloudflare redesplega.
- **Pujada manual**: si no es connecta amb Git, repetir Direct Upload des del panell.
- **Logs de la function**: panell Cloudflare → Pages → Functions → Real-time logs.

## Lleugeresa

Pàgina sense JS, sense trackers, sense cookies. Pes total ~16 KB d'HTML/CSS + ~80 KB de Google Fonts (DM Sans + Mono). Optimitzacions futures opcionals: self-hostar les fonts.
