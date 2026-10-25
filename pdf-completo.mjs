// Genera el PDF sin tachar de un post: rellena los <span class="oculto"> en orden con cifras de un JSON privado.
// Uso: node pdf-completo.mjs <post.md> <cifras.json> <salida.pdf>
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { marked } from "marked";

const [mdPath, jsonPath, outPdf] = process.argv.slice(2);
const d = JSON.parse(readFileSync(jsonPath, "utf8"));
const num = (v) => Number(String(v).replace(/[^\d.]/g, ""));
const mxn = (n) => "$" + Math.round(n).toLocaleString("es-MX") + " MXN";
// derivados, si no vienen escritos
d.total_mes_auto ??= d.costo_modelo && d.costo_whatsapp && d.costo_ghosty ? mxn(num(d.costo_modelo) + num(d.costo_whatsapp) + num(d.costo_ghosty)) : null;
d.modelo_por_conversacion_auto ??= d.costo_modelo && d.conversaciones ? "$" + (num(d.costo_modelo) / num(d.conversaciones)).toFixed(2) + " MXN" : null;
d.horas_cotizar_antes_auto ??= d.minutos_cotizacion_manual && d.cotizaciones ? Math.round(num(d.minutos_cotizacion_manual) * num(d.cotizaciones) / 60).toLocaleString("es-MX") : null;
d.costo_por_cotizacion_auto ??= d.total_mes_auto && d.cotizaciones ? "$" + (num(d.total_mes_auto) / num(d.cotizaciones)).toFixed(2) + " MXN" : null;

// orden de los tachados en el post (la leyenda ya se quitó del markdown)
const ORDEN = ["cotizaciones", "costo_modelo", "total_mes_auto", "costo_modelo", "costo_whatsapp", "costo_ghosty", "horas_persona", "total_mes_auto",
  "conversaciones", "cotizaciones", "costo_modelo", "modelo_por_conversacion_auto", "plantillas", "tarifa_plantilla", "costo_whatsapp",
  "veces_persona", "horas_persona", "minutos_cotizacion_manual", "cotizaciones", "horas_cotizar_antes_auto", "costo_por_cotizacion_auto",
  "costo_cotizacion_manual", "cotizaciones_fuera_horario"];

const raw = readFileSync(mdPath, "utf8");
const [, title] = raw.match(/^---\ntitle: (.*)\n/);
let md = raw.replace(/^---[\s\S]*?---\n/, "").replace(/^\*Las cifras tachadas[^\n]*\n/m, "");
const faltan = new Set();
let i = 0;
md = md.replace(/<span class="oculto"[^>]*>█+<\/span>/g, () => {
  const k = ORDEN[i++];
  if (d[k] == null) faltan.add(k);
  return `<b>${d[k]}</b>`;
});
if (i !== ORDEN.length) { console.error(`El post tiene ${i} tachados y ORDEN ${ORDEN.length}: revisa el orden`); process.exit(1); }
if (faltan.size) { console.error("Faltan cifras en el JSON:", [...faltan].join(", ")); process.exit(1); }

const html = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>@page{size:Letter;margin:18mm 16mm}body{font-family:Inter,sans-serif;color:#14191d;line-height:1.6;font-size:11pt}
h1,h2{font-family:"Bricolage Grotesque",sans-serif;line-height:1.1}h1{font-size:24pt;margin:0 0 6px}h2{font-size:15pt;margin:22px 0 6px;color:#1f9e86}
.meta{color:#5d6b71;margin-bottom:18px}.conf{border:2px dashed #4c8a2c;border-radius:10px;padding:8px 12px;color:#4c8a2c;font-size:9.5pt;margin-bottom:18px}
table{border-collapse:collapse;width:100%;font-size:10pt;margin:8px 0}td,th{border:1px solid #e2ded4;padding:6px 8px;text-align:left}th{background:#f6f4ee}
td:not(:first-child) strong{color:#1f9e86}a{color:#1f9e86}</style></head><body>
<h1>${title}</h1><div class="meta">Héctor (@blissito) Campos M. · versión completa con cifras de septiembre de 2026</div>
<div class="conf">Documento confidencial: cifras reales de la distribuidora, compartidas sólo después de una llamada. No se reenvía.</div>
${marked.parse(md)}</body></html>`;
const tmp = outPdf.replace(/\.pdf$/, ".html");
writeFileSync(tmp, html);
execFileSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--no-pdf-header-footer", `--print-to-pdf=${outPdf}`, "file://" + tmp], { stdio: "ignore" });
console.log("PDF:", outPdf);
