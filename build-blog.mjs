// Genera posts/<slug>/index.html y posts/index.html desde Mongo, con el layout de index.html.
// Uso: DATABASE_URL=... node build-blog.mjs
import { MongoClient } from "mongodb";
import { marked } from "marked";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

const POSTS = [
  { slug: "Arquitecturas_de_IA_con_Agentes_Patrones_y_Documentacion_Ofi", strip: /\*{0,2}Nota del autor\*{0,2}[^\n]*\n+/i },
  { slug: "AutoGen_vs_LangChain_Guia_Comparativa_para_Desarrolladores" },
  { slug: "Frameworks_de_IA_para_TypeScript_Mas_Alla_de_Python" },
  { slug: "adios-a-los-frameworks-web" },
  { slug: "El_Fascinante_Ecosistema_de_LimeSurvey_y_Sistemas_Open_Sourc",
    intro: "Si tu negocio depende de encuestas, analytics o automatizaciones, la pregunta no es qué herramienta está de moda sino cuál no te amarra: que puedas instalarla tú, sacar tus datos por API y cambiarla sin volver a empezar. Este recorrido es por las que cumplen eso." },
  { slug: "TikTok_Libera_Tus_Datos_Pero_Solo_Si_Vives_en_Europa",
    intro: "Lo que le pasa a un usuario de TikTok le pasa a cualquier negocio con su CRM, su tienda en línea o su sistema de facturación: los datos son tuyos sólo si puedes sacarlos. Antes de contratar cualquier herramienta, pregunta cómo te los devuelve." },
];

const index = readFileSync("index.html", "utf8");
const head = index.slice(index.indexOf("<style>"), index.indexOf("</style>") + 8);
const nav = index.slice(index.indexOf("<nav>"), index.indexOf("</nav>") + 6).replace(/href="#/g, 'href="/#');
const footer = index.slice(index.indexOf("<footer>"), index.indexOf("</footer>") + 9);
const themeBoot = index.match(/<script>try\{var t=localStorage[^<]*<\/script>/)[0];
const toggleJs = index.slice(index.lastIndexOf("<script>"), index.lastIndexOf("</script>") + 9);

const extraCss = `<style>
.post{max-width:760px;margin:0 auto;padding:56px 20px}
.post h1{font-size:clamp(2rem,4.5vw,3rem);margin-bottom:14px}
.post .meta{color:var(--muted);margin-bottom:36px}
.post h2{font-size:1.6rem;margin:44px 0 12px}
.post h3{font-size:1.25rem;margin:32px 0 10px}
.post p,.post li{font-size:1.06rem}
.post a{color:var(--acc)}
.post img{max-width:100%;height:auto;border-radius:14px;border:1px solid var(--line)}
.post pre{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:16px;overflow:auto;font-size:.9rem}
.post code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.post blockquote{border-left:4px solid var(--acc);margin:0;padding:4px 18px;color:var(--muted)}
.post table{border-collapse:collapse;width:100%;font-size:.95rem}.post td,.post th{border:1px solid var(--line);padding:8px 10px;text-align:left}
.post .yt{aspect-ratio:16/9;width:100%;border:0;border-radius:14px;margin:24px 0}
.list{max-width:760px;margin:0 auto;padding:56px 20px}
.list article{border-top:1px solid var(--line);padding:26px 0}
.list h2{font-size:1.4rem;margin-bottom:6px}.list h2 a{text-decoration:none}.list h2 a:hover{color:var(--acc)}
.list .meta{color:var(--muted);font-size:.9rem}.list p{color:var(--muted);margin:8px 0 0}
</style>`;

const page = (title, desc, body, canonical, extraHead = "") => `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
${themeBoot}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Héctor (blissmo) Campos</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article"><meta property="og:site_name" content="hectorbliss.com"><meta property="og:locale" content="es_MX"><meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="https://hectorbliss.com/img/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="https://hectorbliss.com/img/og.png">
${extraHead}
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
${head}
${extraCss}
</head>
<body>
${nav}
${body}
${footer}
${toggleJs}
</body>
</html>
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const fecha = (d) => new Date(d).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });

async function bajarImagen(url, slug, n) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/")) return null;
    const ext = extname(new URL(url).pathname) || "." + (r.headers.get("content-type").split("/")[1] || "jpg").replace("jpeg", "jpg");
    const file = `blog-img/${slug}-${n}${ext.split("?")[0]}`;
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    return "/" + file;
  } catch { return null; }
}

const c = new MongoClient(process.env.DATABASE_URL);
await c.connect();
const col = c.db().collection("posts");
mkdirSync("blog-img", { recursive: true });
const lista = [];
for (const cfg of POSTS) {
  const p = await col.findOne({ slug: cfg.slug });
  if (!p) { console.error("no existe", cfg.slug); continue; }
  let md = p.body || "";
  md = md.replace(/^\s*#\s+[^\n]+\n/, ""); // el título va aparte
  if (cfg.strip) md = md.replace(cfg.strip, "");
  if (cfg.intro) md = cfg.intro + "\n\n" + md;
  // imágenes: descargar o quitar
  let n = 0; const imgs = [...md.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)];
  for (const m of imgs) {
    const local = await bajarImagen(m[2], cfg.slug, ++n);
    md = md.replace(m[0], local ? `![${m[1]}](${local})` : "");
  }
  let html = marked.parse(md);
  if (p.youtubeLink) {
    const id = (p.youtubeLink.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1];
    if (id) html = `<iframe class="yt" src="https://www.youtube-nocookie.com/embed/${id}" title="Video" allowfullscreen loading="lazy"></iframe>` + html;
  }
  const desc = md.replace(/[#*>`\[\]()!_-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
  const body = `<main class="post"><a href="/posts/" style="color:var(--muted);text-decoration:none">← Blog</a><h1>${esc(p.title)}</h1><div class="meta">${fecha(p.createdAt)} · Héctor (blissmo) Campos</div>${html}</main>`;
  mkdirSync(`posts/${cfg.slug}`, { recursive: true });
  const ld = { "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: desc, datePublished: new Date(p.createdAt).toISOString(), dateModified: new Date(p.updatedAt || p.createdAt).toISOString(), inLanguage: "es-MX", image: "https://hectorbliss.com/img/og.png", mainEntityOfPage: `https://hectorbliss.com/posts/${cfg.slug}/`, author: { "@type": "Person", "@id": "https://hectorbliss.com/#person", name: "Héctor (blissmo) Campos", url: "https://hectorbliss.com/" } };
  writeFileSync(`posts/${cfg.slug}/index.html`, page(p.title, desc, body, `https://hectorbliss.com/posts/${cfg.slug}/`, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`));
  lista.push({ slug: cfg.slug, title: p.title, createdAt: p.createdAt, desc, imgs: n });
  console.log("ok", cfg.slug, `${n} img`);
}
await c.close();
lista.sort((a, b) => b.createdAt - a.createdAt);
const items = lista.map((x) => `<article><h2><a href="/posts/${x.slug}/">${esc(x.title)}</a></h2><div class="meta">${fecha(x.createdAt)}</div><p>${esc(x.desc)}…</p></article>`).join("\n");
writeFileSync("posts/index.html", page("Blog", "Notas sobre IA aplicada a negocios, agentes y herramientas que no te amarran.", `<main class="list"><span class="eyebrow">Blog</span><h1 style="font-size:2.4rem;margin-bottom:8px">Lo que he aprendido construyendo con IA</h1><p class="lead">Seis piezas que siguen valiendo. Lo demás está en <a href="https://blog.hectorbliss.com" style="color:var(--acc)">blog.hectorbliss.com</a>.</p>${items}</main>`, "https://hectorbliss.com/posts/"));
// Home: "Lo último que he escrito" entre marcadores
const ultimos = lista.slice(0, 3).map((x) => `    <div class="card"><time datetime="${new Date(x.createdAt).toISOString().slice(0,10)}">${fecha(x.createdAt)}</time><h3><a href="/posts/${x.slug}/">${esc(x.title)}</a></h3><p>${esc(x.desc.slice(0, 120))}…</p></div>`).join("\n");
const home = readFileSync("index.html", "utf8").replace(/<!-- ultimo:start -->[\s\S]*?<!-- ultimo:end -->/, `<!-- ultimo:start -->\n${ultimos}\n<!-- ultimo:end -->`);
writeFileSync("index.html", home);
console.log("index con", lista.length, "posts; home con", Math.min(3, lista.length), "últimos");
