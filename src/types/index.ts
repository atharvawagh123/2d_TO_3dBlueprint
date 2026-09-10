export type ProjectType = 'road' | 'bridge' | 'site' | 'building';

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  location: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  description?: string;
}

export type ElementType = 'road' | 'bridge_deck' | 'boundary' | 'building';

export interface Point2D {
  x: number;
  y: number;
}

export interface ElementMetadata {
  lanes?: number;
  hasSidewalk?: boolean;
  color?: string;
  stroke?: string;
  tags?: string[];
  opacity?: number;
  levels?: number;
  roadType?: string;
  isViaduct?: boolean;
  isBridge?: boolean;
  hwType?: string;
  railway?: string;
  buildingType?: string;
  osmId?: number | string;
}

export interface BlueprintElement {
  id: string;
  type: ElementType;
  points: Point2D[];        // Drawn path or polygon in plan view (1 unit = 1 meter)
  width?: number;           // For roads/bridges (meters)
  height?: number;          // For buildings/walls (meters)
  elevation?: number;       // Base elevation in meters
  pier_spacing?: number;    // For bridges: distance between support piers (meters)
  material_label?: string;  // Free text material label (e.g., 'asphalt', 'reinforced_concrete')
  name?: string;
  metadata?: ElementMetadata;
}

export interface BlueprintVersion {
  id: string;
  project_id: string;
  version_no: number;
  created_at: string;
  created_by: string;
  notes?: string;
  elements: BlueprintElement[];
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Comment {
  id: string;
  project_id: string;
  blueprint_version_id: string;
  position: Vector3D;       // {x, y, z} in 3D world space
  text: string;
  author_name: string;
  created_by: string;
  created_at: string;
  status?: 'open' | 'resolved';
}

export type EditorTool = 'select' | 'road' | 'bridge_deck' | 'boundary' | 'building';

export type SnapMode = 'none' | '1m' | '5m';

export type UserRole = 'engineer' | 'client';
