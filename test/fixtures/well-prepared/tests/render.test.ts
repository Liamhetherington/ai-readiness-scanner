import { render } from '../src/render';
import { expect, it } from 'vitest';
it('render', () => expect(render(150)).toBe('Total: 1.50'));
