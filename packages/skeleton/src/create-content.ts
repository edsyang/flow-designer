import { cloneElement, createElement, isValidElement } from 'react';
import type { ComponentClass, ComponentType, ExoticComponent, ReactNode } from 'react';

export type RenderableComponent<P extends object = Record<string, unknown>> = ComponentType<P> | ExoticComponent<P>;

const forwardRefType = Symbol.for('react.forward_ref');
const memoType = Symbol.for('react.memo');

function property(value: unknown, key: string): unknown {
  if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

export function isReactClass(value: unknown): value is ComponentClass<Record<string, unknown>> {
  return typeof value === 'function' && Boolean(property(property(value, 'prototype'), 'isReactComponent'));
}

export function isReactComponent<P extends object = Record<string, unknown>>(value: unknown): value is RenderableComponent<P> {
  const tag = property(value, '$$typeof');
  return typeof value === 'function' || tag === forwardRefType || tag === memoType;
}

export function acceptsRef(value: unknown): boolean {
  if (isValidElement(value)) return acceptsRef(value.type);
  if (isReactClass(value)) return true;
  const tag = property(value, '$$typeof');
  if (tag === forwardRefType) return true;
  return tag === memoType && acceptsRef(property(value, 'type'));
}

export function createContent<P extends object = Record<string, unknown>>(content: ReactNode | RenderableComponent<P>, props?: P): ReactNode {
  if (isValidElement<P>(content)) {
    return props ? cloneElement(content, props) : content;
  }
  if (isReactComponent<P>(content)) return createElement(content, props);
  return content;
}
