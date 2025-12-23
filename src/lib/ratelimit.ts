// Enkel in-memory rate limiter: 5 requests per 10 sekunder per IP

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const LIMIT = 5;
const WINDOW_MS = 10 * 1000; // 10 sekunder

export function checkRateLimit(identifier: string): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(identifier);

  // Fjern gamle entries (cleanup)
  if (entry && entry.resetAt < now) {
    store.delete(identifier);
  }

  const current = store.get(identifier);

  if (!current) {
    // Første request i vinduet
    store.set(identifier, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return { success: true, remaining: LIMIT - 1 };
  }

  if (current.count >= LIMIT) {
    return { success: false, remaining: 0 };
  }

  // Inkrementer count
  current.count += 1;
  store.set(identifier, current);

  return { success: true, remaining: LIMIT - current.count };
}

// Cleanup hvert minutt for å unngå memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 60 * 1000);