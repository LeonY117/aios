/**
 * Resolve a React Flight / RSC serialized payload.
 *
 * The payload is a flat array where objects use `_N` keys as index references:
 * - Key `_31` → real key name is `data[31]`
 * - Value that's a non-negative integer → resolve recursively via `data[value]`
 * - Value that's a string/bool/null/negative → literal
 */
export function resolveFlightPayload(data: unknown[]): unknown {
  return resolve(data, 0, new Set<number>(), 0);
}

function resolve(
  data: unknown[],
  index: number,
  seen: Set<number>,
  depth: number,
): unknown {
  if (depth > 50) return undefined;
  if (index < 0 || index >= data.length) return undefined;
  if (seen.has(index)) return undefined;

  seen.add(index);
  const value = data[index];
  const result = resolveValue(data, value, seen, depth);
  seen.delete(index);
  return result;
}

function resolveValue(
  data: unknown[],
  value: unknown,
  seen: Set<number>,
  depth: number,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    // Non-negative integers are index references
    if (Number.isInteger(value) && value >= 0 && value < data.length) {
      return resolve(data, value, new Set(seen), depth + 1);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(data, item, seen, depth + 1));
  }

  if (typeof value === "object") {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Keys like _31 are references to data[31] for the key name
      const realKey = key.startsWith("_")
        ? String(resolveValue(data, parseInt(key.slice(1), 10), new Set(seen), depth + 1) ?? key)
        : key;
      resolved[realKey] = resolveValue(data, val, seen, depth + 1);
    }
    return resolved;
  }

  return value;
}
