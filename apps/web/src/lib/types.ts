// Mirrors the Java records/DTOs in apps/api -- kept in sync by hand since
// the two apps don't share a schema generator. If a field is added on the
// Spring side, it needs to be added here too.

export type NodeType = "BOOK" | "AUTHOR" | "GENRE" | "TOPIC";

export type RelationshipType =
  | "WRITTEN_BY"
  | "BELONGS_TO_GENRE"
  | "DISCUSSES"
  | "SIMILAR_TO";

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
  weight: number | null;
  explanation: string | null;
}
