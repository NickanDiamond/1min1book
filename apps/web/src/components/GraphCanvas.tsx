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
    // false, deliberately -- see the scattering step in the effect below.
    // cose's basic layout starts each run from nodes' *current* positions
    // and only randomizes ones that don't have a position yet, which is
    // exactly what we want now that the effect itself gives every new
    // node a distinct starting point: already-converged nodes keep the
    // positions they settled on last time (so two previously-separated
    // clusters don't get thrown back together and re-solved from scratch
    // on every graph update), while new arrivals still get spread out
    // instead of stacking at the same default coordinate.
    randomize: false,
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
    // A hub that several books share at once (a common genre, an author
    // with multiple books, a handful of overlapping topics) still tends
    // to converge tightly enough that labels -- which extend well past
    // the ~30px node itself, especially for a long title -- overlap each
    // other even though the node centers are reasonably spaced. cose
    // applies this as a uniform multiplier over the whole solved layout,
    // so it spreads everything out proportionally without changing the
    // relative arrangement the physics already settled on.
    spacingFactor: 1.4,
    // Lower than cose's 0.4 default. Gravity pulls every node toward one
    // shared center regardless of whether it's actually connected to
    // anything else -- at the old value it was dragging separate,
    // unrelated clusters (e.g. two books that share no author, genre, or
    // topic) visually close together even though nothing ever draws an
    // edge between them; the data model never fabricates a connection
    // that doesn't exist. With gravity this low, mutual repulsion
    // dominates, so disconnected groups drift apart into visibly
    // distinct clusters instead of huddling near the middle.
    gravity: 0.12,
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

    // Cytoscape gives a node with no explicit position a default of
    // (0, 0) -- that's every node that just arrived in this batch (a
    // whole book's neighborhood landing in one state update), so without
    // spreading them out ourselves they'd start glued to each other (and
    // often right on top of whatever's already sitting near the origin).
    // We used to solve that by randomizing *every* node's position on
    // every layout run, but that also threw away the positions of nodes
    // that were already laid out -- so an update as small as expanding
    // one node could re-solve the whole graph from scratch and leave two
    // previously-separated, disconnected clusters overlapping in a
    // tangle. Scattering only the nodes that are actually new keeps
    // everything already on the canvas exactly where it settled, while
    // still giving cose's repulsion a distinct starting point for each
    // new arrival to push apart from.
    const allNodes = cy.nodes();
    const isUnplaced = (n: cytoscape.NodeSingular) => n.position("x") === 0 && n.position("y") === 0;
    const newNodes = allNodes.filter(isUnplaced);
    const existingNodes = allNodes.filter((n) => !isUnplaced(n));

    if (newNodes.length > 0) {
      const bounds = existingNodes.length > 0 ? existingNodes.boundingBox() : null;
      const spread = Math.max(bounds ? Math.max(bounds.w, bounds.h) : 0, 600);
      const centerX = bounds ? (bounds.x1 + bounds.x2) / 2 : 0;
      const centerY = bounds ? (bounds.y1 + bounds.y2) / 2 : 0;
      newNodes.forEach((node) => {
        node.position({
          x: centerX + (Math.random() - 0.5) * spread,
          y: centerY + (Math.random() - 0.5) * spread,
        });
      });
    }

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
