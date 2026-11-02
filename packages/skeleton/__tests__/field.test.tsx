import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DisplayType } from '@flow-designer/model';
import { Field } from '../src/field';

describe('Field', () => {
  it('returns null for DisplayType.None', () => {
    const { container } = render(<Field display={DisplayType.None}>content</Field>);
    expect(container.innerHTML).toBe('');
  });

  it('renders PlainField by default', () => {
    const { container } = render(<Field display={DisplayType.Plain}>content</Field>);
    expect(container.textContent).toBe('content');
  });

  it('renders InlineField for DisplayType.Inline', () => {
    const { container } = render(
      <Field display={DisplayType.Inline} title="Label">
        <input />
      </Field>,
    );
    expect(container.querySelector('input')).toBeDefined();
  });

  it('renders BlockField for DisplayType.Block', () => {
    const { container } = render(
      <Field display={DisplayType.Block} title="Block Title">
        <span>body</span>
      </Field>,
    );
    expect(container.textContent).toContain('Block Title');
    expect(container.textContent).toContain('body');
  });
});
