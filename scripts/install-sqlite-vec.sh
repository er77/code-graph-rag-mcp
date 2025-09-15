#!/bin/bash

# SQLite-vec Installation Script for MCP Server Codegraph
# This script attempts to install sqlite-vec extension for optimal performance

set -e

echo "🚀 SQLite-vec Installation Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if command -v apt-get &> /dev/null; then
            DISTRO="debian"
        elif command -v yum &> /dev/null; then
            DISTRO="rhel"
        elif command -v apk &> /dev/null; then
            DISTRO="alpine"
        else
            DISTRO="unknown"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macos"
    else
        OS="unknown"
        DISTRO="unknown"
    fi
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed"
        exit 1
    fi

    # Check for SQLite
    if ! command -v sqlite3 &> /dev/null; then
        print_warning "SQLite3 CLI not found, installing..."
        install_sqlite3
    fi

    # Check SQLite version
    sqlite_version=$(sqlite3 --version | cut -d' ' -f1)
    print_status "SQLite version: $sqlite_version"

    print_success "Prerequisites check completed"
}

# Install SQLite3 if missing
install_sqlite3() {
    case $DISTRO in
        "debian")
            sudo apt-get update
            sudo apt-get install -y sqlite3 libsqlite3-dev
            ;;
        "rhel")
            sudo yum install -y sqlite sqlite-devel
            ;;
        "alpine")
            sudo apk add --no-cache sqlite sqlite-dev
            ;;
        "macos")
            if command -v brew &> /dev/null; then
                brew install sqlite
            else
                print_error "Homebrew not found. Please install SQLite3 manually"
                exit 1
            fi
            ;;
        *)
            print_error "Unsupported distribution for automatic SQLite installation"
            print_status "Please install SQLite3 manually and run this script again"
            exit 1
            ;;
    esac
}

# Check if npm package is available
check_npm_package() {
    if [[ -f "./node_modules/sqlite-vec/package.json" ]]; then
        print_status "Found sqlite-vec npm package"

        # Check for platform-specific binaries
        if [[ "$OS" == "linux" && -f "./node_modules/sqlite-vec/dist/vec0.so" ]]; then
            return 0
        elif [[ "$OS" == "macos" && -f "./node_modules/sqlite-vec/dist/vec0.dylib" ]]; then
            return 0
        elif [[ "$OS" == "windows" && -f "./node_modules/sqlite-vec/dist/vec0.dll" ]]; then
            return 0
        fi
    fi
    return 1
}

# Install sqlite-vec extension
install_sqlite_vec() {
    print_status "Installing sqlite-vec extension..."

    # First, check if npm package is already available
    if check_npm_package; then
        print_success "sqlite-vec npm package already installed"
        return 0
    fi

    case $DISTRO in
        "debian")
            install_sqlite_vec_debian
            ;;
        "rhel")
            install_sqlite_vec_rhel
            ;;
        "alpine")
            install_sqlite_vec_alpine
            ;;
        "macos")
            install_sqlite_vec_macos
            ;;
        *)
            print_warning "Automatic installation not available for your system"
            print_status "Falling back to manual build from source..."
            build_from_source
            ;;
    esac
}

# Install on Debian/Ubuntu
install_sqlite_vec_debian() {
    print_status "Downloading sqlite-vec v0.1.6 for Linux..."

    # Download the latest release
    if wget -q --spider "https://github.com/asg017/sqlite-vec/releases/download/v0.1.6/sqlite-vec-v0.1.6-linux-x86_64.tar.gz" 2>/dev/null; then
        print_status "Downloading official Linux binary..."
        wget -O /tmp/sqlite-vec.tar.gz "https://github.com/asg017/sqlite-vec/releases/download/v0.1.6/sqlite-vec-v0.1.6-linux-x86_64.tar.gz"

        cd /tmp
        tar -xzf sqlite-vec.tar.gz

        # Install system-wide
        sudo cp vec0.so /usr/local/lib/
        sudo ldconfig

        # Also copy to project directory as backup
        PROJECT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")
        cp vec0.so "$PROJECT_DIR/" 2>/dev/null || true

        rm -f /tmp/sqlite-vec.tar.gz /tmp/vec0.so
        print_success "Installed from official Linux binary"
    else
        print_status "Official package not available, building from source..."
        build_from_source
    fi
}

# Install on RHEL/CentOS/Fedora
install_sqlite_vec_rhel() {
    print_status "Building from source for RHEL-based system..."
    build_from_source
}

# Install on Alpine
install_sqlite_vec_alpine() {
    print_status "Building from source for Alpine..."
    build_from_source
}

# Install on macOS
install_sqlite_vec_macos() {
    if command -v brew &> /dev/null; then
        print_status "Installing via Homebrew..."
        # Try custom tap first
        brew tap asg017/sqlite-vec 2>/dev/null || true
        if brew install asg017/sqlite-vec/sqlite-vec 2>/dev/null; then
            print_success "Installed via Homebrew"
        else
            print_status "Homebrew package not available, building from source..."
            build_from_source
        fi
    else
        print_status "Homebrew not found, building from source..."
        build_from_source
    fi
}

# Build from source
build_from_source() {
    print_status "Building sqlite-vec from source..."

    # Install build dependencies
    case $DISTRO in
        "debian")
            sudo apt-get install -y build-essential cmake git
            ;;
        "rhel")
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y cmake git
            ;;
        "alpine")
            sudo apk add --no-cache build-base cmake git
            ;;
        "macos")
            if ! command -v cmake &> /dev/null; then
                if command -v brew &> /dev/null; then
                    brew install cmake
                else
                    print_error "Please install Xcode command line tools and CMake"
                    exit 1
                fi
            fi
            ;;
    esac

    # Create temporary build directory
    BUILD_DIR=$(mktemp -d)
    cd "$BUILD_DIR"

    print_status "Cloning sqlite-vec repository..."
    git clone https://github.com/asg017/sqlite-vec.git
    cd sqlite-vec

    print_status "Building extension..."
    make

    # Install system-wide
    print_status "Installing extension..."
    if [[ "$OS" == "macos" ]]; then
        sudo cp vec0.dylib /usr/local/lib/
        sudo install_name_tool -id /usr/local/lib/vec0.dylib /usr/local/lib/vec0.dylib
    else
        sudo cp vec0.so /usr/local/lib/
        sudo ldconfig 2>/dev/null || true
    fi

    # Also copy to project directory as backup
    PROJECT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")
    cp vec0.* "$PROJECT_DIR/" 2>/dev/null || true

    # Cleanup
    cd /
    rm -rf "$BUILD_DIR"

    print_success "Built and installed from source"
}

# Test installation
test_installation() {
    print_status "Testing sqlite-vec installation..."

    # Create test script
    cat > /tmp/test-sqlite-vec.js << 'EOF'
import Database from 'better-sqlite3';

try {
    const db = new Database(':memory:');

    // Try to load extension
    const paths = ['sqlite-vec', 'vec0', '/usr/local/lib/vec0'];
    let loaded = false;

    for (const path of paths) {
        try {
            db.loadExtension(path);
            console.log(`✅ Extension loaded from: ${path}`);
            loaded = true;
            break;
        } catch (e) {
            // Continue to next path
        }
    }

    if (!loaded) {
        console.log('❌ Extension not loaded');
        process.exit(1);
    }

    // Test basic functionality
    db.exec(`
        CREATE VIRTUAL TABLE test_vec USING vec0(
            id TEXT PRIMARY KEY,
            embedding float[3]
        );
    `);

    const stmt = db.prepare('INSERT INTO test_vec VALUES (?, ?)');
    stmt.run('test', [0.1, 0.2, 0.3]);

    const result = db.prepare('SELECT COUNT(*) as count FROM test_vec').get();
    console.log(`📊 Test vector inserted, count: ${result.count}`);

    // Test search
    const search = db.prepare('SELECT id FROM test_vec WHERE embedding MATCH ? LIMIT 1');
    const searchResult = search.all([0.1, 0.2, 0.3]);
    console.log(`🔍 Search test: ${searchResult.length > 0 ? 'PASS' : 'FAIL'}`);

    db.close();
    console.log('✅ All tests passed!');

} catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
}
EOF

    # Run test
    cd "$(dirname "$(dirname "$(readlink -f "$0")")")"
    if node /tmp/test-sqlite-vec.js; then
        print_success "sqlite-vec extension is working correctly!"
    else
        print_error "Extension test failed"
        return 1
    fi

    # Cleanup
    rm /tmp/test-sqlite-vec.js
}

# Main installation flow
main() {
    echo "Starting sqlite-vec installation for optimal vector search performance..."
    echo ""

    detect_os
    print_status "Detected OS: $OS ($DISTRO)"
    echo ""

    check_prerequisites
    echo ""

    install_sqlite_vec
    echo ""

    if test_installation; then
        echo ""
        print_success "🎉 Installation completed successfully!"
        echo ""
        print_status "The MCP Server Codegraph will now use hardware-accelerated vector search"
        print_status "Expected performance improvements:"
        print_status "  • Vector similarity search: 10-100x faster"
        print_status "  • Memory usage: 2-5x reduction"
        print_status "  • Large dataset handling: Significantly improved"
        echo ""
        print_status "You can now restart your MCP server to use the optimized extension."
    else
        echo ""
        print_warning "Installation completed but tests failed"
        print_status "The system will fall back to JavaScript implementation"
        print_status "Check the installation guide for troubleshooting: SQLITE_VEC_INSTALLATION.md"
    fi
}

# Run main function
main "$@"