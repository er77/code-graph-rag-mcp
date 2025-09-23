# SQL Engine Development Guide

## Overview

This guide provides comprehensive instructions for developing new SQL engine implementations in the xldb_proxy system. It covers the complete development lifecycle from initial research to production deployment.

## Prerequisites

### Knowledge Requirements
- Python database connectivity patterns
- SQL query execution and result handling
- Database-specific authentication methods
- Error handling and logging best practices

### Development Environment
- Python 3.8+ with xldb_proxy dependencies
- Access to target database for testing
- Development instance of xldb_proxy
- Test data and schema

## Development Process

### Phase 1: Research and Planning

#### 1.1 Database Analysis
```bash
# Research database characteristics
- Connection methods and drivers
- Authentication options
- SQL dialect and capabilities
- Metadata discovery mechanisms
- Performance considerations
```

#### 1.2 Pattern Selection
Consult `.memory_bank/patterns/sql_engine_architecture.md` to select appropriate pattern:
- Standard SQL Pattern (traditional databases)
- SSL/TLS Enhanced Pattern (secure connections)
- Protocol-Aware Pattern (distributed systems)
- File-Based Pattern (embedded databases)
- NoSQL Adapter Pattern (document stores)

#### 1.3 Driver Evaluation
```python
# Test driver connectivity
import target_database_driver

# Basic connection test
conn = target_database_driver.connect(
    host='localhost',
    user='test',
    password='test',
    database='test'
)
cursor = conn.cursor()
cursor.execute("SELECT 1")
result = cursor.fetchone()
conn.close()
```

### Phase 2: Implementation

#### 2.1 Engine Class Structure
```python
"""
{Database} Engine implementation for xldb_proxy system.

This module provides {Database} connectivity following
the {Pattern} Pattern.

Architecture References:
- SQL Engine Plugin System: sqlengines/README.md
- {Pattern}: .memory_bank/patterns/sql_engine_architecture.md
"""

# =============================================================================
# 1. IMPORTS AND DATABASE DEPENDENCIES
# =============================================================================
from typing import Optional, Dict, Any, List
import logging
from inspect import cleandoc
import {database_driver}
from models.connection import Connection

logger = logging.getLogger(__name__)

# =============================================================================
# 2. DATABASE CONSTANTS AND CONFIGURATION
# =============================================================================
DEFAULT_PORT = {default_port}
DEFAULT_DATABASE = "{default_db}"
DEFAULT_SCHEMA = "{default_schema}"

# =============================================================================
# 3. CORE SQL ENGINE IMPLEMENTATION
# =============================================================================
class EngineConnection{DatabaseName}(Connection):
    names = ["{engine_name}"]

    def open(self):
        """Establish {Database} connection"""
        # Implementation here
        
    def close(self):
        """Clean up {Database} connection resources"""
        # Implementation here
        
    def tables_query(self, is_admin: bool) -> str:
        """Return SQL to list all tables"""
        # Implementation here
        
    def views_query(self, is_admin: bool) -> str:
        """Return SQL to list all views"""
        # Implementation here
        
    def fields_query(self, is_admin: bool, table_name: str, table_type: str) -> str:
        """Return SQL to describe table/view columns"""
        # Implementation here
        
    def check_query(self) -> str:
        """Return SQL for connection verification"""
        # Implementation here
```

#### 2.2 Connection Management
```python
def open(self):
    """Establish database connection with proper error handling"""
    try:
        sql = self.params.sql
        
        # Parse connection parameters
        conn_params = {
            'host': sql.dbms_host,
            'port': sql.dbms_port or DEFAULT_PORT,
            'user': sql.user,
            'password': sql.password,
            'database': sql.database or DEFAULT_DATABASE
        }
        
        # Add authentication-specific parameters
        conn_params = self._setup_authentication(conn_params)
        
        # Establish connection
        self.connection = database_driver.connect(**conn_params)
        self.cursor = self.connection.cursor()
        
        logger.info(f"{DATABASE_NAME} connection established to {sql.dbms_host}")
        
    except database_driver.Error as e:
        logger.error(f"{DATABASE_NAME} connection failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"{DATABASE_NAME} connection failed: {str(e)}"
        )
```

#### 2.3 Metadata Queries
```python
def tables_query(self, is_admin: bool) -> str:
    """Return SQL to list all tables in current database"""
    return cleandoc(f"""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = '{self._get_schema()}'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)

def fields_query(self, is_admin: bool, table_name: str, table_type: str) -> str:
    """Return SQL to describe table/view columns"""
    return cleandoc(f"""
        SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            ordinal_position
        FROM information_schema.columns
        WHERE table_schema = '{self._get_schema()}'
        AND table_name = '{table_name}'
        ORDER BY ordinal_position
    """)
```

#### 2.4 Authentication Handling
```python
def _setup_authentication(self, conn_params):
    """Setup database-specific authentication"""
    sql = self.params.sql
    
    # Basic authentication
    if sql.user and sql.password:
        conn_params.update({
            'user': sql.user,
            'password': sql.password
        })
    
    # SSL/TLS configuration
    if getattr(sql, 'ssl_enabled', False):
        conn_params['ssl'] = True
        if hasattr(sql, 'ssl_cert'):
            conn_params['ssl_cert'] = sql.ssl_cert
    
    # Additional authentication methods
    # (Kerberos, LDAP, certificates, etc.)
    
    return conn_params
```

### Phase 3: Testing

#### 3.1 Unit Tests
```python
# tests/test_{database_name}.py
import pytest
from models.connection import Connection
from tests.conftest import create_test_params

def test_{database_name}_connection():
    """Test basic connection functionality"""
    params = create_test_params("{engine_name}")
    engine = Connection.engine_connection(params)
    
    engine.open()
    assert engine.connection is not None
    assert engine.cursor is not None
    
    # Test connection check
    result = engine.exec(engine.check_query())
    assert len(result) >= 1
    
    engine.close()

def test_{database_name}_metadata():
    """Test metadata discovery"""
    engine = create_test_engine("{engine_name}")
    engine.open()
    
    # Test tables query
    tables_sql = engine.tables_query(is_admin=True)
    assert "table_name" in tables_sql.lower()
    
    # Test fields query
    fields_sql = engine.fields_query(True, "test_table", "table")
    assert "column_name" in fields_sql.lower()
    
    engine.close()

@pytest.mark.integration
def test_{database_name}_query_execution():
    """Test actual query execution"""
    engine = create_test_engine("{engine_name}")
    engine.open()
    
    # Execute test query
    result = engine.exec("SELECT COUNT(*) FROM test_table")
    assert isinstance(result, list)
    assert len(result) >= 1
    
    engine.close()
```

#### 3.2 Integration Tests
```python
def test_{database_name}_full_workflow():
    """Test complete engine workflow"""
    params = create_test_params("{engine_name}")
    engine = Connection.engine_connection(params)
    
    # Test connection
    engine.open()
    
    # Test metadata discovery
    tables = engine.exec(engine.tables_query(True))
    assert len(tables) >= 0
    
    if tables:
        table_name = tables[0]['table_name']
        fields = engine.exec(engine.fields_query(True, table_name, 'table'))
        assert len(fields) >= 0
    
    # Test connection verification
    check_result = engine.exec(engine.check_query())
    assert len(check_result) >= 1
    
    engine.close()
```

### Phase 4: Documentation

#### 4.1 Create Engine Documentation
Follow the template in `docs/sql_{database}.md`:

```markdown
# {Database} Database Integration

## Overview
[Database description and characteristics]

## Python Driver
[Installation instructions and dependencies]

## xldb_proxy Integration Pattern
[Pattern type and implementation approach]

## Engine Implementation
[Complete code example]

## Connection Configuration
[Configuration examples]

## Query Examples
[Database-specific query patterns]

## Authentication Methods
[Supported authentication approaches]

## Special Considerations
[Database-specific features and limitations]

## Implementation Complexity
[Development effort estimation]
```

#### 4.2 Update Memory Bank
```markdown
# Update .memory_bank/current_tasks.md
Add completion status for engine implementation task

# Update .memory_bank/tech_stack.md
Add new database to supported engines list

# Update patterns if new pattern created
Document any new architectural patterns discovered
```

### Phase 5: Integration

#### 5.1 Auto-Registration Verification
```python
# Verify engine registers automatically
from sqlengines import {database_module}
from models.connection import Connection

# Check registration
assert "{engine_name}" in Connection._engines
assert Connection._engines["{engine_name}"] == EngineConnection{DatabaseName}
```

#### 5.2 Configuration Template
```toml
# Add to xldb-sql-proxy.conf
[database.{engine_name}]
default_timeout = 30
query_timeout = 120
default_port = {default_port}
# Database-specific settings
```

#### 5.3 API Integration Test
```python
def test_api_integration():
    """Test engine through FastAPI endpoints"""
    from fastapi.testclient import TestClient
    from main import app
    
    client = TestClient(app)
    
    # Test connection creation
    connection_data = {
        "name": "test_{database_name}",
        "engine": "{engine_name}",
        "sql": {
            "dbms_host": "localhost",
            "user": "test",
            "password": "test",
            "database": "test"
        }
    }
    
    response = client.post("/connections", json=connection_data)
    assert response.status_code == 200
    
    # Test connection verification
    conn_id = response.json()["id"]
    response = client.post(f"/connections/{conn_id}/check")
    assert response.status_code == 200
```

## Common Implementation Patterns

### Error Handling Template
```python
def handle_{database_name}_errors(self, operation):
    """Handle database-specific error scenarios"""
    try:
        return operation()
    except {database_driver}.{SpecificError} as e:
        if "connection" in str(e).lower():
            raise HTTPException(status_code=503, detail="Database unavailable")
        elif "permission" in str(e).lower():
            raise HTTPException(status_code=403, detail="Access denied")
        elif "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Object not found")
        else:
            raise HTTPException(status_code=400, detail=f"Query error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected {DATABASE_NAME} error: {e}")
        raise HTTPException(status_code=500, detail="Internal database error")
```

### Connection Parameter Parsing
```python
def _parse_connection_params(self):
    """Parse and validate connection parameters"""
    sql = self.params.sql
    
    # Handle host:port combinations
    if ":" in sql.dbms_host:
        host, port = sql.dbms_host.split(":", 1)
        port = int(port)
    else:
        host = sql.dbms_host
        port = sql.dbms_port or DEFAULT_PORT
    
    # Build base parameters
    params = {
        'host': host,
        'port': port,
        'user': sql.user,
        'database': sql.database or DEFAULT_DATABASE
    }
    
    # Add optional parameters
    if sql.password:
        params['password'] = sql.password
    
    return params
```

### Metadata Schema Handling
```python
def _get_schema(self):
    """Get current schema name with fallback"""
    return getattr(self.params.sql, 'db_schema', DEFAULT_SCHEMA)

def _build_qualified_name(self, table_name):
    """Build fully qualified table name"""
    schema = self._get_schema()
    if schema:
        return f'"{schema}"."{table_name}"'
    return f'"{table_name}"'
```

## Quality Checklist

### Implementation Quality
- [ ] All required interface methods implemented
- [ ] Proper error handling with appropriate HTTP status codes
- [ ] Logging for connection events and errors
- [ ] Parameter validation and sanitization
- [ ] Resource cleanup in close() method

### Testing Quality
- [ ] Unit tests for all public methods
- [ ] Integration tests with real database
- [ ] Error condition testing
- [ ] Authentication method testing
- [ ] Performance baseline established

### Documentation Quality
- [ ] Complete engine documentation created
- [ ] Code comments for complex logic
- [ ] Configuration examples provided
- [ ] Usage examples included
- [ ] Memory Bank updated

### Integration Quality
- [ ] Auto-registration working
- [ ] API endpoint integration tested
- [ ] Configuration template provided
- [ ] No conflicts with existing engines
- [ ] Performance meets requirements

## Troubleshooting Guide

### Common Issues

#### Connection Failures
```python
# Debug connection parameters
logger.debug(f"Connecting to {host}:{port} as {user}")
logger.debug(f"Database: {database}, Schema: {schema}")

# Test direct driver connection
try:
    test_conn = driver.connect(**params)
    test_conn.close()
    logger.info("Direct driver connection successful")
except Exception as e:
    logger.error(f"Direct driver connection failed: {e}")
```

#### Metadata Discovery Issues
```python
# Debug metadata queries
logger.debug(f"Tables query: {tables_sql}")
try:
    result = self.cursor.execute(tables_sql)
    logger.debug(f"Tables result: {result}")
except Exception as e:
    logger.error(f"Tables query failed: {e}")
```

#### Authentication Problems
```python
# Debug authentication parameters
auth_params = {k: v for k, v in conn_params.items() if 'password' not in k}
logger.debug(f"Auth parameters: {auth_params}")
```

### Performance Optimization
- Use connection pooling for high-frequency access
- Optimize metadata queries for large schemas
- Implement query result caching where appropriate
- Configure appropriate timeout values

### Security Considerations
- Never log sensitive credentials
- Use parameterized queries to prevent SQL injection
- Validate all user inputs
- Support encrypted connections where available

---

*This guide ensures consistent, high-quality SQL engine implementations that integrate seamlessly with the xldb_proxy architecture.*