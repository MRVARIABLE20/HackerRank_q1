import { type Edge, MarkerType } from "@xyflow/react";

export function edge(id: string, s: string, t: string, label?: string): Edge {
  return {
    id, source: s, target: t, label,
    type: "smoothstep", animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#f5c542", width: 13, height: 13 },
    style: { stroke: "#f5c54260", strokeWidth: 1.5 },
    labelStyle: { fill: "#f5c542", fontSize: 9, fontWeight: 700 },
    labelBgStyle: { fill: "#120d00", fillOpacity: 0.9 },
  };
}
