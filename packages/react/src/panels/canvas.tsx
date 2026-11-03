import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Input } from "antd";
import { prototypeRegistry, t } from "@flow-designer/model";
import type { IArea, IGraphManager, Prototype } from "@flow-designer/model";
import { useEditor } from "../hooks";
import { mountArea } from "./mount-area";
import styles from "../workbench.module.css";

interface CanvasProps {
  area: IArea;
}

interface QuickAddMenu {
  anchorLeft: number;
  anchorTop: number;
  left: number;
  top: number;
  graphX: number;
  graphY: number;
}

function getQuickAddShapeClass(shape: string): string {
  if (shape.includes("diamond")) return styles.canvasQuickAddShapeDiamond!;
  if (shape.includes("rect-event")) return styles.canvasQuickAddShapeRectEvent!;
  if (shape.includes("circle")) return styles.canvasQuickAddShapeCircle!;
  return styles.canvasQuickAddShapeRect!;
}

function getQuickAddShapeColor(shape: string): string {
  if (shape.includes("diamond")) return "#faad14";
  if (shape.includes("circle-end") || shape.includes("circleEnd")) return "#ff4d4f";
  if (shape.includes("rect-event")) return "#fa8c16";
  if (shape.includes("circle")) return "#52c41a";
  return "#4d7cfe";
}

export function Canvas(props: CanvasProps) {
  const { area } = props;
  const editor = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLElement | null>(null);
  const [graph, setGraph] = useState<IGraphManager | null>(null);
  const [prototypes, setPrototypes] = useState<Prototype[]>([]);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<QuickAddMenu | null>(null);
  const addingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuOpen = menu !== null;

  const closeQuickAdd = () => {
    setMenu(null);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    canvasAreaRef.current = container.parentElement;
    const acquiredContainer = editor.getContainer()
      ? null
      : (container.closest<HTMLElement>('[data-fd-area="workbench"]') ?? container);
    if (acquiredContainer) editor.setContainer(acquiredContainer);
    const releaseContainer = () => {
      if (acquiredContainer && editor.getContainer() === acquiredContainer)
        editor.setContainer(null);
    };
    let disposeArea: () => void;
    try {
      disposeArea = mountArea(area, container);
    } catch (error) {
      releaseContainer();
      throw error;
    }

    const graphManager = editor.getGraph();
    if (!graphManager)
      return () => {
        try {
          disposeArea();
        } finally {
          releaseContainer();
        }
      };
    setGraph(graphManager);

    const openQuickAdd = (clientPoint: { x: number; y: number }) => {
      const canvasArea = canvasAreaRef.current;
      if (!canvasArea) return;
      const rect = canvasArea.getBoundingClientRect();
      const graphPoint = graphManager.clientToLocal(clientPoint.x, clientPoint.y);
      returnFocusRef.current = container;
      setQuery("");
      setError(null);
      setMenu({
        anchorLeft: clientPoint.x - rect.left,
        anchorTop: clientPoint.y - rect.top,
        left: clientPoint.x - rect.left + 12,
        top: clientPoint.y - rect.top + 12,
        graphX: graphPoint.x,
        graphY: graphPoint.y,
      });
    };

    const handleBlankDoubleClick = (...args: unknown[]) => {
      const payload = args[0] as
        | {
            e?: { clientX?: number; clientY?: number };
            x?: number;
            y?: number;
          }
        | undefined;
      const canvasArea = canvasAreaRef.current;
      if (!payload || !canvasArea) return;

      const clientX = payload.e?.clientX;
      const clientY = payload.e?.clientY;
      const clientPoint =
        Number.isFinite(clientX) && Number.isFinite(clientY)
          ? { x: clientX as number, y: clientY as number }
          : payload.x !== undefined && payload.y !== undefined
            ? graphManager.localToClient(payload.x, payload.y)
            : null;
      if (!clientPoint) return;

      openQuickAdd(clientPoint);
    };

    const handleCanvasKeyDown = (event: KeyboardEvent) => {
      if (
        event.target !== container ||
        event.key !== "Enter" ||
        event.isComposing ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const rect = canvasAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      event.preventDefault();
      openQuickAdd({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    };
    container.addEventListener("keydown", handleCanvasKeyDown);

    graphManager.on("blank:dblclick", handleBlankDoubleClick);
    return () => {
      graphManager.off("blank:dblclick", handleBlankDoubleClick);
      container.removeEventListener("keydown", handleCanvasKeyDown);
      try {
        disposeArea();
      } finally {
        releaseContainer();
      }
    };
  }, [area, editor]);

  useEffect(() => {
    const refreshPrototypes = () => {
      setPrototypes(
        prototypeRegistry.getRegistry().filter((prototype) => {
          const view = prototype.getView();
          return (
            view.type === "node" && view.quickAdd !== false && Boolean(view.shape || view.component)
          );
        }),
      );
    };
    refreshPrototypes();
    return prototypeRegistry.onRegistryChange(refreshPrototypes);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const previousFocus = returnFocusRef.current ?? containerRef.current;
    const panel = panelRef.current;
    panel?.querySelector("input")?.focus({ preventScroll: true });

    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) closeQuickAdd();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeQuickAdd();
        previousFocus?.focus({ preventScroll: true });
        return;
      }
      if (!panel?.contains(document.activeElement)) return;
      const controls = Array.from(
        panel.querySelectorAll<HTMLElement>("input, button:not(:disabled)"),
      );
      if (event.key === "Tab") {
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey
          ? (index - 1 + controls.length) % controls.length
          : (index + 1) % controls.length;
        event.preventDefault();
        controls[next]?.focus();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const options = Array.from(
          panel.querySelectorAll<HTMLButtonElement>("[data-quick-add-option]:not(:disabled)"),
        );
        if (!options.length) return;
        const index = options.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === "ArrowDown"
            ? (index + 1) % options.length
            : (index - 1 + options.length) % options.length;
        event.preventDefault();
        options[next]?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      if (panel?.contains(document.activeElement) || document.activeElement === document.body)
        previousFocus?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menu) return;

    const panel = panelRef.current;
    const canvasArea = canvasAreaRef.current;
    if (!panel || !canvasArea) return;

    const maxLeft = Math.max(8, canvasArea.clientWidth - panel.offsetWidth - 8);
    const maxTop = Math.max(8, canvasArea.clientHeight - panel.offsetHeight - 8);
    const left = Math.min(
      maxLeft,
      Math.max(
        8,
        menu.anchorLeft + panel.offsetWidth + 12 <= canvasArea.clientWidth - 8
          ? menu.anchorLeft + 12
          : menu.anchorLeft - panel.offsetWidth - 12,
      ),
    );
    const top = Math.min(
      maxTop,
      Math.max(
        8,
        menu.anchorTop + panel.offsetHeight + 12 <= canvasArea.clientHeight - 8
          ? menu.anchorTop + 12
          : menu.anchorTop - panel.offsetHeight - 12,
      ),
    );
    if (left !== menu.left || top !== menu.top) {
      setMenu({ ...menu, left, top });
    }
  }, [menu]);

  const addNode = async (prototype: Prototype) => {
    if (!menu || !graph || addingRef.current) return;
    addingRef.current = true;
    setAdding(true);

    const size = prototype.getView().defaultSize ?? { width: 140, height: 40 };
    try {
      const node = await editor
        .getDocument()
        .getContent()
        .addNode({
          type: prototype.getTypeName(),
          props: {
            __position: {
              x: menu.graphX - size.width / 2,
              y: menu.graphY - size.height / 2,
            },
          },
        });
      if (!node) {
        setError(t("workbench.canvas.addFailed", { name: prototype.getName() }));
        return;
      }

      graph.select([node.getId()]);
      editor.getDocument().getSelection().setKeys([node.getId()]);
      closeQuickAdd();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : String(addError));
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };

  const visiblePrototypes = prototypes.filter((prototype) => {
    const value = `${prototype.getName()} ${prototype.getCategory()}`.toLocaleLowerCase();
    return value.includes(query.trim().toLocaleLowerCase());
  });

  return (
    <>
      <div
        data-fd-area="canvas"
        tabIndex={0}
        aria-label={t("workbench.canvas.label")}
        aria-keyshortcuts="Enter"
        title={t("workbench.canvas.addHint")}
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
      />
      {menu && (
        <div
          ref={panelRef}
          className={styles.canvasQuickAdd}
          data-fd-area="canvasQuickAdd"
          role="dialog"
          aria-label={t("workbench.canvas.quickAdd")}
          style={{ left: menu.left, top: menu.top }}
        >
          <div className={styles.canvasQuickAddHeader}>
            <span>{t("workbench.canvas.quickAdd")}</span>
            <button type="button" onClick={closeQuickAdd} aria-label={t("workbench.canvas.close")}>
              ×
            </button>
          </div>
          <Input
            size="small"
            aria-label={t("workbench.sidebar.searchPlaceholder")}
            placeholder={t("workbench.sidebar.searchPlaceholder")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && visiblePrototypes[0]) {
                event.preventDefault();
                void addNode(visiblePrototypes[0]);
              }
            }}
          />
          <div className={styles.canvasQuickAddList}>
            {visiblePrototypes.map((prototype) => {
              const shape = prototype.getView().shape ?? "fd-rect";
              return (
                <button
                  type="button"
                  key={prototype.getTypeName()}
                  data-quick-add-option
                  disabled={adding}
                  className={styles.canvasQuickAddOption}
                  onClick={() => {
                    void addNode(prototype);
                  }}
                >
                  <span
                    className={[styles.canvasQuickAddShape, getQuickAddShapeClass(shape)]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ borderColor: getQuickAddShapeColor(shape) }}
                  />
                  <span className={styles.canvasQuickAddName}>{prototype.getName()}</span>
                  <span className={styles.canvasQuickAddCategory}>{prototype.getCategory()}</span>
                </button>
              );
            })}
            {visiblePrototypes.length === 0 && (
              <div className={styles.canvasQuickAddEmpty}>{t("workbench.canvas.noMatch")}</div>
            )}
          </div>
          {error && (
            <div className={styles.canvasQuickAddError} role="alert">
              {error}
            </div>
          )}
        </div>
      )}
    </>
  );
}
