#!/bin/bash
###############################################################################
# MCP Server Restart Script
#
# Restarts the Code Graph RAG MCP server by finding and killing existing
# processes, then provides instructions for restarting in Claude Desktop.
#
# Usage:
#   ./scripts/restart-mcp-server.sh
#   ./scripts/restart-mcp-server.sh --force    # Kill without confirmation
#   ./scripts/restart-mcp-server.sh --help     # Show help
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
FORCE_MODE=false
PACKAGE_NAME="@er77/code-graph-rag-mcp"
PROCESS_PATTERN="code-graph-rag-mcp"

###############################################################################
# Functions
###############################################################################

show_help() {
    cat << EOF
${GREEN}MCP Server Restart Script${NC}

Restarts the Code Graph RAG MCP server by killing existing processes.

${YELLOW}Usage:${NC}
  $0 [OPTIONS]

${YELLOW}Options:${NC}
  --force     Kill processes without confirmation
  --help      Show this help message

${YELLOW}Examples:${NC}
  $0                  # Interactive mode (asks for confirmation)
  $0 --force          # Force restart without confirmation

${YELLOW}What this script does:${NC}
  1. Finds all running code-graph-rag-mcp processes
  2. Displays process information (PID, command)
  3. Kills the processes (after confirmation unless --force)
  4. Provides instructions for restarting in Claude Desktop

${YELLOW}Note:${NC}
  After running this script, you need to restart Claude Desktop
  to reconnect to the MCP server.

EOF
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}  MCP Server Restart Utility${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

find_mcp_processes() {
    # Find processes related to code-graph-rag-mcp
    # Using pgrep with full command line search
    if command -v pgrep &> /dev/null; then
        pgrep -f "$PROCESS_PATTERN" || true
    else
        # Fallback to ps + grep
        ps aux | grep -E "$PROCESS_PATTERN" | grep -v grep | awk '{print $2}' || true
    fi
}

show_process_info() {
    local pids="$1"

    if [ -z "$pids" ]; then
        return
    fi

    echo -e "${YELLOW}Found MCP Server Processes:${NC}"
    echo ""

    for pid in $pids; do
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "  ${GREEN}PID:${NC} $pid"
            echo -e "  ${GREEN}CMD:${NC} $(ps -p $pid -o command= | head -c 100)"
            echo ""
        fi
    done
}

kill_processes() {
    local pids="$1"
    local force="$2"

    if [ -z "$pids" ]; then
        echo -e "${YELLOW}No MCP server processes found.${NC}"
        return 0
    fi

    if [ "$force" != "true" ]; then
        echo -e "${YELLOW}Kill these processes? [y/N]:${NC} "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo -e "${RED}Cancelled.${NC}"
            exit 0
        fi
    fi

    echo -e "${BLUE}Stopping MCP server processes...${NC}"

    for pid in $pids; do
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "  Killing PID $pid..."
            kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
            sleep 0.5

            # Check if process is still running
            if ps -p "$pid" > /dev/null 2>&1; then
                echo -e "  ${RED}✗ Failed to kill PID $pid${NC}"
            else
                echo -e "  ${GREEN}✓ Stopped PID $pid${NC}"
            fi
        fi
    done

    echo ""
}

show_restart_instructions() {
    cat << EOF
${GREEN}✓ MCP Server Stopped${NC}

${YELLOW}Next Steps to Restart:${NC}

${BLUE}Option 1: Restart Claude Desktop${NC}
  1. Quit Claude Desktop completely
  2. Relaunch Claude Desktop
  3. MCP server will auto-start

${BLUE}Option 2: Reload MCP Configuration (if supported)${NC}
  In Claude Desktop:
  1. Open Developer Tools (Cmd+Option+I or Ctrl+Shift+I)
  2. In Console, run: location.reload()

${BLUE}Option 3: Manual Restart${NC}
  Run the server manually:
    npx $PACKAGE_NAME /path/to/your/codebase

${YELLOW}Verify Server Status:${NC}
  After restarting, check that MCP tools are available in Claude:
  - Ask Claude: "What MCP tools are available?"
  - Look for code-graph-rag tools in the response

${YELLOW}Troubleshooting:${NC}
  If server doesn't restart:
  1. Check logs: ~/.config/Claude/logs/
  2. Verify config: ~/.config/Claude/claude_desktop_config.json
  3. Check server manually: npx $PACKAGE_NAME /your/path

EOF
}

###############################################################################
# Main Script
###############################################################################

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force)
                FORCE_MODE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    print_header

    # Find MCP processes
    echo -e "${BLUE}Searching for MCP server processes...${NC}"
    PIDS=$(find_mcp_processes)

    if [ -z "$PIDS" ]; then
        echo -e "${YELLOW}No MCP server processes found.${NC}"
        echo -e "The server may not be running, or already stopped."
        echo ""
        show_restart_instructions
        exit 0
    fi

    # Show process info
    show_process_info "$PIDS"

    # Kill processes
    kill_processes "$PIDS" "$FORCE_MODE"

    # Show restart instructions
    show_restart_instructions
}

# Run main function
main "$@"
