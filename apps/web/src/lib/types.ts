// Mirrors the Java records/DTOs in apps/api -- kept in sync by hand since
// the two apps don't share a schema generator. If a field is added on the
// Spring side, it needs to be added here too.

export type NodeType = "BOOK" | "AUTHOR" | "GENRE" | "TOPIC";

export type RelationshipType =
  | "WRITTEN_BY"
  | "BELONGS_TO_GENRE"
  | "DISCUSSES"
  | "SIMILAR_TO";

/**
 * The direction-correct label for one specific relationship as read from
 * one particular side of it -- mirrors model/RelationshipTypes.java.
 * relationshipType identifies the underlying edge and never changes;
 * relationshipLabel is what to actually show the user, and flips to the
 * inverse (e.g. "WROTE" instead of "WRITTEN_BY") when a relationship is
 * being read from its target back to its source. SIMILAR_TO has no
 * inverse -- it's symmetric, so its label always equals its type.
 */
export type RelationshipLabel = RelationshipType | "WROTE" | "DISCUSSED_IN" | "CONTAINS_BOOK";

/** GET /api/search, GET /api/nodes/{id} -- mirrors model/Node.java */
export interface GraphNode {
  id: number;
  type: NodeType;
  name: string;
  externalId: string | null;
}

/** GET /api/nodes/{id}/neighbors -- mirrors service/NeighborView.java */
export interface Neighbor {
  nodeId: number;
  nodeType: NodeType;
  nodeName: string;
  relationshipType: RelationshipType;
  relationshipLabel: RelationshipLabel;
  weight: number;
  explanation: string | null;
}

/**
 * GET /api/graph/path -- mirrors service/PathStepView.java.
 * The first step in any path has null relationshipType/weight/explanation
 * since there's no incoming edge to describe yet.
 */
export interface PathStep {
  nodeId: number;
  nodeType: NodeType | null;
  nodeName: string | null;
  relationshipType: RelationshipType | null;
  relationshipLabel: RelationshipLabel | null;
  weight: number | null;
  explanation: string | null;
}

/** One theme (TOPIC node) a book discusses -- part of BookDetail. */
export interface BookTheme {
  name: string;
  explanation: string | null;
}

/** One other book connected by a SIMILAR_TO edge -- part of BookDetail,
 * already sorted strongest-first and capped server-side. */
export interface RelatedBook {
  nodeId: number;
  title: string;
  weight: number;
}

/** GET /api/books/{id} -- mirrors service/BookDetailView.java. Only
 * fetched for BOOK-type nodes; a GENRE/AUTHOR/TOPIC node has no book row
 * behind it, so this endpoint 404s for those (see DetailsPanel). */
export interface BookDetail {
  nodeId: number;
  title: string;
  summary: string | null;
  authorText: string | null;
  publishedYear: number | null;
  coverUrl: string | null;
  genre: string | null;
  themes: BookTheme[];
  related: RelatedBook[];
}
