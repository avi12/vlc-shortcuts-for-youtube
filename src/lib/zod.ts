import { z } from "zod";

// YouTube's Trusted-Types CSP blocks the `new Function` probe Zod runs on first object-schema
// build. Zod recovers, but Chrome logs a CSP violation. jitless skips the probe entirely.
z.config({ jitless: true });

export { z };

export function createTypeGuard<T>(schema: z.ZodType) {
  return (value: unknown): value is T => schema.safeParse(value).success;
}
