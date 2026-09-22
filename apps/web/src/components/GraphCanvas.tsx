"use client";

import { useEffect, useMemo, useRef } from "react";
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

// BOOK nodes size themselves to their own title instead of using one fixed
// rectangle for every book -- "1984" and "The Handmaid's Tale" need very
// different amounts of room. Clamped so a one-word title doesn't shrink to
// nothing and a long subtitle doesn't take over the canvas; text-wrap
// (below) covers whatever still doesn't fit on one line.
const BOOK_MIN_WIDTH = 44;
const BOOK_MAX_WIDTH = 132;
const BOOK_CHAR_WIDTH = 6.4; // ~11px sans-serif average glyph advance
const BOOK_PADDING = 22;

function bookNodeWidth(ele: cytoscape.NodeSingular): number {
  const label = String(ele.data("label") ?? "");
  return Math.min(BOOK_MAX_WIDTH, Math.max(BOOK_MIN_WIDTH, BOOK_PADDING + label.length * BOOK_CHAR_WIDTH));
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
      // Long labels wrap onto a second line instead of running into
      // whatever node happens to be nearby -- "anywhere" (rather than the
      // default "whitespace") is what lets a hyphenated slug like
      // "individual-freedom" or a single long word like
      // "authoritarianism" actually break, since neither has the
      // whitespace that word-boundary wrapping requires. This replaced an
      // earlier truncateLabel() step in useGraphState -- wrapping keeps
      // the real title/name on the canvas instead of an ellipsis.
      "text-wrap": "wrap",
      "text-max-width": "85px",
      "text-justification": "center",
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
    style: {
      shape: "round-rectangle",
      "background-color": "#3b6fd6",
      // Function-valued style -- cytoscape calls this per-node and
      // resolves it to a real number before fCoSE ever reads .width(),
      // so nodeDimensionsIncludeLabels (in the layout options) reserves
      // space based on each book's *actual* sized rectangle, not a
      // uniform guess.
      width: bookNodeWidth as never,
      height: 28,
      // Wider than the default 85px above -- a book's title is the one
      // label people actually need to read at a glance, so it gets more
      // room per line before wrapping to a second one.
      "text-max-width": "110px",
    },
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
// `highlighted` flag flips on during the step-by-step reveal. Purely a
// style/data change -- see the topology-vs-style split below for why this
// no longer triggers a layout run.
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
// any zoom is applied. What a zoom floor still legitimately guards
// against: fcose spaces a dense hub out much further than cose used to,
// so fit-to-container has to zoom out further to fit it all, and past
// some point that makes every label too small to read. Past this floor
// the graph extends beyond the visible area instead of continuing to
// shrink, and panning covers the rest.
const MIN_ZOOM = 0.45;

// Disconnected components (an unrelated book search-added onto the
// canvas, with no path to anything already there) get their own hard
// minimum separation -- see separateNewComponents below. fCoSE's own
// gravity/repulsion push them apart some, but headless measurement
// (reproducing two disconnected 3-node clusters) showed only ~6px of
// actual clearance between their label-inclusive bounding boxes by
// default -- not "enough space that labels don't collide", and not
// reliably fixable by tuning gravity/repulsion further without also
// pulling connected clusters apart. cytoscape-fcose does support a
// proper packing step for this (`packComponents`), but it delegates to a
// separate `cytoscape-layout-utilities` extension, and registering that
// extension hit an unexplained "already exists in the prototype"
// collision in every environment this was testable in -- not something
// to ship unverified. This constant-gap shelf-pack is a deliberately
// simple, dependency-free substitute: it guarantees the minimum, it's
// easy to reason about, and it only ever moves genuinely new components
// (see isNewComponent below), never anything already settled.
const MIN_COMPONENT_GAP = 100;

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
// makes its physics account for actual rendered label size (including
// the wrapped, multi-line size once text-wrap is in play), and its
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
    return { name: "breadthfirst", animate: false, padding: 56, spacingFactor: 1.4, fit: false } as never;
  }

  return {
    name: "fcose",
    animate: false,
    padding: 56,
    // fit is run once, explicitly, after this AND the component-separation
    // pass below -- letting fCoSE fit internally would frame the graph
    // *before* disconnected components get shifted apart, clipping them
    // right back out of view.
    fit: false,
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
    //
    // But randomize:false is only correct *because* fixedNodeConstraint
    // gives the solver real anchors to work from. On the very first
    // layout -- nothing on the canvas yet, fixedNodeConstraint is empty
    // -- every single node defaults to the exact same (0, 0) starting
    // point, and quality:"proof" with no randomization and no anchors is
    // a far worse starting condition than an actual random scatter.
    // Measured headlessly on a realistic 20-node dense-hub graph (5
    // books, shared themes, the same shape as Nick's dystopian-books
    // test case): randomize:false unconditionally left ~16 overlapping
    // label pairs on average -- worse than doing nothing. Only
    // randomizing when there's nothing yet to preserve brought that down
    // to ~1-2.
    quality: "proof",
    randomize: fixedNodeConstraint.length === 0,
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
    // Keeps genuinely disconnected clusters (no shared author/genre/
    // topic) from being dragged toward one shared center regardless of
    // whether anything actually connects them. Component separation
    // itself is handled explicitly afterward (see MIN_COMPONENT_GAP) --
    // gravity this low is still what keeps fCoSE from fighting that step
    // by pulling everything back toward the middle.
    gravity: 0.12,
    numIter: 2500,
  } as never;
}

type Box = { x1: number; x2: number; y1: number; y2: number };

// Estimates a node's footprint (its own shape plus its wrapped label)
// independently of cytoscape's own boundingBox({includeLabels}) -- that
// option depends on the canvas renderer having actually measured the
// label at least once, which a render-once-per-real-frame browser does
// naturally but which never happens for a node that hasn't been painted
// yet (and doesn't happen at all in a non-rendering/headless context).
// This mirrors the same character-count estimate the fcose overlap fix
// above was verified against, and the maxWidthPx/charW values are the
// same ones the BOOK_* constants and the base stylesheet's
// text-max-width actually use -- if those change, this should too.
function estimateNodeFootprint(n: cytoscape.NodeSingular): Box {
  const pos = n.position();
  const w = (n.width() as unknown as number) || 30;
  const h = (n.height() as unknown as number) || 30;
  const label = String(n.data("label") ?? "");
  const isBook = n.data("nodeType") === "BOOK";
  const maxWidthPx = isBook ? 110 : 85;
  const charW = 6.3;
  const singleLineW = label.length * charW;
  const lines = Math.max(1, Math.ceil(singleLineW / maxWidthPx));
  const labelW = Math.min(singleLineW, maxWidthPx);
  const labelH = lines * 13;
  const marginY = 8;
  const halfW = Math.max(w / 2, labelW / 2);
  return {
    x1: pos.x - halfW,
    x2: pos.x + halfW,
    y1: pos.y - h / 2,
    y2: pos.y + h / 2 + marginY + labelH,
  };
}

function componentFootprint(comp: cytoscape.CollectionReturnValue): Box {
  const boxes = comp.nodes().toArray().map(estimateNodeFootprint);
  return boxes.reduce(
    (acc, b) => ({
      x1: Math.min(acc.x1, b.x1),
      x2: Math.max(acc.x2, b.x2),
      y1: Math.min(acc.y1, b.y1),
      y2: Math.max(acc.y2, b.y2),
    }),
    boxes[0],
  );
}

/**
 * Deterministic minimum spacing between disconnected components. Only
 * ever moves a component that contains at least one node from this
 * update's `newNodeIds` -- a component made entirely of already-settled
 * nodes is treated as a fixed anchor, exactly like fixedNodeConstraint
 * does for individual nodes above, so expanding or adding an unrelated
 * book can never shove an existing, unrelated cluster around.
 */
function separateNewComponents(cy: cytoscape.Core, newNodeIds: Set<string>) {
  const components = cy.elements().components();
  if (components.length < 2) return;

  const separation = (a: Box, b: Box) => {
    const dx = Math.max(a.x1 - b.x2, b.x1 - a.x2, 0);
    const dy = Math.max(a.y1 - b.y2, b.y1 - a.y2, 0);
    return dx === 0 && dy === 0 ? -1 : Math.max(dx, dy);
  };

  const entries = components
    .map((comp) => ({
      comp,
      isNew: comp.nodes().toArray().some((n) => newNodeIds.has(n.id())),
      box: componentFootprint(comp),
    }))
    // Anchors (old components) first, in their existing left-to-right
    // order, so this never has to choose which old component "yields".
    .sort((a, b) => (a.isNew === b.isNew ? a.box.x1 - b.box.x1 : a.isNew ? 1 : -1));

  const placed: Box[] = [];
  for (const entry of entries) {
    if (!entry.isNew) {
      placed.push(entry.box);
      continue;
    }
    let dx = 0;
    for (const box of placed) {
      const shifted: Box = { x1: entry.box.x1 + dx, x2: entry.box.x2 + dx, y1: entry.box.y1, y2: entry.box.y2 };
      const sep = separation(shifted, box);
      if (sep < MIN_COMPONENT_GAP) {
        dx += box.x2 + MIN_COMPONENT_GAP - shifted.x1;
      }
    }
    if (dx !== 0) {
      entry.comp
        .nodes()
        .toArray()
        .forEach((n) => {
          n.position({ x: n.position("x") + dx, y: n.position("y") });
        });
    }
    placed.push({ x1: entry.box.x1 + dx, x2: entry.box.x2 + dx, y1: entry.box.y1, y2: entry.box.y2 });
  }
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

  // Topology (which nodes/edges exist) vs. style (highlighted, inPath,
  // any other per-element data used only for a selector match) are
  // deliberately different things. react-cytoscapejs's own diffing
  // (patchElement in its source) already syncs `data` changes straight
  // into cytoscape without touching `position` -- so a style-only update
  // (path-reveal ticking `highlighted` on, a selection, a hover) was
  // never the thing moving nodes around. It was this effect: it used to
  // depend on the raw `elements` array/object identity, which changes on
  // *every* render that touches nodes/edges regardless of what actually
  // changed about them, and re-ran the full layout every time. During a
  // path reveal specifically, that meant a fresh `cy.layout().run()` on
  // every ~450ms reveal tick. Keying this off a plain string signature of
  // which node/edge ids exist -- not the full element objects -- makes
  // the effect blind to everything except genuine topology changes.
  const topologyKey = useMemo(() => {
    const nodeIds: string[] = [];
    const edgeIds: string[] = [];
    for (const el of elements) {
      const data = el.data as { id?: string; source?: string; target?: string };
      if (data.source !== undefined && data.target !== undefined) {
        edgeIds.push(String(data.id));
      } else if (data.id !== undefined) {
        nodeIds.push(String(data.id));
      }
    }
    nodeIds.sort();
    edgeIds.sort();
    return `${nodeIds.join(",")}|${edgeIds.join(",")}`;
  }, [elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.elements().length === 0) return;

    // Cytoscape gives a node with no explicit position a default of
    // (0, 0) -- that's every node that just arrived in this batch (a
    // whole book's neighborhood landing in one state update). Everything
    // that already has a real position was already laid out on a
    // previous run and gets pinned in place via fixedNodeConstraint
    // below instead of being re-solved -- so two previously-separated,
    // disconnected clusters never get thrown back together, and an
    // update as small as expanding one node can't reshuffle the rest of
    // the canvas.
    // .toArray() + plain Array methods rather than Collection#filter/map
    // -- cytoscape's own typings widen a filtered NodeCollection back to
    // a generic (node-or-edge) SingularElementArgument[], which loses the
    // .position() method.
    const isUnplaced = (n: cytoscape.NodeSingular) => n.position("x") === 0 && n.position("y") === 0;
    const allNodes = cy.nodes().toArray();
    const existingNodes = allNodes.filter((n) => !isUnplaced(n));
    const newNodeIds = new Set(allNodes.filter(isUnplaced).map((n) => n.id()));

    const fixedNodeConstraint = existingNodes.map((n) => ({
      nodeId: n.id(),
      position: { x: n.position("x"), y: n.position("y") },
    }));

    cy.layout(layoutOptions(layoutName, fixedNodeConstraint)).run();

    // Runs after fCoSE (not as part of it) because it needs the *final*
    // component boxes fCoSE settled on, including wrapped label extents.
    // See MIN_COMPONENT_GAP above for why this exists instead of relying
    // on fCoSE's own packComponents.
    separateNewComponents(cy, newNodeIds);

    // The one and only fit for this topology change -- after layout AND
    // separation, so a newly separated component doesn't get clipped
    // back out of frame. Nothing else in this file calls fit(): not the
    // layout options (fit: false above), not the style-only path below,
    // and not on every render -- only here, only on an actual topology
    // change.
    cy.fit(cy.elements(), 56);
  }, [topologyKey, layoutName]);

  return (
    <CytoscapeComponent
      elements={elements}
      style={{ width: "100%", height: "100%" }}
      stylesheet={stylesheet}
      // "preset" -- do nothing on mount; the effect above runs the real
      // layout immediately after, and stays the single source of truth
      // for positioning on every subsequent *topology* change. Style-only
      // updates (highlighting, dimming, selection) flow straight through
      // react-cytoscapejs's own data-only diffing instead, without ever
      // touching this component's effect.
      layout={{ name: "preset" } as never}
      cy={(cy) => {
        if (cyRef.current === cy) return;
        cyRef.current = cy;
        cy.minZoom(MIN_ZOOM);
        cy.removeAllListeners();
        cy.on("tap", "node", (evt) => {
          onNodeClick(Number(evt.target.id()));
        });
      }}
    />
  );
}
