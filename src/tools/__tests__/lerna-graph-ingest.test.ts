import { GraphStorageImpl } from "../../storage/graph-storage.js";
import { SQLiteManager } from "../../storage/sqlite-manager.js";
import { EntityType, RelationType } from "../../types/storage.js";
import { ingestLernaGraph, LERNA_PACKAGE_FILE_PREFIX } from "../lerna-graph-ingest.js";

describe("ingestLernaGraph", () => {
  let manager: SQLiteManager;
  let storage: GraphStorageImpl;

  beforeEach(async () => {
    manager = new SQLiteManager({ memory: true });
    manager.initialize();
    storage = new GraphStorageImpl(manager);
    await storage.initialize();
  });

  afterEach(() => {
    manager.close();
  });

  it("ingests packages and dependency relationships", async () => {
    const graph = {
      "pkg-a": ["pkg-b"],
      "pkg-b": ["pkg-c"],
      "pkg-c": [],
    };

    const summary = await ingestLernaGraph(storage, graph);

    expect(summary.packageCount).toBe(3);
    expect(summary.relationshipCount).toBe(2);
    expect(summary.skippedPackages).toBe(0);
    expect(summary.removedPackages).toBe(0);

    const packagePaths = Object.keys(graph).map((name) => `${LERNA_PACKAGE_FILE_PREFIX}${name}`);
    const entityQuery = await storage.executeQuery({
      type: "entity",
      filters: { filePath: packagePaths },
      limit: packagePaths.length + 5,
    });

    expect(entityQuery.entities).toHaveLength(3);
    for (const entity of entityQuery.entities) {
      expect(entity.type).toBe(EntityType.PACKAGE);
      expect(entity.metadata.source).toBe("lerna");
    }

    const relationshipQuery = await storage.executeQuery({
      type: "relationship",
      filters: { relationshipType: RelationType.DEPENDS_ON },
      limit: 10,
    });

    expect(relationshipQuery.relationships).toHaveLength(2);
    expect(
      relationshipQuery.relationships.every((rel) => rel.type === RelationType.DEPENDS_ON && rel.metadata?.context),
    ).toBe(true);
  });
  it("removes stale package entities when packages disappear", async () => {
    const initial = {
      "pkg-old": ["pkg-keep"],
      "pkg-keep": [],
    };
    await ingestLernaGraph(storage, initial);

    const updated = {
      "pkg-keep": [],
    };
    const summary = await ingestLernaGraph(storage, updated);

    expect(summary.packageCount).toBe(1);
    expect(summary.removedPackages).toBe(1);

    const entityQuery = await storage.executeQuery({
      type: "entity",
      filters: { entityType: EntityType.PACKAGE },
      limit: 10,
    });
    expect(entityQuery.entities).toHaveLength(1);
    expect(entityQuery.entities[0]?.name).toBe("pkg-keep");

    const relationshipQuery = await storage.executeQuery({
      type: "relationship",
      filters: { relationshipType: RelationType.DEPENDS_ON },
      limit: 10,
    });
    expect(relationshipQuery.relationships).toHaveLength(0);
  });
});
