import { hourly } from '../src/rates';
import { expect, it } from 'vitest';
it('rates', () => expect(hourly(100, 2)).toBe(200));
