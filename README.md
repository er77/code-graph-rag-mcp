# mcp-server-codegraph

A [Model Context Protocol](https://github.com/modelcontextprotocol) server that provides tools to generate and query a graph representation in your codebase.


## Features
- 📊 Creates a graph representation of your codebase
- 🔍 Identifies entities (functions, classes, imports) and their relationships
- 🔗 Tracks relationships like function calls, inheritance, and implementations
- 🌐 Supports multiple programming languages (Python, JavaScript, Rust)

## Tools

- **index**
    - Indexes the codebase to create a graph of entities and relationships.
- **list_file_entities**
    - Provides a list of all entities within a specified file.
        - `path` (string): relative path of the file
- **list_entity_relationships**
    - List the relationships of a specific entity
    - Inputs
        - `path` (string): relative path of the file
        - `name` (string): name of entity

## Usage

```sh
npx @cartographai/mcp-server-codegraph /path/to/directory
```

### Claude Desktop

Add this to your `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "npx",
      "args": [
        "-y",
        "@cartographai/mcp-server-codegraph",
        "/path/to/directory",
      ]
    }
  }
}
```
