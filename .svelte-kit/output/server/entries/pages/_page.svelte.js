import { k as is_array, j as get_prototype_of, o as object_prototype, a6 as ensure_array_like, a7 as attr_style, a8 as stringify, a9 as attr, e as escape_html, aa as bind_props, a5 as derived, ab as attr_class, ac as clsx } from "../../chunks/index.js";
import { invoke } from "@tauri-apps/api/core";
import "@tauri-apps/plugin-dialog";
const empty = [];
function snapshot(value, skip_warning = false, no_tojson = false) {
  return clone(value, /* @__PURE__ */ new Map(), "", empty, null, no_tojson);
}
function clone(value, cloned, path, paths, original = null, no_tojson = false) {
  if (typeof value === "object" && value !== null) {
    var unwrapped = cloned.get(value);
    if (unwrapped !== void 0) return unwrapped;
    if (value instanceof Map) return (
      /** @type {Snapshot<T>} */
      new Map(value)
    );
    if (value instanceof Set) return (
      /** @type {Snapshot<T>} */
      new Set(value)
    );
    if (is_array(value)) {
      var copy = (
        /** @type {Snapshot<any>} */
        Array(value.length)
      );
      cloned.set(value, copy);
      if (original !== null) {
        cloned.set(original, copy);
      }
      for (var i = 0; i < value.length; i += 1) {
        var element = value[i];
        if (i in value) {
          copy[i] = clone(element, cloned, path, paths, null, no_tojson);
        }
      }
      return copy;
    }
    if (get_prototype_of(value) === object_prototype) {
      copy = {};
      cloned.set(value, copy);
      if (original !== null) {
        cloned.set(original, copy);
      }
      for (var key of Object.keys(value)) {
        copy[key] = clone(
          // @ts-expect-error
          value[key],
          cloned,
          path,
          paths,
          null,
          no_tojson
        );
      }
      return copy;
    }
    if (value instanceof Date) {
      value.getTime();
      return (
        /** @type {Snapshot<T>} */
        structuredClone(value)
      );
    }
    if (typeof /** @type {T & { toJSON?: any } } */
    value.toJSON === "function" && !no_tojson) {
      return clone(
        /** @type {T & { toJSON(): any } } */
        value.toJSON(),
        cloned,
        path,
        paths,
        // Associate the instance with the toJSON clone
        value
      );
    }
  }
  if (value instanceof EventTarget) {
    return (
      /** @type {Snapshot<T>} */
      value
    );
  }
  try {
    return (
      /** @type {Snapshot<T>} */
      structuredClone(value)
    );
  } catch (e) {
    return (
      /** @type {Snapshot<T>} */
      value
    );
  }
}
function html(value) {
  var html2 = String(value ?? "");
  var open = "<!---->";
  return open + html2 + "<!---->";
}
const app = { view: "themes", busy: false, msg: "", kind: "" };
function say(msg, kind = "") {
  app.msg = msg;
  app.kind = kind;
}
const DEFAULT_SPEC = () => ({
  pkg: {
    name: "my-cli",
    bin: "mycli",
    version: "0.1.0",
    language: "ts",
    description: "What this tool does, in one line."
  },
  globals: [
    { id: "g1", short: "c", long: "config", type: "string", value: "path", def: "", choices: "", desc: "Path to the config file." }
  ],
  commands: [
    {
      id: "c1",
      parent: null,
      name: "build",
      alias: "b",
      desc: "Compile the project.",
      args: [{ id: "a1", name: "entry", arity: "required", def: "", desc: "Files to compile." }],
      opts: [{ id: "o1", short: "w", long: "watch", type: "boolean", value: "", def: "", choices: "", desc: "Rebuild on change." }]
    }
  ]
});
const q = (s) => JSON.stringify(String(s ?? ""));
const kids = (spec, id) => spec.commands.filter((c) => c.parent === (id === "root" ? null : id));
const byId = (spec, id) => id === "root" ? null : spec.commands.find((c) => c.id === id) ?? null;
function chain(spec, id) {
  const out = [];
  let n = byId(spec, id);
  while (n) {
    out.unshift(n);
    n = n.parent ? byId(spec, n.parent) : null;
  }
  return out;
}
const isLeaf = (spec, c) => kids(spec, c.id).length === 0;
function argToken(a) {
  const n = a.name || "arg";
  if (a.arity === "variadic") return `[${n}...]`;
  if (a.arity === "optional") return `[${n}]`;
  return `<${n}>`;
}
function optFlags(o) {
  const head = (o.short ? `-${o.short}, ` : "") + "--" + (o.long || "option");
  return o.type === "boolean" ? head : `${head} <${o.value || "value"}>`;
}
function ArgvTree($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { spec, sel = void 0 } = $$props;
    function rows() {
      const out = [
        {
          id: "root",
          name: spec.pkg.bin || "cli",
          depth: 0,
          subs: kids(spec, "root").length,
          glyph: "◆"
        }
      ];
      const walk = (pid, depth) => {
        for (const c of kids(spec, pid)) {
          const n = kids(spec, c.id).length;
          out.push({
            id: c.id,
            name: c.name || "?",
            depth,
            subs: n,
            glyph: n ? "▸" : "·",
            count: n ? `${n}▸` : String(c.args.length + c.opts.length || "")
          });
          walk(c.id, depth + 1);
        }
      };
      walk("root", 1);
      return out;
    }
    const list = derived(rows);
    $$renderer2.push(`<div class="tree svelte-5ds02t"><!--[-->`);
    const each_array = ensure_array_like(list());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let r = each_array[$$index];
      $$renderer2.push(`<button class="node svelte-5ds02t"${attr_style(`padding-left:${stringify(8 + r.depth * 14)}px`)}${attr("aria-current", sel === r.id)}><span class="glyph svelte-5ds02t">${escape_html(r.glyph)}</span> <span class="nm svelte-5ds02t">${escape_html(r.name)}</span> <span class="count svelte-5ds02t">${escape_html(r.id === "root" ? r.subs : r.count)}</span></button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="acts svelte-5ds02t"><button class="btn svelte-5ds02t">+ Command</button> <button class="btn svelte-5ds02t">+ Sub</button> <button class="btn svelte-5ds02t"${attr("disabled", sel === "root", true)}>Delete</button></div>`);
    bind_props($$props, { sel });
  });
}
function ArgvEditor($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { spec, sel } = $$props;
    const node = derived(() => byId(spec, sel));
    const leaf = derived(() => node() ? isLeaf(spec, node()) : false);
    const title = derived(() => node() ? chain(spec, sel).map((c) => c.name).join(" ") : "Program");
    const TYPES = [
      ["boolean", "flag"],
      ["string", "string"],
      ["number", "number"],
      ["enum", "choice"]
    ];
    const ARITY = ["required", "optional", "variadic"];
    function optRow($$renderer3, list, o) {
      $$renderer3.push(`<div class="row svelte-198ji6w"><div class="line svelte-198ji6w"><input class="w-xs mono svelte-198ji6w"${attr("value", o.short)} placeholder="-x" maxlength="1"/> <input class="grow mono svelte-198ji6w"${attr("value", o.long)} placeholder="long-name"/> `);
      $$renderer3.select(
        { value: o.type, class: "" },
        ($$renderer4) => {
          $$renderer4.push(`<!--[-->`);
          const each_array = ensure_array_like(TYPES);
          for (let $$index_4 = 0, $$length = each_array.length; $$index_4 < $$length; $$index_4++) {
            let [v, label] = each_array[$$index_4];
            $$renderer4.option({ value: v }, ($$renderer5) => {
              $$renderer5.push(`${escape_html(label)}`);
            });
          }
          $$renderer4.push(`<!--]-->`);
        },
        "svelte-198ji6w"
      );
      $$renderer3.push(` `);
      if (o.type !== "boolean") {
        $$renderer3.push(`<!--[0--><input class="w-s mono svelte-198ji6w"${attr("value", o.value)} placeholder="value"/>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <input class="w-s mono svelte-198ji6w"${attr("value", o.def)} placeholder="default"/> <button class="kill svelte-198ji6w">✕</button></div> `);
      if (o.type === "enum") {
        $$renderer3.push(`<!--[0--><input class="desc mono svelte-198ji6w"${attr("value", o.choices)} placeholder="Choices, comma separated"/>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <input class="desc svelte-198ji6w"${attr("value", o.desc)} placeholder="What this flag does"/> <span class="preview svelte-198ji6w">${escape_html(optFlags(o))}</span></div>`);
    }
    $$renderer2.push(`<div class="head svelte-198ji6w"><span class="eyebrow svelte-198ji6w">${escape_html(title())}</span></div> <div class="body svelte-198ji6w">`);
    if (!node()) {
      $$renderer2.push(`<!--[0--><div class="fields svelte-198ji6w"><label class="f svelte-198ji6w"><span class="svelte-198ji6w">Package name</span><input class="mono svelte-198ji6w"${attr("value", spec.pkg.name)}/></label> <label class="f svelte-198ji6w"><span class="svelte-198ji6w">Binary</span><input class="mono svelte-198ji6w"${attr("value", spec.pkg.bin)}/></label> <label class="f svelte-198ji6w"><span class="svelte-198ji6w">Version</span><input class="mono svelte-198ji6w"${attr("value", spec.pkg.version)}/></label> <label class="f svelte-198ji6w"><span class="svelte-198ji6w">Language</span> `);
      $$renderer2.select(
        { value: spec.pkg.language, class: "" },
        ($$renderer3) => {
          $$renderer3.option({ value: "ts" }, ($$renderer4) => {
            $$renderer4.push(`TypeScript`);
          });
          $$renderer3.option({ value: "js" }, ($$renderer4) => {
            $$renderer4.push(`JavaScript`);
          });
        },
        "svelte-198ji6w"
      );
      $$renderer2.push(`</label> <label class="f wide svelte-198ji6w"><span class="svelte-198ji6w">Summary</span><textarea class="svelte-198ji6w">`);
      const $$body = escape_html(spec.pkg.description);
      if ($$body) {
        $$renderer2.push(`${$$body}`);
      }
      $$renderer2.push(`</textarea></label></div> <div class="sect svelte-198ji6w"><div class="secthead svelte-198ji6w"><span class="eyebrow svelte-198ji6w">Global options</span> <button class="btn svelte-198ji6w">+ Option</button></div> `);
      if (!spec.globals.length) {
        $$renderer2.push(`<!--[0--><p class="hint svelte-198ji6w">None. Globals are visible to every command.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array_1 = ensure_array_like(spec.globals);
      for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
        let o = each_array_1[$$index];
        optRow($$renderer2, spec.globals, o);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push(`<!--[-1--><div class="fields svelte-198ji6w"><label class="f svelte-198ji6w"><span class="svelte-198ji6w">Name</span><input class="mono svelte-198ji6w"${attr("value", node().name)}/></label> <label class="f svelte-198ji6w"><span class="svelte-198ji6w">Alias</span><input class="mono svelte-198ji6w"${attr("value", node().alias)} placeholder="b"/></label> <label class="f wide svelte-198ji6w"><span class="svelte-198ji6w">Summary</span><textarea class="svelte-198ji6w">`);
      const $$body_1 = escape_html(node().desc);
      if ($$body_1) {
        $$renderer2.push(`${$$body_1}`);
      }
      $$renderer2.push(`</textarea></label></div> <div class="sect svelte-198ji6w"><div class="secthead svelte-198ji6w"><span class="eyebrow svelte-198ji6w">Arguments</span> <button class="btn svelte-198ji6w"${attr("disabled", !leaf(), true)}>+ Argument</button></div> `);
      if (!leaf()) {
        $$renderer2.push(`<!--[0--><p class="hint svelte-198ji6w">This command dispatches to subcommands, so it takes no positionals of its own.</p>`);
      } else if (!node().args.length) {
        $$renderer2.push(`<!--[1--><p class="hint svelte-198ji6w">No positional arguments.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (leaf()) {
        $$renderer2.push(`<!--[0--><!--[-->`);
        const each_array_2 = ensure_array_like(node().args);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let a = each_array_2[$$index_2];
          $$renderer2.push(`<div class="row svelte-198ji6w"><div class="line svelte-198ji6w"><span${attr_class("tag svelte-198ji6w", void 0, { "req": a.arity === "required" })}>${escape_html(argToken(a))}</span> <input class="grow mono svelte-198ji6w"${attr("value", a.name)} placeholder="name"/> `);
          $$renderer2.select(
            { value: a.arity, class: "" },
            ($$renderer3) => {
              $$renderer3.push(`<!--[-->`);
              const each_array_3 = ensure_array_like(ARITY);
              for (let $$index_1 = 0, $$length2 = each_array_3.length; $$index_1 < $$length2; $$index_1++) {
                let k = each_array_3[$$index_1];
                $$renderer3.option({ value: k }, ($$renderer4) => {
                  $$renderer4.push(`${escape_html(k)}`);
                });
              }
              $$renderer3.push(`<!--]-->`);
            },
            "svelte-198ji6w"
          );
          $$renderer2.push(` <input class="w-m mono svelte-198ji6w"${attr("value", a.def)} placeholder="default"/> <button class="kill svelte-198ji6w">✕</button></div> <input class="desc svelte-198ji6w"${attr("value", a.desc)} placeholder="What this argument is for"/></div>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="sect svelte-198ji6w"><div class="secthead svelte-198ji6w"><span class="eyebrow svelte-198ji6w">Options</span> <button class="btn svelte-198ji6w">+ Option</button></div> `);
      if (!node().opts.length) {
        $$renderer2.push(`<!--[0--><p class="hint svelte-198ji6w">No options of its own.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array_4 = ensure_array_like(node().opts);
      for (let $$index_3 = 0, $$length = each_array_4.length; $$index_3 < $$length; $$index_3++) {
        let o = each_array_4[$$index_3];
        optRow($$renderer2, node().opts, o);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
const HELP_OPT = { id: "", short: "h", long: "help", type: "boolean", value: "", def: "", choices: "", desc: "display help for command" };
const VERSION_OPT = { id: "", short: "V", long: "version", type: "boolean", value: "", def: "", choices: "", desc: "output the version number" };
function listedOpts(spec, id) {
  const node = byId(spec, id);
  return node ? [...node.opts, HELP_OPT] : [VERSION_OPT, ...spec.globals ?? [], HELP_OPT];
}
const titleOf = (c) => c.name + (c.alias ? "|" + c.alias : "");
function usageTail(spec, id) {
  const node = byId(spec, id);
  const subs = kids(spec, id);
  const tail = ["[options]"];
  if (subs.length) tail.push("[command]");
  else for (const a of node?.args ?? []) tail.push(argToken(a));
  return tail;
}
function listingTail(spec, c) {
  const tail = [];
  if (c.opts.length) tail.push("[options]");
  if (!kids(spec, c.id).length) for (const a of c.args) tail.push(argToken(a));
  return tail;
}
function usageParts(spec, id) {
  const parts = [{ t: "bin", v: spec.pkg.bin || "cli" }];
  const path = chain(spec, id);
  path.forEach((c, i) => parts.push({ t: "cmd", v: i === path.length - 1 ? titleOf(c) : c.name }));
  for (const v of usageTail(spec, id)) {
    parts.push({ t: v === "[options]" ? "opt" : v === "[command]" ? "sub" : v.startsWith("<") ? "req" : "optarg", v });
  }
  return parts;
}
const usageLine = (spec, id) => usageParts(spec, id).map((p) => p.v).join(" ");
const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));
function optTail(o) {
  let tail = o.desc || "";
  const bits = [];
  if (o.type === "enum" && o.choices) {
    bits.push("choices: " + String(o.choices).split(",").map((s) => q(s.trim())).join(", "));
  }
  if (o.def) bits.push("default: " + (o.type === "number" ? o.def : q(o.def)));
  return bits.length ? `${tail}${tail ? " " : ""}(${bits.join(", ")})` : tail;
}
function helpLines(spec, id) {
  const node = byId(spec, id);
  const subs = kids(spec, id);
  const args = subs.length ? [] : node?.args ?? [];
  const opts = listedOpts(spec, id);
  const cmdTitles = subs.map((s) => [titleOf(s), ...listingTail(spec, s)].join(" "));
  if (subs.length) cmdTitles.push("help [command]");
  const width = Math.max(
    ...args.map((a) => (a.name || "arg").length),
    ...opts.map((o) => optFlags(o).length),
    ...cmdTitles.map((t) => t.length),
    0
  ) + 2;
  const out = [{ c: "", t: "Usage: " + usageLine(spec, id) }, { c: "", t: "" }];
  const desc = node ? node.desc : spec.pkg.description;
  if (desc) out.push({ c: "", t: desc }, { c: "", t: "" });
  if (args.length) {
    out.push({ c: "", t: "Arguments:" });
    for (const a of args) {
      const tail = (a.desc || "") + (a.def ? ` (default: ${q(a.def)})` : "");
      out.push({ c: "a", t: "  " + (tail ? pad(a.name || "arg", width) + tail : a.name || "arg") });
    }
    out.push({ c: "", t: "" });
  }
  out.push({ c: "", t: "Options:" });
  for (const o of opts) {
    const tail = optTail(o);
    out.push({ c: "k", t: "  " + (tail ? pad(optFlags(o), width) + tail : optFlags(o)) });
  }
  if (subs.length) {
    out.push({ c: "", t: "" }, { c: "", t: "Commands:" });
    subs.forEach((s, i) => {
      const tail = s.desc || "";
      out.push({ c: "k", t: "  " + (tail ? pad(cmdTitles[i], width) + tail : cmdTitles[i]) });
    });
    const last = cmdTitles[cmdTitles.length - 1];
    out.push({ c: "k", t: "  " + pad(last, width) + "display help for command" });
  }
  return out;
}
JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir: "dist",
    rootDir: "src",
    strict: true,
    declaration: true,
    esModuleInterop: true,
    skipLibCheck: true
  },
  include: ["src"]
}, null, 2) + "\n";
function ArgvOutput($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { spec, sel } = $$props;
    let tab = "help";
    const help = derived(() => helpLines(spec, sel));
    const invocation = derived(() => [
      spec.pkg.bin || "cli",
      ...chain(spec, sel).map((c) => c.name),
      "--help"
    ].join(" "));
    $$renderer2.push(`<div class="head svelte-6dnx8o"><div class="tabs svelte-6dnx8o" role="tablist"><!--[-->`);
    const each_array = ensure_array_like([["help", "--help"], ["try", "Try"], ["package", "Package"]]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let [id, label] = each_array[$$index];
      $$renderer2.push(`<button class="tab svelte-6dnx8o" role="tab"${attr("aria-selected", tab === id)}>${escape_html(label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="body svelte-6dnx8o">`);
    {
      $$renderer2.push(`<!--[0--><div class="screen svelte-6dnx8o"><div class="ln svelte-6dnx8o"><span class="prompt svelte-6dnx8o">$</span> ${escape_html(invocation())}</div> <div class="ln svelte-6dnx8o"> </div> <!--[-->`);
      const each_array_1 = ensure_array_like(help());
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let l = each_array_1[$$index_1];
        $$renderer2.push(`<div${attr_class(`ln ${stringify(l.c)}`, "svelte-6dnx8o")}>${escape_html(l.t || " ")}</div>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="acts svelte-6dnx8o"><button class="btn">${escape_html("Copy")}</button> <span class="note svelte-6dnx8o">Byte-identical to what compiled commander prints.</span></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
const argv = {
  spec: DEFAULT_SPEC(),
  sel: "root",
  loaded: false,
  saving: false,
  baseline: ""
};
function usage() {
  return usageParts(argv.spec, argv.sel);
}
function loadSpec() {
  invoke("argv_load").then((found) => {
    if (found?.pkg && found?.commands) argv.spec = found;
  }).catch(() => {
  }).finally(() => {
    argv.baseline = JSON.stringify(snapshot(argv.spec));
    argv.loaded = true;
  });
}
function Surface$4($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="bench svelte-1va89ee"><div class="cols svelte-1va89ee"><div class="col tree svelte-1va89ee">`);
      ArgvTree($$renderer3, {
        spec: argv.spec,
        get sel() {
          return argv.sel;
        },
        set sel($$value) {
          argv.sel = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----></div> <div class="col mid svelte-1va89ee">`);
      ArgvEditor($$renderer3, { spec: argv.spec, sel: argv.sel });
      $$renderer3.push(`<!----></div> <div class="col out svelte-1va89ee">`);
      ArgvOutput($$renderer3, { spec: argv.spec, sel: argv.sel });
      $$renderer3.push(`<!----></div></div></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function Toolbar$3($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="usage"><!--[-->`);
    const each_array = ensure_array_like(usage());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let p = each_array[$$index];
      $$renderer2.push(`<span${attr_class(clsx(p.t))}>${escape_html(p.v)}</span> `);
    }
    $$renderer2.push(`<!--]--></div> <button class="btn">Reset</button> <button class="btn primary"${attr("disabled", argv.saving, true)}>${escape_html("Save spec")}</button>`);
  });
}
const argvSurface = {
  id: "argv",
  label: "Argv",
  full: true,
  component: Surface$4,
  toolbar: Toolbar$3,
  load: loadSpec
};
const listeners = /* @__PURE__ */ new Map();
function on(event, handler) {
  let set = listeners.get(event);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    listeners.set(event, set);
  }
  const h = handler;
  set.add(h);
  return () => {
    set.delete(h);
    if (set.size === 0) listeners.delete(event);
  };
}
const IMPORT_PAIR = "themes:import-pair";
const themes = {
  doc: null,
  schema: { ui: [] },
  cur: 0,
  file: "palette.ts",
  dirty: false,
  dir: "",
  vsix: ""
};
const eff = (mode, key, from) => mode.ui?.[key] ?? mode[from];
async function load$1() {
  app.busy = true;
  try {
    const res = await invoke("load");
    themes.doc = res.palettes;
    themes.schema = res.schema;
    themes.dir = res.dir;
    themes.cur = 0;
    themes.dirty = false;
  } catch (e) {
    say(String(e), "bad");
  } finally {
    app.busy = false;
  }
}
function importPair(payload) {
  if (!themes.doc) {
    say("Themes are not loaded — the pair was not imported.", "bad");
    return;
  }
  const taken = new Set(themes.doc.themes.map((t) => t.name));
  let final = payload.name.trim();
  if (taken.has(final)) {
    let n = 2;
    while (taken.has(`${final} ${n}`)) n++;
    final = `${final} ${n}`;
  }
  themes.doc.themes.push({
    name: final,
    family: payload.family || Object.keys(themes.doc.families)[0],
    tag: payload.tag,
    thesis: payload.thesis,
    light: payload.light,
    dark: payload.dark,
    semantic: payload.semantic
  });
  themes.cur = themes.doc.themes.length - 1;
  themes.dirty = true;
  app.view = "themes";
  say(`added "${final}" — save to write it to palettes.json`, "ok");
}
on(IMPORT_PAIR, importPair);
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const grouped = derived(() => Object.entries(themes.doc.families).map(([id, fam]) => ({
      id,
      label: fam.label,
      items: themes.doc.themes.map((t, i) => ({ t, i })).filter(({ t }) => t.family === id)
    })).filter((g) => g.items.length));
    $$renderer2.push(`<aside class="svelte-636fy3"><!--[-->`);
    const each_array = ensure_array_like(grouped());
    for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
      let g = each_array[$$index_1];
      $$renderer2.push(`<div class="fam svelte-636fy3">${escape_html(g.label)} · ${escape_html(g.items.length)}</div> <!--[-->`);
      const each_array_1 = ensure_array_like(g.items);
      for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
        let { t, i } = each_array_1[$$index];
        $$renderer2.push(`<button${attr_class("item svelte-636fy3", void 0, { "on": i === themes.cur })}><span class="pair svelte-636fy3"><i${attr_style(`background:${stringify(t.light.bg)}`)} class="svelte-636fy3"></i> <i${attr_style(`background:${stringify(t.dark.bg)}`)} class="svelte-636fy3"></i> <i${attr_style(`background:${stringify(t.light.accent)}`)} class="svelte-636fy3"></i></span> <span class="nm svelte-636fy3">${escape_html(t.name)}</span></button>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> <div class="acts svelte-636fy3"><button class="btn svelte-636fy3">New</button> <button class="btn svelte-636fy3">Dupe</button> <button class="btn svelte-636fy3">Delete</button></div></aside>`);
  });
}
const SAMPLES = {
  "palette.ts": {
    active: 13,
    lines: [
      '<span class="c">// token colours resolve against the active scope</span>',
      "",
      '<span class="k">import</span> <span class="x">{</span> <span class="f">defineTheme</span> <span class="x">}</span> <span class="k">from</span> <span class="s">"./palette"</span><span class="x">;</span>',
      "",
      '<span class="k">const</span> <span class="n">CONTRAST_MIN</span> <span class="o">=</span> <span class="n">4.5</span><span class="x">;</span>',
      "",
      '<span class="k">export</span> <span class="k">interface</span> <span class="t">Swatch</span> <span class="x">{</span>',
      '  <span class="p">scope</span><span class="x">:</span> <span class="t">string</span><span class="x">;</span>',
      '  <span class="p">hex</span><span class="x">:</span> <span class="t">string</span><span class="x">;</span>',
      '<span class="x">}</span>',
      "",
      '<span class="k">export</span> <span class="k">function</span> <span class="f">resolve</span><span class="x">(</span><span class="p">list</span><span class="x">:</span> <span class="t">Swatch</span><span class="x">[],</span> <span class="p">scope</span><span class="x">:</span> <span class="t">string</span><span class="x">)</span> <span class="x">{</span>',
      '  <span class="k">const</span> <span class="p">hit</span> <span class="o">=</span> <span class="p">list</span><span class="x">.</span><span class="f">find</span><span class="x">((</span><span class="p">s</span><span class="x">)</span> <span class="o">=&gt;</span> <span class="p">s</span><span class="x">.</span><span class="p">scope</span> <span class="o">===</span> <span class="sel">scope</span><span class="cur"></span><span class="x">);</span>',
      '  <span class="k">if</span> <span class="x">(</span><span class="o">!</span><span class="p">hit</span><span class="x">)</span> <span class="k">throw</span> <span class="k">new</span> <span class="t">Error</span><span class="x">(</span><span class="s">`no swatch for ${scope}`</span><span class="x">);</span>',
      '  <span class="k">return</span> <span class="x">{</span> <span class="p">hex</span><span class="x">:</span> <span class="p">hit</span><span class="x">.</span><span class="p">hex</span><span class="x">,</span> <span class="p">ratio</span><span class="x">:</span> <span class="n">CONTRAST_MIN</span> <span class="x">};</span>',
      '<span class="x">}</span>'
    ]
  },
  "theme.json": {
    active: 6,
    lines: [
      '<span class="x">{</span>',
      '  <span class="p">"name"</span><span class="x">:</span> <span class="s">"Daylight Bone"</span><span class="x">,</span>',
      '  <span class="p">"type"</span><span class="x">:</span> <span class="s">"light"</span><span class="x">,</span>',
      '  <span class="p">"semanticHighlighting"</span><span class="x">:</span> <span class="n">true</span><span class="x">,</span>',
      '  <span class="p">"colors"</span><span class="x">:</span> <span class="x">{</span>',
      '    <span class="p">"editor.background"</span><span class="x">:</span> <span class="s">"#FCFCFC"</span><span class="x">,</span>',
      '    <span class="p">"editorCursor.foreground"</span><span class="x">:</span> <span class="s">"#FF9940"</span><span class="x">,</span>',
      '    <span class="p">"sideBar.background"</span><span class="x">:</span> <span class="s">"#F3F4F5"</span>',
      '  <span class="x">},</span>',
      '  <span class="p">"tokenColors"</span><span class="x">:</span> <span class="x">[</span>',
      '    <span class="x">{</span>',
      '      <span class="p">"scope"</span><span class="x">:</span> <span class="x">[</span><span class="s">"comment"</span><span class="x">],</span>',
      '      <span class="p">"settings"</span><span class="x">:</span> <span class="x">{</span> <span class="p">"fontStyle"</span><span class="x">:</span> <span class="s">"italic"</span> <span class="x">}</span>',
      '    <span class="x">}</span>',
      '  <span class="x">]</span>',
      '<span class="x">}</span>'
    ]
  },
  "tokens.css": {
    active: 9,
    lines: [
      '<span class="c">/* surfaces derive from two neutrals */</span>',
      '<span class="t">:root</span> <span class="x">{</span>',
      '  <span class="p">--ground</span><span class="x">:</span> <span class="n">#fcfcfc</span><span class="x">;</span>',
      '  <span class="p">--ink</span><span class="x">:</span> <span class="n">#5c6166</span><span class="x">;</span>',
      '  <span class="p">--accent</span><span class="x">:</span> <span class="n">#ff9940</span><span class="x">;</span>',
      '<span class="x">}</span>',
      "",
      '<span class="t">.editor__gutter</span> <span class="x">{</span>',
      '  <span class="p">color</span><span class="x">:</span> <span class="f">var</span><span class="x">(</span><span class="p">--ink</span><span class="x">);</span>',
      '  <span class="p">font-variant-numeric</span><span class="x">:</span> <span class="s">tabular-nums</span><span class="x">;</span>',
      '  <span class="p">padding</span><span class="x">:</span> <span class="n">0</span> <span class="n">12px</span> <span class="n">0</span> <span class="n">14px</span><span class="x">;</span>',
      '<span class="x">}</span>',
      "",
      '<span class="k">@media</span> <span class="x">(</span><span class="p">prefers-color-scheme</span><span class="x">:</span> <span class="s">dark</span><span class="x">)</span> <span class="x">{</span>',
      '  <span class="t">:root</span> <span class="x">{</span> <span class="p">--ground</span><span class="x">:</span> <span class="n">#16181a</span><span class="x">;</span> <span class="x">}</span>',
      '<span class="x">}</span>'
    ]
  },
  "README.md": {
    active: 1,
    lines: [
      '<span class="t"><b># Daylight Bone</b></span>',
      "",
      "Warm near-white, foreground held short of black.",
      "Chrome barely separates from the page.",
      "",
      '<span class="t"><b>## Roles</b></span>',
      "",
      '<span class="x">-</span> <span class="s">`editor.background`</span> is the page itself',
      '<span class="x">-</span> <span class="k"><b>**accent**</b></span> carries cursor and keyword',
      '<span class="x">-</span> <span class="c"><i>*comments*</i></span> recede almost to the paper',
      "",
      '<span class="x">[</span><span class="a">contrast notes</span><span class="x">](</span><span class="s">./README.md#contrast</span><span class="x">)</span>',
      "",
      '<span class="c">&gt; A red squiggle that reads as ink is one you miss.</span>'
    ]
  }
};
const FILES = Object.keys(SAMPLES);
function Mock($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { mode, name } = $$props;
    const chrome = derived(() => ({
      bg: mode.bg,
      fg: mode.fg,
      comment: mode.comment,
      key: mode.key,
      str: mode.str,
      fn: mode.fn,
      num: mode.num,
      type: mode.type,
      op: mode.op,
      prop: mode.prop,
      punct: mode.punct,
      accent: mode.accent,
      sel: mode.sel,
      "side-bg": eff(mode, "sidebar.bg", "alt"),
      "side-fg": eff(mode, "sidebar.fg", "fg"),
      "side-border": eff(mode, "sidebar.border", "border"),
      "side-title": eff(mode, "sidebar.title", "punct"),
      "row-bg": eff(mode, "list.activeBg", "sel"),
      "row-fg": eff(mode, "list.activeFg", "fg"),
      "tab-strip": eff(mode, "tab.stripBg", "alt"),
      "tab-abg": eff(mode, "tab.activeBg", "bg"),
      "tab-afg": eff(mode, "tab.activeFg", "fg"),
      "tab-ibg": eff(mode, "tab.inactiveBg", "alt"),
      "tab-ifg": eff(mode, "tab.inactiveFg", "punct"),
      "tab-border": eff(mode, "tab.border", "border"),
      "tab-top": eff(mode, "tab.activeTop", "accent"),
      "status-bg": eff(mode, "statusBar.bg", "alt"),
      "status-fg": eff(mode, "statusBar.fg", "op"),
      gutter: eff(mode, "gutter.fg", "punct"),
      "gutter-on": eff(mode, "gutter.activeFg", "accent")
    }));
    const vars = derived(() => Object.entries(chrome()).map(([k, v]) => `--m-${k}:${v}`).join(";"));
    const sample = derived(() => SAMPLES[themes.file]);
    const lang = derived(() => themes.file.split(".").pop().toUpperCase());
    $$renderer2.push(`<div class="mock svelte-zky279"${attr_style(vars())}><div class="rail svelte-zky279"><div class="ttl svelte-zky279">Explorer</div> <!--[-->`);
    const each_array = ensure_array_like(FILES);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let f = each_array[$$index];
      $$renderer2.push(`<button${attr_class("svelte-zky279", void 0, { "on": f === themes.file })}>${escape_html(f)}</button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="main svelte-zky279"><div class="tabs svelte-zky279"><!--[-->`);
    const each_array_1 = ensure_array_like(FILES.slice(0, 2));
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let f = each_array_1[$$index_1];
      $$renderer2.push(`<button${attr_class("svelte-zky279", void 0, { "on": f === themes.file })}>${escape_html(f)}</button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="code svelte-zky279"><div class="gut svelte-zky279"><!--[-->`);
    const each_array_2 = ensure_array_like(sample().lines);
    for (let i = 0, $$length = each_array_2.length; i < $$length; i++) {
      each_array_2[i];
      $$renderer2.push(`<span${attr_class("svelte-zky279", void 0, { "on": i + 1 === sample().active })}>${escape_html(i + 1)}</span>
`);
    }
    $$renderer2.push(`<!--]--></div> <div class="src svelte-zky279">${html(sample().lines.join("\n"))}</div></div> <div class="status svelte-zky279"><span class="nm svelte-zky279">${escape_html(name)}</span> <span>Ln ${escape_html(sample().active)} · ${escape_html(lang())}</span></div></div></div>`);
  });
}
function lum(hex) {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
const grade = (r) => r >= 7 ? "AAA" : r >= 4.5 ? "AA" : "under AA";
function ColorCell($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      value,
      inherited = false,
      contrast = "",
      against = null,
      palette = null,
      onset,
      onclear = null
    } = $$props;
    let bad = false;
    let open = false;
    $$renderer2.push(`<div class="cc svelte-11w5t0a"><button class="sw svelte-11w5t0a"${attr_style(`background:${stringify(value)}`)} aria-label="Pick colour"${attr("aria-expanded", open)}></button> <input type="text"${attr("value", value)} spellcheck="false"${attr("title", inherited ? "inherited — type to pin it" : "pinned")}${attr_class("svelte-11w5t0a", void 0, { "inherit": inherited, "bad": bad })}/> `);
    if (contrast) {
      $$renderer2.push(`<!--[0--><span class="ctr svelte-11w5t0a">${escape_html(contrast)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (onclear) {
      $$renderer2.push(`<!--[0--><button${attr_class("rst svelte-11w5t0a", void 0, { "on": !inherited })} title="restore inheritance">×</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function RoleTable($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { entry } = $$props;
    const NOTE = {
      bg: "editor.background",
      alt: "sidebar, tabs, status bar",
      border: "hairlines between surfaces",
      sel: "selection + active row",
      fg: "body text",
      comment: "comments (italic)",
      punct: "brackets, line numbers",
      op: "operators",
      key: "keywords, storage",
      str: "strings",
      num: "numbers, constants",
      fn: "function names",
      type: "types, classes, tags",
      prop: "variables, properties",
      accent: "cursor, active tab, badges"
    };
    const modes = derived(() => [
      ["light", themes.doc.meta.lightPrefix],
      ["dark", themes.doc.meta.darkPrefix]
    ]);
    function set(kind, role, v) {
      entry[kind][role] = v;
      themes.dirty = true;
    }
    $$renderer2.push(`<table class="roles"><thead><tr><th>role</th><!--[-->`);
    const each_array = ensure_array_like(modes());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let [, label] = each_array[$$index];
      $$renderer2.push(`<th>${escape_html(label)}</th>`);
    }
    $$renderer2.push(`<!--]--></tr></thead><tbody><!--[-->`);
    const each_array_1 = ensure_array_like(themes.doc.roles);
    for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
      let role = each_array_1[$$index_2];
      $$renderer2.push(`<tr><td class="rl">${escape_html(role)}<small>${escape_html(NOTE[role] ?? "")}</small></td><!--[-->`);
      const each_array_2 = ensure_array_like(modes());
      for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
        let [kind] = each_array_2[$$index_1];
        $$renderer2.push(`<td>`);
        ColorCell($$renderer2, {
          value: entry[kind][role],
          contrast: role === "bg" ? "" : ratio(entry[kind].bg, entry[kind][role]).toFixed(2) + ":1",
          against: role === "bg" ? null : entry[kind].bg,
          palette: entry[kind],
          onset: (v) => set(kind, role, v)
        });
        $$renderer2.push(`<!----></td>`);
      }
      $$renderer2.push(`<!--]--></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table>`);
  });
}
function WorkbenchTable($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { entry } = $$props;
    const modes = derived(() => [
      ["light", themes.doc.meta.lightPrefix],
      ["dark", themes.doc.meta.darkPrefix]
    ]);
    function pin(kind, key, v) {
      entry[kind].ui ??= {};
      entry[kind].ui[key] = v;
      themes.dirty = true;
    }
    function clear(kind, key) {
      const ui = entry[kind].ui;
      if (!ui) return;
      delete ui[key];
      if (!Object.keys(ui).length) delete entry[kind].ui;
      themes.dirty = true;
    }
    $$renderer2.push(`<table class="roles"><thead><tr><th>surface</th><!--[-->`);
    const each_array = ensure_array_like(modes());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let [, label] = each_array[$$index];
      $$renderer2.push(`<th>${escape_html(label)}</th>`);
    }
    $$renderer2.push(`<!--]--></tr></thead><tbody><!--[-->`);
    const each_array_1 = ensure_array_like(themes.schema.ui);
    for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
      let u = each_array_1[i];
      if (i === 0 || themes.schema.ui[i - 1].group !== u.group) {
        $$renderer2.push(`<!--[0--><tr><td colspan="3" class="wbgrp">${escape_html(u.group)}</td></tr>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <tr><td class="rl">${escape_html(u.label)}<code>${escape_html(u.key)}</code></td><!--[-->`);
      const each_array_2 = ensure_array_like(modes());
      for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
        let [kind] = each_array_2[$$index_1];
        $$renderer2.push(`<td>`);
        ColorCell($$renderer2, {
          value: eff(entry[kind], u.key, u.from),
          inherited: entry[kind].ui?.[u.key] === void 0,
          against: entry[kind].bg,
          palette: entry[kind],
          onset: (v) => pin(kind, u.key, v),
          onclear: () => clear(kind, u.key)
        });
        $$renderer2.push(`<!----></td>`);
      }
      $$renderer2.push(`<!--]--></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table>`);
  });
}
function Surface$3($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const entry = derived(() => themes.doc.themes[themes.cur]);
    const family = derived(() => themes.doc.families[entry().family]);
    function cr(mode) {
      const f = ratio(mode.bg, mode.fg);
      return {
        fg: f.toFixed(2),
        grade: grade(f),
        pass: f >= 4.5,
        comment: ratio(mode.bg, mode.comment).toFixed(2),
        str: ratio(mode.bg, mode.str).toFixed(2)
      };
    }
    if (!themes.doc) {
      $$renderer2.push("<!--[0-->");
      if (app.busy) {
        $$renderer2.push(`<!--[0--><div class="blank svelte-omjwkq"><p>Loading…</p></div>`);
      } else {
        $$renderer2.push(`<!--[-1--><div class="blank svelte-omjwkq"><p>Couldn't open the theme data.</p> <button class="btn primary">Retry</button></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      Sidebar($$renderer2);
      $$renderer2.push(`<!----> <main class="svelte-omjwkq"><div class="head svelte-omjwkq"><label class="field svelte-omjwkq"><span class="svelte-omjwkq">Name</span> <input class="name svelte-omjwkq"${attr("value", entry().name)}/></label> <label class="field svelte-omjwkq"><span class="svelte-omjwkq">Family</span> `);
      $$renderer2.select(
        {
          value: entry().family,
          onchange: () => themes.dirty = true,
          class: ""
        },
        ($$renderer3) => {
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(Object.entries(themes.doc.families));
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let [id, f] = each_array[$$index];
            $$renderer3.option({ value: id }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(f.label)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        },
        "svelte-omjwkq"
      );
      $$renderer2.push(`</label> <label class="field svelte-omjwkq"><span class="svelte-omjwkq">Tag</span> <input${attr("value", entry().tag)} class="svelte-omjwkq"/></label> <label class="field grow svelte-omjwkq"><span class="svelte-omjwkq">Thesis</span> <textarea class="svelte-omjwkq">`);
      const $$body = escape_html(entry().thesis);
      if ($$body) {
        $$renderer2.push(`${$$body}`);
      }
      $$renderer2.push(`</textarea></label></div> <div class="panes svelte-omjwkq"><!--[-->`);
      const each_array_1 = ensure_array_like([
        ["light", themes.doc.meta.lightPrefix],
        ["dark", themes.doc.meta.darkPrefix]
      ]);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let [kind, prefix] = each_array_1[$$index_1];
        const c = cr(entry()[kind]);
        $$renderer2.push(`<div><div class="pane-lbl svelte-omjwkq"><span class="t svelte-omjwkq">${escape_html(prefix)}</span> <span class="cr svelte-omjwkq">fg <b class="svelte-omjwkq">${escape_html(c.fg)}</b> <em${attr_class("svelte-omjwkq", void 0, { "no": !c.pass })}>${escape_html(c.grade)}</em> · comment <b class="svelte-omjwkq">${escape_html(c.comment)}</b> · string <b class="svelte-omjwkq">${escape_html(c.str)}</b></span></div> `);
        Mock($$renderer2, { mode: entry()[kind], name: `${prefix} ${entry().name}` });
        $$renderer2.push(`<!----></div>`);
      }
      $$renderer2.push(`<!--]--></div> <h2 class="sec">Palette — contrast against each mode's own background</h2> `);
      RoleTable($$renderer2, { entry: entry() });
      $$renderer2.push(`<!----> <h2 class="sec">Workbench — inherited from the palette unless overridden</h2> <p class="hint">Each surface shows the value it derives from the core palette. Type a colour to pin it;
			× restores inheritance so it keeps tracking the palette.</p> `);
      WorkbenchTable($$renderer2, { entry: entry() });
      $$renderer2.push(`<!----> <details class="svelte-omjwkq"><summary class="svelte-omjwkq">Diagnostics for the ${escape_html(family().label)} family — shared by every theme in it</summary> <div class="body svelte-omjwkq"><p class="hint">Errors, warnings and git status stay hued even in the monochrome families: a red
					squiggle that reads as ink is one you miss. Editing these changes every
					${escape_html(family().label)} theme.</p> <table class="roles"><thead><tr><th>role</th><th>${escape_html(themes.doc.meta.lightPrefix)}</th><th>${escape_html(themes.doc.meta.darkPrefix)}</th></tr></thead><tbody><!--[-->`);
      const each_array_2 = ensure_array_like(Object.keys(family().semantic.light));
      for (let $$index_3 = 0, $$length = each_array_2.length; $$index_3 < $$length; $$index_3++) {
        let k = each_array_2[$$index_3];
        $$renderer2.push(`<tr><td class="rl">${escape_html(k)}</td><!--[-->`);
        const each_array_3 = ensure_array_like(["light", "dark"]);
        for (let $$index_2 = 0, $$length2 = each_array_3.length; $$index_2 < $$length2; $$index_2++) {
          let kind = each_array_3[$$index_2];
          $$renderer2.push(`<td>`);
          ColorCell($$renderer2, {
            value: family().semantic[kind][k],
            against: entry()[kind].bg,
            palette: entry()[kind],
            onset: (v) => {
              family().semantic[kind][k] = v;
              themes.dirty = true;
            }
          });
          $$renderer2.push(`<!----></td>`);
        }
        $$renderer2.push(`<!--]--></tr>`);
      }
      $$renderer2.push(`<!--]--></tbody></table></div></details></main>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Toolbar$2($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    if (themes.doc) {
      $$renderer2.push(`<!--[0--><span class="count svelte-rokbty">${escape_html(themes.doc.themes.length)} pairs · ${escape_html(themes.doc.themes.length * 2)} themes · v${escape_html(themes.doc.meta.version)}</span> <span${attr_class("dot svelte-rokbty", void 0, { "on": themes.dirty })} title="unsaved changes"></span> <button class="btn"${attr("disabled", app.busy, true)}>Build</button> <button class="btn"${attr("disabled", app.busy, true)}>Package .vsix</button> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button class="btn primary"${attr("disabled", app.busy, true)}>Save</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
const themesSurface = {
  id: "themes",
  label: "Themes",
  full: false,
  component: Surface$3,
  toolbar: Toolbar$2,
  load: load$1,
  fullWhileLoading: () => !themes.doc
};
function prefixes() {
  return {
    light: themes.doc?.meta?.lightPrefix ?? "",
    dark: themes.doc?.meta?.darkPrefix ?? ""
  };
}
const schemes = { list: [] };
function load() {
  invoke("schemes").then((found) => {
    schemes.list = found;
  }).catch(() => {
    schemes.list = [];
  });
}
const PAIRS = [
  ["light", "dark"],
  ["latte", "mocha"],
  ["latte", "frappe"],
  ["dawn", "moon"],
  ["dawn", "night"],
  ["day", "night"],
  ["white", "black"],
  ["sun", "moon"]
];
function partnerFor(scheme, all) {
  const want = scheme.variant === "light" ? "dark" : "light";
  const pool = all.filter((s) => s.variant === want && s.system === scheme.system);
  for (const [a, b] of PAIRS) {
    for (const [from, to] of [[a, b], [b, a]]) {
      if (!scheme.id.includes(from)) continue;
      const guess = scheme.id.replaceAll(from, to);
      const hit = pool.find((s) => s.id === guess);
      if (hit) return hit;
    }
  }
  let best = null;
  let bestLen = 4;
  for (const s of pool) {
    let n = 0;
    while (n < s.id.length && n < scheme.id.length && s.id[n] === scheme.id[n]) n++;
    if (n > bestLen) {
      bestLen = n;
      best = s;
    }
  }
  return best;
}
function Surface$2($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let query = "";
    let system = "all";
    let variant = "all";
    let selectedId = "";
    let slots = { light: null, dark: null };
    const list = derived(() => schemes.list.filter((s) => {
      if (!query.trim()) return true;
      const q2 = query.trim().toLowerCase();
      return s.name.toLowerCase().includes(q2) || s.id.includes(q2) || s.author.toLowerCase().includes(q2);
    }));
    const selected = derived(() => schemes.list.find((s) => s.uid === selectedId) ?? null);
    const partner = derived(() => selected() ? partnerFor(selected(), schemes.list) : null);
    function strip(s) {
      const p = s.palette;
      return s.system === "tinted8" ? [
        p.black,
        p.red,
        p.green,
        p.yellow,
        p.blue,
        p.magenta,
        p.cyan,
        p.white
      ] : [
        "base00",
        "base05",
        "base08",
        "base09",
        "base0A",
        "base0B",
        "base0D",
        "base0E"
      ].map((k) => p[k]);
    }
    function cr(p) {
      const f = ratio(p.bg, p.fg);
      return { v: f.toFixed(2), g: grade(f), pass: f >= 4.5 };
    }
    $$renderer2.push(`<div class="browser svelte-hb9tuk"><aside class="svelte-hb9tuk"><div class="filters svelte-hb9tuk"><input class="q svelte-hb9tuk"${attr("placeholder", `Search ${stringify(
      // Default the family select to the first family once the document loads.
      schemes.list.length
    )} schemes…`)}${attr("value", query)} spellcheck="false"/> <div class="chips svelte-hb9tuk"><!--[-->`);
    const each_array = ensure_array_like(["all", "base16", "base24", "tinted8"]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let s = each_array[$$index];
      $$renderer2.push(`<button${attr_class("chip svelte-hb9tuk", void 0, { "on": system === s })}>${escape_html(s)}</button>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="chips svelte-hb9tuk"><!--[-->`);
    const each_array_1 = ensure_array_like(["all", "light", "dark"]);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let v = each_array_1[$$index_1];
      $$renderer2.push(`<button${attr_class("chip svelte-hb9tuk", void 0, { "on": variant === v })}>${escape_html(v)}</button>`);
    }
    $$renderer2.push(`<!--]--></div> <span class="tally svelte-hb9tuk">${escape_html(list().length)} shown</span></div> <div class="rows svelte-hb9tuk"><!--[-->`);
    const each_array_2 = ensure_array_like(list());
    for (let $$index_3 = 0, $$length = each_array_2.length; $$index_3 < $$length; $$index_3++) {
      let s = each_array_2[$$index_3];
      $$renderer2.push(`<button${attr_class("row svelte-hb9tuk", void 0, { "on": s.uid === selectedId })}><span class="sw svelte-hb9tuk"><!--[-->`);
      const each_array_3 = ensure_array_like(strip(s));
      for (let $$index_2 = 0, $$length2 = each_array_3.length; $$index_2 < $$length2; $$index_2++) {
        let c = each_array_3[$$index_2];
        $$renderer2.push(`<i${attr_style(`background:${stringify(c)}`)} class="svelte-hb9tuk"></i>`);
      }
      $$renderer2.push(`<!--]--></span> <span class="nm svelte-hb9tuk">${escape_html(s.name)}</span> <span class="vr svelte-hb9tuk">${escape_html(s.variant[0])}</span></button>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (!list().length) {
      $$renderer2.push(`<!--[0--><p class="none svelte-hb9tuk">Nothing matches.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></aside> <main class="svelte-hb9tuk">`);
    if (!schemes.list.length) {
      $$renderer2.push(`<!--[0--><p class="none big svelte-hb9tuk">No scheme collection found. Put <code class="svelte-hb9tuk">schemes-spec-0.11</code> beside <code class="svelte-hb9tuk">palettes.json</code> and reopen the project.</p>`);
    } else if (!selected()) {
      $$renderer2.push(`<!--[1--><p class="none big svelte-hb9tuk">Pick a scheme to sample it.</p>`);
    } else {
      $$renderer2.push(`<!--[-1--><div class="head svelte-hb9tuk"><div><h2 class="svelte-hb9tuk">${escape_html(selected().name)}</h2> <p class="by svelte-hb9tuk">${escape_html(selected().system)} · ${escape_html(selected().variant)}${escape_html(selected().author ? ` · ${selected().author}` : "")}</p></div> <div class="acts svelte-hb9tuk"><button class="btn">→ Daylight slot</button> <button class="btn">→ Lamplight slot</button> `);
      if (partner()) {
        $$renderer2.push(`<!--[0--><button class="btn primary">Pair with ${escape_html(partner().name)}</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div> <div class="swatches svelte-hb9tuk"><!--[-->`);
      const each_array_4 = ensure_array_like(Object.entries(selected().palette));
      for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
        let [k, v] = each_array_4[$$index_4];
        $$renderer2.push(`<div class="sq svelte-hb9tuk"><i${attr_style(`background:${stringify(v)}`)} class="svelte-hb9tuk"></i><b class="svelte-hb9tuk">${escape_html(k)}</b><span class="svelte-hb9tuk">${escape_html(v.toUpperCase())}</span></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--> <h3 class="sec svelte-hb9tuk">The pair — both slots must be filled to save</h3> <div class="slots svelte-hb9tuk"><!--[-->`);
    const each_array_5 = ensure_array_like([["light", prefixes().light], ["dark", prefixes().dark]]);
    for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
      let [kind, label] = each_array_5[$$index_5];
      $$renderer2.push(`<div${attr_class("slot svelte-hb9tuk", void 0, { "empty": !slots[kind] })}><div class="slot-hd svelte-hb9tuk"><span class="t svelte-hb9tuk">${escape_html(label)}</span> `);
      if (slots[kind]) {
        $$renderer2.push("<!--[0-->");
        const c = cr(slots[kind].palette);
        $$renderer2.push(`<span class="cr svelte-hb9tuk">${escape_html(slots[kind].scheme.name)} · fg <b class="svelte-hb9tuk">${escape_html(c.v)}</b> <em${attr_class("svelte-hb9tuk", void 0, { "no": !c.pass })}>${escape_html(c.g)}</em></span> <button class="x svelte-hb9tuk" title="clear slot">×</button>`);
      } else {
        $$renderer2.push(`<!--[-1--><span class="cr svelte-hb9tuk">empty</span>`);
      }
      $$renderer2.push(`<!--]--></div> `);
      if (slots[kind]) {
        $$renderer2.push("<!--[0-->");
        Mock($$renderer2, { mode: slots[kind].palette, name: `${label} ${"…"}` });
      } else {
        $$renderer2.push(`<!--[-1--><div class="drop svelte-hb9tuk">Send a scheme here with the buttons above.</div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></main></div>`);
  });
}
const schemesSurface = {
  id: "schemes",
  label: "Schemes",
  full: true,
  component: Surface$2,
  load
};
const sassy = {
  direction: "css2sass",
  input: "",
  output: "",
  busy: false
};
function Surface$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const direction = derived(() => sassy.direction);
    const fromLabel = derived(() => direction() === "sass2css" ? "SASS" : "CSS");
    const toLabel = derived(() => direction() === "sass2css" ? "CSS" : "SASS");
    const inputNos = derived(() => rows(sassy.input));
    const outputNos = derived(() => rows(sassy.output));
    function rows(text) {
      const n = Math.max(1, text.split("\n").length);
      return Array.from({ length: n }, (_, i) => i + 1);
    }
    $$renderer2.push(`<div class="convert svelte-1subaox"><div class="panes svelte-1subaox"><div class="pane svelte-1subaox"><div class="phd svelte-1subaox"><span class="svelte-1subaox">${escape_html(
      // Changing direction invalidates the current output.
      fromLabel()
    )} input</span></div> <div class="editor svelte-1subaox"><div class="gutter svelte-1subaox">${escape_html(inputNos().join("\n"))}</div> <textarea spellcheck="false"${attr("placeholder", direction() === "sass2css" ? ".card\n	color: $ink\n	&:hover\n		color: red" : ".card {\n  color: #222;\n}")} class="svelte-1subaox">`);
    const $$body = escape_html(sassy.input);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></div></div> <div class="pane svelte-1subaox"><div class="phd svelte-1subaox"><span class="svelte-1subaox">${escape_html(toLabel())} output</span></div> `);
    {
      $$renderer2.push(`<!--[-1--><div class="editor svelte-1subaox"><div class="gutter svelte-1subaox">${escape_html(outputNos().join("\n"))}</div> <textarea readonly="" spellcheck="false" placeholder="output appears here" class="svelte-1subaox">`);
      const $$body_1 = escape_html(sassy.output);
      if ($$body_1) {
        $$renderer2.push(`${$$body_1}`);
      }
      $$renderer2.push(`</textarea></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function Toolbar$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="chips svelte-1c7wo8l" role="group" aria-label="Direction"><button${attr_class("chip svelte-1c7wo8l", void 0, { "on": sassy.direction === "sass2css" })}>SASS → CSS</button> <button${attr_class("chip svelte-1c7wo8l", void 0, { "on": sassy.direction === "css2sass" })}>CSS → SASS</button></div> <button class="btn primary"${attr("disabled", !sassy.input.trim(), true)}>Convert →</button> <button class="btn"${attr("disabled", true, true)}>${escape_html("Copy")}</button> <button class="btn"${attr("disabled", sassy.busy, true)}>On disk…</button>`);
  });
}
const sassySurface = {
  id: "sassy",
  label: "Sassy",
  full: true,
  component: Surface$1,
  toolbar: Toolbar$1
};
const SAMPLE = `export function Card() {
  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Title</h2>
      <p className="text-sm text-slate-500 leading-6">Body copy here</p>
      <button className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700">Action</button>
    </div>
  )
}`;
const untw = {
  input: SAMPLE,
  themeCss: ""
};
function Surface($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="untw svelte-5ac4ym"><div class="cols svelte-5ac4ym"><div class="pane svelte-5ac4ym"><div class="phd svelte-5ac4ym"><span class="svelte-5ac4ym">Component code</span> <div class="samples svelte-5ac4ym"><button class="mini svelte-5ac4ym">Card</button> <button class="mini svelte-5ac4ym">Accordion</button> <button class="mini svelte-5ac4ym">Clear</button></div></div> <textarea class="codebox svelte-5ac4ym" spellcheck="false" placeholder="&lt;div className=&quot;flex gap-4 p-6 …&quot;>">`);
    const $$body = escape_html(untw.input);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea> <div class="phd svelte-5ac4ym"><span class="svelte-5ac4ym">Project theme — optional @theme CSS</span></div> <textarea class="codebox short svelte-5ac4ym" spellcheck="false" placeholder="@theme {
  --color-foreground: oklch(0.2 0 0);
}">`);
    const $$body_1 = escape_html(untw.themeCss);
    if ($$body_1) {
      $$renderer2.push(`${$$body_1}`);
    }
    $$renderer2.push(`</textarea> <p class="note svelte-5ac4ym">Custom colors and animations resolve from the pasted theme. Everything runs offline.</p></div> <div class="pane results svelte-5ac4ym">`);
    {
      $$renderer2.push(`<!--[1--><div class="blank svelte-5ac4ym"><p>Paste code, then Convert →</p></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></div>`);
  });
}
function Toolbar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<button class="btn primary"${attr("disabled", !untw.input.trim(), true)}>${escape_html("Convert →")}</button> <button class="btn"${attr("disabled", true, true)}>${escape_html("Copy summary")}</button> <button class="btn"${attr("disabled", true, true)}>${escape_html("Copy JSON")}</button>`);
  });
}
const untwSurface = {
  id: "untw",
  label: "Untw",
  full: true,
  component: Surface,
  toolbar: Toolbar
};
const REGISTRY = [
  { ...themesSurface },
  { ...schemesSurface },
  { ...argvSurface },
  { ...sassySurface },
  { ...untwSurface }
];
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const current = derived(() => REGISTRY.find((s) => s.id === app.view));
    const wide = derived(() => current() ? (current().fullWhileLoading?.() ?? false) || current().full : true);
    $$renderer2.push(`<header class="app-header svelte-1uha8ag" data-tauri-drag-region=""><div class="global svelte-1uha8ag"><p data-tauri-drag-region="">fractaldesk</p> <div class="views svelte-1uha8ag" role="group" aria-label="Surface"><!--[-->`);
    const each_array = ensure_array_like(
      // Call the active surface's load hook the first time it becomes active.
      REGISTRY
    );
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let s = each_array[$$index];
      const badge = s.badge?.(app);
      $$renderer2.push(`<button${attr_class("primary svelte-1uha8ag", void 0, { "active": app.view === s.id })}>${escape_html(s.label)}${escape_html(badge ? ` · ${badge}` : "")}</button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <span class="grow svelte-1uha8ag" data-tauri-drag-region=""></span> <span${attr_class(`msg ${stringify(app.kind)}`, "svelte-1uha8ag")}>${escape_html(app.msg)}</span> <div class="conditional svelte-1uha8ag">`);
    if (current()?.toolbar) {
      $$renderer2.push("<!--[0-->");
      const Toolbar2 = current().toolbar;
      if (Toolbar2) {
        $$renderer2.push("<!--[-->");
        Toolbar2($$renderer2, {});
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></header> <div${attr_class("shell svelte-1uha8ag", void 0, { "full": wide() })}>`);
    if (current()) {
      $$renderer2.push("<!--[0-->");
      const Body = current().component;
      if (Body) {
        $$renderer2.push("<!--[-->");
        Body($$renderer2, {});
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
    } else {
      $$renderer2.push(`<!--[-1--><div class="picker svelte-1uha8ag"><p class="svelte-1uha8ag">Pick a surface</p> <div class="views big svelte-1uha8ag"><!--[-->`);
      const each_array_1 = ensure_array_like(REGISTRY);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let s = each_array_1[$$index_1];
        $$renderer2.push(`<button class="svelte-1uha8ag">${escape_html(s.label)}</button>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
