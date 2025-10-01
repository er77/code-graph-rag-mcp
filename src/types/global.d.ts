import type Database from "better-sqlite3";

declare global {
  var testDb: Database.Database | undefined;
}

export {};