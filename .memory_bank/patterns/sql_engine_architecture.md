# SQL Engine Architecture Patterns

## Overview

This document defines the architectural patterns for SQL engine implementations in the xldb_proxy system. Each pattern addresses specific database connectivity requirements and provides a standardized approach for integration.

## Pattern Taxonomy

### 1. Standard SQL Pattern
**Use Case**: Traditional relational databases (MySQL, PostgreSQL, SQLite)
**Characteristics**:
- Standard SQL-92/99/2003 compliance
- ACID transaction support
- Traditional table/column metadata structure

**Key Methods**:
```python
def tables_query(self, is_admin: bool) -> str:
    return "SELECT table_name FROM information_schema.tables"

def fields_query(self, is_admin: bool, table_name: str, table_type: str) -> str:
    return f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'"
```

### 2. SSL/TLS Enhanced Pattern
**Use Case**: Secure database connections (PostgreSQL SSL, MySQL SSL)
**Characteristics**:
- Certificate-based authentication
- Encrypted data transmission
- CA certificate validation

**Implementation Example**:
```python
def _setup_ssl_params(self):
    ssl_params = {}
    if self.params.sql.ssl_enabled:
        ssl_params['sslmode'] = 'require'
        if hasattr(self.params.sql, 'ssl_cert'):
            ssl_params['sslcert'] = self.params.sql.ssl_cert
    return ssl_params
```

### 3. Protocol-Aware Pattern
**Use Case**: Distributed systems (ClickHouse, Trino, Hive)
**Characteristics**:
- Custom protocol implementations
- Cluster-aware connectivity
- Multi-node routing

**Example**:
```python
def _parse_connection_params(self):
    if ":" in self.params.sql.dbms_host:
        host, port = self.params.sql.dbms_host.split(":")
        return {'host': host, 'port': int(port)}
```

### 4. File-Based Pattern
**Use Case**: Embedded databases (SQLite, DuckDB)
**Characteristics**:
- File path connections
- Local storage optimization
- Single-process access

### 5. Analytical Pattern
**Use Case**: OLAP databases (ClickHouse analytics, Vertica)
**Characteristics**:
- Columnar storage optimization
- Aggregation-focused queries
- Large dataset handling

### 6. Virtual Engine Pattern
**Use Case**: Custom engines (HTG, Local Folder)
**Characteristics**:
- Custom metadata structures
- Non-SQL data sources
- Specialized query processing

### 7. NoSQL Adapter Pattern
**Use Case**: Document databases (MongoDB, OrientDB)
**Characteristics**:
- SQL-to-NoSQL query translation
- Document-based metadata
- Schema flexibility

## Implementation Guidelines

### Auto-Registration Mechanism
All SQL engines use the `__init_subclass__` pattern for automatic registration:

```python
class Connection:
    _engines = {}
    
    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if hasattr(cls, 'names'):
            for name in cls.names:
                cls._engines[name] = cls
```

### Required Interface Methods
Every engine must implement:

1. **Connection Management**:
   ```python
   def open(self) -> None
   def close(self) -> None
   def check_query(self) -> str
   ```

2. **Metadata Discovery**:
   ```python
   def tables_query(self, is_admin: bool) -> str
   def views_query(self, is_admin: bool) -> str
   def fields_query(self, is_admin: bool, table_name: str, table_type: str) -> str
   ```

3. **Query Execution**:
   ```python
   def exec(self, query: str) -> List[Dict[str, Any]]
   ```

### Error Handling Pattern
Standardized error handling across all engines:

```python
try:
    # Database operation
    pass
except DatabaseSpecificError as e:
    logger.error(f"Database error: {e}")
    raise HTTPException(
        status_code=500,
        detail=f"Database operation failed: {str(e)}"
    )
```

### Configuration Pattern
Each engine follows consistent parameter parsing:

```python
def _parse_connection_params(self):
    sql = self.params.sql
    return {
        'host': sql.dbms_host,
        'port': sql.dbms_port or DEFAULT_PORT,
        'user': sql.user,
        'password': sql.password,
        'database': sql.database
    }
```

## Pattern Selection Matrix

| Database Type | Pattern | Authentication | Metadata Source |
|---------------|---------|----------------|-----------------|
| MySQL | Standard SQL | User/Pass, SSL | information_schema |
| PostgreSQL | SSL Enhanced | User/Pass, SSL, Kerberos | information_schema |
| ClickHouse | Protocol-Aware | User/Pass, HTTP | system.tables |
| MongoDB | NoSQL Adapter | User/Pass, X.509 | db.collections |
| DuckDB | File-Based | None | pragma_table_info |
| Trino | Protocol-Aware | Basic, JWT, Kerberos | Multiple catalogs |
| HTG | Virtual Engine | Custom | Custom metadata |

## Testing Patterns

### Unit Testing Structure
```python
def test_engine_connection():
    params = create_test_params()
    engine = Connection.engine_connection(params)
    
    engine.open()
    assert engine.connection is not None
    
    # Test basic query
    result = engine.exec("SELECT 1")
    assert len(result) == 1
    
    engine.close()
```

### Integration Testing
```python
@pytest.mark.parametrize("engine_type", ["mysql", "postgresql", "clickhouse"])
def test_metadata_discovery(engine_type):
    engine = create_engine(engine_type)
    tables_sql = engine.tables_query(is_admin=True)
    assert "table_name" in tables_sql.lower()
```

## Performance Considerations

### Connection Pooling
- Implement connection reuse for frequently accessed databases
- Set appropriate timeout values
- Handle connection lifecycle properly

### Query Optimization
- Use prepared statements where supported
- Implement query result caching
- Optimize metadata queries for performance

### Resource Management
- Ensure proper cleanup in `close()` methods
- Handle connection failures gracefully
- Implement retry mechanisms for transient failures

## Security Guidelines

### Credential Management
- Never log credentials in plain text
- Use encrypted storage for sensitive parameters
- Support multiple authentication methods

### SQL Injection Prevention
- Use parameterized queries where possible
- Validate table/column names
- Sanitize user inputs

### Network Security
- Support SSL/TLS encryption
- Implement certificate validation
- Use secure connection protocols

## Future Extensions

### Planned Patterns
1. **Event-Driven Pattern**: For streaming databases
2. **Graph Pattern**: For graph databases (Neo4j)
3. **Time-Series Pattern**: For time-series databases (InfluxDB)
4. **Multi-Tenant Pattern**: For cloud-native databases

### Extensibility Points
- Custom authentication providers
- Plugin-based query processors
- Dynamic metadata handlers
- Custom connection strategies

---

*This document serves as the architectural foundation for SQL engine implementations in xldb_proxy. All new engines should follow these established patterns for consistency and maintainability.*