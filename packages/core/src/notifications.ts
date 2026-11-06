export interface Notification {
  level: "info" | "success" | "warning" | "error";
  message: string;
}
export type NotificationSink = (notification: Notification) => void;
export class NotificationCenter {
  private sink: { receive: NotificationSink } | null = null;
  private disposed = false;
  bindSink(receive: NotificationSink): () => void {
    if (this.disposed) throw new Error("Notifications have been disposed");
    if (this.sink) throw new Error("A notification sink is already bound");
    const sink = { receive };
    this.sink = sink;
    return () => {
      if (this.sink === sink) this.sink = null;
    };
  }
  notify(notification: Notification): void {
    if (this.disposed) return;
    if (this.sink) this.sink.receive(notification);
    else if (notification.level === "error") console.error(notification.message);
    else if (notification.level === "warning") console.warn(notification.message);
  }
  dispose(): void {
    this.disposed = true;
    this.sink = null;
  }
}
