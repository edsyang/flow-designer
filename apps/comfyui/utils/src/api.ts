export const comfyuiApi = {
  async loadWorkflow(_id: string): Promise<Record<string, unknown>> {
    return {};
  },

  async saveWorkflow(_id: string, _data: Record<string, unknown>): Promise<void> {
  },

  async queuePrompt(_workflow: Record<string, unknown>): Promise<{ prompt_id: string }> {
    return { prompt_id: '' };
  },
};
