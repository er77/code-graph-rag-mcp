# API Reference Guide

## Table of Contents
- [Overview](#overview)
- [Base URL and Versioning](#base-url-and-versioning)
- [Authentication](#authentication)
- [Response Format](#response-format)
- [Connection Management](#connection-management)
- [Query Management](#query-management)
- [Data Model Management](#data-model-management)
- [File Services](#file-services)
- [System Endpoints](#system-endpoints)
- [XMLA/OLAP Endpoints](#xmlaolap-endpoints)
- [Error Codes](#error-codes)
- [Rate Limits](#rate-limits)

## Overview

The XLDB Proxy API provides a RESTful interface for managing database connections, executing queries, and handling data operations across multiple database backends. All endpoints return JSON responses and use standard HTTP status codes.

### API Features

- **Multi-Database Support**: Connect to ClickHouse, DuckDB, MySQL, PostgreSQL, Oracle, MSSQL, SQLite, and HTG
- **Secure Connection Management**: Encrypted credential storage
- **Query Execution**: Full SQL support with result formatting options
- **File Integration**: Upload and query CSV, JSON, and Parquet files
- **XMLA/OLAP**: Complete XMLA protocol implementation
- **Real-time Monitoring**: System health and performance endpoints

## Base URL and Versioning

**Base URL**: `http://localhost:55080` (default)

**API Version**: All endpoints are unversioned and stable

**Content Type**: All requests expect `Content-Type: application/json` unless specified otherwise

## Authentication

Currently, the API uses connection-level authentication stored in the database connections themselves. Future versions will include API-level authentication.

## Response Format

### Standard Success Response

```json
{
    "status": "ok",
    "data": {
        // Response data
    },
    "timestamp": "2024-09-13T12:00:00Z"
}
```

### Standard Error Response

```json
{
    "status": "error",
    "error_code": "CONNECTION_NOT_FOUND",
    "message": "Database connection not found",
    "details": {
        "connection_id": "conn_123"
    },
    "timestamp": "2024-09-13T12:00:00Z"
}
```

## Connection Management

### POST `/connection/add`

Create a new database connection.

**Request Body:**
```json
{
    "name": "Production PostgreSQL",
    "sql": {
        "engine_type": "postgres",
        "dbms_host": "db.example.com",
        "dbms_port": 5432,
        "database": "production",
        "user": "app_user",
        "password": "secure_password",
        "ssl": {
            "enabled": true,
            "mode": "require"
        }
    }
}
```

**Response:**
```json
{
    "status": "ok",
    "connection_key": "conn_abc123def456"
}
```

**Supported Engine Types:**
- `postgres` - PostgreSQL
- `mysql` - MySQL
- `clickhouse` - ClickHouse
- `duckdb` - DuckDB
- `oracle` - Oracle Database
- `mssql` - Microsoft SQL Server
- `sqlite` - SQLite
- `htg` - HTG Custom Engine

### POST `/connection/import`

Import multiple connections with encrypted credentials.

**Request Body:**
```json
{
    "connections": [
        {
            "connection_key": "conn_123",
            "name": "Imported Connection",
            "sql": {
                // Encrypted connection parameters
            }
        }
    ],
    "password": "import_password"
}
```

**Response:**
```json
{
    "status": "ok",
    "results": {
        "conn_123": "imported",
        "conn_456": "already exists",
        "conn_789": "wrong password"
    }
}
```

### GET `/connection/list`

List all available database connections.

**Response:**
```json
{
    "status": "ok",
    "connections": [
        {
            "connection_key": "conn_abc123",
            "name": "Production PostgreSQL",
            "engine_type": "postgres",
            "dbms_host": "db.example.com",
            "database": "production",
            "ssl_enabled": true
        }
    ]
}
```

### POST `/connection/test`

Test database connection connectivity.

**Request Body:**
```json
{
    "connection_id": "conn_abc123"
}
```

**Response:**
```json
{
    "status": "ok",
    "connection_time_ms": 245,
    "database_version": "PostgreSQL 13.7",
    "is_accessible": true
}
```

### GET `/connection/{connection_key}/tables`

List tables for a specific connection.

**Query Parameters:**
- `type` (optional): `table` or `view` (default: `table`)

**Response:**
```json
{
    "status": "ok",
    "tables": [
        {
            "table_name": "users",
            "table_type": "BASE TABLE"
        },
        {
            "table_name": "orders",
            "table_type": "BASE TABLE"
        }
    ]
}
```

### GET `/connection/{connection_key}/columns/{table_name}`

List columns for a specific table.

**Response:**
```json
{
    "status": "ok",
    "table_name": "users",
    "columns": [
        {
            "column_name": "id",
            "data_type": "integer",
            "is_nullable": false,
            "column_default": "nextval('users_id_seq'::regclass)",
            "is_primary_key": true
        },
        {
            "column_name": "email",
            "data_type": "character varying(255)",
            "is_nullable": false,
            "column_default": null,
            "is_primary_key": false
        }
    ]
}
```

### GET `/connection/export`

Export connections for backup or migration.

**Query Parameters:**
- `password` (optional): Export password (uses default if not provided)

**Response:**
```json
{
    "status": "ok",
    "connections": [
        {
            "connection_key": "conn_123",
            "name": "Production Database",
            "sql": {
                // Encrypted connection parameters
            }
        }
    ]
}
```

## Query Management

### POST `/query/add`

Create a new SQL query.

**Request Body:**
```json
{
    "connection_id": "conn_abc123",
    "name": "Active Users Report",
    "query": "SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC"
}
```

**Response:**
```json
{
    "status": "ok",
    "query_key": "query_def456ghi789"
}
```

### POST `/query/edit`

Edit an existing query.

**Request Body:**
```json
{
    "query_id": "query_def456",
    "name": "Updated Query Name",
    "query": "SELECT * FROM users WHERE status = 'active' LIMIT 100",
    "new_query_key": "query_new123"
}
```

**Response:**
```json
{
    "status": "ok"
}
```

### GET `/query/delete`

Delete a query and associated data.

**Query Parameters:**
- `query_id`: Query identifier to delete

**Response:**
```json
{
    "status": "ok"
}
```

### GET `/query/list`

List all available queries.

**Response:**
```json
{
    "status": "ok",
    "queries": [
        {
            "name": "Active Users Report",
            "query_key": "query_def456",
            "query": "SELECT * FROM users WHERE status = 'active'",
            "connection_name": "Production PostgreSQL",
            "connection_key": "conn_abc123"
        }
    ]
}
```

### POST `/query/{query_key}/run`

Execute a query and return results.

**Request Body:**
```json
{
    "limit": 1000,
    "offset": 0,
    "format": "json"
}
```

**Response:**
```json
{
    "status": "ok",
    "query_key": "query_def456",
    "execution_time_ms": 245,
    "row_count": 150,
    "columns": [
        {"name": "id", "type": "integer"},
        {"name": "email", "type": "varchar"},
        {"name": "status", "type": "varchar"},
        {"name": "created_at", "type": "timestamp"}
    ],
    "data": [
        [1, "user1@example.com", "active", "2024-01-15T10:30:00Z"],
        [2, "user2@example.com", "active", "2024-01-16T14:20:00Z"]
    ],
    "has_more": true
}
```

**Supported Formats:**
- `json` (default): JSON array format
- `csv`: Comma-separated values
- `excel`: Excel spreadsheet format

### GET `/query/{query_key}/export`

Export query results to various formats.

**Query Parameters:**
- `format`: `csv`, `excel`, `json` (default: `csv`)
- `limit`: Maximum rows to export (default: all)

**Response:** File download with appropriate content type

### POST `/query/{query_key}/fields/add`

Add field metadata to a query.

**Request Body:**
```json
{
    "field_name": "user_id",
    "field_type": "integer",
    "description": "Unique user identifier",
    "is_key": true
}
```

### GET `/query/{query_key}/fields`

Get field metadata for a query.

**Response:**
```json
{
    "status": "ok",
    "query_key": "query_def456",
    "fields": [
        {
            "field_name": "user_id",
            "field_type": "integer",
            "description": "Unique user identifier",
            "is_key": true
        }
    ]
}
```

## Data Model Management

### GET `/data-model/list`

List available data models.

**Response:**
```json
{
    "status": "ok",
    "models": [
        {
            "model_id": "model_123",
            "name": "E-commerce Schema",
            "connection_name": "Production Database",
            "table_count": 8,
            "created_at": "2024-09-13T10:00:00Z"
        }
    ]
}
```

### GET `/data-model/{connection_key}/tables`

Get table list for data modeling.

**Response:**
```json
{
    "status": "ok",
    "tables": [
        {
            "table_name": "users",
            "row_count": 1250,
            "has_primary_key": true
        },
        {
            "table_name": "orders", 
            "row_count": 5678,
            "has_primary_key": true
        }
    ]
}
```

### GET `/data-model/{connection_key}/schema`

Get complete database schema.

**Response:**
```json
{
    "status": "ok",
    "schema": {
        "tables": [
            {
                "table_name": "users",
                "columns": [
                    {"name": "id", "type": "integer", "primary_key": true},
                    {"name": "email", "type": "varchar(255)", "nullable": false}
                ],
                "indexes": [
                    {"name": "users_email_idx", "columns": ["email"], "unique": true}
                ]
            }
        ],
        "views": [],
        "relationships": [
            {
                "from_table": "orders",
                "from_column": "user_id", 
                "to_table": "users",
                "to_column": "id",
                "relationship_type": "many_to_one"
            }
        ]
    }
}
```

### POST `/data-model/{connection_key}/analyze`

Analyze database structure and relationships.

**Request Body:**
```json
{
    "include_tables": ["users", "orders", "products"],
    "analyze_relationships": true,
    "include_statistics": true
}
```

**Response:**
```json
{
    "status": "ok",
    "analysis": {
        "tables_analyzed": 3,
        "relationships_found": 2,
        "potential_issues": [],
        "recommendations": [
            "Consider adding index on orders.created_at for better performance"
        ]
    }
}
```

### POST `/data-model/{connection_key}/generate`

Generate data model documentation.

**Request Body:**
```json
{
    "format": "markdown",
    "include_relationships": true,
    "include_sample_data": false
}
```

**Response:** Generated documentation file download

## File Services

### POST `/files/upload`

Upload files for processing or querying.

**Request:** Multipart form data with file

**Response:**
```json
{
    "status": "ok",
    "file_id": "file_xyz789",
    "filename": "sales_data.csv",
    "size_bytes": 1048576,
    "mime_type": "text/csv",
    "detected_format": "csv",
    "columns": [
        {"name": "product_id", "type": "integer"},
        {"name": "sales_amount", "type": "decimal"}
    ],
    "row_count": 10000
}
```

### GET `/files/{file_id}/info`

Get file information and metadata.

**Response:**
```json
{
    "status": "ok",
    "file_id": "file_xyz789",
    "filename": "sales_data.csv",
    "size_bytes": 1048576,
    "uploaded_at": "2024-09-13T11:00:00Z",
    "format": "csv",
    "columns": 8,
    "rows": 10000
}
```

### POST `/files/{file_id}/query`

Execute SQL queries against uploaded files.

**Request Body:**
```json
{
    "sql": "SELECT product_category, SUM(sales_amount) as total_sales FROM file GROUP BY product_category ORDER BY total_sales DESC",
    "limit": 100
}
```

**Response:**
```json
{
    "status": "ok",
    "execution_time_ms": 150,
    "columns": [
        {"name": "product_category", "type": "varchar"},
        {"name": "total_sales", "type": "decimal"}
    ],
    "data": [
        ["Electronics", 125000.50],
        ["Clothing", 98500.25]
    ]
}
```

### GET `/files/{file_id}/download`

Download original file or query results.

**Query Parameters:**
- `format` (optional): `original`, `csv`, `json`, `excel`

**Response:** File stream with appropriate headers

## System Endpoints

### GET `/ping`

Health check endpoint.

**Response:**
```json
{
    "status": "ok"
}
```

### GET `/version`

Get service version information.

**Response:**
```json
{
    "version": "0.11.1",
    "build_date": "2024-09-13",
    "python_version": "3.9.7"
}
```

### GET `/config`

Get current service configuration.

**Response:**
```json
{
    "query_timeout": 72000,
    "query_max_rows": 1000000,
    "query_bundle_rows": 10000,
    "host": "127.0.0.1",
    "port": 55080,
    "uvicorn_workers": 3,
    "connection_timeout": 1000
}
```

### GET `/logs`

Get recent system logs.

**Query Parameters:**
- `level` (optional): `debug`, `info`, `warning`, `error`
- `limit` (optional): Maximum log entries (default: 100)

**Response:**
```json
{
    "status": "ok",
    "logs": [
        {
            "timestamp": "2024-09-13T12:00:00Z",
            "level": "info",
            "message": "Query executed successfully",
            "context": {
                "query_id": "query_123",
                "execution_time_ms": 245
            }
        }
    ]
}
```

### GET `/mainfolder`

Get main data folder path.

**Response:**
```json
{
    "path": "/opt/xldb/data"
}
```

## XMLA/OLAP Endpoints

### POST `/xmla`

XMLA SOAP endpoint for OLAP operations.

**Request:** SOAP envelope with XMLA request

**Content-Type:** `text/xml` or `application/soap+xml`

**Example Request:**
```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <Discover xmlns="urn:schemas-microsoft-com:xml-analysis">
            <RequestType>DISCOVER_DATASOURCES</RequestType>
            <Restrictions />
            <Properties />
        </Discover>
    </soap:Body>
</soap:Envelope>
```

**Response:** SOAP envelope with XMLA response

### Supported XMLA Operations

- **DISCOVER_DATASOURCES**: List available data sources
- **DISCOVER_SCHEMA_ROWSETS**: List available schema rowsets  
- **DISCOVER_KEYWORDS**: List MDX keywords
- **DISCOVER_CUBES**: List available cubes
- **DISCOVER_DIMENSIONS**: List cube dimensions
- **DISCOVER_MEASURES**: List cube measures
- **Execute**: Execute MDX queries

## Error Codes

### Connection Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| CONNECTION_NOT_FOUND | 404 | Database connection not found |
| CONNECTION_FAILED | 500 | Failed to establish database connection |
| CONNECTION_TIMEOUT | 408 | Database connection timeout |
| AUTHENTICATION_FAILED | 401 | Database authentication failed |
| CONNECTION_EXISTS | 400 | Connection already exists |

### Query Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| QUERY_NOT_FOUND | 404 | Query not found |
| QUERY_EXECUTION_FAILED | 500 | Query execution failed |
| INVALID_SQL | 400 | Invalid SQL syntax |
| QUERY_TIMEOUT | 408 | Query execution timeout |
| QUERY_EXISTS | 400 | Query name already exists |

### File Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| FILE_NOT_FOUND | 404 | File not found |
| FILE_TOO_LARGE | 413 | File size exceeds limit |
| INVALID_FILE_FORMAT | 400 | Unsupported file format |
| FILE_PROCESSING_FAILED | 500 | File processing error |

### System Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INTERNAL_ERROR | 500 | Internal server error |
| VALIDATION_ERROR | 400 | Request validation failed |
| NOT_IMPLEMENTED | 501 | Feature not implemented |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

## Rate Limits

Rate limits are applied per IP address:

| Endpoint Category | Limit |
|-------------------|-------|
| Connection Management | 10 requests/minute |
| Query Execution | 100 requests/minute |
| File Upload | 5 requests/minute |
| System Endpoints | 60 requests/minute |

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Time when limit resets

## Request Examples

### Using cURL

```bash
# Create connection
curl -X POST "http://localhost:55080/connection/add" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test PostgreSQL",
    "sql": {
      "engine_type": "postgres",
      "dbms_host": "localhost",
      "dbms_port": 5432,
      "database": "testdb",
      "user": "testuser",
      "password": "testpass"
    }
  }'

# Create and execute query
curl -X POST "http://localhost:55080/query/add" \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "conn_abc123",
    "name": "User Count",
    "query": "SELECT COUNT(*) as user_count FROM users"
  }'

# Run query
curl -X POST "http://localhost:55080/query/query_def456/run" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100, "format": "json"}'
```

### Using Python

```python
import requests
import json

# API base URL
base_url = "http://localhost:55080"

# Create connection
connection_data = {
    "name": "Test Database",
    "sql": {
        "engine_type": "postgres",
        "dbms_host": "localhost",
        "dbms_port": 5432,
        "database": "testdb",
        "user": "testuser",
        "password": "testpass"
    }
}

response = requests.post(
    f"{base_url}/connection/add",
    json=connection_data
)
connection_result = response.json()
connection_key = connection_result["connection_key"]

# Create query
query_data = {
    "connection_id": connection_key,
    "name": "Sample Query",
    "query": "SELECT * FROM users LIMIT 10"
}

response = requests.post(
    f"{base_url}/query/add",
    json=query_data
)
query_result = response.json()
query_key = query_result["query_key"]

# Execute query
response = requests.post(
    f"{base_url}/query/{query_key}/run",
    json={"limit": 10, "format": "json"}
)
results = response.json()
print(f"Found {results['row_count']} rows")
```

This API reference provides comprehensive documentation for all available endpoints in the XLDB Proxy service, enabling developers to integrate database operations into their applications efficiently and securely.