import type { MessageInstance } from 'antd/es/message/interface';

let messageApi: MessageInstance | null = null;

export function setMessageApi(api: MessageInstance): void {
  messageApi = api;
}

export function getMessageApi(): MessageInstance | null {
  return messageApi;
}
