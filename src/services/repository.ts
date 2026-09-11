import type { Project, BlueprintVersion, Comment } from '../types';
import { getSatelliteTextureUrl } from '../engine/gisProjection';

const STORAGE_PROJECTS_KEY = 'b23d_projects_v2';
const STORAGE_VERSIONS_KEY = 'b23d_versions_v2';
const STORAGE_COMMENTS_KEY = 'b23d_comments_v2';

const NAGPUR_BBOX = {
  west: 79.083,
  south: 21.144,
  east: 79.098,
  north: 21.155,
};

const MUMBAI_BBOX = {
  west: 72.818,
  south: 18.922,
  east: 72.833,
  north: 18.935,
};

// Pre-seeded realistic demo data
const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'proj_bridge_interchange',
    name: 'Ram Jhula Viaduct & Kingsway Corridor',
    type: 'bridge',
    location: 'Nagpur, Maharashtra, India',
    created_by: 'lead_engineer_01',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date().toISOString(),
    description: 'Elevated cable-stayed viaduct, dual carriageway highway corridor, and metro transit approach.',
  },
  {
    id: 'proj_metropolitan_plaza',
    name: 'Mumbai Coastal Road & Commercial Plaza',
    type: 'site',
    location: 'Marine Drive, Mumbai, India',
    created_by: 'lead_engineer_01',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date().toISOString(),
    description: 'Arterial coastal reclamation expressway, commercial towers, and pedestrian link bridges.',
  }
];

const DEFAULT_VERSIONS: BlueprintVersion[] = [
  {
    id: 'ver_bridge_01',
    project_id: 'proj_bridge_interchange',
    version_no: 1,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    created_by: 'lead_engineer_01',
    notes: 'Initial alignment layout with 25m pier spacing and highway approach.',
    bbox: NAGPUR_BBOX,
    satelliteUrl: getSatelliteTextureUrl(NAGPUR_BBOX),
    elements: [
      {
        id: 'elem_approach_road',
        type: 'road',
        name: 'West Approach Highway',
        points: [
          { x: -160, y: -40 },
          { x: -90, y: -20 },
          { x: -30, y: 0 }
        ],
        width: 14,
        elevation: 0,
        material_label: 'asphalt',
        metadata: { lanes: 4 }
      },
      {
        id: 'elem_viaduct_deck',
        type: 'bridge_deck',
        name: 'Main Elevated Viaduct',
        points: [
          { x: -30, y: 0 },
          { x: 50, y: 0 },
          { x: 130, y: 30 },
          { x: 210, y: 80 }
        ],
        width: 14,
        elevation: 12,
        pier_spacing: 30,
        material_label: 'reinforced_concrete',
        metadata: { lanes: 4, hasSidewalk: true }
      },
      {
        id: 'elem_toll_building',
        type: 'building',
        name: 'Operations & Maintenance Facility',
        points: [
          { x: -120, y: 30 },
          { x: -80, y: 30 },
          { x: -80, y: 65 },
          { x: -120, y: 65 }
        ],
        height: 14,
        elevation: 0,
        material_label: 'steel_composite',
        metadata: { color: '#3b82f6' }
      },
      {
        id: 'elem_security_boundary',
        type: 'boundary',
        name: 'ROW Property Boundary',
        points: [
          { x: -180, y: -90 },
          { x: 230, y: -40 },
          { x: 230, y: 130 },
          { x: -180, y: 130 }
        ],
        elevation: 0,
        material_label: 'fence_boundary'
      }
    ]
  },
  {
    id: 'ver_bridge_02',
    project_id: 'proj_bridge_interchange',
    version_no: 2,
    created_at: new Date().toISOString(),
    created_by: 'lead_engineer_01',
    notes: 'Revision 2: Refined curvature and added East approach interchange.',
    bbox: NAGPUR_BBOX,
    satelliteUrl: getSatelliteTextureUrl(NAGPUR_BBOX),
    elements: [
      {
        id: 'elem_approach_road',
        type: 'road',
        name: 'West Approach Highway',
        points: [
          { x: -160, y: -40 },
          { x: -90, y: -20 },
          { x: -30, y: 0 }
        ],
        width: 14,
        elevation: 0,
        material_label: 'asphalt',
        metadata: { lanes: 4 }
      },
      {
        id: 'elem_viaduct_deck',
        type: 'bridge_deck',
        name: 'Main Elevated Viaduct',
        points: [
          { x: -30, y: 0 },
          { x: 50, y: 0 },
          { x: 130, y: 30 },
          { x: 210, y: 80 }
        ],
        width: 14,
        elevation: 12,
        pier_spacing: 30,
        material_label: 'reinforced_concrete',
        metadata: { lanes: 4, hasSidewalk: true }
      },
      {
        id: 'elem_east_exit_ramp',
        type: 'road',
        name: 'East Exit Ramp',
        points: [
          { x: 210, y: 80 },
          { x: 260, y: 110 },
          { x: 300, y: 120 }
        ],
        width: 8,
        elevation: 0,
        material_label: 'asphalt',
        metadata: { lanes: 1 }
      },
      {
        id: 'elem_toll_building',
        type: 'building',
        name: 'Operations & Maintenance Facility',
        points: [
          { x: -120, y: 30 },
          { x: -80, y: 30 },
          { x: -80, y: 65 },
          { x: -120, y: 65 }
        ],
        height: 18,
        elevation: 0,
        material_label: 'steel_composite',
        metadata: { color: '#3b82f6' }
      },
      {
        id: 'elem_substation_building',
        type: 'building',
        name: 'Power Substation Enclosure',
        points: [
          { x: -60, y: 40 },
          { x: -35, y: 40 },
          { x: -35, y: 60 },
          { x: -60, y: 60 }
        ],
        height: 6,
        elevation: 0,
        material_label: 'masonry',
        metadata: { color: '#eab308' }
      },
      {
        id: 'elem_security_boundary',
        type: 'boundary',
        name: 'ROW Property Boundary',
        points: [
          { x: -180, y: -90 },
          { x: 320, y: -40 },
          { x: 320, y: 150 },
          { x: -180, y: 150 }
        ],
        elevation: 0,
        material_label: 'fence_boundary'
      }
    ]
  },
  {
    id: 'ver_plaza_01',
    project_id: 'proj_metropolitan_plaza',
    version_no: 1,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    created_by: 'lead_engineer_01',
    notes: 'Master layout with Commercial Towers A & B, connecting bridge, and boulevard.',
    bbox: MUMBAI_BBOX,
    satelliteUrl: getSatelliteTextureUrl(MUMBAI_BBOX),
    elements: [
      {
        id: 'elem_site_perimeter',
        type: 'boundary',
        name: 'Site Parcel Boundary',
        points: [
          { x: -120, y: -100 },
          { x: 140, y: -100 },
          { x: 140, y: 110 },
          { x: -120, y: 110 }
        ],
        elevation: 0,
        material_label: 'parcel_boundary'
      },
      {
        id: 'elem_tower_a',
        type: 'building',
        name: 'Tower A (Commercial High-Rise)',
        points: [
          { x: -80, y: -60 },
          { x: -20, y: -60 },
          { x: -20, y: 10 },
          { x: -80, y: 10 }
        ],
        height: 52,
        elevation: 0,
        material_label: 'glass_curtain_wall',
        metadata: { color: '#0284c7' }
      },
      {
        id: 'elem_tower_b',
        type: 'building',
        name: 'Tower B (Mid-Rise Suites)',
        points: [
          { x: 40, y: -60 },
          { x: 100, y: -60 },
          { x: 100, y: 10 },
          { x: 40, y: 10 }
        ],
        height: 32,
        elevation: 0,
        material_label: 'precast_concrete',
        metadata: { color: '#475569' }
      },
      {
        id: 'elem_skybridge',
        type: 'bridge_deck',
        name: 'Elevated Atrium Skybridge',
        points: [
          { x: -20, y: -25 },
          { x: 40, y: -25 }
        ],
        width: 6,
        elevation: 18,
        pier_spacing: 15,
        material_label: 'steel_truss_glass',
        metadata: { lanes: 1 }
      },
      {
        id: 'elem_access_road',
        type: 'road',
        name: 'Main Access Boulevard',
        points: [
          { x: -110, y: 60 },
          { x: 130, y: 60 }
        ],
        width: 12,
        elevation: 0,
        material_label: 'asphalt',
        metadata: { lanes: 2 }
      }
    ]
  }
];

const DEFAULT_COMMENTS: Comment[] = [
  {
    id: 'comm_01',
    project_id: 'proj_bridge_interchange',
    blueprint_version_id: 'ver_bridge_02',
    position: { x: 50, y: 12, z: 0 },
    text: 'Client request: Please verify barge vertical clearance under the central 50m span at high water level.',
    author_name: 'Department of Transportation Reviewer',
    created_by: 'client_session_dot',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: 'open'
  },
  {
    id: 'comm_02',
    project_id: 'proj_bridge_interchange',
    blueprint_version_id: 'ver_bridge_02',
    position: { x: -100, y: 18, z: -47.5 },
    text: 'Approved: Substation enclosure location is outside the 100-year flood line.',
    author_name: 'Environmental Engineer',
    created_by: 'client_session_env',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'resolved'
  }
];

class Repository {
  private getStorage<T>(key: string, fallback: T[]): T[] {
    try {
      const data = localStorage.getItem(key);
      if (!data) {
        localStorage.setItem(key, JSON.stringify(fallback));
        return fallback;
      }
      return JSON.parse(data) as T[];
    } catch {
      return fallback;
    }
  }

  private setStorage<T>(key: string, items: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.warn('Storage quota exceeded or unavailable', e);
    }
  }

  public getProjects(): Project[] {
    return this.getStorage<Project>(STORAGE_PROJECTS_KEY, DEFAULT_PROJECTS);
  }

  public getProject(id: string): Project | undefined {
    return this.getProjects().find(p => p.id === id);
  }

  public saveProject(project: Project): void {
    const projects = this.getProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = { ...project, updated_at: new Date().toISOString() };
    } else {
      projects.push(project);
    }
    this.setStorage(STORAGE_PROJECTS_KEY, projects);
  }

  public getVersions(projectId: string): BlueprintVersion[] {
    const versions = this.getStorage<BlueprintVersion>(STORAGE_VERSIONS_KEY, DEFAULT_VERSIONS);
    return versions
      .map(v => {
        const def = DEFAULT_VERSIONS.find(d => d.id === v.id);
        if (def && !v.satelliteUrl && def.satelliteUrl) {
          return { ...v, bbox: def.bbox, satelliteUrl: def.satelliteUrl };
        }
        return v;
      })
      .filter(v => v.project_id === projectId)
      .sort((a, b) => a.version_no - b.version_no);
  }

  public getVersion(versionId: string): BlueprintVersion | undefined {
    const versions = this.getStorage<BlueprintVersion>(STORAGE_VERSIONS_KEY, DEFAULT_VERSIONS);
    const v = versions.find(v => v.id === versionId);
    if (!v) return undefined;
    const def = DEFAULT_VERSIONS.find(d => d.id === v.id);
    if (def && !v.satelliteUrl && def.satelliteUrl) {
      return { ...v, bbox: def.bbox, satelliteUrl: def.satelliteUrl };
    }
    return v;
  }

  public saveVersion(version: BlueprintVersion): void {
    const versions = this.getStorage<BlueprintVersion>(STORAGE_VERSIONS_KEY, DEFAULT_VERSIONS);
    const idx = versions.findIndex(v => v.id === version.id);
    if (idx >= 0) {
      versions[idx] = version;
    } else {
      versions.push(version);
    }
    this.setStorage(STORAGE_VERSIONS_KEY, versions);
  }

  public getComments(projectId: string, versionId?: string): Comment[] {
    const comments = this.getStorage<Comment>(STORAGE_COMMENTS_KEY, DEFAULT_COMMENTS);
    return comments.filter(c => c.project_id === projectId && (!versionId || c.blueprint_version_id === versionId));
  }

  public addComment(comment: Comment): void {
    const comments = this.getStorage<Comment>(STORAGE_COMMENTS_KEY, DEFAULT_COMMENTS);
    comments.push(comment);
    this.setStorage(STORAGE_COMMENTS_KEY, comments);
  }

  public updateCommentStatus(commentId: string, status: 'open' | 'resolved'): void {
    const comments = this.getStorage<Comment>(STORAGE_COMMENTS_KEY, DEFAULT_COMMENTS);
    const target = comments.find(c => c.id === commentId);
    if (target) {
      target.status = status;
      this.setStorage(STORAGE_COMMENTS_KEY, comments);
    }
  }
}

export const repository = new Repository();
