import type { ConnectionContext } from '@flow-designer/model';

export const ConnectionValidators = {
  sameDataType: (ctx: ConnectionContext): boolean =>
    ctx.sourcePort?.dataType != null && ctx.sourcePort.dataType === ctx.targetPort?.dataType,
  directionOnly: (ctx: ConnectionContext): boolean =>
    ctx.sourcePort?.group === 'out' && ctx.targetPort?.group === 'in',
  allowAll: (): boolean => true,
};
