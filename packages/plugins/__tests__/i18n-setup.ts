import { initializeI18n, registerMessages } from "@flow-designer/i18n";
import { pluginsMessages } from "../src/messages";
import { graphMessages } from "@flow-designer/graph";
import { workbenchMessages } from "@flow-designer/react";
import { commonMessages } from "@flow-designer/skeleton";
for (const messages of [pluginsMessages, graphMessages, workbenchMessages, commonMessages])
  registerMessages(messages);
await initializeI18n();
