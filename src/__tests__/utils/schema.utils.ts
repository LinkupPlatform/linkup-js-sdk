import { z } from 'zod';
import { isZodObject } from '../../utils/schema.utils';

it('should check if is zod object', () => {
  expect(isZodObject(undefined)).toBeFalsy();
  expect(isZodObject({})).toBeFalsy();
  expect(
    isZodObject({ type: 'object', properties: { foo: { type: 'string' } } }),
  ).toBeFalsy();
  expect(isZodObject(z.object({ foo: z.string() }))).toBeTruthy();
  expect(isZodObject({ parse: {}, shape: {} })).toBeTruthy();
});
