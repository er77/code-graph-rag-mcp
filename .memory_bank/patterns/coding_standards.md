# Coding Standards

This document defines the coding standards and patterns used throughout the xldb_proxy FastAPI project.

## Code Organization and Structure

### Import Organization
```python
# Standard library imports first
from __future__ import annotations
import os
import logging
from typing import List, Optional
from enum import Enum

# Third-party imports
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator
import duckdb
import polars as pl

# Local imports
from xldb_config import SETTINGS
from logger_conf import debug_log, error_log, info_log
from state_database import state_db
from models.connection import Connection
from api.dependencies import connection_key_dep, query_key_dep
```

### Module Structure
- **Single responsibility**: Each module focuses on one aspect (connections, queries, models)
- **Hierarchical organization**: `api/` for REST endpoints, `models/` for data classes, `sqlengines/` for database drivers
- **Plugin architecture**: Extensible engine system via `__init_subclass__` pattern

## Data Models and Validation

### Pydantic Models
```python
class SQLConnectionParams(BaseModel):
    database: Optional[str] = None
    db_schema: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    dbms_port: Optional[int] = None
    dbms_host: Optional[str] = None
    cp: Optional[str] = 'utf8'

class NewSQLConnectionParams(BaseModel):
    database: Optional[str] = None
    db_schema: Optional[str] = None
    user: str  # Required for new connections
    password: str  # Required for new connections
    dbms_port: int  # Required
    dbms_host: str  # Required
    cp: Optional[str] = 'utf8'
```

**Patterns:**
- Use `Optional[type] = None` for optional fields
- Create separate "New" versions of models for creation endpoints with stricter validation
- Use `field_validator` for custom validation logic
- Use descriptive field titles in Russian for user-facing fields

### Custom Validation
```python
@field_validator('engine')
def engine_validator(cls, v: str):
    if v not in Connection.engines:
        raise ValueError(f'No such engine: {v}')
    return v
```

## API Design Patterns

### Router Organization
```python
router = APIRouter(prefix="/connection", tags=["connection"])

@router.post(
    path="/add",
    summary="Create new connection"
)
def connection_new(params: NewConnectionParams):
    debug_log(f"New connection")
    # Implementation
```

**Standards:**
- Use descriptive path names: `/add`, `/edit`, `/delete`
- Include meaningful summaries in decorators
- Use dependency injection for common validations (`connection_key_dep`, `query_key_dep`)
- Return consistent response format: `{'status': 'ok', 'key': value}`

### Error Handling
```python
have_it = Query.get_query_id(name=name)
if have_it is not None:
    raise HTTPException(status_code=400, detail="Name already exists")
```

**Patterns:**
- Use HTTPException for API errors
- Check for conflicts before creation
- Return specific error messages
- Use 400 for validation errors, 404 for not found

### Dependency Injection
```python
from typing import Annotated

connection_key_dep = Annotated[int, Depends(get_connection_id)]
query_key_dep = Annotated[int, Depends(get_query_id)]

def get_connection_id(connection_key: str):
    connection_id = Connection.get_connection_id(connection_key)
    if connection_id is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    return connection_id
```

## Database Patterns

### State Database Operations
```python
# Always use state_db for centralized database operations
new_record = {
    'connection_id': connection_id,
    'query_key': query_key,
    'name': name,
    'query': query
}
state_db.add_record("queries", new_record)
```

**Standards:**
- Use `state_db.escape()` for string values in SQL queries
- Use parameterized queries or escaping to prevent SQL injection
- Use `cleandoc()` for multiline SQL queries
- Create database tables using `CREATE TABLE IF NOT EXISTS`

### SQL Query Formatting
```python
from inspect import cleandoc

query = cleandoc(f"""
    SELECT DISTINCT name table_name 
    FROM system.tables 
    WHERE engine <> 'View' 
    AND database='{self.params.sql.database}'
""")
```

## Engine Architecture

### Plugin Pattern
```python
class EngineConnectionCH(Connection):
    names = ["clickhouse"]  # Register engine names

    def open(self):
        # Implementation specific to ClickHouse
        self.connection = connect(...)
        self.cursor = self.connection.cursor()

    def close(self):
        self.connection.commit()
        self.cursor.close()
        self.connection.close()
```

**Standards:**
- Inherit from base `Connection` class
- Define `names` class variable for engine registration
- Implement required methods: `open()`, `close()`, `tables_query()`, `views_query()`
- Use engine-specific connection libraries

## Logging and Debugging

### Logging Functions
```python
from logger_conf import debug_log, info_log, error_log

debug_log(f"New query")
debug_log(new_record)  # Automatically formats objects
```

### Decorators for Logging
```python
@log_params  # Logs function parameters
def query_edit(query_id: query_key_dep, name: str = None):
    # Implementation

@log_full  # Logs parameters and return value
def some_function():
    # Implementation
```

**Standards:**
- Use `debug_log()` for development information
- Use `info_log()` for important operations
- Use `error_log()` for exceptions and errors
- Objects are automatically formatted using `pformat()`

## Security Patterns

### Credential Encryption
```python
def encrypt_record(record: dict):
    if "password" in record:
        record['password'] = crypto.encrypt(record['password'])
    if "user" in record:
        record['user'] = crypto.encrypt(record['user'])
```

**Standards:**
- Always encrypt sensitive data before database storage
- Use the centralized `tools.crypto` module
- Handle both user credentials and passwords
- Decrypt only when needed for connections

## File and Path Handling

### Cross-Platform Compatibility
```python
import compat

# Use compat functions for file operations
folder, filename = os.path.split(self.db_path)
os.makedirs(folder, exist_ok=True)

# Use compat for path resolution
config_path = compat.get_config_file_path()
data_dir = compat.get_main_data_dir()
```

**Standards:**
- Use `compat.py` functions for platform-specific operations
- Always create directories with `exist_ok=True`
- Handle Windows/Unix path differences through compat layer

## Key Generation and Uniqueness

### Connection Keys
```python
def calculate_key(self):
    s = self.params.engine
    # Add essential parameters for key generation
    # Exclude user-specific data like names and SSL paths
    return hashlib.sha256(s.encode()).hexdigest()[:16]
```

### UUID for Runtime Keys
```python
import uuid
query_key = str(uuid.uuid1())  # For runtime unique identifiers
```

**Standards:**
- Use SHA256 for deterministic keys based on connection parameters
- Use UUID1 for runtime-generated unique keys
- Exclude user-specific data from key calculation for portability

## Error Handling Patterns

### Exception Hierarchy
```python
class QueryNotFoundException(Exception):
    pass

class QueryAlreadyExistsException(Exception):
    pass
```

### Try-Catch Usage
```python
try:
    with open(config_path, "rb") as f:
        config = tomli.load(f)
except Exception as error:
    logger.error(error)
    print(error)
```

**Standards:**
- Create custom exception classes for domain-specific errors
- Always log exceptions before re-raising or handling
- Use specific exception types when possible
- Handle configuration and file errors gracefully

## Code Style Guidelines

### Naming Conventions
- **Classes**: PascalCase (`ConnectionParams`, `DataModel`)
- **Functions/Methods**: snake_case (`get_connection_id`, `calculate_key`)
- **Variables**: snake_case (`connection_id`, `query_key`)
- **Constants**: UPPER_SNAKE_CASE (`SETTINGS`, `__version__`)
- **Private methods**: Leading underscore (`_internal_method`)

### Type Hints
```python
from __future__ import annotations
from typing import Optional, List, Dict, Any

def get_query(name: str = None, key: str = None) -> Optional[Query]:
    # Implementation
```

### Documentation
- Use docstrings for complex functions
- Include parameter descriptions for API endpoints
- Document architectural decisions in separate files
- Use Russian comments for user-facing elements, English for technical details

## Testing Patterns

### Parametrized Testing
```python
def pytest_generate_tests(metafunc):
    if 'connection' in metafunc.fixturenames:
        metafunc.parametrize('connection', connections, ids=connection_id)
```

**Standards:**
- Use pytest for all testing
- Parametrize tests across multiple database engines
- Create reusable connection fixtures
- Test both success and failure scenarios

## Module Documentation Standards

### File Header Template
```python
"""
Brief description of what this module does and its main purpose.

This module handles [specific functionality] for the xldb_proxy system.
It provides [key capabilities] through [main classes/functions].

External Dependencies:
- [Library Name]: [URL] - [Brief description of usage]
- [Library Name]: [URL] - [Brief description of usage]

Architecture References:
- Project Overview: .memory_bank/README.md
- Coding Standards: .memory_bank/patterns/coding_standards.md
- Architectural Decisions: .memory_bank/patterns/architectural_decisions.md
- SQL Engines Guide: .memory_bank/guides/sql_engine_development.md

@history
 - YYYY-MM-DD: Created by Dev-Agent - TASK-XXX: [Initial implementation/purpose]
 - YYYY-MM-DD: Modified by Dev-Agent - TASK-XXX: Fixed [specific issue description]
"""

# =============================================================================
# 1. IMPORTS AND DEPENDENCIES
# =============================================================================
# [Import statements organized by category]

# =============================================================================
# 2. CONSTANTS AND CONFIGURATION
# =============================================================================
# [Module constants and configuration]

# =============================================================================
# 3. DATA MODELS AND TYPE DEFINITIONS
# =============================================================================
# [Pydantic models, TypedDict, Enum classes]

# =============================================================================
# 4. UTILITY FUNCTIONS AND HELPERS
# =============================================================================
# [Helper functions and utilities]

# =============================================================================
# 5. CORE BUSINESS LOGIC
# =============================================================================
# [Main classes and business logic]

# =============================================================================
# 6. API ENDPOINTS AND ROUTES
# =============================================================================
# [FastAPI route definitions]

# =============================================================================
# 7. INITIALIZATION AND STARTUP
# =============================================================================
# [Module initialization code]
```

### Documentation Requirements
- **External Links**: All external references must be clearly named with URLs
- **Semantic Organization**: Code split into numbered semantic sections
- **Change Tracking**: @history section with TASK-XXX references
- **Architecture References**: Links to relevant documentation

## Quality Assurance

### Code Review Checklist
- [ ] Follows import organization standards
- [ ] Uses appropriate error handling patterns
- [ ] Includes comprehensive type hints
- [ ] Has proper documentation and docstrings
- [ ] Follows naming conventions
- [ ] Uses logging appropriately
- [ ] Handles security concerns properly
- [ ] Is compatible with cross-platform requirements

### Testing Requirements
- [ ] Unit tests for all public methods
- [ ] Integration tests for database connections
- [ ] Error condition testing
- [ ] Performance testing for critical paths
- [ ] Cross-platform compatibility testing

This coding standard ensures consistency, maintainability, and quality across the entire xldb_proxy codebase while supporting the project's multi-database, cross-platform architecture.