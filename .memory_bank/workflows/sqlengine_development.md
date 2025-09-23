# SQL Engine Development Workflow

## 🎯 Overview

This specialized workflow is **exclusively for dev-sqlengines agent** when working on database engine implementations, SQL query processing, and data management systems within the xldb_proxy architecture.

## 🔒 Agent Restrictions

**CRITICAL**: This workflow is **ONLY** for dev-sqlengines agent when working on:
- Files in `sqlengines/` directory
- Database engine implementations
- SQL query processing
- Connection management for databases
- Database-specific optimizations

**Prohibited**: dev-agent is **FORBIDDEN** from using this workflow or modifying any sqlengines/ files.

## 🔄 SQL Engine Development Process

### 1. SQL Engine Task Analysis

#### Conductor Delegation Verification
1. **Task Origin**: Verify task came through supervisor-orchestrator
2. **TASK-XXX Validation**: Confirm proper task identifier present
3. **Folder Scope**: Verify task involves sqlengines/ directory
4. **Complexity Assessment**: Evaluate SQL engine complexity (1-10 scale)

#### Memory Bank Consultation (SQL Engine Specific)
- **Read sqlengines/README.md**: Understand plugin architecture
- **Review patterns/sql_engine_architecture.md**: Check engine patterns
- **Study existing engines**: Identify similar implementation patterns
- **Check guides/sql_engines.md**: Understand subsystem context

### 2. SQL Engine Pattern Selection

#### Available Implementation Patterns

##### 1. Standard SQL Pattern
**Use for**: MySQL, PostgreSQL, SQL Server, Oracle
```python
class EngineConnectionStandard(Connection):
    names = ["engine_name"]

    def open(self):
        # Standard connection with host/port/database
        self.connection = driver.connect(
            host=self.params.sql.dbms_host,
            port=self.params.sql.dbms_port,
            database=self.params.sql.database,
            user=self.params.sql.user,
            password=self.params.sql.password
        )
        self.cursor = self.connection.cursor()

    def tables_query(self, is_admin: bool) -> str:
        return cleandoc(f"""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = '{self.params.sql.db_schema}'
            ORDER BY table_name
        """)
```

##### 2. SSL/TLS Enhanced Pattern
**Use for**: PostgreSQL with certificate authentication
```python
def check_ssl_params(self) -> dict:
    ssl_params = {}
    ssl = self.params.ssl
    if ssl is None:
        return ssl_params

    if ssl.ssl_cert and not self.check_ssl_file(ssl.ssl_cert):
        raise FileNotFoundError(f"SSL cert not found: {ssl.ssl_cert}")

    ssl_params['sslcert'] = ssl.ssl_cert
    ssl_params['sslkey'] = ssl.ssl_key
    ssl_params['sslmode'] = ssl.ssl_mode
    return ssl_params
```

##### 3. Protocol-Aware Pattern
**Use for**: ClickHouse with http/https detection
```python
def open(self):
    is_secure = self.params.sql.dbms_host.startswith("https://")
    dbms_url = remove_prefix(self.params.sql.dbms_host, r"https?://")

    self.connection = connect(
        host=dbms_url,
        secure=is_secure,
        # ... other parameters
    )
```

##### 4. File-Based Pattern
**Use for**: SQLite, single-file databases
```python
def open(self):
    # File path as database parameter
    self.connection = sqlite3.connect(self.params.sql.database)
    self.cursor = self.connection.cursor()

def tables_query(self, is_admin: bool) -> str:
    return cleandoc("""
        SELECT name AS table_name
        FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
    """)
```

##### 5. Analytical Pattern
**Use for**: DuckDB with multi-format file support
```python
def create_file_view(self, filename):
    db_folder = compat.get_duckdb_temp_folder_name()
    connection = duckdb.connect(os.path.join(db_folder, f"{hash(filename)}.db"))

    title, ext = os.path.splitext(filename)
    read_methods = {
        "csv": "read_csv_auto",
        "json": "read_json",
        "parquet": "read_parquet"
    }

    method = read_methods[ext[1:].lower()]
    table_name = os.path.split(title)[1]

    connection.sql(f"""
        CREATE VIEW {table_name}
        AS SELECT * FROM {method}('{filename}')
    """)
    return connection
```

##### 6. Virtual Engine Pattern
**Use for**: HTG cross-database operations
```python
def initialize_context(self, query):
    table_names = tables_in_query(query)
    for table_name in table_names:
        source = Query.get_query(name=table_name)
        connection = Connection.create_connection(con_id=source.connection_id)
        df = connection.exec(source.query)
        duckdb.register(view_name=table_name, python_object=df, connection=htg_context)
```

### 3. SQL Engine Implementation

#### Core Interface Requirements
**Every SQL engine MUST implement these methods:**

```python
class EngineConnectionNew(Connection):
    names = ["engine_identifier"]  # Required for auto-registration

    def open(self):
        """Establish connection using self.params"""
        pass

    def close(self):
        """Clean up connection resources"""
        pass

    def tables_query(self, is_admin: bool) -> str:
        """Return SQL to list all tables"""
        pass

    def views_query(self, is_admin: bool) -> str:
        """Return SQL to list all views"""
        pass

    def fields_query(self, is_admin: bool, table_name: str, table_type: str) -> str:
        """Return SQL to describe table/view columns"""
        pass
```

#### Optional Interface Methods
```python
def primary_keys_query(self, table_name: str) -> str:
    """Return SQL to get primary key columns"""
    return ""

def admin_level_query(self) -> str:
    """Return SQL to check admin privileges"""
    return ""

def check_query(self) -> str:
    """Return SQL for connection verification"""
    return "SELECT 1"

def safe_cursor_iterator(self):
    """Return custom cursor iterator if needed"""
    return SafeCursorDataIterator(self.cursor)
```

### 4. SQL Engine File Structure

#### File Organization
```python
"""
# TASK-XXX: [SQL Engine task description]
# ADR-XXX: [Architecture Decision Reference]

SQL Engine implementation for [Database Name] in the xldb_proxy system.

This module provides [Database Name] database connectivity, query execution,
and data management capabilities following the [Pattern Name] implementation pattern.

Architecture References:
- SQL Engine Plugin System: sqlengines/README.md
- Engine Patterns: .memory_bank/patterns/sql_engine_architecture.md
- Connection Models: models/connection.py
"""

# =============================================================================
# 1. IMPORTS AND DATABASE DEPENDENCIES
# =============================================================================
from typing import Optional, Dict, Any
import logging
from inspect import cleandoc
from models.connection import Connection
import database_specific_driver

# =============================================================================
# 2. DATABASE CONSTANTS AND CONFIGURATION
# =============================================================================
DEFAULT_CONNECTION_TIMEOUT = 30
MAX_CONNECTION_RETRIES = 3

# =============================================================================
# 3. SQL ENGINE DATA MODELS
# =============================================================================
# Database-specific parameter models if needed

# =============================================================================
# 4. DATABASE UTILITY FUNCTIONS
# =============================================================================
def validate_connection_params():
    """SQL-specific validation logic"""
    pass

# =============================================================================
# 5. CORE SQL ENGINE IMPLEMENTATION
# =============================================================================
class EngineConnectionDatabaseName(Connection):
    names = ["database_name", "alias_name"]  # Auto-registration identifiers

    # Implementation methods here

# =============================================================================
# 6. QUERY EXECUTION AND RESULT PROCESSING
# =============================================================================
# Additional query processing logic if needed

# =============================================================================
# 7. CONNECTION MANAGEMENT AND INITIALIZATION
# =============================================================================
# Module initialization and cleanup code
```

### 5. SQL Engine Testing

#### Engine Registration Test
```python
def test_engine_registration():
    from models.connection import Connection
    assert "new_engine" in Connection.engines
    assert Connection.engines["new_engine"] == EngineConnectionNew
```

#### Connection Test
```python
def test_connection_lifecycle():
    params = create_test_connection_params()
    engine = Connection.engine_connection(params)

    engine.open()
    assert engine.connection is not None

    engine.close()
    # Verify cleanup
```

#### Metadata Query Tests
```python
def test_metadata_queries():
    engine = create_test_engine()
    engine.open()

    # Test table listing
    tables_sql = engine.tables_query(is_admin=True)
    assert "SELECT" in tables_sql.upper()

    # Test field discovery
    fields_sql = engine.fields_query(True, "test_table", "table")
    assert "test_table" in fields_sql

    engine.close()
```

#### Integration Tests
```python
def test_sql_engine_integration():
    """Test against actual database instance"""
    engine = create_live_engine()
    engine.open()

    # Test actual query execution
    tables = engine.get_tables()
    assert isinstance(tables, list)

    if tables:
        fields = engine.get_fields(True, tables[0], "table")
        assert len(fields) > 0

    engine.close()
```

### 6. Error Handling Best Practices

#### Connection Error Handling
```python
def open(self):
    try:
        sql = self.params.sql
        self.connection = driver.connect(
            host=sql.dbms_host,
            port=sql.dbms_port,
            database=sql.database,
            user=sql.user,
            password=sql.password,
            timeout=sql.timeout or 30
        )
        self.cursor = self.connection.cursor()
    except driver.Error as e:
        logger.error(f"SQL Engine connection failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in SQL engine: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database connection error"
        )
```

#### Query Error Handling
```python
def exec(self, query: str) -> pl.DataFrame:
    try:
        self.cursor.execute(query)
        results = self.cursor.fetchall()
        return pl.DataFrame(results, schema=self.get_column_schema())
    except driver.DatabaseError as e:
        logger.error(f"Query execution failed: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Query execution error: {str(e)}"
        )
```

### 7. Performance Optimization

#### Connection Optimization
```python
def open(self):
    # Connection pooling for high-traffic scenarios
    pool_config = {
        'pool_size': 10,
        'max_overflow': 20,
        'pool_timeout': 30,
        'pool_recycle': 3600
    }

    self.connection = create_pooled_connection(
        connection_string=self.build_connection_string(),
        **pool_config
    )
```

#### Query Optimization
```python
def exec(self, query: str) -> pl.DataFrame:
    # Query result caching
    cache_key = hash(query)
    if cache_key in self.query_cache:
        return self.query_cache[cache_key]

    result = self._execute_query(query)
    self.query_cache[cache_key] = result
    return result
```

### 8. SQL Engine Documentation

#### Update Engine Registry
```python
# In sqlengines/README.md, add:
- ✅ **NewEngine** - [Description] database support
```

#### Memory Bank Updates
- **patterns/sql_engine_architecture.md**: Document new patterns
- **guides/sql_engines.md**: Add engine-specific usage guide
- **current_tasks.md**: Update task progress

#### Logging Requirements
```bash
# Create engine-specific log
echo "TASK-XXX: Implemented NewEngine following [Pattern] pattern" > .memory_bank/logs_llm/sqlengines_new_engine_llm.log

# Update main task log
echo "TASK-XXX: SQL Engine implementation completed - NewEngine ready for testing" >> .memory_bank/logs_llm/TASK-XXX.log
```

### 9. SQL Engine Deployment

#### Registration in Main Module
```python
# In main.py, add:
import sqlengines.new_engine  # Auto-registers the engine
```

#### Dependency Management
```python
# Add to requirements.txt:
new-database-driver>=1.0.0
```

#### Configuration Template
```toml
# Add to xldb-sql-proxy.conf example:
[database.new_engine]
default_timeout = 30
max_retries = 3
pool_size = 10
```

## 🚫 SQL Engine Anti-Patterns

### Avoid These Practices
- **Breaking Interface Contract**: Not implementing required methods
- **Inconsistent Error Handling**: Each engine using different error patterns
- **Missing Auto-Registration**: Forgetting `names` class attribute
- **Pattern Mixing**: Combining incompatible implementation patterns
- **Inadequate Testing**: Not testing against actual database instances

### Common SQL Engine Pitfalls
- **Connection Leaks**: Not properly closing connections in error scenarios
- **SQL Injection**: Not properly parameterizing queries
- **Performance Issues**: Not implementing connection pooling for high-traffic engines
- **Inconsistent Metadata**: Different result formats across engines

## 📊 SQL Engine Success Metrics

### Implementation Quality
- **Interface Compliance**: 100% required method implementation
- **Pattern Adherence**: Correct implementation pattern selection
- **Error Handling**: Comprehensive exception management
- **Test Coverage**: 90% minimum for SQL engine code

### Performance Metrics
- **Connection Time**: <5 seconds for database connections
- **Query Overhead**: <50ms proxy processing overhead
- **Memory Usage**: Efficient result set handling
- **Concurrent Connections**: Support for 100+ simultaneous connections per engine

---

*This SQL engine development workflow ensures consistent, high-performance database engine implementations while maintaining the plugin architecture integrity.*

**Last Updated**: 2025-01-18 | **Next Review**: 2025-02-18