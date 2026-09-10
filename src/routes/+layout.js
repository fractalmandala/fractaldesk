// Tauri serves a single static bundle: prerender the shell once and skip SSR
// so browser/Tauri APIs (invoke, clipboard, confirm) only run on the client.
export const prerender = true
export const ssr = false
