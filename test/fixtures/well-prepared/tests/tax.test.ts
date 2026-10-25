import { withTax } from '../src/tax';
import { expect, it } from 'vitest';
it('tax', () => expect(withTax(100, 0.2)).toBe(120));
