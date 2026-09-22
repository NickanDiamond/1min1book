"use client";

import { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";

// Registering an extension that's already registered throws. This module
// only evaluates once per real page load, but Next's dev-mode Fast Refresh
// can re-run module-level code without a full reload, so this guards
// against that without needing any extra state.
try {
  cytoscape.use(fcose);
} catch {
  // already registered -- fine, ignore.
}

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

// Legibility floor, not an overlap fix. Zooming is a uniform transform on
// nodes, edges *and* label text together (cytoscape scales font rendering
// with zoom the same as everything else), so it can never change whether
// two labels' rendered boxes overlap -- that's fixed entirely by their
// relative positions/sizes in the layout's own coordinate space, before
// any zoom is applied. (An earlier version of this file clamped zoom
// believing it *was* the fix for overlap; it wasn't -- see the fcose
// switch below for the actual fix.) What a zoom floor still legitimately
// guards against: fcose spaces a dense hub out much further than cose
// used to, so fit-to-container has to zoom out further to fit it all,
// and past some point that makes every label too small to read. Past
// this floor the graph extends beyond the visible area instead of
// continuing to shrink, and panning covers the rest.
const MIN_ZOOM = 0.45;

// Estimated overlap-avoidance was never actually the bug. cose's own
// force simulation has no idea how big a node's *label* is -- by default
// its repulsion/overlap math only looks at the ~30px node shape, so two
// nodes could be "correctly" spaced by cose's own accounting while their
// labels (which extend ~8px below the node, wider than the node itself
// for anything but a one-word title) still visually collide. Cranking
// nodeRepulsion/idealEdgeLength/spacingFactor never touched this --
// spacing the *nodes* out further doesn't help the *labels*, which stay
// exactly as oversized relative to that spacing as before. Confirmed by
// reproducing the live dystopian-books cluster in a headless cytoscape
// instance and measuring label-rect overlap directly: base cose,
// however far its spacing knobs are pushed, converges with ~1.5-3
// overlapping label pairs on average (worst case up to 6) because its
// overlap avoidance is a soft heuristic layered on top of a spring
// simulation, not a real constraint solver -- it minimizes overlap, it
// doesn't guarantee zero.
//
// fCoSE (a proper, actively-maintained successor extension, not a
// built-in) fixes both problems at once: `nodeDimensionsIncludeLabels`
// makes its physics account for actual rendered label size, and its
// `quality: "proof"` mode runs real constraint-based overlap removal as
// a final pass rather than relying purely on spring forces. The same
// headless reproduction scores that combination at 0 overlapping label
// pairs across repeated randomized trials on this graph (both on a
// fresh layout and, more importantly, on the same incremental-update
// case cose was handling above -- see fixedNodeConstraint below).
function layoutOptions(
  layoutName: "cose" | "breadthfirst",
  fixedNodeConstraint: { nodeId: string; position: { x: number; y: number } }[],
) {
  if (layoutName === "breadthfirst") {
    return { name: "breadthfirst", animate: false, padding: 56, spacingFactor: 1.4 } as never;
  }

  return {
    name: "fcose",
    animate: false,
    padding: 56,
    nodeDimensionsIncludeLabels: true,
    // randomize: false + quality: "proof" is fCoSE's documented
    // incremental-layout combination (quality "default"/"draft" ignore
    // randomize:false and re-randomize anyway). Paired with
    // fixedNodeConstraint below, this is what actually replaces the old
    // "scatter only the new nodes, freeze everything else" logic: instead
    // of just giving already-placed nodes a decent starting guess and
    // hoping the physics leaves them alone, every already-placed node is
    // now a hard constraint fCoSE's solver is not allowed to move, and
    // only the genuinely new nodes are free to be positioned. Verified
    // headlessly that pinned nodes never move a single pixel across
    // repeated trials, while the free nodes still resolve with far less
    // label overlap than cose ever did in the same incremental scenario.
    quality: "proof",
    randomize: false,
    fixedNodeConstraint,
    // fCoSE has no spacingFactor/nodeOverlap (those are cose-only) --
    // nodeSeparation is its equivalent overlap-avoidance knob. These
    // three values are the best headlessly-measured combination found:
    // pushing them higher didn't reliably score better (the solver is
    // fighting to satisfy fixedNodeConstraint at the same time), and
    // pushing them lower let more labels collide.
    nodeRepulsion: 8000,
    idealEdgeLength: 160,
    nodeSeparation: 150,
    // Same reasoning as before: keeps genuinely disconnected clusters
    // (no shared author/genre/topic) from being dragged toward one
    // shared center regardless of whether anything actually connects them.
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
    // whole book's neighborhood landing in one state update). Everything
    // that already has a real position was already laid out on a
    // previous run and gets pinned in place via fixedNodeConstraint
    // (below) instead of being re-solved -- so two previously-separated,
    // disconnected clusters never get thrown back together, and an
    // update as small as expanding one node can't reshuffle the rest of
    // the canvas.
    // .toArray() + plain Array methods rather than Collection#filter/map --
    // cytoscape's own typings widen a filtered NodeCollection back to a
    // generic (node-or-edge) SingularElementArgument[], which loses the
    // .position() method.
    const isUnplaced = (n: cytoscape.NodeSingular) => n.position("x") === 0 && n.position("y") === 0;
    const existingNodes = cy.nodes().toArray().filter((n) => !isUnplaced(n));

    const fixedNodeConstraint = existingNodes.map((n) => ({
      nodeId: n.id(),
      position: { x: n.position("x"), y: n.position("y") },
    }));

    cy.layout(layoutOptions(layoutName, fixedNodeConstraint)).run();
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
        // See MIN_ZOOM above -- a readability floor, not an overlap fix.
        cy.minZoom(MIN_ZOOM);
        cy.removeAllListeners();
        cy.on("tap", "node", (evt) => {
          onNodeClick(Number(evt.target.id()));
        });
      }}
    />
  );
}
