// Genera posts/<slug>/index.html y posts/index.html desde Mongo, con el layout de index.html.
// Uso: DATABASE_URL=... node build-blog.mjs
import { MongoClient } from "mongodb";
import { marked } from "marked";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

const POSTS = [
  { slug: "tu-agente-trabaja-a-su-hora" },
  { slug: "dale-correo-propio-a-tu-agente" },
  { slug: "mcp-para-quien-no-programa" },
  { slug: "un-agente-que-agenda-tus-citas" },
  { slug: "cuanto-cuesta-un-pr-hecho-por-agentes" },
  { slug: "un-ano-construyendo-agentes-que-trabajan-solos" },
  // Borradores: se publican con noindex, fuera del índice, la home y el sitemap
  { slug: "cuanto-cuesta-un-agente-al-mes", draft: true },
  { slug: "sofi-vendedora-por-whatsapp", draft: true },
  { slug: "primer-proceso-a-automatizar", draft: true },
  { slug: "asistente-con-tu-catalogo", draft: true },
  { slug: "que-pasa-con-mis-datos", draft: true },
];

// Posts que salieron del blog: su URL queda como redirect a /posts/ (Pages no da 301)
const OLD = [
  "Arquitecturas_de_IA_con_Agentes_Patrones_y_Documentacion_Ofi",
  "AutoGen_vs_LangChain_Guia_Comparativa_para_Desarrolladores",
  "Frameworks_de_IA_para_TypeScript_Mas_Alla_de_Python",
  "adios-a-los-frameworks-web",
  "El_Fascinante_Ecosistema_de_LimeSurvey_y_Sistemas_Open_Sourc",
  "TikTok_Libera_Tus_Datos_Pero_Solo_Si_Vives_en_Europa",
];
const NAME = "Héctor (@blissito) Campos M.";
const PERSON = { "@type": "Person", "@id": "https://hectorbliss.com/#person", name: NAME, url: "https://hectorbliss.com/" };

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
.post img.cover{width:100%;aspect-ratio:1200/630;object-fit:cover;margin:0 0 28px}
.post figure,.post p:has(>img){margin:28px 0}
.post pre{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:16px;overflow:auto;font-size:.9rem}
.post code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.post blockquote{border-left:4px solid var(--acc);margin:0;padding:4px 18px;color:var(--muted)}
.post table{border-collapse:collapse;width:100%;font-size:.95rem}.post td,.post th{border:1px solid var(--line);padding:8px 10px;text-align:left}
.post .yt{aspect-ratio:16/9;width:100%;border:0;border-radius:14px;margin:24px 0}
.reader-btn{display:inline-flex;align-items:center;gap:8px;margin-left:12px;background:transparent;border:1px solid var(--line);color:var(--fg);border-radius:10px;padding:6px 12px;font:inherit;font-size:.9rem;cursor:pointer;vertical-align:middle}
.reader-btn svg{width:16px;height:16px}
.reader-btn .off{display:none}
/* modo lectura (como fixter2025): columna ancha (max-w-6xl) y texto mucho más grande */
html.reader nav,html.reader footer,html.reader .post>.back{display:none}
html.reader .post{max-width:1152px;padding-top:72px}
html.reader .post h1{font-size:clamp(2.6rem,1.5rem + 3.5vw,4.5rem)}
html.reader .post .meta{font-size:clamp(1rem,.8rem + .6vw,1.35rem)}
html.reader .post p,html.reader .post blockquote p{font-size:clamp(1.25rem,.9rem + 1.2vw,1.875rem);line-height:1.625}
html.reader .post li,html.reader .post blockquote{font-size:clamp(1.15rem,.9rem + .9vw,1.5rem);line-height:1.625}
html.reader .post h2{font-size:clamp(1.9rem,1.2rem + 2.2vw,3rem);margin:56px 0 16px}
html.reader .post h3{font-size:clamp(1.5rem,1rem + 1.6vw,2.25rem)}
html.reader .post table{font-size:clamp(1rem,.8rem + .7vw,1.35rem)}
html.reader .post pre{font-size:clamp(.95rem,.8rem + .5vw,1.25rem)}
html.reader .reader-btn{position:fixed;top:16px;right:16px;z-index:20;background:var(--bg2);margin:0}
html.reader .reader-btn .on{display:none}html.reader .reader-btn .off{display:inline}
.post td:not(:first-child) strong{color:var(--acc)}
.oculto{background:var(--fg);color:transparent;border-radius:4px;padding:0 .15em;user-select:none;cursor:help;-webkit-print-color-adjust:exact}
.list{max-width:760px;margin:0 auto;padding:56px 20px}
.list article{border-top:1px solid var(--line);padding:26px 0;display:grid;grid-template-columns:180px 1fr;gap:20px;align-items:start}
.list article.no-thumb{grid-template-columns:1fr}
.list .thumb{width:180px;aspect-ratio:1200/630;object-fit:cover;border-radius:10px;border:1px solid var(--line)}
@media (max-width:640px){.list article{grid-template-columns:1fr}.list .thumb{width:100%}}
.list h2{font-size:1.4rem;margin-bottom:6px}.list h2 a{text-decoration:none}.list h2 a:hover{color:var(--acc)}
.list .meta{color:var(--muted);font-size:.9rem}.list p{color:var(--muted);margin:8px 0 0}
</style>`;

const page = (title, desc, body, canonical, extraHead = "") => `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
${themeBoot}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${NAME}</title>
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
<script data-goatcounter="https://hectorbliss.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</body>
</html>
`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// Corta en el último espacio antes de n y agrega «…»
const recorta = (t, n) => (t.length <= n ? t : t.slice(0, t.lastIndexOf(" ", n)).replace(/[\s,.;:]+$/, "") + "…");
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
  md = md.replace(/<!--[\s\S]*?-->\s*/g, "");
  // imágenes: descargar o quitar
  let n = 0; const imgs = [...md.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)];
  for (const m of imgs) {
    if (m[2].startsWith("/")) { n++; continue; } // ya es local
    const local = await bajarImagen(m[2], cfg.slug, ++n);
    md = md.replace(m[0], local ? `![${m[1]}](${local})` : "");
  }
  let html = marked.parse(md);
  if (p.youtubeLink) {
    const id = (p.youtubeLink.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1];
    if (id) html = `<iframe class="yt" src="https://www.youtube-nocookie.com/embed/${id}" title="Video" allowfullscreen loading="lazy"></iframe>` + html;
  }
  const desc = p.excerpt || recorta(md.replace(/[#*>`\[\]()!_-]/g, " ").replace(/\s+/g, " ").trim(), 155);
  const cover = p.cover || null;
  const coverAbs = cover ? `https://hectorbliss.com${cover}` : "https://hectorbliss.com/img/og.png";
  const heroImg = cover ? `<img class="cover" src="${cover}" alt="" width="1200" height="630">` : "";
  const minutos = Math.max(1, Math.round(md.split(/\s+/).length / 220));
  const body = `<main class="post"><a class="back" href="/posts/" style="color:var(--muted);text-decoration:none">← Blog</a><h1>${esc(p.title)}</h1><div class="meta">${fecha(p.createdAt)} · ${NAME} · ${minutos} min de lectura<button class="reader-btn" id="readerToggle" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/></svg><span class="on">Modo lectura</span><span class="off">Salir de modo lectura</span></button></div>${cfg.draft ? `<p style="background:var(--bg2);border:2px dashed var(--acc2);border-radius:12px;padding:12px 16px;color:var(--muted)">Borrador: no está en el índice del blog ni en Google.</p>` : ""}${heroImg}${html}</main>`;
  mkdirSync(`posts/${cfg.slug}`, { recursive: true });
  const ld = { "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: desc, datePublished: new Date(p.createdAt).toISOString(), dateModified: new Date(p.updatedAt || p.createdAt).toISOString(), inLanguage: "es-MX", image: coverAbs, mainEntityOfPage: `https://hectorbliss.com/posts/${cfg.slug}/`, author: PERSON, publisher: PERSON };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: "https://hectorbliss.com/" },
    { "@type": "ListItem", position: 2, name: "Blog", item: "https://hectorbliss.com/posts/" },
    { "@type": "ListItem", position: 3, name: p.title, item: `https://hectorbliss.com/posts/${cfg.slug}/` } ] };
  let out = page(p.title, desc, body, `https://hectorbliss.com/posts/${cfg.slug}/`, `<script>try{if(localStorage.getItem("reader")==="1")document.documentElement.classList.add("reader")}catch(e){}</script><script type="application/ld+json">${JSON.stringify(ld)}</script><script type="application/ld+json">${JSON.stringify(crumbs)}</script>`).replace("</main>", `</main><script>\n// Modo lectura: se recuerda en localStorage; Esc lo apaga\n(function(){var r=document.documentElement,b=document.getElementById("readerToggle");function set(on){r.classList.toggle("reader",on);b.setAttribute("aria-pressed",on);try{localStorage.setItem("reader",on?"1":"0")}catch(e){}}b.setAttribute("aria-pressed",r.classList.contains("reader"));b.addEventListener("click",function(){set(!r.classList.contains("reader"))});document.addEventListener("keydown",function(e){if(e.key==="Escape"&&r.classList.contains("reader"))set(false)})})();\n</script>`).replace(/https:\/\/hectorbliss\.com\/img\/og\.png/g, coverAbs);
  if (cfg.draft) out = out.replace('<meta name="robots" content="index,follow">', '<meta name="robots" content="noindex,nofollow">');
  writeFileSync(`posts/${cfg.slug}/index.html`, out);
  if (cfg.draft) { console.log("borrador", cfg.slug); continue; }
  lista.push({ slug: cfg.slug, title: p.title, createdAt: p.createdAt, desc, imgs: n, cover, coverAbs });
  console.log("ok", cfg.slug, `${n} img`);
}
await c.close();
lista.sort((a, b) => b.createdAt - a.createdAt);
const items = lista.map((x) => `<article class="${x.cover ? "" : "no-thumb"}">${x.cover ? `<a href="/posts/${x.slug}/"><img class="thumb" src="${x.cover}" alt="" loading="lazy"></a>` : ""}<div><h2><a href="/posts/${x.slug}/">${esc(x.title)}</a></h2><div class="meta">${fecha(x.createdAt)}</div><p>${esc(x.desc)}</p></div></article>`).join("\n");
const blogLd = { "@context": "https://schema.org", "@type": "Blog", "@id": "https://hectorbliss.com/posts/#blog", name: "Blog de Héctor Campos", url: "https://hectorbliss.com/posts/", inLanguage: "es-MX", author: PERSON, publisher: PERSON,
  blogPost: lista.map((x) => ({ "@type": "BlogPosting", headline: x.title, url: `https://hectorbliss.com/posts/${x.slug}/`, datePublished: new Date(x.createdAt).toISOString(), image: x.coverAbs })) };
writeFileSync("posts/index.html", page("Blog", "Notas sobre agentes de IA para negocios: qué cuestan, dónde corren y cómo se conectan a tu correo, tu agenda y tu WhatsApp.", `<main class="list"><span class="eyebrow">Blog</span><h1 style="font-size:2.4rem;margin-bottom:8px">Lo que he aprendido construyendo agentes</h1><p class="lead">Notas sobre agentes de IA que ya trabajan en negocios de verdad. Lo demás está en <a href="https://blog.hectorbliss.com" style="color:var(--acc)">blog.hectorbliss.com</a>.</p>${items}</main>`, "https://hectorbliss.com/posts/", `<script type="application/ld+json">${JSON.stringify(blogLd)}</script>`).replace('content="article"', 'content="website"'));
for (const slug of OLD) {
  mkdirSync(`posts/${slug}`, { recursive: true });
  writeFileSync(`posts/${slug}/index.html`, `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>Blog · ${NAME}</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://hectorbliss.com/posts/"><meta http-equiv="refresh" content="0; url=/posts/"></head><body><p>Este texto ya no está aquí. <a href="/posts/">Ver el blog</a>.</p></body></html>\n`);
}
// Home: "Lo último que he escrito" entre marcadores
const ultimos = lista.slice(0, 3).map((x) => `    <div class="card">${x.cover ? `<a href="/posts/${x.slug}/"><img class="thumb" src="${x.cover}" alt="" loading="lazy"></a>` : ""}<time datetime="${new Date(x.createdAt).toISOString().slice(0,10)}">${fecha(x.createdAt)}</time><h3><a href="/posts/${x.slug}/">${esc(x.title)}</a></h3><p>${esc(recorta(x.desc, 120))}</p></div>`).join("\n");
const home = readFileSync("index.html", "utf8").replace(/<!-- ultimo:start -->[\s\S]*?<!-- ultimo:end -->/, `<!-- ultimo:start -->\n${ultimos}\n<!-- ultimo:end -->`);
writeFileSync("index.html", home);
console.log("index con", lista.length, "posts; home con", Math.min(3, lista.length), "últimos");
