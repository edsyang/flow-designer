import { contentTypesRegistry } from "@flow-designer/model";
import { ProcessContent } from "./process-content";

export { ProcessContent } from "./process-content";
export { ProcessRelation } from "./process-relation";
export type { IProcessContentData, SerializedFlowElement } from "./types";

export function registerProcessContentType(): void {
  contentTypesRegistry.register(ProcessContent);
}
