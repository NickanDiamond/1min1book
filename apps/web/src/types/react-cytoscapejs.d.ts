// react-cytoscapejs doesn't ship its own TypeScript types (and there's no
// @types package for it), so this is a minimal ambient declaration covering
// only the props this project actually uses. Cytoscape's own types are an
// `export =` namespace, so they're referenced as `cytoscape.X` (a default
// import of the namespace) rather than named imports, which is the only
// form guaranteed to resolve for every member of that namespace.
declare module "react-cytoscapejs" {
  import type { Component, CSSProperties } from "react";
  import type cytoscape from "cytoscape";

  export interface CytoscapeComponentProps {
    elements: cytoscape.ElementDefinition[];
    style?: CSSProperties;
    layout?: cytoscape.LayoutOptions;
    stylesheet?: (cytoscape.StylesheetStyle | cytoscape.StylesheetCSS)[];
    cy?: (cy: cytoscape.Core) => void;
    className?: string;
    minZoom?: number;
    maxZoom?: number;
  }

  export default class CytoscapeComponent extends Component<CytoscapeComponentProps> {}
}
