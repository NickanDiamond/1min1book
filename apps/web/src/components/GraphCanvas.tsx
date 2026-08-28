"use client";

import { useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type cytoscape from "cytoscape";

// One color per node type -- this is the whole legend, so it needs to stay
// small and distinct. Matches the legend rendered in page.tsx.
const stylesheet: (cytoscape.StylesheetStyle | cytoscape.StylesheetCSS)[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      color: "#111827",
      "font-size": 10,
      "text-valign": "bottom",
      "text-margin-y": 6,
      width: 26,
      height: 26,
      "border-width": 2,
      "border-color": "#ffffff",
      "background-color": "#6b7280",
    },
  },
  { selector: 'node[nodeType = "BOOK"]', style: { "background-color": "#2563eb" } },
  { selector: 'node[nodeType = "AUTHOR"]', style: { "background-color": "#059669" } },
  { selector: 'node[nodeType = "GENRE"]', style: { "background-color": "#d97706" } },
  { selector: 'node[nodeType = "TOPIC"]', style: { "background-color": "#7c3aed" } },
  {
    selector: "node[?highlighted]",
    style: { "border-width": 4, "border-color": "#f97316", width: 34, height: 34 },
  },
  {
    selector: "edge",
    style: {
      // mapData interpolates edge weight (0..1) to a line width (1..6px) --
      // stronger SIMILAR_TO connections read as visibly thicker lines.
      width: "mapData(weight, 0, 1, 1, 6)",
      "line-color": "#cbd5e1",
      "curve-style": "bezier",
      "target-arrow-shape": "none",
      opacity: 0.65,
    },
  },
  {
    selector: 'edge[relationshipType = "SIMILAR_TO"]',
    style: { "line-color": "#2563eb" },
  },
  {
    selector: "edge[?highlighted]",
    style: { "line-color": "#f97316", width: 5, opacity: 1 },
  },
];

export interface GraphCanvasProps {
  elements: cytoscape.ElementDefinition[];
  onNodeClick: (id: number) => void;
}

export default function GraphCanvas({ elements, onNodeClick }: GraphCanvasProps) {
  const cyRef = useRef<cytoscape.Core | null>(null);

  return (
    <CytoscapeComponent
      elements={elements}
      style={{ width: "100%", height: "100%" }}
      stylesheet={stylesheet}
      layout={{ name: "cose", animate: false, padding: 40 } as never}
      cy={(cy) => {
        if (cyRef.current === cy) return;
        cyRef.current = cy;
        cy.removeAllListeners();
        cy.on("tap", "node", (evt) => {
          onNodeClick(Number(evt.target.id()));
        });
      }}
    />
  );
}
