import { exec } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { chmod, mkdir } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import { join, normalize, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const BINARY_URL = "https://github.com/CartographAI/graph/releases/download/v0.1.0/graph";
const BINARY_PATH = "./bin/graph";

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: mcp-server-codegraph <directory>");
  process.exit(1);
}

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

const directory = normalize(resolve(expandHome(args[0])));

// Function to download the binary
async function downloadBinary() {
  try {
    // Create bin directory if it doesn't exist
    await mkdir("./bin", { recursive: true });

    // Download the binary
    await new Promise<void>((resolve, reject) => {
      https
        .get(BINARY_URL, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectLocation = response.headers.location;

            if (!redirectLocation) {
              reject(new Error("redirect location is missing"));
              return;
            }
            // Handle redirect
            https
              .get(redirectLocation, async (redirectedResponse) => {
                const fileStream = createWriteStream(BINARY_PATH);
                await pipeline(redirectedResponse, fileStream);
                resolve();
              })
              .on("error", reject);
          } else {
            const fileStream = createWriteStream(BINARY_PATH);
            pipeline(response, fileStream).then(resolve).catch(reject);
          }
        })
        .on("error", reject);
    });

    // Make the binary executable
    await chmod(BINARY_PATH, 0o755);
    console.error("Binary downloaded and made executable successfully");
  } catch (error) {
    console.error("Error downloading binary:", error);
    throw error;
  }
}

const server = new Server(
  {
    name: "mcp-server-codegraph",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const ListFileEntitiesArgsSchema = z.object({
  path: z.string().describe("relative path of the file"),
});

const ListEntityRelationshipsArgsSchema = z.object({
  path: z.string().describe("relative path of the file entity appears in"),
  name: z.string().describe("name of entity"),
});

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "index",
        description: "Indexes the codebase to create a graph of entities and relationships.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        },
      },
      {
        name: "list_file_entities",
        description:
          "Provides a list of all entities within a specified file. Returns a list of entities, including their names, types (e.g., Function, Class, Import), and locations (start and end lines). Use this to explore the contents of a file.",
        inputSchema: zodToJsonSchema(ListFileEntitiesArgsSchema) as ToolInput,
      },
      {
        name: "list_entity_relationships",
        description:
          "Lists the relationships (Calls, Inheritance, Implementations) of a specify entity. Returns details about the related entities (source and target) and the type of relationship. Use this to understand how an entity interacts with other parts of the code.",
        inputSchema: zodToJsonSchema(ListEntityRelationshipsArgsSchema) as ToolInput,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "index": {
        const { stdout, stderr } = await new Promise<{
          stdout: string;
          stderr: string;
        }>((resolve, reject) => {
          exec(`${BINARY_PATH} ${directory} ${join(directory, "index.json")}`, (error, stdout, stderr) => {
            if (error) {
              reject({ error, stdout, stderr });
            } else {
              resolve({ stdout, stderr });
            }
          });
        });

        return {
          content: [{ type: "text", text: `stdout: ${stdout}\nstderr: ${stderr}` }],
        };
      }
      case "list_file_entities": {
        const parsedArgs = ListFileEntitiesArgsSchema.safeParse(args);
        if (!parsedArgs.success) {
          throw new Error(`Invalid arguments for list_file_entities: ${parsedArgs.error}`);
        }
        const filename = parsedArgs.data.path;
        const indexPath = join(directory, "index.json");
        const graph = JSON.parse(readFileSync(indexPath, "utf-8"));

        // biome-ignore lint/suspicious/noExplicitAny: types are temporary
        const fileNode = graph.nodes.find((node: any) => node.type === "File" && node.name === filename);

        if (!fileNode) {
          return {
            content: [{ type: "text", text: `File not found: ${filename}` }],
            isError: true,
          };
        }

        // biome-ignore lint/suspicious/noExplicitAny: types are temporary
        const getEntitiesRecursively = (nodeId: string, graph: any) => {
          // biome-ignore lint/suspicious/noExplicitAny: types are temporary
          const node = graph.nodes.find((n: any) => n.id === nodeId);

          if (!node) {
            console.warn(`Node with ID ${nodeId} not found in graph.`);
            return null;
          }

          const entity = {
            name: node.name,
            type: node.type,
            start: node.data.start,
            end: node.data.end,
          };

          return entity;
        };

        const entities = fileNode.data.children
          .map((childId: string) => getEntitiesRecursively(childId, graph))
          // biome-ignore lint/suspicious/noExplicitAny: types are temporary
          .filter((entity: any) => entity.name);

        return {
          content: [{ type: "text", text: JSON.stringify(entities, null, 2) }],
        };
      }
      case "list_entity_relationships": {
        const parsedArgs = ListEntityRelationshipsArgsSchema.safeParse(args);
        if (!parsedArgs.success) {
          throw new Error(`Invalid arguments for list_entity_relationships: ${parsedArgs.error}`);
        }
        const filename = parsedArgs.data.path;
        const entity_name = parsedArgs.data.name;
        const indexPath = join(directory, "index.json");
        const graph = JSON.parse(readFileSync(indexPath, "utf-8"));

        // biome-ignore lint/suspicious/noExplicitAny: types are temporary
        const fileNode = graph.nodes.find((node: any) => node.type === "File" && node.name === filename);

        if (!fileNode) {
          return {
            content: [{ type: "text", text: `File not found: ${filename}` }],
            isError: true,
          };
        }

        // biome-ignore lint/suspicious/noExplicitAny: types are temporary
        const entityNode = graph.nodes.find((node: any) => {
          return node.name === entity_name && node.file_id === fileNode.id;
        });
        if (!entityNode) {
          return {
            content: [
              {
                type: "text",
                text: `Entity not found: ${entity_name}} in ${filename}`,
              },
            ],
            isError: true,
          };
        }

        const relationships = graph.links
          // biome-ignore lint/suspicious/noExplicitAny: types are temporary
          .filter((link: any) => link.source_id === entityNode.id || link.target_id === entityNode.id)
          // biome-ignore lint/suspicious/noExplicitAny: types are temporary
          .map((link: any) => {
            // biome-ignore lint/suspicious/noExplicitAny: types are temporary
            const sourceNode = graph.nodes.find((node: any) => node.id === link.source_id);
            // biome-ignore lint/suspicious/noExplicitAny: types are temporary
            const targetNode = graph.nodes.find((node: any) => node.id === link.target_id);
            // biome-ignore lint/suspicious/noExplicitAny: types are temporary
            const sourceFileNode = graph.nodes.find((node: any) => node.id === sourceNode.file_id);
            // biome-ignore lint/suspicious/noExplicitAny: types are temporary
            const targetFileNode = graph.nodes.find((node: any) => node.id === targetNode.file_id);

            if (!sourceNode || !targetNode) {
              console.warn(`Source or target node not found for link: ${JSON.stringify(link)}`);
              return null;
            }

            return {
              type: link.type,
              source: {
                name: sourceNode.name,
                type: sourceNode.type,
                start: sourceNode.data.start,
                end: sourceNode.data.end,
                file: sourceFileNode.name,
              },
              target: {
                name: targetNode.name,
                type: targetNode.type,
                start: targetNode.data.start,
                end: targetNode.data.end,
                file: targetFileNode.name,
              },
              data: link.data,
            };
          })
          // biome-ignore lint/suspicious/noExplicitAny: types are temporary
          .filter((rel: any) => rel !== null); // Remove null entries;

        return {
          content: [{ type: "text", text: JSON.stringify(relationships, null, 2) }],
        };
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  try {
    await downloadBinary();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server CodeGraph running on stdio");
    console.error("directory:", directory);
  } catch (error) {
    console.error("Error during server setup:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
