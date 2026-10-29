// generates metrics/activity-graph.svg from the last 31 days of contributions
import { writeFileSync, mkdirSync } from "node:fs";

const LOGIN = process.env.GRAPH_USER || "Rocha4k";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = process.env.GRAPH_OUT || "metrics/activity-graph.svg";
const DAYS = 31;

const C = { bg: "#0d1117", line: "#ffffff", point: "#ffffff", area: "#333333", title: "#ffffff", text: "#8b949e", grid: "#21262d" };
const W = 1000, H = 320, PAD = { top: 60, right: 30, bottom: 45, left: 50 };

const to = new Date();
const from = new Date(to.getTime() - (DAYS - 1) * 864e5);

const query = `query($login:String!,$from:DateTime!,$to:DateTime!){
  user(login:$login){ contributionsCollection(from:$from,to:$to){
    contributionCalendar{ weeks{ contributionDays{ date contributionCount } } } } } }`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "activity-graph" },
  body: JSON.stringify({ query, variables: { login: LOGIN, from: from.toISOString(), to: to.toISOString() } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors || json));

const days = json.data.user.contributionsCollection.contributionCalendar.weeks
  .flatMap((w) => w.contributionDays)
  .slice(-DAYS);

const max = Math.max(4, ...days.map((d) => d.contributionCount));
// round the y-axis step to 1, 2 or 5 times a power of ten
const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw));
const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
const steps = Math.ceil(max / step);
const top = steps * step;
const plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
const x = (i) => PAD.left + (i * plotW) / (days.length - 1);
const y = (v) => PAD.top + plotH - (v * plotH) / top;
const base = y(0);

const pts = days.map((d, i) => [x(i).toFixed(1), y(d.contributionCount).toFixed(1)]);
const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
const area = `${line} L${pts.at(-1)[0]},${base} L${pts[0][0]},${base} Z`;

const gridY = Array.from({ length: steps + 1 }, (_, i) => step * i).map((v) =>
  `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/>` +
  `<text x="${PAD.left - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
const labelsX = days.map((d, i) => `<text x="${x(i)}" y="${base + 20}" text-anchor="middle">${Number(d.date.slice(8))}</text>`).join("");
const dots = pts.map(([px, py], i) => `<circle cx="${px}" cy="${py}" r="3" fill="${C.point}"><title>${days[i].date}: ${days[i].contributionCount}</title></circle>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI,Ubuntu,Helvetica,Arial,sans-serif">
<rect width="100%" height="100%" rx="6" fill="${C.bg}"/>
<text x="${W / 2}" y="32" fill="${C.title}" font-size="18" font-weight="600" text-anchor="middle">${LOGIN}'s Contribution Graph</text>
<g fill="${C.text}" font-size="11">${gridY}${labelsX}</g>
<text x="${W / 2}" y="${H - 6}" fill="${C.text}" font-size="12" text-anchor="middle">Days</text>
<text transform="translate(14 ${PAD.top + plotH / 2}) rotate(-90)" fill="${C.text}" font-size="12" text-anchor="middle">Contributions</text>
<path d="${area}" fill="${C.area}" opacity="0.6"/>
<path d="${line}" fill="none" stroke="${C.line}" stroke-width="2" stroke-linejoin="round"/>
${dots}
</svg>
`;

mkdirSync(OUT.split("/").slice(0, -1).join("/") || ".", { recursive: true });
writeFileSync(OUT, svg);
console.log(`wrote ${OUT} (${days.length} days, max ${max})`);
