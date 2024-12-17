import { ZodObject } from 'zod';

export function isZodObject(schema: unknown): boolean {
  return (
    schema instanceof ZodObject ||
    (typeof schema === 'object' &&
      schema !== null &&
      'parse' in schema &&
      'shape' in schema)
  );
}
