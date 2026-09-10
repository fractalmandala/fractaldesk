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
		client: {start:"_app/immutable/entry/start.CdFq3hJB.js",app:"_app/immutable/entry/app.CdyN_ADD.js",imports:["_app/immutable/entry/start.CdFq3hJB.js","_app/immutable/chunks/BnQRQFzy.js","_app/immutable/chunks/B9uXdNzu.js","_app/immutable/chunks/5e0tK8JI.js","_app/immutable/entry/app.CdyN_ADD.js","_app/immutable/chunks/CSTSI2jn.js","_app/immutable/chunks/BnQRQFzy.js","_app/immutable/chunks/30y4YoFP.js","_app/immutable/chunks/CQ93P2V_.js","_app/immutable/chunks/CvT-Ex6s.js","_app/immutable/chunks/5e0tK8JI.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
