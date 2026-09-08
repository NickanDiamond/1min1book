"use client";

import { useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type cytoscape from "cytoscape";

// One shape + color per node type. Shape carries the type distinction so the
// graph still reads correctly without relying on color alone; color is a
// second, redundant cue on top of it.
const BASE_STYLESHEET: (cytoscape.StylesheetStyle | cytoscape.StylesheetCSS)[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      color: "#27272a",
      "font-size": 11,
      "font-weight": 500,
      "font-family": "var(--font-geist-sans), sans-serif",
      "text-valign": "bottom",
      "text-margin-y": 8,
      // A white outline behind the label keeps it legible where an edge
      // or another node's label crosses behind it, instead of relying on
      // pure spacing to avoid every collision.
      "text-outline-width": 3,
      "text-outline-color": "#fafafa",
      "text-outline-opacity": 1,
      width: 30,
      height: 30,
      "border-width": 2,
      "border-color": "#ffffff",
      "background-color": "#a1a1aa",
      shape: "ellipse",
      "overlay-opacity": 0,
      "transition-property": "opacity, border-width, width, height",
      "transition-duration": 200,
    },
  },
  // Shape + color per type. Books read as "documents" (rounded rectangle),
  // authors as people (circle), genres as broad categories (hexagon), and
  // topics as facets cutting across books (diamond).
  {
    selector: 'node[nodeType = "BOOK"]',
    style: { shape: "round-rectangle", "background-color": "#3b6fd6", width: 36, height: 28 },
  },
  {
    selector: 'node[nodeType = "AUTHOR"]',
    style: { shape: "ellipse", "background-color": "#2f9e6e", width: 32, height: 32 },
  },
  {
    selector: 'node[nodeType = "GENRE"]',
    style: { shape: "hexagon", "background-color": "#d2892f", width: 32, height: 32 },
  },
  {
    selector: 'node[nodeType = "TOPIC"]',
    style: { shape: "diamond", "background-color": "#8b5fc2", width: 32, height: 32 },
  },
  {
    selector: "node[?highlighted]",
    style: { "border-width": 3, "border-color": "#e8823c", width: 40, height: 34 },
  },
  {
    selector: "edge",
    style: {
      // mapData interpolates edge weight (0..1) to a line width (1..6px) --
      // stronger SIMILAR_TO connections read as visibly thicker lines.
      width: "mapData(weight, 0, 1, 1, 6)",
      "line-color": "#d4d4d8",
      "curve-style": "bezier",
      "target-arrow-shape": "none",
      opacity: 0.6,
      "transition-property": "opacity, line-color, width",
      "transition-duration": 200,
    },
  },
  {
    selector: 'edge[relationshipType = "SIMILAR_TO"]',
    style: { "line-color": "#3b6fd6" },
  },
  {
    selector: "edge[?highlighted]",
    style: { "line-color": "#e8823c", width: 5, opacity: 1 },
  },
];

// Applied only on screens that resolve a path (Find a Connection): fades
// everything not on the path, and keeps path elements muted until their
// `highlighted` flag flips on during the step-by-step reveal.
const DIM_NON_PATH_STYLESHEET: (cytoscape.StylesheetStyle | cytoscape.StylesheetCSS)[] = [
  { selector: "node[!inPath]", style: { opacity: 0.12 } },
  { selector: "edge[!inPath]", style: { opacity: 0.06 } },
  { selector: "node[?inPath][!highlighted]", style: { opacity: 0.35 } },
  { selector: "edge[?inPath][!highlighted]", style: { opacity: 0.3 } },
];

export interface GraphCanvasProps {
  elements: cytoscape.ElementDefinition[];
  onNodeClick: (id: number) => void;
  /** Fade out everything not on the current path -- used by /connect. */
  dimNonPath?: boolean;
  layoutName?: "cose" | "breadthfirst";
}

export default function GraphCanvas({
  elements,
  onNodeClick,
  dimNonPath = false,
  layoutName = "cose",
}: GraphCanvasProps) {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const stylesheet = dimNonPath ? [...BASE_STYLESHEET, ...DIM_NON_PATH_STYLESHEET] : BASE_STYLESHEET;

  return (
    <CytoscapeComponent
      elements={elements}
      style={{ width: "100%", height: "100%" }}
      stylesheet={stylesheet}
      layout={
        {
          name: layoutName,
          animate: false,
          padding: 56,
          // Tuned up from the defaults so that unconnected or loosely
          // connected nodes -- e.g. two different clusters that share no
          // edge -- still get pushed apart instead of settling near the
          // same point. Cose applies repulsion between *every* node pair,
          // connected or not, so raising nodeRepulsion/nodeOverlap and
          // giving it more iterations to converge is what actually fixes
          // overlapping nodes/labels, not just adding visual polish.
          nodeRepulsion: 16000,
          idealEdgeLength: 110,
          nodeOverlap: 24,
          gravity: 0.35,
          numIter: 2500,
        } as never
      }
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
