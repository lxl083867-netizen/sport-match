type EventValue = string | number | boolean | null | undefined | string[] | number[];

type EventProperties = Record<string, EventValue>;

export function logEvent(event: string, properties: EventProperties = {}) {
  const safeProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );

  console.info("[sport-match:event]", JSON.stringify({
    event,
    at: new Date().toISOString(),
    ...safeProperties,
  }));
}

export function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
