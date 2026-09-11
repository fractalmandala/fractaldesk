export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([".DS_Store","fonts/ahm-i.woff2","fonts/ahm.woff2","fonts/ahn-i.woff2","fonts/ahn.woff2","fonts/ins-600.woff2","fonts/ins-700.woff2","fonts/ins-italic-600.woff2","fonts/ins-italic-700.woff2","fonts/ins-italic.woff2","fonts/ins-regular.woff2","fonts/monaspaceargon.woff2","fonts/monaspaceneon.woff2"]),
	mimeTypes: {".woff2":"font/woff2"},
	_: {
		client: {start:"_app/immutable/entry/start.C14Gm6By.js",app:"_app/immutable/entry/app.9hPO5PP3.js",imports:["_app/immutable/entry/start.C14Gm6By.js","_app/immutable/chunks/CUqCdBQG.js","_app/immutable/chunks/dUGYYc2H.js","_app/immutable/chunks/_qRwWQhU.js","_app/immutable/entry/app.9hPO5PP3.js","_app/immutable/chunks/DBSTzikj.js","_app/immutable/chunks/CUqCdBQG.js","_app/immutable/chunks/CceL6had.js","_app/immutable/chunks/B3fYBq26.js","_app/immutable/chunks/BkowBAkq.js","_app/immutable/chunks/_qRwWQhU.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
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
