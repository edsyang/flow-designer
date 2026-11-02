import type { IPluginConfig, IPluginContext } from '@flow-designer/core';
import { prototypeRegistry } from '@flow-designer/model';

const DEFAULT_PORTS = [8080];

function parsePortParam(url: URL, param: string): number[] {
  if (!url.searchParams.has(param)) return [];
  const raw = url.searchParams.get(param);
  if (!raw) return DEFAULT_PORTS;
  return raw.split(',').map(Number).filter((p) => p > 0 && p < 65536);
}

export function pluginDebugLoader(ctx: IPluginContext): IPluginConfig {
  return {
    name: 'plugin-debug-loader',
    dep: ['plugin-x6-graph'],
    async init() {
      if (typeof window === 'undefined') return;

      const url = new URL(window.location.href);
      const pluginPorts = parsePortParam(url, 'debugPlugin');
      const componentPorts = parsePortParam(url, 'debugComponent');

      if (pluginPorts.length === 0 && componentPorts.length === 0) return;

      for (const port of pluginPorts) {
        try {
          const mod = await import(/* @vite-ignore */ `http://localhost:${String(port)}/src/index.ts`);
          const creator = (mod as Record<string, unknown>).default ?? mod;
          if (typeof creator === 'function') {
            await (ctx as unknown as { plugins: { register: (c: unknown, o: unknown, opts: { autoInit: boolean }) => Promise<void> } }).plugins.register(creator, {}, { autoInit: true });
          }
        } catch {
          // debug plugin load failure is non-fatal
        }
      }

      for (const port of componentPorts) {
        try {
          const mod = await import(/* @vite-ignore */ `http://localhost:${String(port)}/src/index.ts`);
          const proto = (mod as Record<string, unknown>).default ?? mod;
          if (proto && typeof proto === 'object' && 'name' in proto && 'view' in proto) {
            prototypeRegistry.register(proto as Parameters<typeof prototypeRegistry.register>[0]);
          }
        } catch {
          // debug component load failure is non-fatal
        }
      }
    },
  };
}
