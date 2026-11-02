import { Component, createRef, forwardRef, isValidElement, memo } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { acceptsRef, createContent, isReactClass, isReactComponent } from '../src/create-content';

interface NamedProps { name: string }
const FunctionContent = ({ name }: NamedProps) => <span>{name}</span>;
class ClassContent extends Component<NamedProps> {
  render() { return <span>{this.props.name}</span>; }
}
const ForwardContent = forwardRef<HTMLSpanElement, NamedProps>(({ name }, ref) => <span ref={ref}>{name}</span>);

describe('shared React content helpers', () => {
  afterEach(cleanup);

  it('renders typed functions, classes, memo and forwardRef with supplied props', () => {
    for (const content of [FunctionContent, ClassContent, memo(FunctionContent), ForwardContent, memo(ForwardContent)]) {
      expect(isReactComponent(content)).toBe(true);
      const view = render(<>{createContent(content, { name: 'supplied' })}</>);
      expect(view.container.textContent).toBe('supplied');
      view.unmount();
    }
  });

  it('clones elements while preserving their key and ref', () => {
    const ref = createRef<HTMLSpanElement>();
    const original = <span key="stable" ref={ref} title="old">content</span>;
    const result = createContent(original, { title: 'new' });
    expect(isValidElement(result) && result.key).toBe('stable');
    expect(createContent(original)).toBe(original);
    const view = render(<>{result}</>);
    expect(ref.current).toBe(view.container.querySelector('span'));
    expect(ref.current?.title).toBe('new');
  });

  it('recognizes ref-capable wrappers without treating registry configs as components', () => {
    expect(isReactClass(ClassContent)).toBe(true);
    expect(isReactClass(FunctionContent)).toBe(false);
    for (const value of [null, undefined, 'registered', { type: 'registered' }, {}, <span />]) expect(isReactComponent(value)).toBe(false);
    expect(acceptsRef(ClassContent)).toBe(true);
    expect(acceptsRef(ForwardContent)).toBe(true);
    expect(acceptsRef(memo(ForwardContent))).toBe(true);
    expect(acceptsRef(<ForwardContent name="value" />)).toBe(true);
    expect(acceptsRef(FunctionContent)).toBe(false);
    expect(acceptsRef(memo(FunctionContent))).toBe(false);
    expect(acceptsRef(null)).toBe(false);
  });

  it('preserves ordinary React nodes without invoking them as components', () => {
    expect(createContent('text')).toBe('text');
    expect(createContent(12)).toBe(12);
    expect(createContent(null)).toBeNull();
  });
});
