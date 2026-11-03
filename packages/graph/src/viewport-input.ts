import { Dnd } from "@antv/x6-plugin-dnd";
import type { Dom, Graph, Node } from "@antv/x6";
import type { Scroller } from "@antv/x6-plugin-scroller";

type Point = { x: number; y: number };
type DragKind = "panel" | "canvas";

function panelRects(graph: Graph): DOMRect[] {
  const owner = graph.container.closest('[data-fd-area="workbench"]');
  return owner
    ? [
        ...owner.querySelectorAll<HTMLElement>(
          '[data-fd-area="sidebar"], [data-fd-area="inspector"], [data-fd-area="canvasToolbar"], [data-fd-area="header"], [data-fd-area="canvasQuickAdd"], [role="dialog"], .ant-modal-mask, .ant-modal-wrap',
        ),
      ].map((element) => element.getBoundingClientRect())
    : [];
}

function overPanel(graph: Graph, point: Point): boolean {
  return panelRects(graph).some(
    (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      point.x >= rect.left &&
      point.x < rect.right &&
      point.y >= rect.top &&
      point.y < rect.bottom,
  );
}

/** Panel drags must dwell at an edge; existing canvas nodes pan immediately. */
export class DragEdgePanController {
  private point: Point | null = null;
  private direction: Point = { x: 0, y: 0 };
  private kind: DragKind = "panel";
  private afterPan: ((delta: Point) => void) | null = null;
  private dwell: ReturnType<typeof setTimeout> | null = null;
  private dwellAnchor: Point | null = null;
  private frame: number | null = null;
  private disposed = false;
  private readonly stopHandler = () => {
    this.stop();
  };

  constructor(
    private graph: Graph,
    private scroller: Scroller,
  ) {
    document.addEventListener("mouseup", this.stopHandler, true);
    document.addEventListener("touchend", this.stopHandler, true);
    document.addEventListener("pointercancel", this.stopHandler, true);
    window.addEventListener("blur", this.stopHandler);
    window.addEventListener("resize", this.stopHandler);
  }

  update(point: Point, kind: DragKind, afterPan?: (delta: Point) => void): void {
    if (this.disposed) return;
    const direction = this.getDirection(point, kind);
    if (!direction.x && !direction.y) {
      this.stop();
      return;
    }
    const changed =
      kind !== this.kind || direction.x !== this.direction.x || direction.y !== this.direction.y;
    if (changed) this.stop();
    this.kind = kind;
    this.point = point;
    this.direction = direction;
    this.afterPan = afterPan ?? null;
    if (
      kind === "panel" &&
      this.dwell !== null &&
      this.dwellAnchor &&
      Math.hypot(point.x - this.dwellAnchor.x, point.y - this.dwellAnchor.y) > 6
    ) {
      clearTimeout(this.dwell);
      this.dwell = null;
      this.dwellAnchor = null;
    }
    if (this.dwell !== null || this.frame !== null) return;
    if (kind === "panel") {
      this.dwellAnchor = point;
      this.dwell = setTimeout(() => {
        this.dwell = null;
        this.pan();
      }, 500);
    } else this.pan();
  }

  stop(): void {
    if (this.dwell !== null) clearTimeout(this.dwell);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.dwell = null;
    this.dwellAnchor = null;
    this.frame = null;
    this.point = null;
    this.afterPan = null;
    this.direction = { x: 0, y: 0 };
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    document.removeEventListener("mouseup", this.stopHandler, true);
    document.removeEventListener("touchend", this.stopHandler, true);
    document.removeEventListener("pointercancel", this.stopHandler, true);
    window.removeEventListener("blur", this.stopHandler);
    window.removeEventListener("resize", this.stopHandler);
  }

  private getDirection(point: Point, kind: DragKind): Point {
    const viewport = this.scroller.container.getBoundingClientRect();
    const rect = viewport;
    const outside = kind === "panel" ? 0 : 32;
    if (
      point.x < rect.left - outside ||
      point.x > rect.right + outside ||
      point.y < rect.top - outside ||
      point.y > rect.bottom + outside
    )
      return { x: 0, y: 0 };
    const threshold = 24;
    const direction = {
      x: point.x <= rect.left + threshold ? -1 : point.x >= rect.right - threshold ? 1 : 0,
      y: point.y <= rect.top + threshold ? -1 : point.y >= rect.bottom - threshold ? 1 : 0,
    };
    if ((!direction.x && !direction.y) || overPanel(this.graph, point)) return { x: 0, y: 0 };
    return direction;
  }

  private pan(): void {
    const point = this.point;
    if (!point || this.disposed) return;
    const direction = this.getDirection(point, this.kind);
    if (
      (!direction.x && !direction.y) ||
      direction.x !== this.direction.x ||
      direction.y !== this.direction.y
    ) {
      this.stop();
      return;
    }
    const container = this.scroller.container;
    const before = this.graph.clientToLocal(point.x, point.y);
    const left = container.scrollLeft;
    const top = container.scrollTop;
    container.scrollLeft += this.direction.x * 12;
    container.scrollTop += this.direction.y * 12;
    const blockedX = this.direction.x && container.scrollLeft === left ? this.direction.x : 0;
    const blockedY = this.direction.y && container.scrollTop === top ? this.direction.y : 0;
    if (blockedX || blockedY) {
      const rect = container.getBoundingClientRect();
      const center = this.graph.clientToLocal(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      const scale = this.graph.transform.getScale();
      this.scroller.centerPoint(
        center.x + (blockedX * 12) / scale.sx,
        center.y + (blockedY * 12) / scale.sy,
      );
    }
    const after = this.graph.clientToLocal(point.x, point.y);
    this.afterPan?.({ x: after.x - before.x, y: after.y - before.y });
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.pan();
    });
  }
}

/** A drag ghost remains centred under the pointer, including after viewport panning. */
export class StableViewportDnd extends Dnd {
  constructor(
    options: ConstructorParameters<typeof Dnd>[0],
    private edgePan: DragEdgePanController,
  ) {
    super(options);
  }

  protected override isInsideValidArea(point: Point): boolean {
    const scroller = this.targetScroller as Scroller | null;
    if (!scroller) return super.isInsideValidArea(point);
    const contains = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return (
        point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom
      );
    };
    return (
      contains(scroller.container) &&
      !overPanel(this.targetGraph, point) &&
      !(this.options.dndContainer && contains(this.options.dndContainer))
    );
  }

  protected override onDragging(event: Dom.MouseMoveEvent): void {
    super.onDragging(event);
    if (!this.draggingNode) return;
    const pointer = this.normalizeEvent(event);
    const point = { x: pointer.clientX, y: pointer.clientY };
    this.edgePan.update(point, "panel", () => {
      if (this.draggingNode) {
        this.updateGraphPosition(point.x, point.y);
        this.updateNodePosition(point.x, point.y);
      }
    });
  }

  protected override onDragEnd(event: Dom.MouseUpEvent): void {
    this.edgePan.stop();
    super.onDragEnd(event);
  }

  override dispose(): void {
    this.edgePan.stop();
    super.dispose();
  }
}

export function installCanvasDragPan(
  graph: Graph,
  scroller: Scroller,
): { edgePan: DragEdgePanController; dispose: () => void } {
  const edgePan = new DragEdgePanController(graph, scroller);
  const moving = ({ e, node }: { e: { clientX: number; clientY: number }; node: Node }) => {
    edgePan.update({ x: e.clientX, y: e.clientY }, "canvas", (delta) => {
      if (delta.x || delta.y) {
        const position = node.position();
        node.position(position.x + delta.x, position.y + delta.y);
      }
    });
  };
  const moved = () => {
    edgePan.stop();
  };
  graph.on("node:moving", moving);
  graph.on("node:moved", moved);
  return {
    edgePan,
    dispose: () => {
      graph.off("node:moving", moving);
      graph.off("node:moved", moved);
      edgePan.dispose();
    },
  };
}
