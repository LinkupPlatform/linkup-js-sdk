import { z } from 'zod';
import { isZodObject } from '../schema.utils';

it('should check if is zod object', () => {
  expect(isZodObject(undefined)).toBeFalsy();
  expect(isZodObject({})).toBeFalsy();
  expect(isZodObject({ properties: { foo: { type: 'string' } }, type: 'object' })).toBeFalsy();
  expect(isZodObject(z.object({ foo: z.string() }))).toBeTruthy();
  expect(isZodObject({ parse: {}, shape: {} })).toBeTruthy();
});
