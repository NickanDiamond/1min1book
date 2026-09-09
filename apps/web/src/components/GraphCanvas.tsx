"use client";

import { useEffect, useRef } from "react";
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

function layoutOptions(layoutName: "cose" | "breadthfirst") {
  return {
    name: layoutName,
    animate: false,
    padding: 56,
    // Without this, cose's basic layout starts each run from nodes'
    // *current* positions and only randomizes ones that don't have a
    // position yet. Every node added in the same batch (e.g. all of a
    // book's neighbors arriving in one state update) starts at the exact
    // same default coordinate -- and repulsion between two points at
    // zero distance from each other has no direction to push them apart
    // in, so they can stay glued together indefinitely. Forcing a fresh
    // random start every run means no two nodes ever share a starting
    // point, so repulsion always has something to work with.
    randomize: true,
    // cose applies repulsion between every node pair, connected or not --
    // raising these is what actually keeps loosely-connected clusters
    // (e.g. a shared genre pulling in another book's whole neighborhood)
    // from settling on top of each other. Bumped up further alongside the
    // label-truncation fix above, since a hub with a dozen-plus neighbors
    // (a popular genre or topic) still benefits from extra spacing even
    // with shorter labels.
    nodeRepulsion: 20000,
    idealEdgeLength: 140,
    nodeOverlap: 24,
    gravity: 0.35,
    numIter: 2500,
  } as never;
}

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

  // react-cytoscapejs only runs its declarative `layout` prop once, on
  // mount. Elements added afterwards (each new expansion depth-level, a
  // shared node pulling in a whole new neighborhood, a fresh search) get
  // added without ever being laid out -- which is what was actually
  // causing nodes to pile up on top of each other, not insufficient
  // spacing. Re-running the layout ourselves, explicitly, whenever the
  // element set changes is what actually fixes it.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || elements.length === 0) return;
    cy.layout(layoutOptions(layoutName)).run();
  }, [elements, layoutName]);

  return (
    <CytoscapeComponent
      elements={elements}
      style={{ width: "100%", height: "100%" }}
      stylesheet={stylesheet}
      // "preset" -- do nothing on mount; the effect above runs the real
      // layout immediately after, and stays the single source of truth
      // for positioning on every subsequent update too.
      layout={{ name: "preset" } as never}
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
