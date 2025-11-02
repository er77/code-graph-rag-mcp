/**
 * Utilities for ingesting Lerna project graph output into the SQLite-backed graph storage.
 */

import { createHash } from "node:crypto";
import type { GraphStorageImpl } from "../storage/graph-storage.js";
import { type Entity, EntityType, type Relationship, RelationType } from "../types/storage.js";
import type { LernaGraphJSON } from "./lerna-project-graph.js";

export const LERNA_PACKAGE_FILE_PREFIX = "lerna://package/";

type EntityMap = Map<string, Entity>;

function createPackageEntity(name: string, dependencies: string[], timestamp: number): Entity {
  const filePath = `${LERNA_PACKAGE_FILE_PREFIX}${name}`;
  const hash = createHash("sha256")
    .update(`${name}:${dependencies.sort().join(",")}`)
    .digest("hex");

  return {
    id: "",
    name,
    type: EntityType.PACKAGE,
    filePath,
    location: {
      start: { line: 0, column: 0, index: 0 },
      end: { line: 0, column: 0, index: 0 },
    },
    metadata: {
      source: "lerna",
      signature: "lerna-package",
      language: "workspace",
      dependencies,
    },
    hash,
    createdAt: timestamp,
    updatedAt: timestamp,
    complexityScore: 1,
    language: "workspace",
    sizeBytes: 0,
  };
}

function mapEntitiesByName(entities: Entity[]): EntityMap {
  const map: EntityMap = new Map();
  for (const entity of entities) {
    if (!entity.filePath.startsWith(LERNA_PACKAGE_FILE_PREFIX)) continue;
    const name = entity.filePath.slice(LERNA_PACKAGE_FILE_PREFIX.length);
    map.set(name, entity);
  }
  return map;
}

async function fetchExistingPackageEntities(storage: GraphStorageImpl, limit = 1000): Promise<Entity[]> {
  const existing = await storage.executeQuery({
    type: "entity",
    filters: { entityType: EntityType.PACKAGE },
    limit,
  });
  return existing.entities.filter((entity) => entity.filePath.startsWith(LERNA_PACKAGE_FILE_PREFIX));
}

async function removeStalePackageEntity(storage: GraphStorageImpl, entity: Entity): Promise<void> {
  const relationships = await storage.getRelationshipsForEntity(entity.id);
  for (const rel of relationships) {
    await storage.deleteRelationship(rel.id);
  }
  await storage.deleteEntity(entity.id);
}

function buildRelationships(graph: LernaGraphJSON, entityMap: EntityMap, timestamp: number): Relationship[] {
  const relationships: Relationship[] = [];

  for (const [sourceName, deps] of Object.entries(graph)) {
    const sourceEntity = entityMap.get(sourceName);
    if (!sourceEntity) continue;

    for (const dep of deps) {
      const targetEntity = entityMap.get(dep);
      if (!targetEntity) continue;

      relationships.push({
        id: "",
        fromId: sourceEntity.id,
        toId: targetEntity.id,
        type: RelationType.DEPENDS_ON,
        metadata: {
          context: "lerna_dependency",
          createdAt: timestamp,
        },
        createdAt: timestamp,
      });
    }
  }

  return relationships;
}

export interface LernaIngestSummary {
  packageCount: number;
  relationshipCount: number;
  skippedPackages: number;
  removedPackages: number;
}

/**
 * Ingest a Lerna project graph into the existing graph storage.
 * The function does not remove existing entries; it upserts package entities and dependency relationships.
 */
export async function ingestLernaGraph(storage: GraphStorageImpl, graph: LernaGraphJSON): Promise<LernaIngestSummary> {
  const packageNames = Object.keys(graph);
  if (!packageNames.length) {
    return { packageCount: 0, relationshipCount: 0, skippedPackages: 0, removedPackages: 0 };
  }

  const timestamp = Date.now();

  const existingPackages = await fetchExistingPackageEntities(storage);
  const existingMap = mapEntitiesByName(existingPackages);
  const desiredPackages = new Set(packageNames);
  let removedPackages = 0;

  for (const [name, entity] of existingMap.entries()) {
    if (!desiredPackages.has(name)) {
      await removeStalePackageEntity(storage, entity);
      removedPackages++;
    }
  }

  const entities = packageNames
    .sort((a, b) => a.localeCompare(b))
    .map((name) => createPackageEntity(name, graph[name] ?? [], timestamp));

  await storage.insertEntities(entities);

  const filePaths = entities.map((entity) => entity.filePath);
  const queryResult = await storage.executeQuery({
    type: "entity",
    filters: { filePath: filePaths },
    limit: Math.max(filePaths.length, 100),
  });

  const entityMap = mapEntitiesByName(queryResult.entities);
  const skippedPackages = packageNames.length - entityMap.size;

  const relationships = buildRelationships(graph, entityMap, timestamp);
  if (relationships.length > 0) {
    await storage.insertRelationships(relationships);
  }

  return {
    packageCount: entityMap.size,
    relationshipCount: relationships.length,
    skippedPackages,
    removedPackages,
  };
}
