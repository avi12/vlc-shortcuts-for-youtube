import { z } from "@/lib/zod";

// A guard checks a value in place: YouTube's players and components are used as they are, since a parsed copy would
// lose their identity and their methods' `this`
export function createGuard<Schema extends z.ZodType>(schema: Schema) {
  return (value: unknown): value is z.infer<Schema> => schema.safeParse(value).success;
}

// For classes that exist only in a browser: a schema built at import time would throw when WXT imports the
// entrypoints in Node to read their options
export function createLazyGuard<Schema extends z.ZodType>(getSchema: () => Schema) {
  return (value: unknown): value is z.infer<Schema> => getSchema().safeParse(value).success;
}

// A page method whose parameters and result are YouTube's own, so zod checks only that it is a function
export const METHOD_SCHEMA = z.function({
  input: z.array(z.unknown()),
  output: z.unknown()
});

export const VOID_METHOD_SCHEMA = z.function({
  input: [],
  output: z.void()
});

export const isMethod = createGuard(METHOD_SCHEMA);
