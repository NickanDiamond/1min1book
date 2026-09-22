// cytoscape-fcose ships no TypeScript types of its own. The layout options
// we pass it (nodeDimensionsIncludeLabels, nodeSeparation, quality,
// fixedNodeConstraint, etc.) aren't part of cytoscape's own LayoutOptions
// type either, so GraphCanvas.tsx already casts its layout config through
// `as never` -- this declaration just lets the import itself typecheck.
declare module "cytoscape-fcose";
