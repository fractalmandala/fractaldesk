export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["fonts/ahm-i.woff2","fonts/ahm.woff2","fonts/ahn-i.woff2","fonts/ahn.woff2"]),
	mimeTypes: {".woff2":"font/woff2"},
	_: {
		client: {start:"_app/immutable/entry/start.D-SO4R20.js",app:"_app/immutable/entry/app.KJutTljB.js",imports:["_app/immutable/entry/start.D-SO4R20.js","_app/immutable/chunks/FaCA-vJ4.js","_app/immutable/chunks/CLkBu27V.js","_app/immutable/chunks/2A9hSI3p.js","_app/immutable/entry/app.KJutTljB.js","_app/immutable/chunks/BbfC3tDe.js","_app/immutable/chunks/FaCA-vJ4.js","_app/immutable/chunks/DMZB9y-K.js","_app/immutable/chunks/B8WgoHTb.js","_app/immutable/chunks/tKRese0W.js","_app/immutable/chunks/2A9hSI3p.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
