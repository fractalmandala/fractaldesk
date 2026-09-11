// Minimal typed pub/sub bus. Surfaces use this for cross-surface communication
// instead of widening the global app state. Subscribing returns an unsubscribe
// function; emitting with no subscribers is a no-op. No persisted state.

type Handler<T = unknown> = (payload: T) => void

const listeners = new Map<string, Set<Handler>>()

export function on<T = unknown>(event: string, handler: Handler<T>): () => void {
	let set = listeners.get(event)
	if (!set) {
		set = new Set()
		listeners.set(event, set)
	}
	const h = handler as Handler
	set.add(h)
	return () => {
		set!.delete(h)
		if (set!.size === 0) listeners.delete(event)
	}
}

export function emit<T = unknown>(event: string, payload?: T): void {
	const set = listeners.get(event)
	if (!set) return
	for (const h of set) h(payload)
}
