import { runCleanupTasks } from "./cleanup-tasks";
import type { Graph } from "@antv/x6";
import type { Scroller } from "@antv/x6-plugin-scroller";
/** Owns viewport observers and DOM listeners; native input logic stays in viewport-input. */
export class ViewportResources {
  private viewportResizeObserver: ResizeObserver | null = null;
  private viewportResizeHandler: (() => void) | null = null;
  private cleanups: Array<() => void> = [];
  constructor(private currentGraph: () => Graph | null) {}
  private get graph(): Graph | null {
    return this.currentGraph();
  }
  setupTemporaryPan(container: HTMLElement, scroller: Scroller): void {
    if (!container.hasAttribute("tabindex")) container.tabIndex = 0;
    const owner = container.closest<HTMLElement>('[data-fd-area="workbench"]') ?? container;
    let space = false;
    let dragging: { x: number; y: number; left: number; top: number } | null = null;
    const keydown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        event.code === "Space" &&
        !event.defaultPrevented &&
        !event.isComposing &&
        active instanceof Element &&
        owner.contains(active) &&
        !active.closest("input, textarea, select, button, [role=textbox], [contenteditable=true]")
      ) {
        space = true;
        event.preventDefault();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === "Space") space = false;
    };
    const down = (event: MouseEvent) => {
      if (
        event.button === 0 &&
        !space &&
        event.target instanceof Element &&
        !event.target.closest("input, textarea, [contenteditable=true]")
      )
        container.focus({ preventScroll: true });
      if (event.button !== 1 && !(event.button === 0 && space)) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = {
        x: event.clientX,
        y: event.clientY,
        left: scroller.container.scrollLeft,
        top: scroller.container.scrollTop,
      };
    };
    const move = (event: MouseEvent) => {
      if (!dragging) return;
      scroller.container.scrollLeft = dragging.left - (event.clientX - dragging.x);
      scroller.container.scrollTop = dragging.top - (event.clientY - dragging.y);
    };
    const up = () => {
      dragging = null;
    };
    const reset = () => {
      space = false;
      dragging = null;
    };
    const focusout = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !owner.contains(event.relatedTarget)) reset();
    };
    owner.addEventListener("keydown", keydown);
    owner.addEventListener("keyup", keyup);
    owner.addEventListener("focusout", focusout);
    window.addEventListener("blur", reset);
    scroller.container.addEventListener("mousedown", down, true);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    this.cleanups.push(() => {
      runCleanupTasks([
        () => {
          owner.removeEventListener("keydown", keydown);
        },
        () => {
          owner.removeEventListener("keyup", keyup);
        },
        () => {
          owner.removeEventListener("focusout", focusout);
        },
        () => {
          window.removeEventListener("blur", reset);
        },
        () => {
          scroller.container.removeEventListener("mousedown", down, true);
        },
        () => {
          document.removeEventListener("mousemove", move);
        },
        () => {
          document.removeEventListener("mouseup", up);
        },
      ]);
    });
  }

  observeViewportSize(viewport: HTMLElement, graph: Graph): void {
    const resize = (width = viewport.clientWidth, height = viewport.clientHeight) => {
      if (width > 0 && height > 0 && this.graph === graph) {
        this.resizeGraph(graph, width, height);
      }
    };

    if (typeof ResizeObserver !== "undefined") {
      this.viewportResizeObserver = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (entry) resize(entry.contentRect.width, entry.contentRect.height);
      });
      this.viewportResizeObserver.observe(viewport);
    }

    if (typeof window !== "undefined") {
      this.viewportResizeHandler = () => {
        resize();
      };
      window.addEventListener("resize", this.viewportResizeHandler);
    }
  }

  resizeGraph(graph: Graph, width: number, height: number): void {
    graph.resize(width, height);
    graph.transform.resize(width, height);
  }

  setupScrollerAutoFit(graph: Graph, scroller: Scroller): void {
    let updateQueued = false;
    const scheduleUpdate = () => {
      if (updateQueued) return;
      updateQueued = true;
      queueMicrotask(() => {
        updateQueued = false;
        if (this.graph === graph) {
          scroller.enableAutoResize();
          try {
            scroller.updateScroller();
          } finally {
            scroller.disableAutoResize();
          }
        }
      });
    };

    graph.on("cell:added", scheduleUpdate);
    graph.on("cell:removed", scheduleUpdate);
    graph.on("node:moved", scheduleUpdate);
  }
  disposeListeners(): void {
    runCleanupTasks(this.cleanups.splice(0));
  }
  disposeObserver(): void {
    const observer = this.viewportResizeObserver,
      handler = this.viewportResizeHandler;
    this.viewportResizeObserver = null;
    this.viewportResizeHandler = null;
    runCleanupTasks([
      () => observer?.disconnect(),
      () => {
        if (handler && typeof window !== "undefined") window.removeEventListener("resize", handler);
      },
    ]);
  }
}
