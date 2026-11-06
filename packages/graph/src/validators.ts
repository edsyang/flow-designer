import { canUsePort } from "@flow-designer/model";
import type { ConnectionContext } from "@flow-designer/model";
type Ports = Pick<ConnectionContext, "sourcePort" | "targetPort">;
const sameDataType = (ctx: Ports): boolean =>
  ctx.sourcePort?.dataType != null && ctx.sourcePort.dataType === ctx.targetPort?.dataType;
const directionOnly = (ctx: Ports): boolean =>
  canUsePort(ctx.sourcePort, "source") && canUsePort(ctx.targetPort, "target");
export const ConnectionValidators = {
  sameDataType: Object.assign(sameDataType, { validatePorts: sameDataType }),
  directionOnly: Object.assign(directionOnly, { validatePorts: directionOnly }),
  allowAll: (): boolean => true,
};
