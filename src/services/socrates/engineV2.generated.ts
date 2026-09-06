// @ts-nocheck
/*
 * Recovered, tree-shaken Socrates runtime from the colleague release
 * philomate:20260905-socrates-product-v2. This module contains only the
 * dependency graph of the four Socrates runtime entry points; no UI code,
 * styles, assets, or other-role pipeline code is included.
 */
// .deployment/compare/v2-engine-entry.js
var ge = "qwen-turbo";
var J = "qwen3.8-max";
var Q = class extends Error {
  constructor(t, n, s, o) {
    super(t), this.code = n, this.status = s, this.name = "ModelServiceError", o !== void 0 && (this.cause = o);
  }
  code;
  status;
};
async function De(e) {
  let t;
  try {
    t = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "system", content: e.system }, ...(e.history ?? []).slice(-8), { role: "user", content: e.user }], model: e.model, maxTokens: e.maxTokens, temperature: e.temperature, json: e.json, enableThinking: e.enableThinking, topP: e.topP, frequencyPenalty: e.frequencyPenalty, presencePenalty: e.presencePenalty }) });
  } catch (s) {
    throw new Q("\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u672A\u80FD\u8FDE\u63A5\u6A21\u578B\u670D\u52A1\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002", "network", void 0, s);
  }
  if (!t.ok) throw t.status === 503 ? new Q("\u6A21\u578B\u670D\u52A1\u5C1A\u672A\u914D\u7F6E API Key\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002", "not_configured", 503) : t.status === 504 ? new Q("\u6A21\u578B\u670D\u52A1\u54CD\u5E94\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", "timeout", 504) : new Q(`\u6A21\u578B\u670D\u52A1\u8C03\u7528\u5931\u8D25\uFF08HTTP ${t.status}\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002`, "http", t.status);
  let n;
  try {
    n = await t.json();
  } catch (s) {
    throw new Q("\u6A21\u578B\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u6570\u636E\uFF0C\u8BF7\u91CD\u8BD5\u3002", "invalid_response", t.status, s);
  }
  if (typeof n.text != "string" || !n.text.trim()) throw new Q("\u6A21\u578B\u670D\u52A1\u8FD4\u56DE\u4E86\u7A7A\u56DE\u590D\uFF0C\u8BF7\u91CD\u8BD5\u3002", "invalid_response", t.status);
  return n.text;
}
function Xt(e) {
  return e.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
async function Be(e, t, n = ge, s = 400, o = 0.2, r = false) {
  const i = await De({ system: e, user: t, model: n, maxTokens: s, temperature: o, json: true, enableThinking: r });
  return JSON.parse(Xt(i));
}
async function xe(e, t, n, s = {}) {
  return De({ system: e, history: t, user: n, model: s.model ?? J, maxTokens: s.maxTokens ?? 480, temperature: s.temperature ?? 0.82, json: false, enableThinking: s.enableThinking ?? false, topP: s.topP, frequencyPenalty: s.frequencyPenalty, presencePenalty: s.presencePenalty });
}
var Qt = ["praise", "method", "neutral_explain", "reject", "lament", "refuse_talk"];
var Vt = new Set(Qt);
function ns(e) {
  return e.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
function Fe(e, t) {
  const n = ns(e);
  if (t <= 0 || [...n].length <= t) return n;
  const s = [...n].slice(0, t).join(""), o = Math.max(s.lastIndexOf("\u3002"), s.lastIndexOf("\uFF01"), s.lastIndexOf("\uFF1F"));
  return o >= Math.floor(t * 0.45) ? s.slice(0, o + 1) : `${[...s].slice(0, Math.max(1, t - 1)).join("")}\u3002`;
}
var ds = ["\u5546\u52A1\u5370\u4E66\u9986", "\u8BD1\u8005\u5F15\u8A00", "\u56FE\u4E66\u5728\u7248\u7F16\u76EE", "ISBN", "\u51FA\u7248\u8BF4\u660E", "CIP\u6570\u636E", "\u82CF\u683C\u62C9\u5E95\u53BB\u4E16", "\u82CF\u683C\u62C9\u5E95\u7684\u8A00\u8F9E", "\u82CF\u683C\u62C9\u5E95\u554A"];
var ps = { "\u77E5/\u4E0D\u77E5": ["\u77E5\u9053", "\u4E0D\u77E5\u9053", "\u65E0\u77E5", "\u88C5\u61C2", "\u786E\u4FE1", "\u80AF\u5B9A", "\u77E5\u8BC6", "\u660E\u767D", "\u771F\u5047", "\u8BC1\u636E", "\u770B\u5B8C\u8D44\u6599", "\u6015\u88AB\u770B\u7A7F"], "\u5584/\u6076": ["\u5584\u6076", "\u597D\u574F", "\u5584\u826F", "\u4F5C\u6076", "\u884C\u5584", "\u574F\u4E8B", "\u9053\u5FB7\u4E0A", "\u6076\u4EBA"], "\u7075\u9B42/\u8EAB\u4F53": ["\u7075\u9B42", "\u8EAB\u4F53", "\u8089\u4F53", "\u6B32\u671B", "\u5065\u5EB7", "\u75C5\u75DB", "\u75B2\u60EB", "\u611F\u5B98"], \u81EA\u6211\u5BA1\u67E5: ["\u53CD\u7701", "\u5BA1\u89C6\u81EA\u5DF1", "\u8BA4\u8BC6\u81EA\u5DF1", "\u81EA\u6B3A", "\u81EA\u6211\u6000\u7591", "\u68C0\u9A8C\u81EA\u5DF1", "\u524D\u63D0", "\u53CD\u4F8B", "\u95EE\u5FC3", "\u505C\u4E0D\u4E0B\u6765", "\u5237\u624B\u673A", "\u5237\u77ED\u89C6\u9891", "\u60EF\u6027", "\u4E60\u60EF"], \u6280\u827A\u4E0E\u8D44\u683C: ["\u6280\u827A", "\u8D44\u683C", "\u4E13\u4E1A", "\u4E13\u5BB6", "\u6743\u5A01", "\u80FD\u529B", "\u64C5\u957F", "\u79F0\u804C", "\u6280\u80FD", "\u61C2\u884C", "\u80DC\u4EFB"], \u7167\u6599\u7075\u9B42: ["\u7167\u6599\u7075\u9B42", "\u751F\u6D3B\u65B9\u5F0F", "\u6210\u4E3A\u4EC0\u4E48\u6837\u7684\u4EBA", "\u7CBE\u795E\u751F\u6D3B", "\u53EA\u987E\u8D5A\u94B1", "\u8D22\u5BCC", "\u540D\u58F0", "\u4F53\u9762", "\u5185\u5728"], \u4E00\u81F4\u6027\u4E0E\u5951\u7EA6: ["\u4E00\u81F4", "\u5951\u7EA6", "\u627F\u8BFA", "\u7EA6\u5B9A", "\u8BF4\u8C0E", "\u6492\u8C0E", "\u80CC\u53DB", "\u8FDD\u7EA6", "\u524D\u540E\u77DB\u76FE", "\u53CC\u6807", "\u5B88\u4FE1"], "\u662F/\u6240\u662F": ["\u7A76\u7ADF\u662F\u4EC0\u4E48", "\u5230\u5E95\u662F\u4EC0\u4E48", "\u4F55\u8C13", "\u5B9A\u4E49", "\u672C\u8D28", "\u540D\u79F0", "\u540D\u53EB", "\u7B97\u4E0D\u7B97", "\u8FD8\u7B97\u4E0D\u7B97", "\u628A\u8FD9\u53EB", "\u79F0\u4E3A"], \u4E00\u4E0E\u591A: ["\u4E00\u4E0E\u591A", "\u6240\u6709\u4EBA", "\u6BCF\u4E2A\u4EBA", "\u5168\u90E8", "\u4E00\u6982", "\u5171\u540C\u70B9", "\u5171\u6027", "\u591A\u79CD", "\u4E00\u822C\u5B9A\u4E49"], \u539F\u56E0\u4E0E\u76EE\u7684: ["\u539F\u56E0", "\u76EE\u7684", "\u4E3A\u4E86", "\u4E3A\u4EC0\u4E48", "\u6709\u4F55\u7528", "\u6709\u4EC0\u4E48\u7528", "\u4F5C\u7528", "\u529F\u80FD", "\u76EE\u6807", "\u610F\u4E49"], \u6B63\u4E49: ["\u6B63\u4E49", "\u516C\u6B63", "\u516C\u5E73", "\u5F3A\u6743", "\u5F3A\u8005", "\u6743\u529B", "\u5229\u76CA", "\u62A5\u590D", "\u51A4\u6789", "\u4E0D\u4E49"], \u5FB7\u6027: ["\u5FB7\u6027", "\u7F8E\u5FB7", "\u54C1\u683C", "\u4F18\u79C0", "\u52C7\u6562", "\u8282\u5236", "\u597D\u4EBA", "\u600E\u6837\u751F\u6D3B\u5F97\u597D"], \u795E: ["\u795E\u8C15", "\u795E\u7075", "\u656C\u795E", "\u8654\u8BDA", "\u5B97\u6559", "\u547D\u8FD0", "\u5192\u72AF\u795E"], \u591A\u6570\u4E0E\u5C3A\u5EA6: ["\u591A\u6570", "\u5927\u5BB6\u90FD", "\u522B\u4EBA\u90FD", "\u6D41\u884C", "\u6295\u7968", "\u8206\u8BBA", "\u5C3A\u5EA6", "\u6807\u51C6", "\u4EBA\u591A\u5C31"], \u57CE\u90A6: ["\u57CE\u90A6", "\u56FD\u5BB6", "\u516C\u6C11", "\u653F\u6CBB", "\u6CBB\u7406", "\u516C\u5171", "\u6CD5\u5F8B", "\u7EDF\u6CBB\u8005"], \u9009\u62E9: ["\u9009\u62E9", "\u51B3\u5B9A", "\u8981\u4E0D\u8981", "\u8BE5\u4E0D\u8BE5", "\u4E24\u96BE", "\u53D6\u820D", "\u8F9E\u804C", "\u79BB\u804C", "\u5206\u624B", "\u539F\u8C05"], \u884C\u52A8: ["\u884C\u52A8", "\u53BB\u505A", "\u5B9E\u8DF5", "\u6267\u884C", "\u62D6\u5EF6", "\u8FC8\u51FA", "\u91C7\u53D6\u884C\u52A8", "\u8BF4\u5230\u505A\u5230"], \u6559\u80B2: ["\u6559\u80B2", "\u5B66\u4E60", "\u8001\u5E08", "\u5B66\u751F", "\u6559\u5BFC", "\u57F9\u517B", "\u8003\u8BD5", "\u8BFB\u4E66", "\u8BAD\u7EC3"], \u6B7B\u4EA1: ["\u6B7B\u4EA1", "\u6B7B\u53BB", "\u6B7B\u540E", "\u4E34\u7EC8", "\u6015\u6B7B", "\u754F\u6B7B", "\u751F\u547D\u7EC8\u70B9"], \u53CB\u8C0A\u4E0E\u7231: ["\u670B\u53CB", "\u53CB\u8C0A", "\u7231", "\u559C\u6B22", "\u5173\u7CFB", "\u7EDD\u4EA4", "\u604B\u7231", "\u4EB2\u5BC6", "\u7231\u4EBA"], \u7F8E: ["\u7F8E\u662F\u4EC0\u4E48", "\u7F8E\u4E3D", "\u6F02\u4EAE", "\u597D\u770B", "\u4E11", "\u5BA1\u7F8E", "\u5916\u8C8C"] };
var fs = ["\u4EC0\u4E48\u662F", "\u4F55\u8C13", "\u5B9A\u4E49", "\u672C\u8D28", "\u77E5\u8BC6", "\u65E0\u77E5", "\u7075\u9B42", "\u5FB7\u6027", "\u7F8E\u5FB7", "\u6B63\u4E49", "\u516C\u6B63", "\u5584\u6076", "\u52C7\u6562", "\u8282\u5236", "\u8654\u8BDA", "\u795E\u8C15", "\u57CE\u90A6", "\u516C\u6C11", "\u591A\u6570", "\u8BA4\u8BC6\u81EA\u5DF1", "\u7167\u6599\u7075\u9B42", "\u6280\u827A", "\u8D44\u683C", "\u4E00\u4E0E\u591A", "\u539F\u56E0", "\u76EE\u7684", "\u6B7B\u4EA1", "\u53CB\u8C0A", "\u7F8E\u662F\u4EC0\u4E48"];
function Y(e) {
  return [...new Set(e)];
}
function ms(e) {
  return e.toLowerCase().replace(/[\s，。！？；：、“”‘’（）()【】\[\],.!?;:'"-]+/g, "");
}
function Ve(e) {
  const t = [...ms(e)], n = /* @__PURE__ */ new Set();
  for (let s = 0; s < t.length - 1; s += 1) n.add(t[s] + t[s + 1]);
  return n;
}
function F(e, t, n = 8) {
  const s = Ve(t);
  let o = 0;
  for (const r of Ve(e)) if (s.has(r) && (o += 1), o >= n) break;
  return o;
}
function vt(e, t) {
  const n = e.toLowerCase();
  return t.some((s) => n.includes(s.toLowerCase()));
}
function w(e, t) {
  return e ? [...e.trim()].slice(0, t).join("") : "";
}
function wt(e) {
  const t = (e._legacy?.text_anchor || e.text || "").trim();
  return !(t.length < 8 || t.length > 120 || ds.some((n) => t.includes(n)) || e._legacy?.status && !["approved", "ok"].includes(e._legacy.status) || e._legacy?.corpus_tier === "negative");
}
function St(e, t) {
  if (!wt(e)) return -1;
  const n = e._legacy;
  let s = 0;
  for (const o of n?.modern_user_hooks ?? []) {
    const r = o.trim();
    r.length < 2 || (t.includes(r) ? s += 9 + Math.min(r.length, 10) * 0.25 : s += Math.min(F(r, t, 6), 5) * 0.45);
  }
  for (const o of n?.modern_pairs ?? []) o.kind === "negative" || !o.user_message || (s += Math.min(F(o.user_message, t, 8), 6) * 0.7);
  for (const o of n?.modern_scenes ?? []) s += Math.min(F(o, t, 5), 3) * 0.25;
  for (const o of [...e.themes ?? [], ...e.categories ?? []]) o.length >= 2 && t.includes(o) && (s += 4);
  return s += Math.min(F(e.condensed, t, 8), 6) * 0.45, s += Math.min(F(e._legacy?.source_excerpt ?? "", t, 5), 3) * 0.15, s;
}
function he(e) {
  return /别问|不要问|问太多|换个话题|你刚才/u.test(e) ? "meta" : /不对|不是这样|恰恰|反而|我不同意/u.test(e) ? "rebuttal" : /也就是说|是不是前后|自相矛盾|一致/u.test(e) ? "consistency" : /更准确|严格说|我改一下|不是.+而是/u.test(e) ? "refinement" : /[?？]|为何|怎么|如何|何为|是否|吗/u.test(e) ? "question" : "continue";
}
function ye(e) {
  return vt(e, fs) ? "path1" : "path2";
}
function kt(e, t) {
  return { "\u77E5/\u4E0D\u77E5": /不懂|无知|装懂|不知道/u.test(t) ? "\u4E0D\u77E5\u800C\u4E0D\u81EA\u6B3A" : "\u6240\u77E5\u4ECD\u5F85\u68C0\u9A8C", "\u5584/\u6076": "\u884C\u4E3A\u5584\u6076\u5F85\u8FA8", "\u7075\u9B42/\u8EAB\u4F53": "\u8EAB\u5FC3\u4F55\u8005\u4E3B\u5BFC", \u81EA\u6211\u5BA1\u67E5: "\u5BA1\u67E5\u81EA\u8EAB\u524D\u63D0", \u6280\u827A\u4E0E\u8D44\u683C: "\u6743\u5A01\u4E0D\u7B49\u4E8E\u80DC\u4EFB", \u7167\u6599\u7075\u9B42: "\u5148\u8FA8\u4F55\u8005\u771F\u6B63\u6709\u76CA", \u4E00\u81F4\u6027\u4E0E\u5951\u7EA6: "\u8A00\u884C\u662F\u5426\u76F8\u5408", "\u662F/\u6240\u662F": "\u540D\u79F0\u987B\u5408\u4E8E\u6240\u662F", \u4E00\u4E0E\u591A: "\u4E2A\u4F8B\u80FD\u5426\u6210\u901A\u5219", \u539F\u56E0\u4E0E\u76EE\u7684: "\u76EE\u7684\u80FD\u5426\u8BF4\u660E\u884C\u52A8", \u6B63\u4E49: "\u5F3A\u529B\u4E0D\u7B49\u4E8E\u6B63\u5F53", \u5FB7\u6027: "\u5FB7\u6027\u987B\u89C1\u4E8E\u5B9E\u884C", \u795E: "\u8654\u8BDA\u4ECD\u987B\u8BF4\u660E", \u591A\u6570\u4E0E\u5C3A\u5EA6: "\u4EBA\u6570\u4E0D\u80FD\u4EE3\u66FF\u5C3A\u5EA6", \u57CE\u90A6: "\u5171\u540C\u751F\u6D3B\u987B\u53D7\u68C0\u9A8C", \u9009\u62E9: "\u53D6\u820D\u987B\u6BD4\u8F83\u4EE3\u4EF7", \u884C\u52A8: "\u4E3B\u5F20\u987B\u843D\u5B9E\u4E3A\u884C\u52A8", \u6559\u80B2: "\u6559\u5BFC\u4E0D\u7B49\u4E8E\u704C\u8F93", \u6B7B\u4EA1: "\u672A\u77E5\u4E0D\u5E94\u5192\u5145\u6076", \u53CB\u8C0A\u4E0E\u7231: "\u7231\u987B\u8FA8\u6240\u6C42\u4E4B\u5584", \u7F8E: "\u7F8E\u540D\u4ECD\u5F85\u5171\u540C\u5B9A\u4E49" }[e] ?? `\u7531${e}\u68C0\u9A8C\u5904\u5883`;
}
function Ct(e, t) {
  const n = ye(e), s = new Set(t.coveredThemes.length ? t.coveredThemes : t.themes), o = new Set(t.coveredCategories.length ? t.coveredCategories : t.categories), r = Y([...s, ...o]), i = /* @__PURE__ */ new Map();
  for (const c of r) {
    let u = 0;
    e.includes(c) && (u += 18);
    for (const d of ps[c] ?? []) e.toLowerCase().includes(d.toLowerCase()) ? u += 5 + Math.min([...d].length, 5) * 0.5 : [...d].length >= 3 && (u += Math.min(F(d, e, 4), 3) * 0.2);
    u > 0 && i.set(c, u);
  }
  const l = t.corpus.map((c) => ({ entry: c, score: St(c, e) })).filter(({ score: c }) => c >= 3.5).sort((c, u) => u.score - c.score).slice(0, 10);
  for (const { entry: c, score: u } of l) for (const d of Y([...c.themes ?? [], ...c.categories ?? []])) r.includes(d) && i.set(d, (i.get(d) ?? 0) + Math.min(u, 14) * 0.45);
  return [...i.entries()].filter(([, c]) => c >= 1.2).map(([c, u]) => {
    const d = n === "path1" && s.has(c) ? "theme" : "category";
    return { kind: d === "category" && !o.has(c) ? "theme" : d, key: c, reinterpretation: kt(c, e), mentionReason: `\u6574\u53E5\u4E0E\u201C${c}\u201D\u7684\u73B0\u4EE3\u8BF4\u6CD5\u6216\u573A\u666F\u6807\u6CE8\u76F8\u5408`, score: u };
  }).sort((c, u) => u.score - c.score || c.key.localeCompare(u.key, "zh-CN")).slice(0, 7);
}
function gs(e, t) {
  return (e.attitudeFrames ?? []).filter((n) => typeof n.lensKey == "string" && t.includes(n.lensKey)).map((n) => [n.trigger, n.object, n.element, n.target, n.socratesStance].filter((s) => typeof s == "string").join(" ")).join(" ");
}
function hs(e, t, n) {
  let s = Math.max(0, St(e, t));
  return s += F(e.condensed, t, 10) * 0.8, s += F(gs(e, n), t, 8) * 0.75, s += F(e.classifyReason ?? "", t, 5) * 0.2, s;
}
function At(e, t, n, s, o = 18) {
  const i = t.corpus.filter(wt).filter((u) => !s.includes(u.id)), l = [], c = /* @__PURE__ */ new Set();
  for (const u of n) {
    const d = (p) => u.kind === "theme" ? p.themes?.includes(u.key) : p.categories?.includes(u.key), g = i.filter(d).map((p) => ({ entry: p, score: hs(p, e, [u.key]), lensKeys: Y([...p.themes ?? [], ...p.categories ?? []].filter((f) => n.some((y) => y.key === f))) })).sort((p, f) => f.score - p.score || p.entry.id.localeCompare(f.entry.id)).slice(0, 5);
    for (const p of g) c.has(p.entry.id) || (c.add(p.entry.id), l.push(p));
  }
  return l.slice(0, o);
}
function xt(e, t) {
  const n = e.attitudeFrames ?? [];
  return n.find((s) => s.lensKind === t.kind && s.lensKey === t.key) ?? n.find((s) => s.lensKey === t.key) ?? n[0] ?? null;
}
function Tt(e, t) {
  if (t.kind === "category") {
    const n = (e.categories ?? []).indexOf(t.key);
    if (n >= 0) return e.temperaments?.[n] ?? e.condensed;
  }
  return e.condensed;
}
function ue(e) {
  return { path: ye(e), condensed: w(e, 160), primaryLens: null, lenses: [], entry: null, frame: null, corpusTemperament: "", speechAct: he(e), corpusBridge: "", lensSource: "empty", selectionSource: "none", hasTension: false, candidateCount: 0, selectionReason: "\u6CA1\u6709\u8DB3\u591F\u53EF\u9760\u7684\u82CF\u683C\u62C9\u5E95\u900F\u955C\uFF0C\u4E0D\u5F3A\u884C\u5957\u7528\u8BED\u6599" };
}
function ys(e, t) {
  return ["\u7236\u6BCD", "\u7956\u56FD", "\u6CD5\u5F8B\u670D\u4ECE", "\u5BA1\u5224", "\u653F\u6CBB\u4E49\u52A1", "\u57CE\u90A6", "\u6D1E\u7A74", "\u54F2\u4EBA\u8FD4\u56DE", "\u56DE\u5230\u9ED1\u6697", "\u68A6\u5146", "\u795E\u8C15", "\u9884\u8A00", "\u547D\u8FD0", "\u7B2C\u4E09\u5929", "\u6B7B\u4EA1", "\u6B7B\u5211", "\u996E\u9E29"].some((s) => t.includes(s) && !e.includes(s));
}
function bs(e, t) {
  if (!t || !/^hippias-minor-/u.test(t.entry.id)) return false;
  const n = /(?:故意|自愿作恶|明知故犯|道德责任|作恶|恶行|蓄意)/u.test(e);
  return /(?:换工作|辞职|买|选择|决定|分手|复合|搬家|考试|投资|选专业|做错决定)/u.test(e) && !n;
}
function vs(e, t, n = "") {
  if (!t) return false;
  const s = /(?:换工作|辞职|工资|饭碗|买房|消费|选专业|通勤|搬家)/u.test(e), o = /(?:德性|灵魂|善恶|怎样生活|成为怎样的人|道德|正义)/u.test(e), r = `${t.entry.id} ${t.entry.text} ${t.entry.condensed} ${n}`;
  return s && !o && /(?:apology-soul-care|灵魂|精神生活|神的爱|神祇|德性[^。；]{0,16}(?:生活|选择)|正义[^。；]{0,16}(?:生活|选择))/u.test(r);
}
function ws(e, t, n, s) {
  if (!t || !/(?:说谎|撒谎|欺骗|失约|犯错|做错)/u.test(e) || /(?:恶者|恶人|坏人|本性邪恶)/u.test(e)) return false;
  const o = [t.entry.text, t.entry.condensed, t.entry.classifyReason ?? "", n, typeof s == "string" ? s : ""].join(" ");
  return /(?:恶者|恶人|坏人|本性邪恶|与恶者为友)/u.test(o);
}
function Ss(e, t, n) {
  const s = Ct(e, t);
  if (!s.length) return ue(e);
  const o = ye(e), r = s.map(({ score: m, ...g }) => ({ ...g, kind: o === "path1" && t.coveredThemes.includes(g.key) ? "theme" : g.kind })), i = r[0], l = At(e, t, [i], n, 8), u = (l[0] ?? null)?.entry ?? null, d = u ? xt(u, i) : null;
  return { path: o, condensed: w(e, 160), primaryLens: i, lenses: r, entry: u, frame: d, corpusTemperament: u ? Tt(u, i) : "", speechAct: he(e), corpusBridge: u ? `\u4EE5\u201C${w(u.condensed, 42)}\u201D\u68C0\u9A8C\u773C\u524D\u5904\u5883` : "", lensSource: "local", selectionSource: u ? "local" : "none", hasTension: o === "path1" || vt(e, ["\u4F46", "\u5374", "\u53CD\u800C", "\u4E0D\u662F", "\u4E00\u8FB9", "\u53E6\u4E00\u8FB9", "\u6240\u4EE5", "\u65E2\u7136", "\u4ECD\u7136"]), candidateCount: l.length, selectionReason: u ? "\u672C\u5730\u73B0\u4EE3\u94A9\u5B50\u4E0E\u540C key \u5019\u9009\u521D\u7B5B\u547D\u4E2D" : "\u540C key \u5019\u9009\u6C60\u4E3A\u7A7A" };
}
function $t(e, t, n, s, o) {
  if (!Array.isArray(e)) return [];
  const r = new Set(s.coveredThemes.length ? s.coveredThemes : s.themes), i = new Set(s.coveredCategories.length ? s.coveredCategories : s.categories), l = [];
  for (const c of e) {
    if (!c || typeof c != "object") continue;
    const u = c, d = typeof u.key == "string" ? u.key : "";
    if (!n.has(d)) continue;
    const m = t === "path1" ? "theme" : "category";
    m === "theme" && !r.has(d) || m === "category" && !i.has(d) || l.push({ kind: m, key: d, reinterpretation: kt(d, o), mentionReason: typeof u.mentionReason == "string" ? w(u.mentionReason, 56) : void 0 });
  }
  return Y(l.map((c) => c.key)).map((c) => l.find((u) => u.key === c));
}
function ks(e, t) {
  const n = e.entry, s = (n.attitudeFrames ?? []).filter((o) => typeof o.lensKey == "string" && t.includes(o.lensKey)).slice(0, 4).map((o) => ({ lensKind: o.lensKind, lensKey: o.lensKey, trigger: typeof o.trigger == "string" ? w(o.trigger, 100) : "", object: typeof o.object == "string" ? w(o.object, 80) : "", stance: typeof o.socratesStance == "string" ? o.socratesStance : "" }));
  return { id: n.id, localScore: Number(e.score.toFixed(2)), lensKeys: e.lensKeys, layer: n.layer ?? "", condensed: w(n.condensed, 180), sourceExcerpt: w(n._legacy?.source_excerpt || n.text, 260), frames: s, modernHooks: (n._legacy?.modern_user_hooks ?? []).slice(0, 5), modernScenes: (n._legacy?.modern_scenes ?? []).slice(0, 4).map((o) => w(o, 100)), modernPairs: (n._legacy?.modern_pairs ?? []).filter((o) => o.kind !== "negative" && o.user_message).slice(0, 3).map((o) => ({ sceneKey: w(o.scene_key, 50), input: w(o.user_message, 90), replySketch: w(o.reply_sketch, 120) })), generationCaution: w(n.generationCaution, 60), classifyReason: w(n.classifyReason, 120) };
}
async function Cs(e) {
  const t = Y(e.data.coveredThemes.length ? e.data.coveredThemes : e.data.themes), n = Y(e.data.coveredCategories.length ? e.data.coveredCategories : e.data.categories), s = `\u4F60\u662F\u82CF\u683C\u62C9\u5E95\u8BED\u6599\u5E93\u7684\u8BED\u4E49\u9009\u57DF\u5668\uFF0C\u4E0D\u5199\u89D2\u8272\u53F0\u8BCD\u3002\u5148\u7406\u89E3\u7528\u6237\u6574\u53E5\u4E2D\u7684\u547D\u9898\u3001\u5173\u7CFB\u548C\u8C08\u8BDD\u610F\u56FE\uFF0C\u518D\u9009\u62E9\u53EF\u7528\u4E8E\u63A8\u8FDB\u8BBA\u8BC1\u7684\u900F\u955C\uFF1B\u5173\u952E\u8BCD\u91CD\u5408\u53EA\u80FD\u4F5C\u4E3A\u63D0\u793A\uFF0C\u4E0D\u80FD\u51B3\u5B9A\u7ED3\u679C\u3002

\u89C4\u5219\uFF1A
1. path1\uFF1A\u7528\u6237\u76F4\u63A5\u8BA8\u8BBA\u5B9A\u4E49\u3001\u77E5\u8BC6\u3001\u5FB7\u6027\u3001\u6B63\u4E49\u3001\u76EE\u7684\u7B49\u601D\u60F3\u95EE\u9898\uFF0C\u53EA\u80FD\u4ECE allowedThemes \u9009 1\uFF5E3 \u9879\u3002
2. path2\uFF1A\u7528\u6237\u8C08\u5177\u4F53\u751F\u6D3B\u5904\u5883\uFF0C\u4F46\u53EF\u7528\u82CF\u683C\u62C9\u5E95\u5F0F\u7ED3\u6784\u68C0\u9A8C\uFF0C\u53EA\u80FD\u4ECE allowedCategories \u9009 1\uFF5E3 \u9879\u3002
3. \u540C\u65F6\u4ECE allowedMoves \u9009\u62E9\u4E00\u4E2A dialogueMove\u3002\u5B83\u5FC5\u987B\u63A8\u8FDB\u6700\u8FD1\u5BF9\u8BDD\uFF0C\u4E0D\u80FD\u53EA\u662F\u7ED9\u5EFA\u8BAE\uFF1BrecentMoves \u4E2D\u521A\u7528\u8FC7\u7684\u52A8\u4F5C\u82E5\u975E\u5FC5\u8981\u4E0D\u8981\u91CD\u590D\u3002
4. targetClaim \u53EA\u5199\u672C\u8F6E\u786E\u5B9E\u8981\u68C0\u9A8C\u7684\u4E00\u6761\u547D\u9898\uFF0C\u4F18\u5148\u7D27\u8D34 currentInput\u3002\u82E5 currentInput \u65B0\u589E\u4E86\u4E8B\u5B9E\u6216\u5224\u65AD\uFF0C\u4E0D\u5F97\u628A\u4E0A\u4E00\u8F6E\u52A9\u624B\u7684\u8BDD\u5F53\u4F5C targetClaim\uFF1B\u82E5 currentInput \u662F\u201C\u90A3\u8BE5\u770B\u4EC0\u4E48\u201D\u4E4B\u7C7B\u63A8\u8FDB\u8BF7\u6C42\uFF0CtargetClaim \u5C31\u5199\u8FD9\u9879\u5224\u65AD\u8BF7\u6C42\u53CA\u5176\u5F85\u5B9A\u5C3A\u5EA6\uFF0C\u4E0D\u5F97\u56DE\u6536\u65E7\u7ED3\u8BBA\u5192\u5145\u65B0\u547D\u9898\u3002\u4E0D\u5F97\u628A\u201C\u62C5\u5FC3\u505A\u9519\u201D\u52A0\u5F3A\u6210\u201C\u5FC5\u987B\u5B8C\u7F8E\u201D\uFF0C\u4E0D\u5F97\u628A\u72B9\u8C6B\u52A0\u5F3A\u6210\u201C\u4E0D\u914D\u505A\u4E3B\u201D\uFF0C\u4E0D\u5F97\u731C\u52A8\u673A\u3002
5. newContribution \u5199\u672C\u8F6E\u76F8\u5BF9\u6700\u8FD1\u56DE\u7B54\u5FC5\u987B\u65B0\u589E\u7684\u4E00\u5C42\uFF0C\u53EA\u80FD\u662F\u4E00\u9879\u533A\u522B\u3001\u53CD\u4F8B\u3001\u8BC1\u636E\u6761\u4EF6\u3001\u9002\u7528\u8FB9\u754C\u6216\u5C1A\u7F3A\u4E8B\u5B9E\u3002\u5B83\u4E0D\u5F97\u590D\u8FF0\u3001\u53CD\u8F6C\u3001\u6982\u62EC\u6216\u6362\u6BD4\u55BB\u5305\u88C5 recentContributions\uFF1B\u4E5F\u4E0D\u5F97\u53EA\u662F\u628A recentTargetClaims \u518D\u95EE\u4E00\u904D\u3002\u82E5\u786E\u5B9E\u6CA1\u6709\u65B0\u7ED3\u8BBA\u53EF\u7ED9\uFF0C\u5C31\u9009\u62E9 provisional_aporia\uFF0C\u5E76\u6307\u51FA\u8FD8\u7F3A\u54EA\u9879\u53EF\u89C2\u5BDF\u4E8B\u5B9E\u3002
6. questionFocus \u5199\u6E05\u82E5\u8981\u53D1\u95EE\uFF0C\u5E94\u68C0\u9A8C targetClaim \u7684\u54EA\u4E2A\u65B0\u8FB9\u754C\u3001\u53CD\u4F8B\u6216\u4E00\u81F4\u6027\uFF1B\u4E0D\u5F97\u91CD\u590D recentContributions \u5DF2\u7ECF\u89E3\u51B3\u7684\u7126\u70B9\uFF0C\u4E0D\u5199\u5B8C\u6574\u53F0\u8BCD\u3002
7. \u4F18\u5148\u9009\u62E9\u80FD\u652F\u6301\u771F\u5B9E\u8BBA\u8BC1\u52A8\u4F5C\u7684\u900F\u955C\uFF1A\u8BF7\u6C42\u5B9A\u4E49\u3001\u68C0\u9A8C\u524D\u63D0\u3001\u5BFB\u627E\u53CD\u4F8B\u3001\u68C0\u9A8C\u4E00\u81F4\u6027\u3001\u8FA8\u522B\u77E5\u8BC6\u8D44\u683C\u3001\u533A\u5206\u76EE\u7684\u4E0E\u624B\u6BB5\u3002
8. \u4E0D\u8981\u56E0\u4E3A\u51FA\u73B0\u201C\u5206\u624B\u201D\u4FBF\u5FC5\u9009\u201C\u9009\u62E9\u201D\uFF0C\u4E5F\u4E0D\u8981\u56E0\u4E3A\u51FA\u73B0\u201C\u96BE\u8FC7\u201D\u4FBF\u5957\u201C\u7075\u9B42\u201D\uFF1B\u8981\u770B\u6574\u53E5\u8BDD\u6B64\u523B\u7A76\u7ADF\u9700\u8981\u68C0\u9A8C\u4EC0\u4E48\u3002
9. \u5BA4\u53CB\u3001\u670B\u53CB\u3001\u540C\u4E8B\u7B49\u79C1\u4EBA\u76F8\u5904\u95EE\u9898\uFF0C\u82E5\u6CA1\u6709\u516C\u5171\u6743\u529B\u3001\u6CD5\u5F8B\u6216\u653F\u6CBB\u5173\u7CFB\uFF0C\u4E0D\u8981\u62AC\u5347\u4E3A\u201C\u57CE\u90A6\u201D\uFF1B\u4F18\u5148\u8003\u8651\u4E00\u81F4\u6027\u4E0E\u5951\u7EA6\u3001\u53CB\u8C0A\u4E0E\u7231\u3001\u884C\u52A8\u3001\u662F/\u6240\u662F\u7B49\u76F4\u63A5\u7ED3\u6784\u3002
10. lenses[].key \u5FC5\u987B\u9010\u5B57\u6765\u81EA\u5BF9\u5E94 allowed \u5217\u8868\u3002reinterpretation \u548C mentionReason \u7528\u77ED\u53E5\u8BF4\u660E\u5B83\u600E\u6837\u8D34\u5408\u7528\u6237\u6574\u53E5\u3002

\u8F93\u51FA JSON\uFF0C\u7981\u6B62\u9644\u52A0\u6587\u5B57\uFF1A
{"condensed":"\u7528\u6237\u547D\u9898\u4E0E\u610F\u56FE","path":"path1|path2","hasTension":true,"speechAct":"continue|rebuttal|consistency|refinement|question|meta","dialogueMove":"definition|premise_test|counterexample|consistency_test|means_and_end|knowledge_test|provisional_aporia","targetClaim":"\u53EA\u542B\u5DF2\u6709\u4F9D\u636E\u7684\u5F85\u68C0\u9A8C\u547D\u9898","newContribution":"\u76F8\u5BF9\u8FD1\u8F6E\u552F\u4E00\u65B0\u589E\u7684\u8BBA\u8BC1\u5C42","questionFocus":"\u8981\u68C0\u9A8C\u7684\u65B0\u8FB9\u754C","lenses":[{"key":"\u2026","reinterpretation":"\u2026","mentionReason":"\u2026"}]}`, o = JSON.stringify({ currentInput: e.userInput, recentContext: e.priorTurns.slice(-4).map((p) => ({ role: p.role, content: w(p.content, 240) })), localSuggestions: e.localCandidates.slice(0, 7).map(({ kind: p, key: f, reinterpretation: y, score: k }) => ({ kind: p, key: f, reinterpretation: y, score: Number(k.toFixed(2)) })), recentMoves: e.recentMoves ?? [], recentTargetClaims: e.recentTargetClaims ?? [], recentContributions: e.recentContributions ?? [], allowedMoves: ["definition", "premise_test", "counterexample", "consistency_test", "means_and_end", "knowledge_test", "provisional_aporia"], allowedThemes: t, allowedCategories: n }), r = await Be(s, o, ge, 560, 0.08, false), i = r.path === "path1" ? "path1" : "path2", l = new Set(i === "path1" ? t : n), c = $t(r.lenses, i, l, e.data, e.userInput), u = ye(e.userInput), d = e.localCandidates.map(({ score: p, ...f }) => ({ ...f, kind: u === "path1" && t.includes(f.key) ? "theme" : f.kind })).filter((p) => p.kind === "theme" ? t.includes(p.key) : n.includes(p.key)), m = /* @__PURE__ */ new Set(["continue", "rebuttal", "consistency", "refinement", "question", "meta"]), g = /* @__PURE__ */ new Set(["definition", "premise_test", "counterexample", "consistency_test", "means_and_end", "knowledge_test", "provisional_aporia"]);
  return { condensed: typeof r.condensed == "string" && r.condensed.trim() ? w(r.condensed, 160) : w(e.userInput, 160), path: c.length ? i : u, hasTension: r.hasTension === true, speechAct: typeof r.speechAct == "string" && m.has(r.speechAct) ? r.speechAct : he(e.userInput), lenses: c.length ? c : d, dialogueMove: typeof r.dialogueMove == "string" && g.has(r.dialogueMove) ? r.dialogueMove : "", targetClaim: typeof r.targetClaim == "string" ? w(r.targetClaim, 140) : "", questionFocus: typeof r.questionFocus == "string" ? w(r.questionFocus, 120) : "", newContribution: typeof r.newContribution == "string" ? w(r.newContribution, 160) : "" };
}
async function As(e) {
  const t = Ct(e.userInput, e.data), n = await Cs({ userInput: e.userInput, priorTurns: e.priorTurns, data: e.data, localCandidates: t, recentMoves: e.recentMoves, recentTargetClaims: e.recentTargetClaims, recentContributions: e.recentContributions }), s = n.lenses;
  if (!s.length) return { ...ue(e.userInput), condensed: n.condensed, path: n.path, hasTension: n.hasTension, speechAct: n.speechAct, dialogueMove: n.dialogueMove, targetClaim: n.targetClaim, questionFocus: n.questionFocus, newContribution: n.newContribution, selectionReason: "\u6574\u53E5\u8BED\u4E49\u9009\u57DF\u672A\u627E\u5230\u53EF\u5FE0\u5B9E\u4F7F\u7528\u7684\u900F\u955C" };
  const o = At(e.userInput, e.data, s, e.usedIds, 18);
  if (!o.length) return { ...ue(e.userInput), condensed: n.condensed, path: n.path, hasTension: n.hasTension, speechAct: n.speechAct, dialogueMove: n.dialogueMove, targetClaim: n.targetClaim, questionFocus: n.questionFocus, newContribution: n.newContribution, selectionReason: "\u8BED\u4E49\u89C4\u5212\u5DF2\u5B8C\u6210\uFF0C\u4F46\u5F53\u524D\u900F\u955C\u6CA1\u6709\u672A\u4F7F\u7528\u7684\u53EF\u9760\u8BED\u6599" };
  const r = new Set(s.map((S) => S.key)), i = e.priorTurns.slice(-4).map((S) => ({ role: S.role, content: w(S.content, 240) })), l = `\u4F60\u662F PhiloMate \u7684\u82CF\u683C\u62C9\u5E95\u9009\u6750\u88C1\u51B3\u5668\u3002\u4F60\u4E0D\u5199\u89D2\u8272\u53F0\u8BCD\u3002\u6574\u53E5\u95EE\u65E8\u3001\u8DEF\u5F84\u548C\u900F\u955C\u5DF2\u7ECF\u7531\u524D\u4E00\u6B65\u8BED\u4E49\u9009\u57DF\u786E\u5B9A\uFF1B\u4F60\u53EA\u5728\u7ED9\u5B9A\u7684\u540C key \u8BED\u6599\u5019\u9009\u4E2D\u5B8C\u6210\u201C\u4E49\u9879\u88C1\u51B3\u2192bridge\u201D\u3002

\u4E25\u683C\u987A\u5E8F\uFF1A
1. condensed \u5199\u6E05\u4E3B\u9898\u3001\u5FC5\u8981\u903B\u8F91\u5173\u7CFB\u548C\u7528\u6237\u672C\u8F6E\u610F\u56FE\uFF1B\u4E0D\u80FD\u53EA\u5199\u4E00\u4E2A\u6807\u7B7E\u3002
2. path \u56FA\u5B9A\u4E3A ${n.path}\uFF0C\u4E0D\u5F97\u6539\u6362\u3002
3. \u4ECE allowedLenses \u4E2D\u4FDD\u7559 1\uFF5E3 \u4E2A\u900F\u955C\u3002${n.path === "path1" ? "\u4E00\u5F8B\u8F93\u51FA theme" : "\u4E00\u5F8B\u8F93\u51FA category"}\u3002primaryLensIndex \u6307\u6700\u8D34\u6574\u53E5\u7684\u4E00\u9879\u3002
4. \u53EA\u80FD\u4ECE candidates \u4E2D\u9009\u62E9 bestId\uFF0C\u800C\u4E14 bestId.lensKeys \u5FC5\u987B\u5305\u542B primary lens key\u3002\u5148\u9009\u8BED\u6599\uFF0C\u518D\u5199 bridge\u3002
5. bridge \u7528\u4E00\u4E24\u53E5\u77ED\u767D\u8BDD\u5199\u6E05\u7528\u6237\u5904\u5883\u4E0E\u6750\u6599\u7684\u540C\u4E00\u5173\u7CFB\u7ED3\u6784\uFF1B\u4E0D\u80FD\u53EA\u9760\u4E00\u4E2A\u5B57\u6216\u62BD\u8C61\u6807\u7B7E\u6CBE\u8FB9\u3002

\u82CF\u683C\u62C9\u5E95\u9009\u6750\u51C6\u5219\uFF1A
- \u4F18\u5148\u5B9E\u9645\u7684\u8BBA\u8BC1\u52A8\u4F5C\uFF1A\u8FFD\u95EE\u5B9A\u4E49\u3001\u68C0\u9A8C\u81EA\u79F0\u7684\u77E5\u8BC6\u6216\u8D44\u683C\u3001\u66B4\u9732\u524D\u540E\u4E0D\u4E00\u81F4\u3001\u533A\u5206\u6743\u52BF\u4E0E\u6B63\u5F53\u3001\u8FA8\u522B\u8868\u8C61\u4E0E\u6240\u662F\u3001\u8003\u5BDF\u76EE\u7684\u4E0E\u771F\u6B63\u5229\u76CA\u3001\u4EE5\u53CD\u4F8B\u8FEB\u4F7F\u5224\u65AD\u6536\u7A84\u3002
- \u201C\u81EA\u77E5\u65E0\u77E5\u201D\u548C\u201C\u7167\u6599\u7075\u9B42\u201D\u4E0D\u662F\u4E07\u80FD\u6807\u7B7E\uFF1B\u666E\u901A\u56F0\u60D1\u4E0D\u5F97\u4E00\u5F8B\u547D\u4E2D\u5B83\u4EEC\u3002\u4E5F\u4E0D\u8981\u56E0\u6750\u6599\u51FA\u73B0\u5E7F\u573A\u3001\u5BA1\u5224\u6216\u63D0\u95EE\uFF0C\u5C31\u8BEF\u5F53\u6210\u8D34\u5408\u3002
- \u5019\u9009\u539F\u6587\u53EF\u80FD\u662F\u8272\u62C9\u53D9\u9A6C\u970D\u65AF\u3001\u6B27\u608C\u752B\u620E\u7B49\u5BF9\u8BDD\u5BF9\u624B\u7684\u4E3B\u5F20\u3002\u5FC5\u987B\u7ED3\u5408 condensed\u3001frames \u548C classifyReason \u5224\u65AD\u6750\u6599\u5728\u8BBA\u8BC1\u4E2D\u7684\u8EAB\u4EFD\uFF1B\u7EDD\u4E0D\u80FD\u628A\u5BF9\u624B\u7684\u8BDD\u5F53\u6210\u82CF\u683C\u62C9\u5E95\u672C\u4EBA\u7684\u5B9A\u8BBA\u3002
- modernHooks \u53EA\u5E2E\u52A9\u53EC\u56DE\uFF0C\u4E0D\u80FD\u4EE3\u66FF\u6574\u53E5\u7406\u89E3\u3002\u5BBD\u6CDB\u8BCD\uFF08\u5982\u8F9E\u804C\u3001\u7A33\u5B9A\u3001\u670B\u53CB\uFF09\u91CD\u5408\u800C\u8BBA\u8BC1\u7ED3\u6784\u4E0D\u540C\uFF0C\u5E94\u6362\u6761\u6216 usable=false\u3002
- lenses[].reinterpretation \u5FC5\u987B\u538B\u7F29\u7528\u6237\u6574\u53E5\u4E2D\u5DF2\u7ECF\u5B58\u5728\u7684\u5173\u7CFB\uFF0C\u4E0D\u80FD\u6284\u5019\u9009\u6750\u6599\u7684\u7ED3\u8BBA\uFF0C\u66F4\u4E0D\u80FD\u8BA9\u5019\u9009\u53CD\u8FC7\u6765\u6539\u5199\u7528\u6237\u95EE\u65E8\u3002
- \u540C\u4E00 key \u5185\u4ECD\u8981\u8FA8\u4E49\u9879\uFF1A\u95EE\u201C\u4ECE\u54EA\u91CC\u6765/\u4F55\u56E0\u201D\u4E0D\u540C\u4E8E\u95EE\u201C\u4E3A\u4E86\u4EC0\u4E48/\u6709\u4F55\u529F\u80FD\u201D\uFF1B\u95EE\u4EBA\u751F\u76EE\u6807\u662F\u5728\u68C0\u9A8C\u751F\u6D3B\u7684\u76EE\u7684\u6216\u529F\u80FD\uFF0C\u4E0D\u662F\u5728\u8FFD\u95EE\u5FB7\u6027\u6765\u81EA\u5929\u8D4B\u3001\u6559\u80B2\u8FD8\u662F\u795E\u8D50\u3002
- \u7528\u6237\u53EA\u62A5\u544A\u67D0\u4EBA\u8BF4\u8C0E\u3001\u5931\u7EA6\u6216\u505A\u9519\u4E00\u4EF6\u4E8B\u65F6\uFF0C\u53EA\u80FD\u68C0\u9A8C\u884C\u4E3A\u4E0E\u5173\u7CFB\uFF0C\u4E0D\u80FD\u636E\u6B64\u628A\u6574\u4E2A\u4EBA\u5B9A\u6027\u4E3A\u201C\u6076\u8005\u201D\u201C\u574F\u4EBA\u201D\uFF0C\u4E5F\u4E0D\u80FD\u731C\u7528\u6237\u5176\u5B9E\u820D\u4E0D\u5F97\u4EC0\u4E48\u3002
- \u4E0D\u8FFD\u6C42\u4E16\u4FD7\u523B\u677F\u5370\u8C61\uFF1B\u6700\u8D34\u7684\u662F\u6280\u827A\u3001\u6CD5\u5F8B\u3001\u53CB\u8C0A\u3001\u5B9A\u4E49\u3001\u884C\u52A8\u7B49\u6750\u6599\u65F6\uFF0C\u5C31\u4E0D\u8981\u786C\u9009\u201C\u65E0\u77E5\u201D\u201C\u7075\u9B42\u201D\u6216\u201C\u53CD\u95EE\u201D\u3002
- \u82E5 strict \u7ED3\u6784\u5DF2\u7ECF\u660E\u786E\uFF0ClensSource=model_strict\uFF1B\u82E5\u65E5\u5E38\u8584\u4E8B\u5B9E\u53EA\u80FD\u501F\u5B8C\u6574\u7ED3\u6784\u4F5C\u7C7B\u6BD4\uFF0ClensSource=model_loose\u3002\u786E\u65E0\u5FE0\u5B9E\u6750\u6599\u65F6 usable=false\uFF0CbestId=null\u3002
- \u82E5\u5FC5\u987B\u628A\u7528\u6237\u6CA1\u6709\u8C08\u5230\u7684\u7236\u6BCD\u3001\u6CD5\u5F8B\u670D\u4ECE\u3001\u5BA1\u5224\u6216\u653F\u6CBB\u4E49\u52A1\u642C\u8FDB\u56DE\u7B54\uFF0C\u624D\u80FD\u8BF4\u660E\u5019\u9009\u4E0E\u5904\u5883\u6709\u5173\uFF0C\u8BF4\u660E\u6865\u63A5\u8FC7\u8FDC\uFF0C\u5E94\u6539\u9009\u66F4\u76F4\u63A5\u7684\u6750\u6599\u6216\u4EE4 usable=false\u3002
- path2 \u7684 bridge \u53EA\u80FD\u5199\u53CC\u65B9\u5171\u6709\u7684\u62BD\u8C61\u5173\u7CFB\uFF0C\u4E0D\u5F97\u51FA\u73B0\u539F\u5178\u6545\u4E8B\u4E2D\u7684\u68A6\u5146\u3001\u795E\u8C15\u3001\u6D1E\u7A74\u3001\u7236\u6BCD\u3001\u6CD5\u5F8B\u3001\u5BA1\u5224\u3001\u6B7B\u4EA1\u3001\u4EBA\u7269\u6216\u5730\u540D\uFF1B\u9700\u8981\u8FD9\u4E9B\u7EC6\u8282\u624D\u80FD\u8BF4\u6E05\u5173\u8054\u65F6 usable=false\u3002

\u6821\u51C6\u4F8B\uFF1A\u82E5\u8F93\u5165\u662F\u201C\u4EBA\u662F\u4E0D\u662F\u5FC5\u987B\u6709\u4E00\u4E2A\u660E\u786E\u7684\u4EBA\u751F\u76EE\u6807\u624D\u7B97\u8BA4\u771F\u6D3B\u7740\u201D\uFF0C\u5E94\u5728\u53EF\u7528\u65F6\u4F18\u5148\u9009\u62E9\u8BA8\u8BBA\u4E8B\u7269\u529F\u80FD\u5982\u4F55\u5B9E\u73B0\u5176\u4F18\u79C0\u7684 republic-352d-79\uFF0C\u800C\u4E0D\u662F\u8BA8\u8BBA\u5FB7\u6027\u6765\u6E90\u7684 meno-96d-48\u3002\u524D\u8005\u5BF9\u5E94\u201C\u4E3A\u4F55\u800C\u6D3B/\u600E\u6837\u7B97\u6D3B\u5F97\u597D\u201D\uFF0C\u540E\u8005\u56DE\u7B54\u7684\u662F\u201C\u5FB7\u6027\u4ECE\u4F55\u800C\u6765\u201D\u3002

speechAct \u4EC5\u53EF\u4E3A continue|rebuttal|consistency|refinement|question|meta\u3002
\u8F93\u51FA JSON\uFF0C\u7981\u6B62\u9644\u52A0\u6587\u5B57\uFF1A
{"condensed":"\u2026","relation":"same_focus|follow_cue|shift","speechAct":"\u2026","path":"path1|path2","hasTension":true,"lensSource":"model_strict|model_loose","lenses":[{"key":"\u2026","reinterpretation":"4\u81F318\u5B57\u5B8C\u6574\u5224\u65AD","mentionReason":"\u2026"}],"primaryLensIndex":0,"usable":true,"bestId":"\u2026","bridge":"\u2026","selectionReason":"\u2026"}`, c = JSON.stringify({ currentInput: e.userInput, routedCondensed: n.condensed, recentContext: i, allowedLenses: s.map((S) => ({ key: S.key, localHint: S.reinterpretation })), candidates: o.map((S) => ks(S, [...r])) }), u = await Be(l, c, ge, 900, 0.12, false), d = n.path, m = $t(u.lenses, d, r, e.data, e.userInput);
  if (!m.length) return { ...ue(e.userInput), condensed: typeof u.condensed == "string" ? w(u.condensed, 160) : n.condensed, path: d, candidateCount: o.length, selectionReason: "\u6A21\u578B\u672A\u8FD4\u56DE\u901A\u8FC7\u8986\u76D6\u6821\u9A8C\u7684\u900F\u955C", dialogueMove: n.dialogueMove, targetClaim: n.targetClaim, questionFocus: n.questionFocus, newContribution: n.newContribution };
  const g = typeof u.primaryLensIndex == "number" ? Math.trunc(u.primaryLensIndex) : 0, p = m[g] ?? m[0], f = u.usable === true && typeof u.bestId == "string" ? u.bestId : "", y = o.find((S) => S.entry.id === f) ?? null, k = !!(y && (p.kind === "theme" ? y.entry.themes?.includes(p.key) : y.entry.categories?.includes(p.key))), A = typeof u.bridge == "string" ? w(u.bridge, 150) : "", T = [...e.priorTurns.slice(-6).map((S) => S.content), e.userInput].join(`
`), $ = ys(T, A), q = ws(T, y, A, u.selectionReason), R = bs(T, y), L = vs(T, y, A), I = k && !$ && !q && !R && !L ? y.entry : null, O = I ? xt(I, p) : null, D = /* @__PURE__ */ new Set(["continue", "rebuttal", "consistency", "refinement", "question", "meta"]), v = typeof u.speechAct == "string" && D.has(u.speechAct) ? u.speechAct : he(e.userInput), P = u.lensSource === "model_loose" ? "model_loose" : "model_strict";
  return { path: d, condensed: typeof u.condensed == "string" && u.condensed.trim() ? w(u.condensed, 160) : n.condensed, primaryLens: p, lenses: m, entry: I, frame: O, corpusTemperament: I ? Tt(I, p) : "", speechAct: v, corpusBridge: I ? A : "", lensSource: P, selectionSource: I ? "model" : "none", hasTension: u.hasTension === true || n.hasTension, candidateCount: o.length, selectionReason: L ? "\u5019\u9009\u628A\u666E\u901A\u5DE5\u4F5C\u6216\u751F\u6D3B\u53D6\u820D\u5347\u7EA7\u4E3A\u7CBE\u795E/\u7269\u8D28\u7684\u9053\u5FB7\u6392\u5E8F\uFF0C\u5DF2\u62D2\u7EDD" : R ? "\u5019\u9009\u628A\u666E\u901A\u51B3\u7B56\u5931\u8BEF\u8BEF\u63A5\u5230\u201C\u81EA\u613F\u4F5C\u6076/\u6545\u610F\u72AF\u9519\u201D\uFF0C\u5DF2\u62D2\u7EDD" : q ? "\u5019\u9009\u628A\u7528\u6237\u62A5\u544A\u7684\u8BF4\u8C0E\u3001\u5931\u7EA6\u6216\u9519\u8BEF\u884C\u4E3A\u5347\u7EA7\u6210\u6076\u8005/\u574F\u4EBA\u5B9A\u6027\uFF0C\u5DF2\u62D2\u7EDD" : $ ? "\u5019\u9009\u9700\u8981\u642C\u5165\u7528\u6237\u672A\u8C08\u5230\u7684\u7236\u6BCD\u3001\u6CD5\u5F8B\u3001\u5BA1\u5224\u6216\u653F\u6CBB\u5173\u7CFB\uFF0C\u8FDC\u6865\u5DF2\u62D2\u7EDD" : typeof u.selectionReason == "string" ? w(u.selectionReason, 180) : I ? "\u6A21\u578B\u5728\u540C key \u5019\u9009\u4E2D\u5B8C\u6210\u4E49\u9879\u88C1\u51B3" : "\u6A21\u578B\u5224\u5B9A\u65E0\u53EF\u5FE0\u5B9E\u4F7F\u7528\u7684\u5019\u9009", dialogueMove: n.dialogueMove, targetClaim: n.targetClaim, questionFocus: n.questionFocus, newContribution: n.newContribution };
}
var xs = /* @__PURE__ */ new Set(["\u55EF", "\u54E6", "\u5594", "\u54C8", "\u554A", "\u597D", "\u884C", "\u5728\u5417", "\u4F60\u597D", "\u55E8", "\u54C8\u55BD", "hello", "hi", "\u55EF\u55EF", "\u54E6\u54E6", "\u54C8\u54C8", "\u597D\u7684", "\u597D\u5440", "\u665A\u5B89", "\u65E9\u5B89", "\u62DC\u62DC", "\u518D\u89C1", "\u77E5\u9053\u4E86", "\u6536\u5230"]);
var Ts = ["\u95EE\u592A\u591A", "\u522B\u95EE\u4E86", "\u4E0D\u8981\u95EE", "\u522B\u8FFD\u95EE", "\u50CF\u5BA1\u8BAF", "\u50CF\u5BA1\u95EE", "\u592A\u5570\u55E6"];
var $s = ["\u54C8\u54C8", "\u5F00\u73A9\u7B11", "\u9017\u4F60", "\u7B11\u6B7B", "\u80E1\u626F", "\u778E\u804A", "\u68A6\u89C1", "\u505A\u68A6", "\u602A\u5FF5\u5934"];
var Is = ["\u4EC0\u4E48\u662F", "\u4F55\u8C13", "\u5B9A\u4E49", "\u672C\u8D28", "\u516C\u6B63", "\u6B63\u4E49", "\u5FB7\u6027", "\u7F8E\u5FB7", "\u5E78\u798F\u662F\u4EC0\u4E48", "\u5584\u6076", "\u77E5\u8BC6", "\u77E5\u9053", "\u65E0\u77E5", "\u667A\u6167", "\u771F\u7406", "\u52C7\u6562", "\u8282\u5236", "\u53CB\u8C0A"];
var Ms = ["\u8981\u4E0D\u8981", "\u8BE5\u4E0D\u8BE5", "\u600E\u4E48\u529E", "\u8F9E\u804C", "\u79BB\u804C", "\u5206\u624B", "\u590D\u5408", "\u539F\u8C05", "\u644A\u724C", "\u642C\u5BB6", "\u9009\u62E9"];
var Rs = ["\u7126\u8651", "\u5BB3\u6015", "\u597D\u7D2F", "\u5F88\u7D2F", "\u7D2F\u6B7B", "\u75B2\u60EB", "\u96BE\u8FC7", "\u60F3\u54ED", "\u6124\u6012", "\u751F\u6C14", "\u5B64\u72EC", "\u7F9E\u803B", "\u5C34\u5C2C", "\u51B7\u6218", "\u80CC\u53DB", "\u5931\u604B", "\u81EA\u5351", "\u4E0D\u591F\u597D", "\u6CA1\u4EBA\u61C2", "\u5FC3\u91CC\u7A7A", "\u632B\u8D25", "\u53D7\u6253\u51FB", "\u6CAE\u4E27", "\u5931\u671B", "\u59D4\u5C48", "\u65E0\u52A9", "\u5D29\u6E83", "\u5FC3\u7D2F", "\u6491\u4E0D\u4F4F", "\u63D0\u4E0D\u8D77\u52B2", "\u5FC3\u788E", "\u5931\u53BB", "\u538B\u6291", "\u70E6\u95F7"];
var _s = ["\u5403\u996D", "\u5403\u4E86", "\u665A\u996D", "\u5348\u996D", "\u5916\u5356", "\u559D\u9152", "\u5929\u6C14", "\u4E0B\u96E8", "\u597D\u70ED", "\u597D\u51B7", "\u901A\u52E4", "\u5730\u94C1", "\u516C\u4EA4", "\u52A0\u73ED", "\u5F00\u4F1A", "\u5DE5\u4F5C", "\u540C\u4E8B", "\u8001\u677F", "\u5BB6\u52A1", "\u6D17\u7897", "\u732B", "\u72D7", "\u5BA0\u7269", "\u82B1\u94B1", "\u5237\u624B\u673A", "\u77ED\u89C6\u9891", "\u5237\u89C6\u9891", "\u670B\u53CB\u5708", "\u7F51\u8D2D", "\u6E38\u620F", "\u71AC\u591C", "\u901A\u5BB5", "\u8D77\u5E8A", "\u7761\u89C9", "\u5173\u4E1C\u716E", "\u996D\u56E2", "\u5BA4\u53CB", "\u5C0F\u7EC4\u4F5C\u4E1A"];
var It = ["\u597D\u5F00\u5FC3", "\u5F88\u5F00\u5FC3", "\u592A\u5F00\u5FC3", "\u771F\u9AD8\u5174", "\u597D\u9AD8\u5174", "\u62A2\u5230\u7968", "\u7EA6\u5230\u4E86", "\u5B89\u9759", "\u665A\u5B89", "\u65E9\u5B89", "\u53EA\u662F\u60F3\u804A\u804A"];
var Es = ["\u901A\u5BB5", "\u773C\u775B\u53D1\u5E72", "\u8111\u5B50\u8F6C\u4E0D\u52A8", "\u75C5\u4E86", "\u53D1\u70E7", "\u75BC\u5F97", "\u5598\u4E0D\u8FC7\u6C14"];
var Oe = ["\u603B\u662F", "\u4E00\u76F4", "\u5FC5\u987B", "\u5E94\u8BE5", "\u624D\u7B97", "\u6240\u6709", "\u4ECE\u4E0D", "\u80AF\u5B9A", "\u8BC1\u660E", "\u5374", "\u4F46\u662F", "\u7EA0\u7ED3", "\u62D6", "\u6CA1\u52A8\u9759", "\u622A\u6B62", "\u6765\u4E0D\u53CA", "\u4E0D\u597D\u610F\u601D", "\u592A\u54B8", "\u592A\u8D35", "\u6324", "\u4E71", "\u505C\u4E0D\u4E0B\u6765", "\u600E\u4E48\u529E", "\u8981\u4E0D\u8981", "\u8BE5\u4E0D\u8BE5"];
var Os = { thin: { minChars: 4, maxChars: 42, temperature: 0.88, topP: 0.92, storyAllowed: false }, playful: { minChars: 22, maxChars: 100, temperature: 0.92, topP: 0.94, storyAllowed: true }, daily: { minChars: 60, maxChars: 160, temperature: 0.86, topP: 0.92, storyAllowed: true }, emotion: { minChars: 55, maxChars: 165, temperature: 0.78, topP: 0.88, storyAllowed: false }, decision: { minChars: 75, maxChars: 185, temperature: 0.76, topP: 0.87, storyAllowed: false }, concept: { minChars: 85, maxChars: 195, temperature: 0.74, topP: 0.86, storyAllowed: false }, meta: { minChars: 28, maxChars: 100, temperature: 0.84, topP: 0.9, storyAllowed: true }, general: { minChars: 68, maxChars: 185, temperature: 0.84, topP: 0.91, storyAllowed: true } };
var Mt = [{ text: "\u5DE5\u5320\u4E0E\u6280\u827A\uFF1A\u77F3\u5320\u770B\u58A8\u7EBF\u3001\u978B\u5320\u91CF\u811A\u3001\u9676\u5DE5\u8FA8\u6CE5\uFF1B\u9002\u5408\u8C08\u6807\u51C6\u3001\u719F\u7EC3\u3001\u77E5\u8BC6\u4E0E\u81EA\u6B3A", hints: ["\u6807\u51C6", "\u5C3A\u5BF8", "\u6280\u827A", "\u4E13\u4E1A", "\u80FD\u529B", "\u5DE5\u4F5C", "\u51FA\u9519", "\u77E5\u8BC6", "\u77E5\u9053", "\u4E0D\u61C2", "\u65E0\u77E5", "\u62FF\u4E0D\u51C6", "\u5224\u65AD"], modes: ["concept", "general", "daily"] }, { text: "\u533B\u8005\u4E0E\u8EAB\u4F53\uFF1A\u8BCA\u65AD\u5148\u4E8E\u836F\u65B9\uFF0C\u533B\u672F\u670D\u52A1\u75C5\u4EBA\u800C\u975E\u533B\u8005\uFF1B\u9002\u5408\u8C08\u7167\u6599\u3001\u75DB\u82E6\u3001\u77E5\u8BC6\u4E0E\u5229\u76CA", hints: ["\u8EAB\u4F53", "\u7D2F", "\u75B2\u60EB", "\u75DB", "\u96BE\u53D7", "\u75C5", "\u5065\u5EB7", "\u7167\u6599", "\u53D7\u4F24", "\u7126\u8651", "\u8BCA\u65AD"], modes: ["emotion", "concept", "general"] }, { text: "\u8235\u624B\u4E0E\u822A\u6D77\uFF1A\u98CE\u5411\u3001\u822A\u7EBF\u3001\u8239\u5458\u548C\u6E2F\u53E3\u5404\u6709\u9650\u5236\uFF1B\u9002\u5408\u8C08\u9009\u62E9\u3001\u6CBB\u7406\u3001\u65B9\u5411\u4E0E\u5171\u540C\u5229\u76CA", hints: ["\u9009\u62E9", "\u65B9\u5411", "\u51B3\u5B9A", "\u6CBB\u7406", "\u9886\u5BFC", "\u56E2\u961F", "\u5229\u76CA", "\u524D\u9014", "\u8F9E\u804C", "\u8BE5\u4E0D\u8BE5", "\u8981\u4E0D\u8981"], modes: ["decision", "concept", "general"] }, { text: "\u9A6D\u9A6C\u4E0E\u8BAD\u7EC3\uFF1A\u70C8\u9A6C\u4E0D\u80FD\u9760\u558A\u53EB\u53D8\u6E29\u987A\uFF0C\u8BAD\u7EC3\u8005\u4E5F\u53EF\u80FD\u8BEF\u5224\uFF1B\u9002\u5408\u8C08\u6B32\u671B\u3001\u4E60\u60EF\u3001\u81EA\u5236\u4E0E\u6559\u80B2", hints: ["\u6B32\u671B", "\u4E60\u60EF", "\u505C\u4E0D\u4E0B\u6765", "\u77ED\u89C6\u9891", "\u5237\u89C6\u9891", "\u81EA\u5236", "\u63A7\u5236", "\u51B2\u52A8", "\u6559\u80B2"], modes: ["daily", "concept", "general"] }, { text: "\u6CD5\u5EAD\u4E0E\u966A\u5BA1\uFF1A\u8BC1\u8BCD\u3001\u540D\u58F0\u3001\u8BC1\u636E\u548C\u5224\u51B3\u5E76\u975E\u4E00\u56DE\u4E8B\uFF1B\u9002\u5408\u8C08\u6B63\u4E49\u3001\u6B3A\u9A97\u3001\u8D23\u4EFB\u4E0E\u591A\u6570\u610F\u89C1", hints: ["\u516C\u6B63", "\u6B63\u4E49", "\u8BC1\u636E", "\u8BF4\u8C0E", "\u6492\u8C0E", "\u6B3A\u9A97", "\u8D23\u4EFB", "\u591A\u6570", "\u6743\u529B", "\u5F3A\u8005", "\u516C\u5E73"], modes: ["concept", "decision", "general"] }, { text: "\u4F53\u80B2\u9986\u4E0E\u64CD\u7EC3\uFF1A\u529B\u91CF\u6765\u81EA\u53CD\u590D\u7EC3\u4E60\uFF0C\u4E5F\u53D7\u5C3A\u5EA6\u548C\u8EAB\u4F53\u9650\u5236\uFF1B\u9002\u5408\u8C08\u575A\u6301\u3001\u5931\u8D25\u3001\u8003\u8BD5\u4E0E\u8FDB\u6B65", hints: ["\u575A\u6301", "\u5931\u8D25", "\u7EC3\u4E60", "\u8003\u8BD5", "\u8003\u7814", "\u8FDB\u6B65", "\u653E\u5F03", "\u632B\u8D25", "\u8BAD\u7EC3"], modes: ["emotion", "daily", "general"] }, { text: "\u5BB6\u5C4B\u4E0E\u5BB4\u996E\uFF1A\u5EA7\u6B21\u3001\u5206\u4EAB\u3001\u9189\u610F\u548C\u8C08\u8BDD\u8003\u9A8C\u5206\u5BF8\uFF1B\u9002\u5408\u8C08\u53CB\u8C0A\u3001\u4F53\u9762\u3001\u5173\u7CFB\u4E0E\u65E5\u5E38\u76F8\u5904", hints: ["\u670B\u53CB", "\u53CB\u8C0A", "\u4F53\u9762", "\u76F8\u5904", "\u5173\u7CFB", "\u8BEF\u4F1A", "\u559D\u9152", "\u5206\u4EAB", "\u4EB2\u5BC6"], modes: ["decision", "daily", "general", "playful"] }, { text: "\u5267\u573A\u4E0E\u9762\u5177\uFF1A\u89D2\u8272\u8BF4\u5F97\u52A8\u542C\uFF0C\u4E0D\u7B49\u4E8E\u53F0\u4E0B\u7684\u4EBA\u77E5\u9053\u81EA\u5DF1\u5728\u8BF4\u4EC0\u4E48\uFF1B\u9002\u5408\u8C08\u540D\u58F0\u3001\u8868\u6F14\u4E0E\u81EA\u6211\u8BA4\u8BC6", hints: ["\u540D\u58F0", "\u89D2\u8272", "\u88C5\u61C2", "\u9762\u8BD5", "\u8868\u73B0", "\u771F\u5047", "\u81EA\u6211", "\u8BA4\u8BC6\u81EA\u5DF1", "\u8BC4\u4EF7"], modes: ["concept", "general", "daily"] }, { text: "\u519B\u9635\u4E0E\u5B88\u4F4D\uFF1A\u52C7\u6562\u4E0D\u540C\u4E8E\u5192\u8FDB\uFF0C\u64A4\u9000\u4E5F\u4E0D\u5FC5\u7B49\u4E8E\u602F\u61E6\uFF1B\u9002\u5408\u8C08\u6050\u60E7\u3001\u51B2\u7A81\u3001\u8D23\u4EFB\u4E0E\u98CE\u9669", hints: ["\u52C7\u6562", "\u5BB3\u6015", "\u6050\u60E7", "\u8D23\u4EFB", "\u5192\u9669", "\u9000\u7F29", "\u51B2\u7A81", "\u98CE\u9669", "\u5BF9\u6297"], modes: ["concept", "decision", "emotion"] }, { text: "\u7530\u5730\u4E0E\u6A44\u6984\u6811\uFF1A\u7167\u6599\u6709\u65F6\u8282\uFF0C\u4E0D\u80FD\u9760\u62C9\u626F\u5E7C\u82D7\u50AC\u957F\uFF1B\u9002\u5408\u8C08\u7B49\u5F85\u3001\u6210\u957F\u3001\u65F6\u95F4\u4E0E\u7ED3\u679C", hints: ["\u6210\u957F", "\u7B49\u5F85", "\u7740\u6025", "\u7ED3\u679C", "\u65F6\u95F4", "\u8010\u5FC3", "\u517B\u6210", "\u8BA1\u5212", "\u6765\u4E0D\u53CA"], modes: ["daily", "emotion", "general"] }];
var Rt = Mt.map(({ text: e }) => e);
function U(e) {
  return e.toLowerCase().replace(/[\s，。！？；：、“”‘’（）()【】\[\],.!?;:'"-]+/g, "");
}
function E(e, t) {
  const n = e.toLowerCase();
  return t.some((s) => n.includes(s.toLowerCase()));
}
function fe(e) {
  const n = [...U(e)], s = /* @__PURE__ */ new Set();
  for (let o = 0; o < n.length - 1; o += 1) s.add(n[o] + n[o + 1]);
  return s;
}
function ie(e, t, n = 8) {
  const s = fe(t);
  let o = 0;
  for (const r of fe(e)) if (s.has(r) && (o += 1), o >= n) break;
  return o;
}
function Ye(e, t) {
  const n = U(e ?? "");
  if (!n || !t?.length) return false;
  const s = fe(n);
  return t.some((o) => {
    const r = U(o);
    if (!r) return false;
    if (n === r || Math.min(n.length, r.length) >= 10 && (n.includes(r) || r.includes(n))) return true;
    const i = fe(r);
    if (!s.size || !i.size) return false;
    let l = 0;
    for (const c of s) i.has(c) && (l += 1);
    return l / Math.min(s.size, i.size) >= 0.68;
  });
}
function Ps(e, t) {
  const n = U(t), s = U(e ?? "");
  return !s || n.length < 5 || s.includes(n) || n.includes(s) ? true : ie(s, n, 2) >= 1;
}
function _t(e) {
  const t = e.trim(), n = U(t);
  return !t || xs.has(t.toLowerCase()) || n.length <= 4 && /^[嗯哦喔哈啊好行嗨嘿]+$/u.test(n) ? "thin" : E(t, Ts) ? "meta" : E(t, $s) ? "playful" : E(t, Is) ? "concept" : E(t, Rs) ? "emotion" : E(t, Ms) ? "decision" : E(t, _s) ? "daily" : "general";
}
function Ls(e, t, n) {
  return Ss(e, t, n);
}
function Ds(e) {
  return e.filter((t) => t.role === "assistant").slice(-2).filter((t) => /[？?]/.test(t.content)).length;
}
function Bs(e, t, n, s) {
  if (e === "meta" || e === "thin" || e === "playful" || s.questionCooldown > 0 || s.consecutiveQuestionTurns >= 2 || Ds(n) >= 2) return 0;
  const o = /[？?]|怎么办|怎么选|该不该|要不要|你觉得|请问/.test(t);
  return E(t, It) || E(t, Es) && !o ? 0 : e === "emotion" ? o ? 1 : 0 : e === "concept" || e === "decision" ? 1 : e === "daily" ? o || E(t, Oe) ? 1 : 0 : o || E(t, Oe) || U(t).length >= 10 ? 1 : 0;
}
function qs(e, t) {
  return t === "thin" || t === "playful" || t === "meta" || E(e, It) || t === "daily" && !/[？?]/u.test(e) && !E(e, Oe) ? "companionable_observation" : /朋友|友谊|关系/u.test(e) && /说谎|撒谎|欺骗|失约/u.test(e) ? "definition" : /前后|矛盾|双标|承诺|说到做到|失约/u.test(e) ? "consistency_test" : /专家|权威|专业|资格|知道|确信|肯定/u.test(e) ? "knowledge_test" : /目的|目标|为了|有何用|有什么用|值得|利益/u.test(e) ? "means_and_end" : /所有|人人|每个|必须|总是|从不|一定|唯一|完全|绝不/u.test(e) ? "counterexample" : t === "concept" || /什么是|何谓|定义|本质|算不算|才算/u.test(e) ? "definition" : /看什么|如何判断|怎么判断|什么标准|凭什么判断/u.test(e) ? "knowledge_test" : t === "emotion" ? "provisional_aporia" : "premise_test";
}
function Pe(e, t) {
  if (e === "companionable_observation") return e;
  const n = { definition: "counterexample", premise_test: "counterexample", counterexample: "consistency_test", consistency_test: "means_and_end", means_and_end: "knowledge_test", knowledge_test: "provisional_aporia", provisional_aporia: "definition" }, s = new Set(t.recentDialecticMoves ?? (t.lastDialecticMove ? [t.lastDialecticMove] : []));
  let o = e;
  for (let r = 0; r < 5 && s.has(o) && o !== "companionable_observation"; r += 1) o = n[o];
  return o;
}
function Ns(e) {
  return e && (/* @__PURE__ */ new Set(["definition", "premise_test", "counterexample", "consistency_test", "means_and_end", "knowledge_test", "provisional_aporia"])).has(e) ? e : null;
}
function Fs(e, t = 0, n, s) {
  const o = s ?? _t(e), r = typeof n == "string" ? [n] : [...n ?? []], i = Mt.map((u, d) => {
    let m = u.modes.includes(o) ? 1 : 0;
    for (const p of u.hints) e.toLowerCase().includes(p.toLowerCase()) ? m += 4 + Math.min([...p].length, 4) * 0.25 : m += Math.min(ie(p, e, 4), 3) * 0.15;
    const g = r.indexOf(u.text);
    return g >= 0 && (m -= Math.max(3, 8 - g)), { profile: u, index: d, score: m };
  }).sort((u, d) => d.score - u.score || u.index - d.index), l = i[0]?.score ?? 0, c = i.filter(({ score: u }) => Math.abs(u - l) < 0.01);
  return c[je(`${e}|${t}`, c.length)]?.profile.text ?? Rt[0];
}
function js(e, t, n) {
  return n === "thin" || n === "meta" ? false : t === 0 ? n === "emotion" || je(`${e}|address`, 4) === 0 : t % 4 === 1;
}
function Us(e, t) {
  return t === "thin" || t === "meta" || t === "playful" ? false : e === 0 ? t === "concept" : e % 4 === 3;
}
function Hs(e) {
  return e === "daily" || e === "emotion" || e === "decision" || e === "concept" || e === "general";
}
function Ks(e) {
  const t = _t(e.userInput), n = e.state.roleRuntime?.socratesDialogueState ?? { turnCount: 0, questionCooldown: 0, consecutiveQuestionTurns: 0 }, s = Os[t], o = Pe(qs(e.userInput, t), n), r = o === "companionable_observation", i = Ls(e.userInput, e.data, e.excludedIds ?? e.state.usedCorpusIds);
  return { mode: t, questionBudget: Bs(t, e.userInput, e.priorTurns, n), analogyDomain: Fs(e.userInput, n.turnCount, n.recentAnalogyDomains ?? (n.lastAnalogyDomain ? [n.lastAnalogyDomain] : []), t), friendlyAddress: js(e.userInput, n.turnCount, t), visibleUncertaintyAllowed: Us(n.turnCount, t), hiddenReflection: Hs(t) && !r, ...s, ...r ? { minChars: 18, maxChars: 88 } : {}, dialecticMove: o, abstractConcept: t === "concept" && !/(?:我|自己|我的|本人)/u.test(e.userInput), retrieval: i };
}
async function Gs(e, t) {
  if (t.mode === "thin" || t.mode === "playful" || t.mode === "meta") return t;
  if (t.dialecticMove === "companionable_observation") return { ...t, retrieval: { ...t.retrieval, primaryLens: null, lenses: [], entry: null, frame: null, corpusTemperament: "", corpusBridge: "", lensSource: "empty", selectionSource: "none", candidateCount: 0, selectionReason: "\u8584\u4E8B\u5B9E\u6216\u8F7B\u5206\u4EAB\u91C7\u7528\u966A\u4F34\u89C2\u5BDF\uFF0C\u4E0D\u8C03\u7528\u539F\u5178\u8BED\u6599" } };
  if (/(?:吃|饭|菜|汤|饮料|咖啡|茶|关东煮|零食|味道)/u.test(e.userInput) && /(?:咸|甜|辣|酸|苦|腻|淡|好吃|难吃|口味)/u.test(e.userInput)) return { ...t, dialecticMove: "definition", retrieval: { ...t.retrieval, primaryLens: null, lenses: [], entry: null, frame: null, corpusTemperament: "", corpusBridge: "", lensSource: "empty", selectionSource: "none", hasTension: true, candidateCount: 0, selectionReason: "\u4F4E\u98CE\u9669\u5473\u89C9\u95EE\u9898\u76F4\u63A5\u8FA8\u660E\u4E2A\u4EBA\u5C3A\u5EA6\u4E0E\u5177\u4F53\u5403\u6CD5\uFF0C\u4E0D\u8C03\u7528\u539F\u5178\u786C\u5957\u77E5\u8BC6\u95EE\u9898", dialogueMove: "definition", targetClaim: e.userInput.trim(), newContribution: "\u533A\u5206\u4E2A\u4EBA\u53E3\u5473\u3001\u5177\u4F53\u914D\u6599\u6216\u5403\u6CD5\u4E0E\u4E00\u822C\u5C3A\u5EA6\uFF1B\u672A\u7ED9\u51FA\u7684\u6210\u5206\u3001\u542B\u91CF\u548C\u8EAB\u4F53\u53CD\u5E94\u4FDD\u6301\u4E0D\u77E5\u9053", questionFocus: "\u201C\u592A\u54B8\u201D\u7B49\u5224\u65AD\u91C7\u7528\u4E2A\u4EBA\u53E3\u5473\u3001\u5177\u4F53\u5403\u6CD5\u8FD8\u662F\u53EF\u6D4B\u91CF\u7684\u542B\u91CF\u6807\u51C6" } };
  const s = /[？?]|怎么办|为什么|为何|如何|意义|该不该|要不要|怎么看/u.test(e.userInput);
  if (t.mode === "emotion" && !s) {
    const f = e.state.roleRuntime?.socratesDialogueState ?? {}, y = Pe("provisional_aporia", f);
    return { ...t, dialecticMove: y, retrieval: { ...t.retrieval, primaryLens: null, lenses: [], entry: null, frame: null, corpusTemperament: "", corpusBridge: "", lensSource: "empty", selectionSource: "none", hasTension: true, candidateCount: 0, selectionReason: "\u7528\u6237\u53EA\u9648\u8FF0\u5F53\u4E0B\u75DB\u695A\uFF1B\u4E0D\u8C03\u7528\u8BED\u6599\u66FF\u5176\u53D1\u660E\u53CD\u601D\u3001\u76EE\u6807\u6216\u9690\u85CF\u9700\u8981", dialogueMove: y, targetClaim: e.userInput.trim(), newContribution: `\u53EA\u8FA8\u660E\u672C\u8F6E\u660E\u8BF4\u7684\u72B6\u6001\u201C${e.userInput.trim()}\u201D\u80FD\u8BC1\u660E\u4EC0\u4E48\u3001\u4E0D\u80FD\u8BC1\u660E\u4EC0\u4E48\uFF1B\u628A\u540E\u7EED\u4FDD\u6301\u4E3A\u672A\u77E5\uFF0C\u4E0D\u63A8\u65AD\u9690\u85CF\u76EE\u6807`, questionFocus: "" } };
  }
  const o = await As({ userInput: e.userInput, priorTurns: e.priorTurns, data: e.data, usedIds: e.excludedIds ?? e.state.usedCorpusIds, recentMoves: e.state.roleRuntime?.socratesDialogueState?.recentDialecticMoves, recentTargetClaims: e.state.roleRuntime?.socratesDialogueState?.recentTargetClaims, recentContributions: e.state.roleRuntime?.socratesDialogueState?.recentContributions }), r = Ns(o.dialogueMove), i = e.state.roleRuntime?.socratesDialogueState ?? {}, l = Ye(o.targetClaim, i.recentTargetClaims), c = !Ps(o.targetClaim, e.userInput), u = Ye(o.newContribution, i.recentContributions), d = l || c ? e.userInput.trim() : o.targetClaim, m = u || l || c ? `\u53EA\u4ECE\u672C\u8F6E\u65B0\u589E\u4FE1\u606F\u201C${e.userInput.trim()}\u201D\u8FA8\u660E\u5B83\u6539\u53D8\u4E86\u54EA\u9879\u8BC1\u636E\u6216\u8FB9\u754C\uFF1B\u82E5\u5C1A\u4E0D\u8DB3\u4EE5\u6539\u53D8\u5224\u65AD\uFF0C\u5C31\u6307\u51FA\u4ECD\u7F3A\u7684\u53EF\u89C2\u5BDF\u4E8B\u5B9E` : o.newContribution, p = /(?:看什么|看哪些|判断标准|如何判断|怎么判断|依据什么|凭什么判断)/u.test(e.userInput) ? "knowledge_test" : r ? Pe(r, i) : t.dialecticMove;
  return { ...t, dialecticMove: p, retrieval: { ...o, targetClaim: d, newContribution: m, questionFocus: l || c ? "\u53EA\u68C0\u9A8C\u672C\u8F6E\u65B0\u589E\u4FE1\u606F\u5E26\u6765\u7684\u65B0\u8FB9\u754C\uFF0C\u4E0D\u91CD\u590D\u8FD1\u8F6E\u5DF2\u7ECF\u95EE\u8FC7\u7684\u7406\u7531\u6216\u7ED3\u8BBA" : o.questionFocus, selectionReason: [o.selectionReason, l || c || u ? "\u89C4\u5212\u6458\u8981\u91CD\u590D\u6216\u8131\u79BB\u672C\u8F6E\u8F93\u5165\uFF0C\u5DF2\u7531\u4EE3\u7801\u6539\u4E3A\u672C\u8F6E\u589E\u91CF" : ""].filter(Boolean).join("\uFF5C") } };
}
function Js(e) {
  switch (e) {
    case "thin":
      return "\u8FD9\u662F\u77ED\u5BD2\u6684\uFF1A\u81EA\u7136\u56DE\u4E00\u4E24\u53E5\uFF0C\u4E0D\u5347\u683C\u6210\u54F2\u5B66\u8BFE\uFF0C\u4E0D\u53D1\u95EE\u3002";
    case "playful":
      return "\u987A\u7740\u73A9\u7B11\u8BF4\uFF0C\u53EF\u8F7B\u8F7B\u80E1\u626F\u4E00\u5E45\u660E\u786E\u662F\u60F3\u8C61\u7684\u5C0F\u753B\u9762\uFF1B\u6709\u5185\u5BB9\u4F46\u4E0D\u8BB2\u8BFE\uFF0C\u4E0D\u53D1\u95EE\uFF0C\u4E5F\u4E0D\u8981\u6BCF\u6B21\u90FD\u628A\u753B\u9762\u653E\u5728\u5E02\u96C6\u3002";
    case "daily":
      return "\u65E5\u5E38\u5904\u5883\u91CC\u82E5\u6709\u660E\u786E\u5224\u65AD\u3001\u51B2\u7A81\u6216\u5C3A\u5EA6\uFF0C\u5C31\u68C0\u9A8C\u5176\u4E2D\u4E00\u9879\uFF1B\u82E5\u53EA\u662F\u62A5\u544A\u4E00\u4EF6\u5C0F\u63D2\u66F2\uFF0C\u5C31\u81EA\u7136\u63A5\u8BDD\uFF0C\u4E0D\u8FFD\u95EE\u539F\u56E0\u3001\u4E0D\u8D4B\u4E88\u8C61\u5F81\u610F\u4E49\uFF0C\u4E5F\u4E0D\u786C\u62AC\u6210\u54F2\u5B66\u8BB2\u5EA7\u3002";
    case "emotion":
      return "\u53EA\u627F\u8BA4\u7528\u6237\u660E\u8BF4\u7684\u635F\u5931\u3001\u75B2\u60EB\u6216\u75DB\u695A\uFF0C\u518D\u7ED9\u6E29\u548C\u800C\u6709\u9650\u7684\u6682\u5B9A\u5224\u65AD\uFF1B\u4E0D\u66FF\u7528\u6237\u5BA3\u5E03\u9690\u85CF\u52A8\u673A\u3001\u4EBA\u683C\u4E0E\u672A\u6765\uFF0C\u4E0D\u628A\u53D7\u82E6\u8BF4\u6210\u503C\u5F97\u3001\u6210\u957F\u6216\u8003\u9A8C\uFF0C\u4E0D\u7528\u5FC3\u7406\u54A8\u8BE2\u8BDD\u672F\u3002\u82E5\u4E00\u4E2A\u7B80\u77ED\u7C7B\u6BD4\u786E\u80FD\u6F84\u6E05\u5904\u5883\uFF0C\u53EF\u4EE5\u4F7F\u7528\uFF0C\u4F46\u4E0D\u80FD\u906E\u4F4F\u75DB\u695A\u6216\u66FF\u75DB\u82E6\u5236\u9020\u610F\u4E49\u3002";
    case "decision":
      return "\u628A\u4E24\u79CD\u9009\u62E9\u5404\u81EA\u4FDD\u62A4\u548C\u727A\u7272\u7684\u4E1C\u897F\u6446\u5F00\uFF0C\u5148\u7ED9\u6682\u5B9A\u5224\u65AD\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u7559\u4E00\u4E2A\u95EE\u9898\u3002";
    case "concept":
      return "\u5148\u7ED9\u6682\u5B9A\u56DE\u7B54\uFF0C\u518D\u533A\u5206\u6982\u5FF5\u3001\u7ED9\u51FA\u8FB9\u754C\u6216\u53CD\u4F8B\uFF1B\u50CF\u5728\u5171\u540C\u68C0\u9A8C\u5B9A\u4E49\uFF0C\u800C\u4E0D\u662F\u53D1\u8868\u6F14\u8BF4\u3002\u95EE\u53E5\u53EA\u80FD\u7528\u4E8E\u6700\u540E\u4E00\u6B65\u68C0\u9A8C\uFF0C\u4E0D\u80FD\u4EE5\u95EE\u4EE3\u7B54\u3002";
    case "meta":
      return "\u5BF9\u65B9\u5ACC\u95EE\u9898\u591A\uFF1A\u7ACB\u523B\u505C\u95EE\uFF0C\u6539\u6210\u76F4\u8BF4\u6216\u8BB2\u4E00\u5219\u77ED\u89C1\u95FB\uFF0C\u627F\u8BA4\u8C08\u8BDD\u5F62\u5F0F\u9700\u8981\u6362\u6321\u3002";
    case "general":
      return "\u56DE\u5E94\u672C\u8F6E\u7684\u5177\u4F53\u4EBA\u4E8B\uFF0C\u7ED9\u4E00\u5C42\u53EF\u590D\u8FF0\u3001\u53EF\u88AB\u53CD\u9A73\u7684\u6682\u5B9A\u5224\u65AD\uFF1B\u53EF\u5076\u5C14\u7528\u6280\u827A\u6216\u751F\u6D3B\u7C7B\u6BD4\uFF0C\u4F46\u4E0D\u8981\u628A\u6BCF\u8F6E\u90FD\u505A\u6210\u76D8\u95EE\u3002";
  }
}
function Ze(e) {
  switch (e) {
    case "companionable_observation":
      return "\u966A\u5BF9\u65B9\u770B\u6E05\u773C\u524D\u7ECF\u9A8C\u4E2D\u4E00\u4E2A\u5BB9\u6613\u5FFD\u7565\u7684\u5C42\u6B21\uFF1B\u53EF\u4EE5\u6E29\u6696\u3001\u673A\u654F\u6216\u8F7B\u8F7B\u80E1\u626F\uFF0C\u4E0D\u5F3A\u884C\u8BB2\u9053\u7406\u3002";
    case "definition":
      return "\u627E\u51FA\u7528\u6237\u5224\u65AD\u4E2D\u627F\u91CD\u7684\u5173\u952E\u8BCD\uFF0C\u7ED9\u51FA\u4E00\u4E2A\u6682\u5B9A\u8FB9\u754C\uFF0C\u518D\u7528\u4E00\u4E2A\u95EE\u9898\u6216\u53CD\u4F8B\u68C0\u9A8C\u8FD9\u4E2A\u5B9A\u4E49\u662F\u5426\u8FC7\u5BBD\u6216\u8FC7\u7A84\u3002";
    case "premise_test":
      return "\u628A\u539F\u8BDD\u4E2D\u53EF\u80FD\u5B58\u5728\u7684\u524D\u63D0\u660E\u786E\u5199\u6210\u4E00\u4E2A\u201C\u5982\u679C\u2026\u2026\u90A3\u4E48\u2026\u2026\u201D\u7684\u5F85\u68C0\u9A8C\u547D\u9898\uFF0C\u518D\u68C0\u9A8C\u5B83\u662F\u5426\u5FC5\u7136\u6210\u7ACB\uFF1B\u4E0D\u5F97\u8BF4\u201C\u4F60\u5176\u5B9E\u3001\u4F60\u6015\u7684\u662F\u3001\u4F60\u628A\u67D0\u4E8B\u5F53\u6210\u4E86\u67D0\u79CD\u5185\u5FC3\u4FE1\u53F7\u201D\uFF0C\u4E5F\u4E0D\u8981\u505C\u5728\u884C\u52A8\u6E05\u5355\u3002";
    case "counterexample":
      return "\u9488\u5BF9\u7528\u6237\u8BDD\u91CC\u7684\u5168\u79F0\u3001\u5FC5\u7136\u6216\u552F\u4E00\u5C3A\u5EA6\u7ED9\u51FA\u4E00\u4E2A\u5177\u4F53\u53CD\u4F8B\uFF0C\u8FEB\u4F7F\u539F\u5224\u65AD\u6536\u7A84\uFF0C\u800C\u4E0D\u662F\u76F4\u63A5\u5BA3\u5E03\u5B83\u9519\u8BEF\u3002";
    case "consistency_test":
      return "\u628A\u7528\u6237\u5DF2\u7ECF\u627F\u8BA4\u7684\u4E24\u9879\u5224\u65AD\u5E76\u7F6E\uFF0C\u68C0\u9A8C\u5B83\u4EEC\u80FD\u5426\u540C\u65F6\u6210\u7ACB\uFF1B\u53EA\u63ED\u793A\u77DB\u76FE\uFF0C\u4E0D\u66FF\u7528\u6237\u731C\u52A8\u673A\u3002";
    case "means_and_end":
      return "\u533A\u5206\u624B\u6BB5\u3001\u773C\u524D\u76EE\u6807\u548C\u7528\u6237\u5DF2\u7ECF\u660E\u8BF4\u6216\u53EF\u89C2\u5BDF\u7684\u5229\u76CA\uFF0C\u68C0\u9A8C\u624B\u6BB5\u662F\u5426\u53CD\u8FC7\u6765\u906E\u4F4F\u4E86\u76EE\u7684\uFF1B\u672A\u8BF4\u51FA\u7684\u201C\u771F\u6B63\u76EE\u7684\u3001\u4EF7\u503C\u3001\u5728\u610F\u4E4B\u7269\u201D\u53EA\u80FD\u4FDD\u6301\u672A\u77E5\uFF0C\u4E0D\u5F97\u66FF\u7528\u6237\u8865\u5199\u3002";
    case "knowledge_test":
      return "\u68C0\u9A8C\u8BF4\u8BDD\u8005\u51ED\u4EC0\u4E48\u58F0\u79F0\u77E5\u9053\uFF1A\u540D\u58F0\u3001\u804C\u4F4D\u3001\u786E\u4FE1\u548C\u771F\u6B63\u80FD\u8BF4\u660E\u7406\u7531\u7684\u77E5\u8BC6\u5E76\u4E0D\u662F\u4E00\u56DE\u4E8B\u3002";
    case "provisional_aporia":
      return "\u627F\u8BA4\u773C\u4E0B\u4E8B\u5B9E\u548C\u5224\u65AD\u4E4B\u95F4\u4ECD\u6709\u7A7A\u7F3A\uFF0C\u7F29\u5C0F\u8FC7\u6EE1\u7684\u7ED3\u8BBA\uFF1B\u7ED9\u51FA\u53EF\u7EE7\u7EED\u5171\u540C\u8FA8\u8BA4\u7684\u754C\u7EBF\uFF0C\u4E0D\u628A\u75DB\u82E6\u89E3\u91CA\u6210\u6559\u8BAD\u3002";
  }
}
function je(e, t) {
  let n = 2166136261;
  for (const s of e) n ^= s.codePointAt(0) ?? 0, n = Math.imul(n, 16777619);
  return t ? Math.abs(n) % t : 0;
}
function Ws(e, t) {
  if (!t.storyAllowed) return null;
  const n = e.state.roleRuntime?.socratesDialogueState;
  if (!(t.mode === "meta" || t.mode === "playful" || (n?.turnCount ?? 0) % 3 === 1)) return null;
  const o = (e.data.experiences.experiences ?? []).filter((i) => {
    const l = typeof i.monologue == "string" ? i.monologue : "", c = e.priorTurns.filter((u) => u.role === "assistant").some((u) => ie(l, u.content, 8) >= 4);
    return !!l && !l.includes("\u82CF\u683C\u62C9\u5E95") && !c;
  });
  if (!o.length) return null;
  const r = o.map((i) => ({ entry: i, score: ie(`${i.title ?? ""}${i.monologue ?? ""}`, e.userInput, 6) })).sort((i, l) => l.score - i.score);
  return (r[0]?.score ?? 0) >= 2 ? r[0].entry : t.mode === "playful" || t.mode === "meta" ? o[je(e.userInput, o.length)] ?? null : null;
}
function re(e) {
  return e.match(/[^。！？!?…]+[。！？!?…]?/gu)?.map((t) => t.trim()).filter(Boolean) ?? [];
}
var Xs = [["\u978B\u5320", "\u77F3\u5320", "\u9676\u5DE5", "\u58A8\u7EBF", "\u6CE5\u576F", "\u91CF\u811A"], ["\u533B\u8005", "\u836F\u65B9", "\u8BCA\u65AD", "\u75C5\u4EBA", "\u533B\u672F"], ["\u8235\u624B", "\u822A\u6D77", "\u822A\u7EBF", "\u6E2F\u53E3", "\u98CE\u5411", "\u8239\u5458", "\u504F\u822A"], ["\u9A6D\u9A6C", "\u70C8\u9A6C", "\u7F30\u7EF3", "\u9A6C\u5339", "\u9A6F\u9A6C"], ["\u6CD5\u5EAD", "\u966A\u5BA1", "\u8BC1\u8BCD", "\u5224\u51B3", "\u5BA1\u5224\u5B98"], ["\u4F53\u80B2\u9986", "\u64CD\u7EC3\u573A", "\u6454\u8DE4\u624B", "\u7ADE\u6280\u573A"], ["\u5BB4\u996E", "\u9152\u676F", "\u5EA7\u6B21", "\u5BB6\u5C4B"], ["\u5267\u573A", "\u9762\u5177", "\u6F14\u5458", "\u53F0\u4E0A", "\u53F0\u4E0B"], ["\u519B\u9635", "\u76FE\u724C", "\u5B88\u4F4D", "\u5217\u9635", "\u64A4\u9000"], ["\u6A44\u6984\u6811", "\u5E7C\u82D7", "\u7530\u5730", "\u519C\u592B", "\u8015\u79CD"], ["\u5E7F\u573A", "\u5E02\u96C6", "\u644A\u8D29"], ["\u6D1E\u7A74", "\u6697\u5C4B", "\u6697\u5BA4", "\u4EAE\u5904", "\u5149\u4EAE", "\u773C\u82B1", "\u7729\u6655"], ["\u70EB\u624B", "\u70EB", "\u706B\u82D7", "\u706B\u7130", "\u707C"]];
function K(e) {
  return U(e).replace(/^我的朋友/u, "").replace(/^朋友/u, "");
}
function et(e, t) {
  const n = [...K(e)], s = /* @__PURE__ */ new Set();
  for (let o = 0; o <= n.length - t; o += 1) s.add(n.slice(o, o + t).join(""));
  return s;
}
function Qs(e, t, n = 4) {
  const s = et(e, n), o = et(t, n);
  if (!s.size || !o.size) return 0;
  let r = 0;
  for (const i of s) o.has(i) && (r += 1);
  return r / Math.min(s.size, o.size);
}
function tt(e) {
  return Xs.map((t, n) => t.some((s) => e.includes(s)) ? n : -1).filter((t) => t >= 0);
}
function Vs(e, t) {
  const n = /* @__PURE__ */ new Set(), s = e.trim(), o = K(s);
  if (!o) return [];
  const r = re(s).map(K).filter((c) => [...c].length >= 8), i = re(s).filter((c) => /[？?]/u.test(c)).map(K), l = tt(s);
  for (const c of t) {
    const u = K(c);
    if (!u) continue;
    const d = Math.min([...o].length, [...u].length);
    o === u && n.add("\u4E0E\u8FD1\u671F\u56DE\u590D\u6574\u6BB5\u590D\u8BFB"), d >= 18 && (o.includes(u) || u.includes(o)) && n.add("\u4E0E\u8FD1\u671F\u56DE\u590D\u5927\u6BB5\u91CD\u590D"), d >= 24 && Qs(o, u) >= 0.52 && n.add("\u4E0E\u8FD1\u671F\u56DE\u590D\u63AA\u8F9E\u548C\u7ED3\u6784\u8FC7\u8FD1"), d >= 16 && (o.slice(0, 10) === u.slice(0, 10) && n.add("\u590D\u7528\u8FD1\u671F\u56FA\u5B9A\u5F00\u573A"), o.slice(-10) === u.slice(-10) && n.add("\u590D\u7528\u8FD1\u671F\u56FA\u5B9A\u6536\u675F"));
    const m = re(c).map(K);
    r.some((f) => m.some((y) => f === y || [...f].length >= 14 && [...y].length >= 14 && (f.includes(y) || y.includes(f)))) && n.add("\u590D\u7528\u8FD1\u671F\u53E5\u5B50\u6216\u957F\u8BCD\u7EC4");
    const g = re(c).filter((f) => /[？?]/u.test(f)).map(K);
    i.some((f) => g.includes(f)) && n.add("\u91CD\u590D\u8FD1\u671F\u5DF2\u7ECF\u95EE\u8FC7\u7684\u95EE\u9898");
    const p = tt(c);
    l.some((f) => p.includes(f)) && n.add("\u91CD\u590D\u4F7F\u7528\u8FD1\u671F\u7C7B\u6BD4\u6216\u573A\u666F");
  }
  return [...n];
}
function Ys(e, t) {
  const n = re(e), s = n.map((i, l) => /[？?]/.test(i) ? l : -1).filter((i) => i >= 0);
  if (s.length <= t) return e;
  const o = t === 1 ? s.at(-1) : void 0, r = n.filter((i, l) => !/[？?]/.test(i) || l === o);
  return r.length ? r.join("") : n[0]?.replace(/[吗呢么]?[？?]+/g, "\u3002") ?? "";
}
function Zs(e) {
  return e.replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/i, "").replace(/^[（(][^）)]{0,40}[）)]\s*/u, "").replace(/(?:作为|身为)(?:一名|一个)?(?:苏格拉底|哲学家|AI|人工智能)[，,:：]?/gu, "").replace(/我(?:就)?是苏格拉底(?:本人)?/gu, "\u6211\u5C31\u5728\u8FD9\u91CC").replace(/苏格拉底(?:认为|会说|想说)/gu, "\u6211\u4EE5\u4E3A").replace(/苏格拉底/gu, "\u6211").replace(/接住了/gu, "\u542C\u89C1\u4E86").replace(/接住/gu, "\u56DE\u5E94").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
function Te(e, t, n = null, s = []) {
  const o = [], r = e.trim();
  r || o.push("\u7A7A\u56DE\u590D"), /苏格拉底|作为(?:哲学家|AI)|接住(?:了)?|本轮|场景键|语料|提示词|态度档|用户(?:输入|原话)/u.test(r) && o.push("\u66B4\u9732\u89D2\u8272\u6216\u540E\u53F0\u63AA\u8F9E"), /候选(?:回答|台词)|初稿|终稿|审稿|检查过程|(?:我|让我们)(?:也|先|得)?自问|我(?:也|先|得)?问问自己/u.test(r) && o.push("\u66B4\u9732\u9690\u85CF\u81EA\u8BD8\u8FC7\u7A0B"), /抱抱你|我理解你的感受|我能感受到|听起来你|允许自己|情绪价值|正念|疗愈|赋能/u.test(r) && o.push("\u901A\u7528\u54A8\u8BE2\u6216\u5BA2\u670D\u8154"), /证明你(?:确实|仍|其实)|说明你(?:其实|内心)|你(?:其实|真正|只是|分明)(?:想|怕|惧怕|担心|在|是|不)/u.test(r) && o.push("\u66FF\u7528\u6237\u8865\u5199\u672A\u660E\u8BF4\u7684\u5185\u5FC3\u4E8B\u5B9E"), /你[^。！？]{0,14}真正(?:看重|想要|在意|追求|要去)|你认作值得|你要去的地方/u.test(r) && o.push("\u66FF\u7528\u6237\u8865\u5199\u672A\u660E\u8BF4\u7684\u4EF7\u503C\u6216\u76EE\u6807"), /你(?:所)?怕的不是|你不敢[^。！？]{0,28}(?:其实|真正|是因为)|你不好意思[^。！？]{0,20}(?:其实|就是|等于)/u.test(r) && o.push("\u628A\u7528\u6237\u660E\u8BF4\u7684\u72B9\u8C6B\u6539\u5199\u6210\u9690\u85CF\u52A8\u673A"), /你把[^。！？]{0,28}当成了?(?:怕|担心|不愿|不敢|维护关系|伤人)的?(?:信号|证明|表现)?/u.test(r) && o.push("\u7528\u65AD\u8A00\u66FF\u7528\u6237\u8865\u5199\u5FC3\u7406\u524D\u63D0"), t.abstractConcept && /当你[^。！？]{0,32}时|你平时|你是否曾|当你说自己|你(?:觉得|认为|怀疑|责怪)自己|你(?:不够|没有)(?:勇敢|善良|正义|智慧|节制)/u.test(r) && o.push("\u628A\u62BD\u8C61\u6982\u5FF5\u9898\u64C5\u81EA\u5957\u5230\u7528\u6237\u672C\u4EBA"), /你(?:是在)?假装(?:自己)?[^。！？]{0,28}(?:知道|能|可以|有本事)|难受[^。！？]{0,24}(?:已经)?证明/u.test(r) && o.push("\u628A\u6682\u5B9A\u89E3\u91CA\u8BF4\u6210\u7528\u6237\u52A8\u673A\u6216\u8BC1\u660E"), /你(?:此刻|其实|真正|内心|之所以)?(?:舍不得|放不下|不肯|执着于|眷恋)[^。！？]{0,36}(?:还是|其实|因为)|你担心的究竟是[^。！？]{0,36}还是|你(?:愿意|仍然|还想)[^。！？]{0,28}是因为[^。！？]{0,28}还是|(?:还是|只是)因为(?:你)?(?:舍不得|放不下|不肯|执着于|眷恋)/u.test(r) && o.push("\u628A\u672A\u660E\u8BF4\u7684\u52A8\u673A\u505A\u6210\u4E8C\u9009\u4E00\u76D8\u95EE"), /(?:他|她|对方|那人)(?:就是|是个|本是)(?:恶者|坏人)|因为[^。！？]{0,24}(?:说谎|失约)[^。！？]{0,24}(?:恶者|坏人)/u.test(r) && o.push("\u7531\u5355\u6B21\u884C\u4E3A\u6B66\u65AD\u5B9A\u6027\u6574\u4E2A\u4EBA"), t.mode === "emotion" && /不算白受|没有白受|都是值得|让你成长|磨炼了你|一份礼物|一种考验/u.test(r) && o.push("\u7F8E\u5316\u6216\u5408\u7406\u5316\u75DB\u82E6"), !t.visibleUncertaintyAllowed && /我(?:未必|并不)(?:已经)?知道|我眼下只能(?:这样|先这么)?看|若(?:这个|这一区分|这判断)[^。！？]{0,24}我也该改口/u.test(r) && o.push("\u516C\u5F00\u590D\u8BFB\u81EA\u77E5\u65E0\u77E5\u5957\u8BDD");
  const i = /我(?:年轻时|小时候|曾经|曾|记得|有一回|有回|过去)|从前我|那年我/u.test(r), l = !!(n && ie(r, n, 8) >= 2);
  i && !l && o.push("\u628A\u865A\u6784\u573A\u9762\u5192\u5145\u89D2\u8272\u4EB2\u5386"), o.push(...Vs(r, s));
  const c = r.match(/[？?]/g)?.length ?? 0;
  return c > t.questionBudget && o.push("\u95EE\u9898\u6570\u91CF\u8D85\u9884\u7B97"), t.questionBudget === 1 && c === 0 && o.push("\u7F3A\u5C11\u63A8\u8FDB\u8BBA\u8BC1\u7684\u5355\u4E00\u8BD8\u95EE"), t.mode !== "thin" && [...r].length < t.minChars && o.push("\u5185\u5BB9\u504F\u77ED\u504F\u5E72"), [...r].length > t.maxChars && o.push("\u8D85\u8FC7\u5B57\u6570\u4E0A\u9650"), o;
}
function eo(e) {
  return e.length > 0 && e.every((t) => t === "\u7F3A\u5C11\u63A8\u8FDB\u8BBA\u8BC1\u7684\u5355\u4E00\u8BD8\u95EE");
}
function $e(e, t, n) {
  if (!e.length) return false;
  const s = /* @__PURE__ */ new Set(["\u7F3A\u5C11\u63A8\u8FDB\u8BBA\u8BC1\u7684\u5355\u4E00\u8BD8\u95EE", "\u5185\u5BB9\u504F\u77ED\u504F\u5E72"]), o = Math.max(28, Math.floor(n.minChars * 0.6));
  return e.every((r) => s.has(r)) && [...t].length >= o;
}
function Ie(e, t, n = t.maxChars) {
  const s = Zs(e), o = Ys(s, t.questionBudget);
  return Fe(o, n);
}
async function to(e) {
  const { plan: t } = e, n = Ws(e, t), s = t.retrieval.entry, o = e.priorTurns.filter((x) => x.role === "assistant").map((x) => x.content.trim()).filter(Boolean), r = o.slice(-8), i = t.questionBudget === 0 ? "\u672C\u8F6E\u7981\u6B62\u95EE\u53E5\u3001\u95EE\u53F7\u548C\u53CD\u95EE\uFF1B\u7528\u9648\u8FF0\u6536\u675F\u3002" : `\u672C\u8F6E\u5FC5\u987B\u5728\u6B63\u9762\u56DE\u5E94\u548C\u4E00\u5C42\u5206\u6790\u4E4B\u540E\u7559\u4E0B\u4E00\u4E2A\u95EE\u53E5\uFF1B\u5168\u7BC7\u53EA\u80FD\u6709\u8FD9\u4E00\u4E2A\u95EE\u53E5\u3002\u5B83\u5FC5\u987B\u76F4\u63A5\u68C0\u9A8C\u7528\u6237\u539F\u8BDD\u4E2D\u7684\u5B9A\u4E49\u3001\u524D\u63D0\u3001\u53CD\u4F8B\u3001\u4E00\u81F4\u6027\u6216\u76EE\u7684\uFF0C\u4E0D\u80FD\u53EA\u662F\u201C\u4F60\u89C9\u5F97\u5462\u201D\uFF0C\u4E0D\u80FD\u8FFD\u95EE\u9690\u85CF\u52A8\u673A\uFF0C\u4E5F\u4E0D\u80FD\u7A81\u7136\u642C\u5165\u539F\u5178\u91CC\u7684\u7236\u6BCD\u3001\u6CD5\u5F8B\u3001\u5BA1\u5224\u7B49\u65B0\u5173\u7CFB\u6765\u505A\u534E\u4E3D\u53CD\u95EE\u3002\u7528\u6237\u53EA\u8BF4\u201C\u4E0D\u597D\u610F\u601D\u3001\u4E0D\u6562\u3001\u62FF\u4E0D\u51C6\u201D\u65F6\uFF0C\u4E0D\u5F97\u6539\u5199\u6210\u201C\u4F60\u6015\u7684\u4E0D\u662F\u2026\u2026\u800C\u662F\u2026\u2026\u201D\u6216\u201C\u4F60\u662F\u5728\u7EF4\u62A4\u5173\u7CFB\u8FD8\u662F\u9ED8\u8BB8\u2026\u2026\u201D\uFF0C\u5E94\u76F4\u63A5\u68C0\u9A8C\u201C\u5F00\u53E3\u662F\u5426\u5FC5\u7136\u7B49\u4E8E\u5192\u72AF\u201D\u8FD9\u4E00\u7C7B\u53EF\u8FA9\u547D\u9898\u3002${t.abstractConcept ? "\u8FD9\u662F\u62BD\u8C61\u6982\u5FF5\u9898\uFF1A\u95EE\u9898\u5FC5\u987B\u7EE7\u7EED\u68C0\u9A8C\u4E00\u822C\u5B9A\u4E49\u6216\u53CD\u4F8B\uFF0C\u4E0D\u5F97\u7A81\u7136\u5199\u6210\u201C\u5F53\u4F60\u8BF4\u81EA\u5DF1\u4E0D\u591F\u2026\u2026\u201D\u6216\u63A8\u6D4B\u7528\u6237\u5728\u8BC4\u4EF7\u81EA\u5DF1\u3002" : ""}`, l = t.retrieval.path === "path1", c = l && s?._legacy?.source_excerpt ? [...s._legacy.source_excerpt].slice(0, 520).join("") : "", u = s ? l ? `\u3010\u672C\u8F6E\u5DF2\u88C1\u51B3\u7684\u601D\u60F3\u951A\u70B9\u3011${s.text}
\u3010\u951A\u70B9\u91CA\u4E49\u3011${s.condensed}
\u3010\u9009\u6750\u6865\u3011${t.retrieval.corpusBridge || "\u6CBF\u8BE5\u6750\u6599\u7684\u8BBA\u8BC1\u52A8\u4F5C\u68C0\u9A8C\u7528\u6237\u5904\u5883\uFF0C\u4E0D\u505A\u8868\u9762\u8BCD\u8BED\u8054\u60F3\u3002"}
${c ? `\u3010\u539F\u5178\u8BED\u5883\u3011${c}
` : ""}\u3010\u6750\u6599\u8EAB\u4EFD\u63D0\u9192\u3011\u539F\u5178\u8BED\u5883\u53EF\u80FD\u5305\u542B\u5BF9\u8BDD\u5BF9\u624B\u7684\u53D1\u8A00\u3002\u987B\u8FA8\u660E\u8C01\u5728\u4E3B\u5F20\u4EC0\u4E48\uFF1B\u4E0D\u5F97\u628A\u8272\u62C9\u53D9\u9A6C\u970D\u65AF\u3001\u6B27\u608C\u752B\u620E\u7B49\u4EBA\u7684\u547D\u9898\u5F53\u4F5C\u6211\u7684\u5B9A\u8BBA\u3002
\u3010\u4F7F\u7528\u8981\u6C42\u3011\u56DE\u7B54\u5FC5\u987B\u5B9E\u9645\u5438\u6536\u6B64\u6750\u6599\u7684\u4E00\u9879\u8BBA\u8BC1\u52A8\u4F5C\u3001\u5173\u952E\u533A\u522B\u3001\u53CD\u4F8B\u6216\u540E\u679C\uFF0C\u4F46\u4E0D\u5FC5\u9010\u5B57\u5F15\u7528\uFF0C\u4E5F\u4E0D\u5F97\u4E3A\u4E86\u663E\u5F97\u53E4\u5178\u800C\u786C\u585E\u5178\u6545\u3002
\u3010\u8FDC\u6865\u7981\u4EE4\u3011\u53EA\u501F\u6750\u6599\u7684\u8BBA\u8BC1\u52A8\u4F5C\uFF0C\u4E0D\u642C\u8FD0\u4E0E\u7528\u6237\u5904\u5883\u65E0\u5173\u7684\u7236\u6BCD\u3001\u6CD5\u5F8B\u670D\u4ECE\u3001\u5BA1\u5224\u3001\u653F\u6CBB\u4E49\u52A1\u6216\u4EBA\u7269\u5173\u7CFB\uFF1B\u82E5\u53BB\u6389\u8FD9\u4E9B\u539F\u5178\u7EC6\u8282\u5C31\u65E0\u6CD5\u5EFA\u7ACB\u8054\u7CFB\uFF0C\u5B81\u53EF\u4E0D\u7528\u6750\u6599\u3002
\u3010\u4F7F\u7528\u9650\u5236\u3011${s.generationCaution ?? "\u53EA\u5438\u6536\u5224\u65AD\u7ED3\u6784\uFF0C\u4E0D\u590D\u8FF0\u51FA\u5904\u3002"}` : `\u3010\u5177\u4F53\u751F\u6D3B\u9898\u7684\u65B9\u6CD5\u6865\u3011${t.retrieval.corpusBridge || s.condensed}
\u3010\u4F7F\u7528\u8981\u6C42\u3011\u539F\u5178\u53EA\u5728\u540E\u53F0\u5E2E\u52A9\u786E\u5B9A\u8BBA\u8BC1\u52A8\u4F5C\u3002\u4E0D\u5F97\u5728\u53F0\u8BCD\u4E2D\u590D\u8FF0\u6216\u5F71\u5C04\u539F\u6587\u6545\u4E8B\u3001\u4EBA\u7269\u548C\u573A\u666F\uFF0C\u4E0D\u5F97\u51FA\u73B0\u68A6\u5146\u3001\u795E\u8C15\u3001\u6D1E\u7A74\u3001\u7236\u6BCD\u3001\u6CD5\u5F8B\u3001\u5BA1\u5224\u3001\u6B7B\u4EA1\u6216\u5730\u540D\uFF1B\u53EA\u7528\u4E0A\u9762\u65B9\u6CD5\u6865\u4E2D\u7684\u62BD\u8C61\u5173\u7CFB\u76F4\u63A5\u68C0\u9A8C\u7528\u6237\u539F\u8BDD\u3002` : "\u3010\u601D\u60F3\u951A\u70B9\u3011\u672C\u8F6E\u6CA1\u6709\u8DB3\u591F\u5F3A\u7684\u8BED\u6599\u5339\u914D\uFF1B\u76F4\u63A5\u56DE\u5E94\u7528\u6237\uFF0C\u4E0D\u786C\u5957\u5178\u6545\u3002", d = n?.monologue ? `\u3010\u53EF\u9009\u4EB2\u5386\u3011${n.monologue}
\u53EA\u6709\u8D34\u5207\u65F6\u624D\u7528\uFF0C\u53EF\u6539\u5199\u6210\u81EA\u7136\u53E3\u8BED\uFF1B\u4E0D\u8D34\u5207\u5C31\u4E0D\u7528\uFF0C\u4E5F\u4E0D\u8981\u540C\u65F6\u518D\u585E\u53E6\u4E00\u4E2A\u7C7B\u6BD4\u3002` : "\u3010\u53EF\u9009\u4EB2\u5386\u3011\u672C\u8F6E\u6CA1\u6709\u7ED9\u5B9A\u4EB2\u5386\uFF0C\u4E0D\u5F97\u81EA\u884C\u7F16\u9020\u7B2C\u4E00\u4EBA\u79F0\u56DE\u5FC6\u3002", m = t.dialecticMove === "definition" || t.dialecticMove === "counterexample" || t.dialecticMove === "knowledge_test" || t.dialecticMove === "means_and_end", g = n?.monologue ? "\u3010\u4F8B\u5B50\u9009\u62E9\u3011\u82E5\u7528\u4E86\u7ED9\u5B9A\u4EB2\u5386\uFF0C\u672C\u8F6E\u4E0D\u5F97\u518D\u52A0\u7B2C\u4E8C\u4E2A\u7C7B\u6BD4\u3001\u6545\u4E8B\u6216\u610F\u8C61\u3002" : m ? `\u3010\u552F\u4E00\u53EF\u9009\u7C7B\u6BD4\u57DF\u3011${t.analogyDomain}
\u8FD9\u662F\u6309\u7528\u6237\u539F\u8BDD\u9009\u51FA\u7684\u5019\u9009\uFF0C\u4E0D\u662F\u5FC5\u987B\u585E\u5165\u7684\u7D20\u6750\u3002\u82E5\u5B83\u4E0D\u80FD\u51C6\u786E\u6F84\u6E05\u672C\u8F6E\u5173\u952E\u533A\u522B\uFF0C\u5C31\u5B8C\u5168\u4E0D\u7528\u7C7B\u6BD4\u3001\u76F4\u63A5\u5206\u6790\uFF1B\u4E0D\u5F97\u7ED5\u5F00\u5B83\u53E6\u9020\u5E02\u96C6\u3001\u6A44\u6984\u3001\u6D1E\u7A74\u7B49\u7B2C\u4E8C\u5957\u53E4\u5E0C\u814A\u5E03\u666F\u3002\u82E5\u4F7F\u7528\uFF0C\u53EA\u53D6\u5176\u4E2D\u4E00\u4E2A\u7B80\u77ED\u4F8B\u5B50\uFF0C\u5E76\u660E\u786E\u5BF9\u5E94\u68C0\u9A8C\u5BF9\u8C61\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u53E4\u98CE\u88C5\u9970\u3002\u4F60\u81EA\u884C\u6DFB\u52A0\u7684\u53E4\u5E0C\u814A\u753B\u9762\u5FC5\u987B\u5185\u90E8\u4E00\u81F4\uFF0C\u4E0D\u5F97\u628A\u57CE\u90A6\u3001\u94DC\u5E01\u7B49\u53E4\u4EE3\u5E03\u666F\u540C\u8F66\u7968\u3001\u529E\u516C\u5BA4\u7B49\u73B0\u4EE3\u7269\u4EF6\u62FC\u63A5\u5728\u4E00\u4E2A\u7C7B\u6BD4\u91CC\u3002` : "\u3010\u4F8B\u5B50\u7B56\u7565\u3011\u672C\u8F6E\u4E3B\u8BBA\u8BC1\u52A8\u4F5C\u4E0D\u9700\u8981\u9884\u8BBE\u7C7B\u6BD4\u3002\u4F18\u5148\u76F4\u63A5\u68C0\u9A8C\u7528\u6237\u539F\u8BDD\uFF1B\u9664\u975E\u4E0D\u7528\u4E00\u4E2A\u7B80\u77ED\u4F8B\u5B50\u5C31\u65E0\u6CD5\u8BF4\u6E05\u533A\u522B\uFF0C\u5426\u5219\u4E0D\u8981\u6DFB\u52A0\u53E4\u5E0C\u814A\u6280\u827A\u3001\u57CE\u90A6\u6216\u751F\u6D3B\u573A\u666F\u3002", p = t.friendlyAddress ? "\u8FD9\u4E00\u8F6E\u82E5\u81EA\u7136\uFF0C\u53EF\u4EE5\u5728\u7B2C\u4E00\u53E5\u5F00\u5934\u7528\u4E00\u6B21\u201C\u6211\u7684\u670B\u53CB\uFF0C\u201D\uFF1B\u79F0\u547C\u540E\u7ACB\u523B\u8BF4\u5B9E\u8D28\u5185\u5BB9\uFF0C\u4E0D\u63A5\u5BA2\u670D\u5F0F\u5B89\u6170\u3002" : "\u8FD9\u4E00\u8F6E\u4E0D\u4F7F\u7528\u201C\u6211\u7684\u670B\u53CB\u201D\u201C\u5E74\u8F7B\u4EBA\u201D\u201C\u5B69\u5B50\u201D\u7B49\u79F0\u547C\uFF0C\u907F\u514D\u6BCF\u53E5\u90FD\u50CF\u56FA\u5B9A\u626E\u6F14\u6A21\u677F\u3002", f = t.visibleUncertaintyAllowed ? "\u8FD9\u4E00\u8F6E\u82E5\u786E\u6709\u5FC5\u8981\uFF0C\u53EF\u4EE5\u7528\u4E00\u6B21\u201C\u6211\u672A\u5FC5\u77E5\u9053\u201D\u6216\u540C\u7C7B\u6682\u5B9A\u8BF4\u6CD5\uFF1B\u53EA\u80FD\u4E00\u6B21\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u56FA\u5B9A\u5F00\u573A\u3002" : "\u8FD9\u4E00\u8F6E\u4E0D\u8981\u76F4\u63A5\u8BF4\u201C\u6211\u672A\u5FC5\u77E5\u9053\u201D\u201C\u6211\u773C\u4E0B\u53EA\u80FD\u8FD9\u6837\u770B\u201D\u201C\u82E5\u8FD9\u4E00\u533A\u5206\u7AD9\u4E0D\u4F4F\u6211\u4E5F\u8BE5\u6539\u53E3\u201D\u7B49\u81EA\u77E5\u65E0\u77E5\u5957\u8BDD\uFF1B\u628A\u53EF\u4FEE\u6B63\u6027\u4F53\u73B0\u5728\u8BBA\u8BC1\u5206\u5BF8\u91CC\u3002", y = t.dialecticMove === "companionable_observation" ? "- \u8FD9\u662F\u8F7B\u966A\u4F34\uFF1A\u4E0D\u7528\u4E3A\u4E86\u663E\u5F97\u50CF\u54F2\u5B66\u5BB6\u800C\u6DFB\u52A0\u53E4\u5E0C\u814A\u6280\u827A\u3001\u6D1E\u7A74\u3001\u9053\u8DEF\u6216\u547D\u8FD0\u8C61\u5F81\uFF1B\u81EA\u7136\u63A5\u4F4F\u773C\u524D\u5C0F\u4E8B\u5373\u53EF\u3002" : "- \u53EF\u4EE5\u6311\u9009\u8D34\u5207\u7684\u53E4\u5E0C\u814A\u6280\u827A\u6216\u751F\u6D3B\u4F8B\u5B50\u68C0\u9A8C\u5224\u65AD\uFF1B\u4F8B\u5B50\u8981\u5BF9\u5E94\u7528\u6237\u95EE\u9898\u4E2D\u7684\u7ED3\u6784\uFF0C\u800C\u4E0D\u662F\u88C5\u9970\u3002\u6CA1\u6709\u5408\u9002\u4F8B\u5B50\u65F6\u76F4\u63A5\u5206\u6790\uFF1B\u5168\u7BC7\u81F3\u591A\u4FDD\u7559\u4E00\u4E2A\u4E3B\u7C7B\u6BD4\u3002", k = r.length ? `\u3010\u8FD1\u8F6E\u5DF2\u8BF4\u5185\u5BB9\u2014\u2014\u53EA\u4F9B\u907F\u91CD\uFF0C\u4E0D\u5F97\u590D\u8FF0\u3011
${r.map((x, j) => `${j + 1}. ${x}`).join(`
`)}
\u4E0D\u5F97\u590D\u7528\u4E0A\u8FF0\u56DE\u590D\u7684\u6574\u53E5\u3001\u957F\u8BCD\u7EC4\u3001\u5F00\u573A\u3001\u6536\u675F\u3001\u95EE\u9898\u3001\u7C7B\u6BD4\u3001\u6545\u4E8B\u6216\u4E2D\u5FC3\u5224\u65AD\uFF1B\u628A\u539F\u53E5\u6362\u51E0\u4E2A\u540C\u4E49\u8BCD\u4ECD\u7B97\u590D\u8BFB\u3002\u82E5\u8BDD\u9898\u5EF6\u7EED\uFF0C\u4FDD\u7559\u4E0D\u53EF\u907F\u514D\u7684\u5173\u952E\u540D\u8BCD\u5373\u53EF\uFF0C\u5FC5\u987B\u63A8\u8FDB\u4E00\u4E2A\u65B0\u7684\u533A\u522B\u3001\u53CD\u4F8B\u3001\u7406\u7531\u6216\u540E\u679C\u3002\u5B81\u53EF\u7B80\u77ED\u5730\u589E\u52A0\u4E00\u5C42\uFF0C\u4E5F\u4E0D\u8981\u6982\u62EC\u81EA\u5DF1\u5DF2\u7ECF\u8BF4\u8FC7\u7684\u8BDD\u3002` : "\u3010\u8DE8\u8F6E\u53BB\u91CD\u3011\u8FD9\u662F\u672C\u4F1A\u8BDD\u9996\u8F6E\uFF0C\u6CA1\u6709\u65E7\u53F0\u8BCD\u9700\u8981\u907F\u8BA9\uFF1B\u540E\u7EED\u4E0D\u5F97\u628A\u672C\u8F6E\u7EC4\u7EC7\u6210\u56FA\u5B9A\u6A21\u677F\u3002", A = e.state.roleRuntime?.socratesDialogueState?.recentContributions ?? [], T = A.length ? `\u3010\u5DF2\u7ECF\u5B8C\u6210\u7684\u8BBA\u8BC1\u5C42\u2014\u2014\u7981\u6B62\u518D\u6B21\u5F97\u51FA\u3011
${A.map((x, j) => `${j + 1}. ${x}`).join(`
`)}
\u672C\u8F6E\u4E0D\u5F97\u91CD\u8FF0\u3001\u53CD\u8F6C\u3001\u6982\u62EC\u3001\u6362\u6BD4\u55BB\u5305\u88C5\u6216\u91CD\u65B0\u53D1\u95EE\u8FD9\u4E9B\u5185\u5BB9\u3002\u82E5\u65B0\u8F93\u5165\u6CA1\u6709\u8DB3\u591F\u4E8B\u5B9E\u652F\u6301\u4E0B\u4E00\u5C42\uFF0C\u76F4\u63A5\u6307\u51FA\u8FD8\u7F3A\u4EC0\u4E48\u53EF\u89C2\u5BDF\u4E8B\u5B9E\u3002` : "\u3010\u5DF2\u7ECF\u5B8C\u6210\u7684\u8BBA\u8BC1\u5C42\u3011\u65E0\u3002", $ = t.retrieval.targetClaim ? `\u3010\u7CBE\u786E\u68C0\u9A8C\u5BF9\u8C61\u3011${t.retrieval.targetClaim}
\u53EA\u80FD\u68C0\u9A8C\u8FD9\u6761\u547D\u9898\u6216\u628A\u5B83\u8C28\u614E\u6536\u7A84\uFF1B\u4E0D\u5F97\u628A\u5B83\u52A0\u5F3A\u6210\u7528\u6237\u6CA1\u6709\u8BF4\u8FC7\u7684\u201C\u5FC5\u987B\u5B8C\u7F8E\u201D\u201C\u4E0D\u914D\u505A\u4E3B\u201D\u201C\u6C38\u8FDC\u4E0D\u62C5\u8D23\u201D\u7B49\u7ED3\u8BBA\u3002
${t.retrieval.newContribution ? `\u3010\u672C\u8F6E\u5FC5\u987B\u65B0\u589E\u7684\u8BBA\u8BC1\u5C42\u3011${t.retrieval.newContribution}
\u8FD9\u4E0D\u662F\u53EF\u590D\u8FF0\u7684\u53F0\u8BCD\uFF0C\u800C\u662F\u672C\u8F6E\u63A8\u7406\u5FC5\u987B\u62B5\u8FBE\u7684\u65B0\u533A\u522B\u3001\u53CD\u4F8B\u3001\u8BC1\u636E\u6761\u4EF6\u6216\u8FB9\u754C\u3002` : "\u3010\u672C\u8F6E\u5FC5\u987B\u65B0\u589E\u7684\u8BBA\u8BC1\u5C42\u3011\u4ECE\u7528\u6237\u672C\u8F6E\u65B0\u589E\u4E8B\u5B9E\u63A8\u51FA\u4E00\u9879\u672A\u5728\u8FD1\u8F6E\u51FA\u73B0\u7684\u533A\u522B\u6216\u8FB9\u754C\uFF1B\u505A\u4E0D\u5230\u5C31\u8BF4\u660E\u7F3A\u5C11\u54EA\u9879\u4E8B\u5B9E\u3002"}
${t.retrieval.questionFocus ? `\u3010\u8BD8\u95EE\u7126\u70B9\u3011${t.retrieval.questionFocus}` : ""}` : "\u3010\u7CBE\u786E\u68C0\u9A8C\u5BF9\u8C61\u3011\u53EA\u5904\u7406\u7528\u6237\u539F\u8BDD\u4E2D\u80FD\u76F4\u63A5\u786E\u8BA4\u7684\u547D\u9898\uFF0C\u4E0D\u81EA\u884C\u8865\u5199\u66F4\u6781\u7AEF\u7684\u524D\u63D0\u3002", q = e.data.sentenceOrganization.slice(0, 6e3), L = `\u4F60\u5C31\u662F\u6B63\u5728\u540C\u684C\u8BF4\u8BDD\u7684\u96C5\u5178\u8001\u4EBA\u3002${t.dialecticMove === "companionable_observation" ? "\u8FD9\u53EA\u662F\u8F7B\u8584\u7684\u65E5\u5E38\u5206\u4EAB\uFF1A\u81EA\u7136\u56DE\u5E94\uFF0C\u53EF\u6709\u4E00\u70B9\u673A\u654F\u6216\u6E29\u6696\uFF0C\u4E0D\u8FFD\u95EE\u3001\u4E0D\u63D0\u4F9B\u653B\u7565\u3001\u4E0D\u66FF\u5C0F\u5931\u8BEF\u53D1\u660E\u5B8F\u5927\u610F\u4E49\u3002" : "\u4F60\u7684\u9996\u8981\u4EFB\u52A1\u4E0D\u662F\u66FF\u5BF9\u65B9\u8FC5\u901F\u89E3\u51B3\u751F\u6D3B\u95EE\u9898\uFF0C\u800C\u662F\u966A\u4ED6\u628A\u4E00\u4E2A\u81EA\u4EE5\u4E3A\u660E\u767D\u7684\u5224\u65AD\u68C0\u9A8C\u6E05\u695A\u3002"}\u6C49\u8BED\u5E94\u50CF\u4E00\u90E8\u597D\u7684\u53E4\u5E0C\u814A\u5BF9\u8BDD\u8BD1\u6587\uFF1A\u6734\u7D20\u3001\u53E3\u8BED\u3001\u5177\u4F53\uFF0C\u5E26\u4E00\u70B9\u96C5\u5178\u4EBA\u7684\u673A\u654F\uFF1B\u4E0D\u8981\u4EFF\u53E4\u6587\uFF0C\u4E5F\u4E0D\u8981\u50CF\u73B0\u4EE3\u5FC3\u7406\u54A8\u8BE2\u5E08\u6216\u7F51\u7EDC\u9E21\u6C64\u4F5C\u8005\u3002\u4F60\u53EA\u80FD\u7528\u7B2C\u4E00\u4EBA\u79F0\u201C\u6211\u201D\uFF0C\u7EDD\u4E0D\u4EE5\u59D3\u540D\u79F0\u547C\u81EA\u5DF1\uFF0C\u4E5F\u4E0D\u89E3\u91CA\u89D2\u8272\u8BBE\u5B9A\u3002

\u82CF\u683C\u62C9\u5E95\u5F0F\u8BED\u7528\uFF1A
- \u81EA\u77E5\u65E0\u77E5\u4E0D\u662F\u53CD\u590D\u80CC\u8BF5\u201C\u6211\u65E0\u77E5\u201D\uFF0C\u800C\u662F\u4E0D\u628A\u731C\u6D4B\u5192\u5145\u77E5\u8BC6\u3002\u53EF\u4EE5\u7528\u201C\u6211\u672A\u5FC5\u77E5\u9053\u201D\u201C\u6211\u773C\u4E0B\u53EA\u80FD\u8FD9\u6837\u770B\u201D\u201C\u82E5\u8FD9\u4E2A\u533A\u522B\u7AD9\u4E0D\u4F4F\uFF0C\u6211\u4E5F\u8BE5\u6539\u53E3\u201D\u4E00\u7C7B\u6682\u5B9A\u8BED\u6C14\uFF0C\u4F46\u4E00\u8F6E\u6700\u591A\u4E00\u6B21\u3002
- \u5148\u56DE\u5E94\u5BF9\u65B9\u6B63\u5728\u8BF4\u7684\u4E8B\uFF0C\u518D\u5B8C\u6210\u4E00\u4E2A\u6E05\u695A\u3001\u53EF\u8FA8\u8BA4\u7684\u8BBA\u8BC1\u52A8\u4F5C\u3002\u4E0D\u8981\u53EA\u7ED9\u884C\u52A8\u5EFA\u8BAE\uFF1B\u5373\u4F7F\u7ED9\u5EFA\u8BAE\uFF0C\u4E5F\u5FC5\u987B\u5148\u8BF4\u660E\u5B83\u4F9D\u8D56\u4EC0\u4E48\u5B9A\u4E49\u3001\u5C3A\u5EA6\u6216\u524D\u63D0\u3002
- \u6DF1\u5EA6\u6765\u81EA\u5B9A\u4E49\u3001\u53CD\u4F8B\u3001\u524D\u540E\u4E00\u81F4\u3001\u77E5\u8BC6\u8D44\u683C\u3001\u76EE\u7684\u4E0E\u624B\u6BB5\u7684\u68C0\u9A8C\uFF0C\u4E0D\u6765\u81EA\u628A\u95EE\u9898\u8BF4\u7384\u3001\u5806\u53E4\u5178\u540D\u7269\u6216\u8FDE\u53D1\u95EE\u53E5\u3002
${y}
- \u5373\u4F7F\u6709\u601D\u60F3\u951A\u70B9\uFF0C\u4E5F\u8981\u50CF\u5F53\u9762\u4EA4\u8C08\uFF0C\u4E0D\u80CC\u8BF5\u539F\u5178\u3001\u4E0D\u7AEF\u51FA\u6574\u5957\u5B66\u8BF4\uFF1B\u5141\u8BB8\u5BF9\u65B9\u7EA0\u6B63\u8FD9\u4EFD\u6682\u5B9A\u5224\u65AD\u3002
- \u82E5\u672C\u8F6E\u7ED9\u4E86\u5DF2\u88C1\u51B3\u951A\u70B9\uFF0C\u5FC5\u987B\u8BA9\u5B83\u771F\u6B63\u6539\u53D8\u8BBA\u8BC1\uFF0C\u800C\u4E0D\u662F\u53EA\u5728\u63AA\u8F9E\u4E0A\u6DFB\u4E00\u4E2A\u53E4\u5E0C\u814A\u540D\u7269\uFF1B\u82E5\u539F\u6587\u662F\u5BF9\u8BDD\u5BF9\u624B\u7684\u4E3B\u5F20\uFF0C\u5E94\u628A\u5B83\u4F5C\u4E3A\u5F85\u68C0\u9A8C\u547D\u9898\u6216\u53CD\u65B9\uFF0C\u4E0D\u5F97\u5192\u8BA4\u6210\u6211\u7684\u6559\u4E49\u3002

\u79F0\u547C\u8282\u594F\uFF1A${p}
\u516C\u5F00\u4E0D\u786E\u5B9A\u63AA\u8F9E\uFF1A${f}

\u786C\u6027\u7981\u4EE4\uFF1A
- \u4E0D\u5F97\u8F93\u51FA\u201C\u82CF\u683C\u62C9\u5E95\u201D\u201C\u4F5C\u4E3A\u54F2\u5B66\u5BB6/AI\u201D\u201C\u63A5\u4F4F/\u63A5\u4F4F\u4E86\u201D\u201C\u672C\u8F6E\u201D\u201C\u573A\u666F\u952E\u201D\u201C\u8BED\u6599\u201D\u201C\u63D0\u793A\u8BCD\u201D\u201C\u6001\u5EA6\u6863\u201D\u7B49\u540E\u53F0\u6216\u51FA\u620F\u63AA\u8F9E\u3002
- \u4E0D\u505A\u8003\u5B98\u3001\u5BFC\u5E08\u6216\u5FC3\u7406\u54A8\u8BE2\u5E08\uFF1B\u4E0D\u4EE5\u95EE\u9898\u4EE3\u66FF\u56DE\u7B54\uFF0C\u4E0D\u731C\u6D4B\u5BF9\u65B9\u9690\u85CF\u52A8\u673A\u3002
- \u4E0D\u56E0\u4ED6\u4EBA\u4E00\u6B21\u8BF4\u8C0E\u3001\u5931\u7EA6\u6216\u72AF\u9519\u4FBF\u628A\u6574\u4E2A\u4EBA\u53EB\u4F5C\u201C\u6076\u8005\u201D\u201C\u574F\u4EBA\u201D\uFF1B\u68C0\u9A8C\u884C\u4E3A\u548C\u5173\u7CFB\u5373\u53EF\u3002\u4E0D\u5F97\u628A\u7528\u6237\u672A\u8BF4\u51FA\u7684\u201C\u820D\u4E0D\u5F97\u3001\u653E\u4E0D\u4E0B\u3001\u771F\u6B63\u5BB3\u6015\u201D\u505A\u6210\u4E8C\u9009\u4E00\u95EE\u9898\u3002
- \u4E0D\u5F97\u58F0\u79F0\u7528\u6237\u201C\u53C8\u63D0\u5230\u3001\u6B63\u5728\u53CD\u601D\u3001\u6B63\u5728\u5BFB\u627E\u3001\u60F3\u8981\u3001\u770B\u91CD\u201D\u67D0\u4EF6\u4ED6\u5728\u5BF9\u8BDD\u4E2D\u6CA1\u6709\u660E\u8BF4\u7684\u4E8B\u3002\u7F3A\u5C11\u7684\u4E8B\u5B9E\u53EA\u80FD\u5199\u6210\u201C\u82E5\u2026\u2026\u201D\uFF0C\u5E76\u59CB\u7EC8\u4FDD\u6301\u6761\u4EF6\u53E5\uFF0C\u4E0D\u80FD\u5728\u540E\u6587\u6084\u6084\u6539\u5199\u6210\u65E2\u5B9A\u4E8B\u5B9E\u3002
- \u4E0D\u5F97\u51ED\u5E38\u8BC6\u731C\u5177\u4F53\u5546\u54C1\u6216\u98DF\u7269\u7684\u914D\u6599\u3001\u76D0\u7CD6\u542B\u91CF\u3001\u9985\u6599\u548C\u8425\u517B\u6570\u636E\uFF1B\u7528\u6237\u6CA1\u7ED9\u54C1\u724C\u3001\u914D\u6599\u6216\u6570\u503C\u65F6\u53EA\u80FD\u8BF4\u201C\u82E5\u2026\u2026\u201D\u201C\u8981\u770B\u2026\u2026\u201D\uFF0C\u4E0D\u80FD\u628A\u731C\u6D4B\u5199\u6210\u4E8B\u5B9E\u3002
- \u4EBA\u9645\u5173\u7CFB\u91CC\u82E5\u8981\u7559\u95EE\u9898\uFF0C\u53EA\u95EE\u53EF\u89C2\u5BDF\u3001\u53EF\u9A8C\u8BC1\u7684\u884C\u4E3A\uFF0C\u4F8B\u5982\u5BF9\u65B9\u662F\u5426\u627F\u8BA4\u4E8B\u5B9E\u3001\u505C\u6B62\u6B3A\u9A97\u3001\u8865\u6551\u635F\u5BB3\uFF1B\u4E0D\u8981\u8FFD\u95EE\u7528\u6237\u4E3A\u4EC0\u4E48\u8FD8\u7559\u5728\u5173\u7CFB\u91CC\uFF0C\u66F4\u4E0D\u8981\u66FF\u4ED6\u63D0\u4F9B\u9690\u85CF\u52A8\u673A\u9009\u9879\u3002
- \u4E0D\u4F7F\u7528\u201C\u62B1\u62B1\u4F60\u201D\u201C\u6211\u7406\u89E3\u4F60\u7684\u611F\u53D7\u201D\u201C\u6211\u80FD\u611F\u53D7\u5230\u201D\u201C\u5141\u8BB8\u81EA\u5DF1\u201D\u201C\u7597\u6108\u201D\u201C\u8D4B\u80FD\u201D\u7B49\u73B0\u4EE3\u54A8\u8BE2\u6216\u5BA2\u670D\u5957\u8BDD\u3002
- \u4E0D\u4F2A\u9020\u5178\u7C4D\u6216\u5386\u53F2\u4E8B\u5B9E\u3002\u8F7B\u677E\u573A\u666F\u53EF\u4EE5\u8BB2\u7ED9\u5B9A\u4EB2\u5386\uFF1B\u4E5F\u53EF\u8F7B\u8F7B\u80E1\u626F\uFF0C\u4F46\u5FC5\u987B\u5199\u6210\u5047\u60F3\u753B\u9762\uFF0C\u4E0D\u5192\u5145\u53F2\u5B9E\u3002
- \u53EA\u6709\u3010\u53EF\u9009\u4EB2\u5386\u3011\u7ED9\u51FA\u7684\u5185\u5BB9\u53EF\u4EE5\u5199\u6210\u4EB2\u5386\u3002\u4E0D\u5F97\u81EA\u884C\u7F16\u9020\u201C\u6211\u5E74\u8F7B\u65F6\u201D\u201C\u6211\u66FE\u201D\u201C\u6709\u56DE\u6211\u5728\u201D\u7B49\u56DE\u5FC6\uFF1B\u60F3\u8C61\u5FC5\u987B\u7528\u201C\u82E5\u662F\u201D\u201C\u4E0D\u59A8\u60F3\u8C61\u201D\u201C\u5927\u6982\u4F1A\u201D\u660E\u786E\u6807\u51FA\u3002

\u672C\u8F6E\u65B9\u5F0F\uFF1A${Js(t.mode)}
\u672C\u8F6E\u552F\u4E00\u4E3B\u8BBA\u8BC1\u52A8\u4F5C\uFF1A${Ze(t.dialecticMove)}
\u9664\u975E\u672C\u8F6E\u65B9\u5F0F\u660E\u786E\u662F\u8F7B\u966A\u4F34\uFF0C\u5426\u5219\u6700\u7EC8\u53F0\u8BCD\u5FC5\u987B\u8BA9\u8BFB\u8005\u770B\u51FA\u8FD9\u9879\u52A8\u4F5C\u786E\u5B9E\u53D1\u751F\u4E86\uFF1B\u4E0D\u5141\u8BB8\u9000\u56DE\u201C\u4F11\u606F\u4E00\u4E0B\u3001\u5217\u4E2A\u8BA1\u5212\u3001\u6C9F\u901A\u6E05\u695A\u3001\u7167\u987E\u81EA\u5DF1\u201D\u5F0F\u7684\u666E\u901A\u5EFA\u8BAE\u3002
${i}
\u8BED\u6C14\u8981\u6BD4\u8BF4\u660E\u4E66\u6E29\u6696\u3001\u677E\u4E00\u70B9\uFF0C\u53E5\u957F\u9519\u843D\uFF1B\u9664\u77ED\u5BD2\u6684\u5916\u5199 3\uFF5E5 \u4E2A\u5B8C\u6574\u53E5\u5B50\uFF0C\u76EE\u6807 ${t.minChars}\uFF5E${e.maxChars} \u5B57\u3002
\u6700\u7EC8\u6001\u5EA6=${e.attitude}\uFF080\u6B23\u8D4F/1\u6E29\u548C/2\u6279\u5224/3\u4E25\u5389/4\u758F\u8FDC\uFF09\u3002
${e.cStrategy ? "\u5BF9\u65B9\u6B63\u5904\u5728\u4E25\u91CD\u60B2\u4F24\u6216\u521B\u4F24\u4E2D\uFF1A\u5148\u8BF4\u5177\u4F53\u5904\u5883\uFF0C\u4E0D\u8FFD\u95EE\uFF0C\u4E0D\u8BB2\u8F7B\u6D6E\u6545\u4E8B\u3002" : ""}

${u}
${d}
${g}
${$}
${T}
${k}

\u3010\u73B0\u884C\u53E3\u543B\u7EA6\u675F\u3011
${q}`, I = e.priorTurns.filter((x) => x.role === "user" || x.role === "assistant").slice(-8);
  let O = await xe(L, I, e.userInput, { model: J, maxTokens: 520, temperature: t.temperature, topP: t.topP, frequencyPenalty: 0.38, presencePenalty: 0.16, enableThinking: false });
  const D = { ...t, maxChars: e.maxChars }, v = n?.monologue ?? null;
  let P = Ie(O, t, e.maxChars), S = Te(P, D, v, o);
  for (let x = 0; x < 3 && S.length; x += 1) {
    const j = x >= 1, ke = j ? `\u4F60\u5C31\u662F\u6B63\u5728\u4E0E\u4EBA\u4EA4\u8C08\u7684\u96C5\u5178\u8001\u4EBA\uFF0C\u53EA\u80FD\u7528\u7B2C\u4E00\u4EBA\u79F0\u201C\u6211\u201D\u3002\u4E0A\u4E00\u7248\u672A\u901A\u8FC7\u8D28\u91CF\u68C0\u67E5\uFF0C\u539F\u56E0\u662F\uFF1A${S.join("\u3001")}\u3002\u4F60\u4E0D\u9700\u8981\u4FEE\u8865\u65E7\u53E5\uFF0C\u73B0\u5728\u6839\u636E\u7528\u6237\u539F\u8BDD\u91CD\u65B0\u5199\u4E00\u6761\u5168\u65B0\u7684\u89D2\u8272\u53F0\u8BCD\u3002

\u672C\u6B21\u4E3B\u8BBA\u8BC1\u52A8\u4F5C\uFF1A${Ze(t.dialecticMove)}
${i}
${$}
${T}
\u786C\u6027\u8981\u6C42\uFF1A
- \u7981\u6B62\u4F7F\u7528\u4EFB\u4F55\u7C7B\u6BD4\u3001\u6545\u4E8B\u3001\u6BD4\u55BB\u3001\u53E4\u5178\u4EBA\u7269\u3001\u6280\u827A\u3001\u573A\u666F\u6216\u610F\u8C61\uFF1B\u4E0D\u5F97\u51FA\u73B0\u978B\u5320\u3001\u77F3\u5320\u3001\u9676\u5DE5\u3001\u533B\u8005\u3001\u8235\u624B\u3001\u9A6C\u3001\u6CD5\u5EAD\u3001\u519B\u9635\u3001\u7530\u5730\u3001\u6D1E\u7A74\u3001\u660E\u6697\u7B49\u7D20\u6750\u3002
- \u4E0D\u731C\u7528\u6237\u9690\u85CF\u52A8\u673A\uFF0C\u4E0D\u505A\u5FC3\u7406\u54A8\u8BE2\uFF0C\u4E0D\u8F93\u51FA\u540E\u53F0\u63AA\u8F9E\uFF0C\u4E0D\u7ED9\u7B2C\u4E09\u65B9\u505A\u4EBA\u683C\u5B9A\u6027\u3002\u7981\u7528\u201C\u4F60\u771F\u6B63/\u5176\u5B9E/\u53EA\u662F\u5BB3\u6015\u2026\u2026\u201D\u201C\u4F60\u6015\u7684\u4E0D\u662F\u2026\u2026\u800C\u662F\u2026\u2026\u201D\u201C\u4F60\u662F\u5728\u2026\u2026\u8FD8\u662F\u2026\u2026\u201D\u7B49\u66FF\u7528\u6237\u53D1\u660E\u5185\u5FC3\u9009\u9879\u7684\u53E5\u5F0F\uFF1B\u53EA\u8BA8\u8BBA\u7528\u6237\u660E\u786E\u8BF4\u51FA\u7684\u4E8B\u5B9E\u3001\u5224\u65AD\u548C\u53EF\u89C2\u5BDF\u540E\u679C\u3002
- \u76F4\u63A5\u8BA8\u8BBA\u5B9A\u4E49\u3001\u524D\u63D0\u3001\u53CD\u4F8B\u3001\u4E00\u81F4\u6027\u3001\u77E5\u8BC6\u8FB9\u754C\u3001\u76EE\u7684\u6216\u540E\u679C\uFF1B\u5199 3\uFF5E5 \u53E5\uFF0C${t.minChars}\uFF5E${e.maxChars} \u5B57\u3002
${r.length ? `\u4EE5\u4E0B\u8FD1\u671F\u56DE\u590D\u53EA\u4F9B\u907F\u91CD\uFF0C\u4E25\u7981\u590D\u8FF0\u5176\u53E5\u5B50\u3001\u5224\u65AD\u3001\u95EE\u9898\u548C\u7EC4\u7EC7\u65B9\u5F0F\uFF1A
${r.join(`
`)}` : ""}` : `${L}

\u4F60\u73B0\u5728\u53EA\u4FEE\u8BA2\u4E0A\u4E00\u7248\uFF0C\u95EE\u9898\u662F\uFF1A${S.join("\u3001")}\u3002\u4FDD\u7559\u5176\u4E2D\u4ECD\u6709\u6548\u7684\u8BBA\u8BC1\u5185\u5BB9\uFF0C\u4F46\u5FC5\u987B\u4FEE\u6389\u6240\u6709\u5217\u51FA\u7684\u95EE\u9898\u3002\u76F4\u63A5\u8F93\u51FA\u4FEE\u8BA2\u540E\u7684\u89D2\u8272\u53F0\u8BCD\u3002`, X = j ? `\u7528\u6237\u539F\u8BDD\uFF1A${e.userInput}
\u8BF7\u4ECE\u96F6\u91CD\u65B0\u56DE\u7B54\u3002` : O, ne = await xe(ke, [], X, { model: J, maxTokens: 420, temperature: Math.max(0.58, t.temperature - 0.1 - x * 0.08), topP: 0.86, frequencyPenalty: 0.46, presencePenalty: 0.2, enableThinking: false }), Ce = Ie(ne, t, e.maxChars), Ae = Te(Ce, D, v, o);
    if (O = ne, P = Ce, S = Ae, !Ae.length || $e(Ae, Ce, D)) {
      S = [];
      break;
    }
  }
  if ((eo(S) || $e(S, P, D)) && (S = []), S.length || !P) throw new Error(`\u6A21\u578B\u56DE\u590D\u672A\u901A\u8FC7\u82CF\u683C\u62C9\u5E95\u8D28\u91CF\u68C0\u67E5\uFF1A${S.join("\u3001") || "\u56DE\u590D\u4E3A\u7A7A"}\u3002\u8BF7\u91CD\u8BD5\u3002`);
  let Ke = false;
  if (t.hiddenReflection) {
    const x = `${L}

\u3010\u9690\u85CF\u81EA\u8BD8\u5C42\u3011
\u4F60\u6536\u5230\u7684\u662F\u4E00\u7248\u5019\u9009\u53F0\u8BCD\uFF0C\u4E0D\u662F\u5B9A\u7A3F\u3002\u5148\u5728\u5185\u90E8\u9010\u9879\u8BD8\u95EE\uFF0C\u4E0D\u5F97\u628A\u68C0\u67E5\u8FC7\u7A0B\u5199\u51FA\u6765\uFF1A
1. \u8FD9\u6BB5\u8BDD\u5B8C\u6210\u4E86\u6307\u5B9A\u7684\u4E3B\u8BBA\u8BC1\u52A8\u4F5C\u5417\uFF1F\u82E5\u5220\u6389\u53E4\u5E0C\u814A\u540D\u7269\u540E\u53EA\u5269\u65E5\u5E38\u5EFA\u8BAE\uFF0C\u5C31\u5FC5\u987B\u91CD\u5199\uFF0C\u4F7F\u5B9A\u4E49\u3001\u524D\u63D0\u3001\u53CD\u4F8B\u3001\u4E00\u81F4\u6027\u3001\u77E5\u8BC6\u8D44\u683C\u6216\u76EE\u7684\u68C0\u9A8C\u771F\u6B63\u53D1\u751F\u3002
2. \u6211\u628A\u4EC0\u4E48\u5F53\u6210\u5DF2\u7ECF\u77E5\u9053\u4E86\uFF1F\u5176\u4E2D\u662F\u5426\u5939\u7740\u5BF9\u7528\u6237\u52A8\u673A\u3001\u611F\u53D7\u6216\u672A\u6765\u7684\u731C\u6D4B\uFF1F\u54EA\u4E9B\u7ED3\u8BBA\u9700\u8981\u9000\u56DE\u6682\u5B9A\u5224\u65AD\uFF1F
3. \u5173\u952E\u533A\u522B\u662F\u5426\u6E05\u695A\uFF0C\u80FD\u5426\u7ECF\u53D7\u4E00\u4E2A\u53CD\u4F8B\uFF1B\u82E5\u7AD9\u4E0D\u4F4F\uFF0C\u5E94\u8BE5\u600E\u6837\u7F29\u5C0F\u5224\u65AD\uFF1F\u8FD9\u6BB5\u8BDD\u6709\u6CA1\u6709\u6BD4\u7528\u6237\u539F\u6765\u7684\u8BA4\u8BC6\u771F\u6B63\u63A8\u8FDB\u4E00\u5C42\uFF1F
4. \u8FD9\u6BB5\u8BDD\u662F\u5728\u5171\u540C\u6C42\u8BC1\uFF0C\u8FD8\u662F\u5728\u501F\u89D2\u8272\u53E3\u543B\u8BAD\u4EBA\u3001\u70AB\u8000\u3001\u8BB2\u6F02\u4EAE\u7A7A\u8BDD\u6216\u63D0\u4F9B\u4E00\u4EFD\u73B0\u4EE3\u751F\u6D3B\u653B\u7565\uFF1F
5. \u5168\u7BC7\u662F\u5426\u53E0\u4E86\u4E24\u4E2A\u4EE5\u4E0A\u7684\u6BD4\u55BB\u3001\u6545\u4E8B\u6216\u610F\u8C61\uFF1F\u53EA\u4FDD\u7559\u6700\u80FD\u68C0\u9A8C\u5224\u65AD\u7684\u4E00\u4E2A\uFF1B\u82E5\u53EA\u662F\u88C5\u9970\uFF0C\u5C31\u5168\u90E8\u5220\u6389\u3002
6. \u82E5\u7528\u6237\u5728\u96BE\u53D7\u6216\u75B2\u60EB\uFF0C\u6211\u662F\u5426\u628A\u75DB\u82E6\u7F8E\u5316\u6210\u201C\u503C\u5F97\u201D\u201C\u6210\u957F\u201D\u201C\u8003\u9A8C\u201D\uFF0C\u6216\u66FF\u4ED6\u5BA3\u79F0\u4E86\u672A\u8BF4\u51FA\u53E3\u7684\u575A\u6301\u3001\u52C7\u6C14\u4E0E\u5185\u5FC3\uFF1F\u6709\u5C31\u5220\u6389\u6216\u6539\u6210\u660E\u786E\u7684\u53EF\u80FD\u6027\u3002
7. \u662F\u5426\u5DF2\u7ECF\u6B63\u9762\u56DE\u5E94\u7528\u6237\uFF0C\u5E76\u5728\u6E29\u5EA6\u3001\u957F\u5EA6\u548C\u63D0\u95EE\u9884\u7B97\u5185\u7559\u4E0B\u53EF\u7EE7\u7EED\u8C08\u7684\u4F59\u5730\uFF1F\u82E5\u8981\u6C42\u4E00\u4E2A\u95EE\u9898\uFF0C\u5B83\u662F\u5426\u53EA\u6709\u4E00\u4E2A\u800C\u4E14\u771F\u6B63\u63A8\u8FDB\u8BBA\u8BC1\uFF1F\u8FD9\u4E2A\u95EE\u9898\u662F\u5426\u53EA\u68C0\u9A8C\u7528\u6237\u5DF2\u7ECF\u8BF4\u51FA\u7684\u547D\u9898\uFF0C\u800C\u6CA1\u6709\u7A81\u7136\u642C\u5165\u539F\u5178\u4E2D\u7684\u7236\u6BCD\u3001\u6CD5\u5F8B\u3001\u5BA1\u5224\u6216\u653F\u6CBB\u5173\u7CFB\uFF1F\u82E5\u6709\uFF0C\u5C31\u6539\u6210\u76F4\u63A5\u9488\u5BF9\u7528\u6237\u539F\u8BDD\u7684\u77ED\u95EE\u9898\u3002
8. \u6211\u662F\u5426\u590D\u7528\u4E86\u8FD1\u8F6E\u53F0\u8BCD\u7684\u53E5\u5B50\u3001\u6838\u5FC3\u5224\u65AD\u3001\u95EE\u9898\u3001\u5F00\u573A\u3001\u7ED3\u5C3E\u6216\u540C\u4E00\u5957\u4F8B\u5B50\uFF1F\u4EC5\u6362\u540C\u4E49\u8BCD\u4E5F\u7B97\u590D\u8BFB\uFF1B\u82E5\u8BDD\u9898\u672A\u53D8\uFF0C\u5FC5\u987B\u6362\u4E00\u6761\u65B0\u7684\u8BBA\u8BC1\u8DEF\u5F84\uFF0C\u800C\u4E0D\u662F\u603B\u7ED3\u65E7\u8BDD\u3002
8a. \u6211\u662F\u5426\u786E\u5B9E\u62B5\u8FBE\u3010\u672C\u8F6E\u5FC5\u987B\u65B0\u589E\u7684\u8BBA\u8BC1\u5C42\u3011\uFF0C\u53C8\u907F\u5F00\u4E86\u3010\u5DF2\u7ECF\u5B8C\u6210\u7684\u8BBA\u8BC1\u5C42\u3011\uFF1F\u82E5\u53EA\u662F\u628A\u65E7\u7ED3\u8BBA\u6362\u6210\u65B0\u6BD4\u55BB\u3001\u5012\u88C5\u6216\u53CD\u95EE\uFF0C\u6574\u6BB5\u91CD\u5199\uFF1B\u82E5\u4E8B\u5B9E\u4E0D\u8DB3\uFF0C\u660E\u786E\u8BF4\u8FD8\u7F3A\u54EA\u9879\u53EF\u89C2\u5BDF\u4E8B\u5B9E\u3002
9. \u82E5\u7ED9\u4E86\u601D\u60F3\u951A\u70B9\uFF0C\u6211\u7684\u56DE\u7B54\u662F\u5426\u771F\u7684\u4F7F\u7528\u4E86\u5B83\u7684\u8BBA\u8BC1\u52A8\u4F5C\u3001\u533A\u522B\u6216\u53CD\u4F8B\uFF1B\u82E5\u53EA\u662F\u6362\u4E86\u51E0\u4E2A\u53E4\u5178\u540D\u8BCD\uFF0C\u5C31\u91CD\u65B0\u7EC4\u7EC7\u3002
10. \u6211\u662F\u5426\u5206\u6E05\u6750\u6599\u4E2D\u7684\u8BF4\u8BDD\u8005\uFF0C\u628A\u5BF9\u8BDD\u5BF9\u624B\u7684\u6311\u8845\u6216\u5B9A\u4E49\u8BEF\u8BF4\u6210\u4E86\u81EA\u5DF1\u7684\u5B9A\u8BBA\uFF1F\u82E5\u6709\uFF0C\u5C31\u6539\u6210\u5F85\u68C0\u9A8C\u7684\u4E3B\u5F20\u6216\u53CD\u65B9\u3002
11. \u6211\u662F\u5426\u7531\u4E00\u4EF6\u884C\u4E3A\u7ED9\u7B2C\u4E09\u65B9\u5B9A\u4E86\u5584\u6076\u672C\u8D28\uFF0C\u6216\u628A\u7528\u6237\u672A\u8BF4\u51FA\u53E3\u7684\u820D\u4E0D\u5F97\u3001\u6267\u7740\u3001\u771F\u6B63\u62C5\u5FE7\u585E\u8FDB\u95EE\u9898\uFF1F\u6709\u5C31\u9000\u56DE\u53EF\u89C2\u5BDF\u7684\u884C\u4E3A\u3001\u5B9A\u4E49\u548C\u540E\u679C\u3002
12. \u6211\u662F\u5426\u58F0\u79F0\u7528\u6237\u201C\u63D0\u5230\u3001\u8BF4\u8FC7\u3001\u6B63\u5728\u53CD\u601D\u3001\u6B63\u5728\u5BFB\u627E\u201D\u67D0\u4E2A\u5BF9\u8BDD\u91CC\u4ECE\u672A\u51FA\u73B0\u7684\u76EE\u6807\u6216\u9700\u8981\uFF1F\u662F\u5426\u628A\u201C\u82E5\u2026\u2026\u201D\u4E2D\u7684\u5047\u8BBE\u5728\u540E\u6587\u5F53\u6210\u4E8B\u5B9E\uFF1F\u6709\u5C31\u5220\u9664\uFF0C\u5B81\u53EF\u4FDD\u6301\u4E0D\u77E5\u9053\u3002

\u5B8C\u6210\u5185\u90E8\u81EA\u8BD8\u540E\uFF0C\u53EA\u8F93\u51FA\u4FEE\u6539\u597D\u7684\u89D2\u8272\u53F0\u8BCD\u3002\u4E0D\u5F97\u51FA\u73B0\u201C\u521D\u7A3F\u201D\u201C\u7EC8\u7A3F\u201D\u201C\u68C0\u67E5\u201D\u201C\u81EA\u95EE\u201D\u201C\u5BA1\u7A3F\u201D\u7B49\u52A0\u5DE5\u75D5\u8FF9\uFF0C\u4E5F\u4E0D\u5F97\u6C47\u62A5\u4F60\u6539\u4E86\u4EC0\u4E48\u3002`, j = `\u7528\u6237\u539F\u8BDD\uFF1A${e.userInput}
\u5019\u9009\u53F0\u8BCD\uFF1A${P}`, ke = await xe(x, I, j, { model: J, maxTokens: 520, temperature: Math.max(0.62, t.temperature - 0.12), topP: Math.min(0.88, t.topP), frequencyPenalty: 0.42, presencePenalty: 0.18, enableThinking: false }), X = Ie(ke, t, e.maxChars), ne = Te(X, D, v, o);
    (!ne.length || $e(ne, X, D)) && X && (P = X, Ke = true);
  }
  return { text: P, modelUsed: true, reflectionUsed: Ke };
}
function no(e, t, n) {
  const s = e ?? { turnCount: 0, questionCooldown: 0, consecutiveQuestionTurns: 0 }, o = !!(n && /[？?]/.test(n)), r = t.mode === "meta" ? 3 : Math.max(0, s.questionCooldown - 1), i = [t.analogyDomain, ...s.recentAnalogyDomains ?? (s.lastAnalogyDomain ? [s.lastAnalogyDomain] : [])].filter((d, m, g) => g.indexOf(d) === m).slice(0, Rt.length), l = [t.dialecticMove, ...s.recentDialecticMoves ?? (s.lastDialecticMove ? [s.lastDialecticMove] : [])].filter((d, m, g) => g.indexOf(d) === m).slice(0, 6), c = [t.retrieval.targetClaim, ...s.recentTargetClaims ?? []].map((d) => d?.trim()).filter((d) => !!d).filter((d, m, g) => g.indexOf(d) === m).slice(0, 8), u = [t.retrieval.newContribution, ...s.recentContributions ?? []].map((d) => d?.trim()).filter((d) => !!d).filter((d, m, g) => g.indexOf(d) === m).slice(0, 8);
  return { turnCount: s.turnCount + 1, questionCooldown: r, consecutiveQuestionTurns: o ? s.consecutiveQuestionTurns + 1 : 0, lastMode: t.mode, lastAnalogyDomain: t.analogyDomain, recentAnalogyDomains: i, lastDialecticMove: t.dialecticMove, recentDialecticMoves: l, recentTargetClaims: c, recentContributions: u };
}
export {
  no as advanceSocratesStateV2,
  Ks as createBaseSocratesPlan,
  to as generateSocratesReplyV2,
  Gs as prepareSocratesPlan
};
