import { r as root } from "./root.js";
import "./server.js";
let read_implementation = null;
function set_read_implementation(fn) {
  read_implementation = fn;
}
function set_manifest(_) {
}
let public_env = {};
function set_private_env(environment) {
}
function set_public_env(environment) {
  public_env = environment;
}
const error = ({ status, message }) => '<!doctype html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<title>' + message + `</title>

		<style>
			body {
				--bg: white;
				--fg: #222;
				--divider: #ccc;
				background: var(--bg);
				color: var(--fg);
				font-family:
					system-ui,
					-apple-system,
					BlinkMacSystemFont,
					'Segoe UI',
					Roboto,
					Oxygen,
					Ubuntu,
					Cantarell,
					'Open Sans',
					'Helvetica Neue',
					sans-serif;
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100vh;
				margin: 0;
			}

			.error {
				display: flex;
				align-items: center;
				max-width: 32rem;
				margin: 0 1rem;
			}

			.status {
				font-weight: 200;
				font-size: 3rem;
				line-height: 1;
				position: relative;
				top: -0.05rem;
			}

			.message {
				border-left: 1px solid var(--divider);
				padding: 0 0 0 1rem;
				margin: 0 0 0 1rem;
				min-height: 2.5rem;
				display: flex;
				align-items: center;
			}

			.message h1 {
				font-weight: 400;
				font-size: 1em;
				margin: 0;
			}

			@media (prefers-color-scheme: dark) {
				body {
					--bg: #222;
					--fg: #ddd;
					--divider: #666;
				}
			}
		</style>
	</head>
	<body>
		<div class="error">
			<span class="status">` + status + '</span>\n			<div class="message">\n				<h1>' + message + "</h1>\n			</div>\n		</div>\n	</body>\n</html>\n";
const options = {
  app_template_contains_nonce: false,
  async: false,
  csp: { "mode": "auto", "directives": { "upgrade-insecure-requests": false, "block-all-mixed-content": false }, "reportOnly": { "upgrade-insecure-requests": false, "block-all-mixed-content": false } },
  csrf_check_origin: true,
  csrf_trusted_origins: [],
  embedded: false,
  env_public_prefix: "PUBLIC_",
  env_private_prefix: "",
  hash_routing: false,
  hooks: null,
  // added lazily, via `get_hooks`
  preload_strategy: "modulepreload",
  root,
  service_worker: false,
  service_worker_options: void 0,
  server_error_boundaries: false,
  templates: {
    app: ({ head, body, assets, nonce, env }) => '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1"/>\n    ' + head + '\n  </head>\n  <body data-sveltekit-preload-data="hover">\n    <div style="display: contents">' + body + "</div>\n    <script>\n      // TEMP-PROOF probe (revert after diagnosis): paint boot failures visibly.\n      (function () {\n        function show(msg) {\n          var el = document.getElementById('boot-probe');\n          if (!el) {\n            el = document.createElement('pre');\n            el.id = 'boot-probe';\n            el.style.cssText =\n              'position:fixed;inset:0;z-index:99999;background:#111;color:#7dff9e;padding:24px;font:12px/1.6 monospace;white-space:pre-wrap;overflow:auto;margin:0';\n            document.body.appendChild(el);\n          }\n          el.textContent += msg + '\\n';\n        }\n        window.addEventListener(\n          'error',\n          function (e) {\n            show('ERR ' + (e.message || '(no message)') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));\n          },\n          true\n        );\n        window.addEventListener('unhandledrejection', function (e) {\n          show('REJ ' + String((e.reason && e.reason.message) || e.reason));\n        });\n        show('LOC ' + location.href + ' UA-Tauri=' + ('__TAURI_INTERNALS__' in window));\n        fetch('/_app/immutable/entry/start.CoedMNCf.js')\n          .then(function (r) {\n            show('FETCH status=' + r.status + ' type=' + r.headers.get('content-type'));\n            return r.text();\n          })\n          .then(function (t) {\n            show('FETCH bytes=' + t.length + ' head=' + t.slice(0, 60).replace(/\\n/g, ' '));\n          })\n          .catch(function (e) {\n            show('FETCH ERR ' + e);\n          });\n        Promise.race([\n          import('/_app/immutable/entry/start.CoedMNCf.js').then(function () {\n            return 'IMPORT OK';\n          }),\n          new Promise(function (res) {\n            setTimeout(function () {\n              res('IMPORT STILL PENDING @4s');\n            }, 4000);\n          })\n        ]).then(show);\n        setTimeout(function () {\n          var scripts = Array.prototype.map.call(document.scripts, function (s) {\n            return (s.src || '(inline)') + (s.type ? ' [' + s.type + ']' : '');\n          });\n          show('T+6s readyState=' + document.readyState + ' scripts=' + scripts.length);\n          scripts.forEach(function (src) {\n            show('  src: ' + src);\n          });\n          show('  bodyChildren=' + document.body.children.length);\n        }, 6000);\n      })();\n    <\/script>\n  </body>\n</html>\n",
    error
  },
  version_hash: "1uvoelz"
};
async function get_hooks() {
  let handle;
  let handleFetch;
  let handleError;
  let handleValidationError;
  let init;
  let reroute;
  let transport;
  return {
    handle,
    handleFetch,
    handleError,
    handleValidationError,
    init,
    reroute,
    transport
  };
}
export {
  set_public_env as a,
  set_read_implementation as b,
  set_manifest as c,
  get_hooks as g,
  options as o,
  public_env as p,
  read_implementation as r,
  set_private_env as s
};
