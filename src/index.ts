import { exec } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, mkdir } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import { join, normalize, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
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

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "index",
        description: "Index the codebase",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        },
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
