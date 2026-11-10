import type { ReactNode } from 'react';
import { render, renderHook, type RenderOptions, type RenderHookOptions } from '@testing-library/react';
import { StudioTestProviders } from './studio-scope-context.js';
export { createStudioTestScope, studioTestScope, StudioTestProviders } from './studio-scope-context.js';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

export function renderStudio(node: ReactNode, options: RenderOptions = {}) {
  const Wrapper = options.wrapper;
  return render(node, { ...options, wrapper: ({ children }) => <StudioTestProviders>{Wrapper ? <Wrapper>{children}</Wrapper> : children}</StudioTestProviders> });
}
export function renderStudioHook<Result, Props>(callback: (props: Props) => Result, options: RenderHookOptions<Props> = {}) {
  const Wrapper = options.wrapper;
  return renderHook(callback, { ...options, wrapper: ({ children }) => <StudioTestProviders>{Wrapper ? <Wrapper>{children}</Wrapper> : children}</StudioTestProviders> });
}
