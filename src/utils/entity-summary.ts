import type { Entity } from "../types/storage.js";

export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  filePath: string;
  location: Entity["location"];
  metadata: Entity["metadata"];
}

export function mapEntitySummary(entity: Entity): EntitySummary {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    filePath: entity.filePath,
    location: entity.location,
    metadata: entity.metadata,
  };
}
