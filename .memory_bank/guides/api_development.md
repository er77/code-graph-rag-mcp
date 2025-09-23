# API Development Guide

## Overview

This guide provides comprehensive instructions for developing FastAPI endpoints and related components in the xldb_proxy system. It covers API design patterns, request/response models, dependency injection, and integration with the database engine system.

## API Architecture

### FastAPI Structure
```
main.py                 # Application entry point and configuration
api/
├── connection.py       # Connection management endpoints
├── query.py           # Query execution endpoints  
├── data_model.py      # Data modeling endpoints
├── file_service_router.py # File operations
└── dependencies.py    # Dependency injection utilities
models/
├── connection.py      # Connection data models
├── query.py          # Query data models
└── data_model.py     # Data modeling structures
```

### Design Principles
- RESTful resource-based URLs
- Consistent request/response patterns
- Proper HTTP status codes
- Comprehensive error handling
- Dependency injection for reusable components

## Development Process

### Phase 1: API Design

#### 1.1 Resource Identification
```python
# Identify the primary resource
RESOURCE: connections
OPERATIONS: CREATE, READ, UPDATE, DELETE, LIST
RELATIONSHIPS: connections -> queries -> results

# Define URL patterns
GET    /connections           # List all connections
POST   /connections           # Create new connection
GET    /connections/{id}      # Get specific connection
PUT    /connections/{id}      # Update connection
DELETE /connections/{id}      # Delete connection
POST   /connections/{id}/check # Test connection
```

#### 1.2 Request/Response Design
```python
# Request models
class ConnectionCreateRequest(BaseModel):
    name: str
    engine: str
    sql: SQLConnectionParams
    
class ConnectionUpdateRequest(BaseModel):
    name: Optional[str] = None
    sql: Optional[SQLConnectionParams] = None

# Response models  
class ConnectionResponse(BaseModel):
    id: str
    name: str
    engine: str
    created_at: datetime
    updated_at: datetime
    
class ConnectionListResponse(BaseModel):
    connections: List[ConnectionResponse]
    total: int
```

### Phase 2: Model Implementation

#### 2.1 Pydantic Models
```python
# models/api_models.py
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class SQLConnectionParams(BaseModel):
    """SQL connection parameters with validation"""
    dbms_host: str = Field(..., description="Database host")
    dbms_port: Optional[int] = Field(None, description="Database port")
    user: str = Field(..., description="Username")
    password: Optional[str] = Field(None, description="Password")
    database: Optional[str] = Field(None, description="Database name")
    db_schema: Optional[str] = Field(None, description="Schema name")
    ssl_enabled: Optional[bool] = Field(False, description="Enable SSL")
    
    @validator('dbms_port')
    def validate_port(cls, v):
        if v is not None and (v < 1 or v > 65535):
            raise ValueError('Port must be between 1 and 65535')
        return v

class ConnectionBase(BaseModel):
    """Base connection model"""
    name: str = Field(..., min_length=1, max_length=100)
    engine: str = Field(..., description="Database engine type")
    sql: SQLConnectionParams
    
    @validator('engine')
    def validate_engine(cls, v):
        from models.connection import Connection
        if v not in Connection._engines:
            available = list(Connection._engines.keys())
            raise ValueError(f'Engine "{v}" not supported. Available: {available}')
        return v

class ConnectionCreate(ConnectionBase):
    """Connection creation request"""
    pass

class ConnectionUpdate(BaseModel):
    """Connection update request"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    sql: Optional[SQLConnectionParams] = None

class ConnectionResponse(ConnectionBase):
    """Connection response model"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

#### 2.2 Response Wrappers
```python
# models/responses.py
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, List

T = TypeVar('T')

class SuccessResponse(BaseModel, Generic[T]):
    """Standard success response wrapper"""
    success: bool = True
    data: T
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    """Standard error response"""
    success: bool = False
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None

class ListResponse(BaseModel, Generic[T]):
    """Paginated list response"""
    items: List[T]
    total: int
    page: int = 1
    size: int = 50
    pages: int
```

### Phase 3: Router Implementation

#### 3.1 Basic Router Structure
```python
# api/example_router.py
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import List, Optional
import logging

from models.api_models import *
from models.responses import *
from api.dependencies import get_connection, get_query
from state_database import StateDatabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["example"])

@router.get("/resources", response_model=SuccessResponse[ListResponse[ResourceResponse]])
async def list_resources(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None)
):
    """List resources with pagination and search"""
    try:
        # Implementation logic
        resources = await get_resources(page, size, search)
        
        return SuccessResponse(
            data=ListResponse(
                items=resources.items,
                total=resources.total,
                page=page,
                size=size,
                pages=(resources.total + size - 1) // size
            )
        )
        
    except Exception as e:
        logger.error(f"Failed to list resources: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### 3.2 CRUD Operations
```python
@router.post("/connections", response_model=SuccessResponse[ConnectionResponse])
async def create_connection(request: ConnectionCreate):
    """Create a new database connection"""
    try:
        # Validate engine availability
        from models.connection import Connection
        if request.engine not in Connection._engines:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported engine: {request.engine}"
            )
        
        # Create connection record
        state_db = StateDatabase()
        connection_id = state_db.create_connection(
            name=request.name,
            engine=request.engine,
            params=request.sql.dict()
        )
        
        # Test connection
        connection = Connection.from_id(connection_id)
        connection.open()
        connection.close()
        
        # Return response
        created_connection = state_db.get_connection(connection_id)
        return SuccessResponse(
            data=ConnectionResponse(**created_connection),
            message="Connection created successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to create connection: {e}")
        if "Connection failed" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/connections/{connection_id}", response_model=SuccessResponse[ConnectionResponse])
async def get_connection(connection_id: str):
    """Get connection by ID"""
    try:
        state_db = StateDatabase()
        connection_data = state_db.get_connection(connection_id)
        
        if not connection_data:
            raise HTTPException(status_code=404, detail="Connection not found")
            
        return SuccessResponse(data=ConnectionResponse(**connection_data))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/connections/{connection_id}", response_model=SuccessResponse[ConnectionResponse])
async def update_connection(connection_id: str, request: ConnectionUpdate):
    """Update existing connection"""
    try:
        state_db = StateDatabase()
        
        # Check if connection exists
        existing = state_db.get_connection(connection_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Prepare update data
        update_data = {}
        if request.name is not None:
            update_data['name'] = request.name
        if request.sql is not None:
            update_data['params'] = request.sql.dict()
        
        # Update connection
        state_db.update_connection(connection_id, update_data)
        
        # Test updated connection if params changed
        if request.sql is not None:
            connection = Connection.from_id(connection_id)
            connection.open()
            connection.close()
        
        # Return updated connection
        updated_connection = state_db.get_connection(connection_id)
        return SuccessResponse(
            data=ConnectionResponse(**updated_connection),
            message="Connection updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/connections/{connection_id}")
async def delete_connection(connection_id: str):
    """Delete connection"""
    try:
        state_db = StateDatabase()
        
        # Check if connection exists
        if not state_db.get_connection(connection_id):
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Delete connection
        state_db.delete_connection(connection_id)
        
        return SuccessResponse(
            data=None,
            message="Connection deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete connection {connection_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

#### 3.3 Custom Operations
```python
@router.post("/connections/{connection_id}/check")
async def check_connection(connection_id: str = Depends(get_connection)):
    """Test database connection"""
    try:
        connection = Connection.from_id(connection_id)
        connection.open()
        
        # Execute connection check query
        result = connection.exec(connection.check_query())
        connection.close()
        
        return SuccessResponse(
            data={"status": "connected", "result": result},
            message="Connection test successful"
        )
        
    except Exception as e:
        logger.error(f"Connection check failed for {connection_id}: {e}")
        raise HTTPException(
            status_code=503, 
            detail=f"Connection test failed: {str(e)}"
        )

@router.get("/connections/{connection_id}/tables")
async def list_tables(
    connection_id: str = Depends(get_connection),
    is_admin: bool = Query(False)
):
    """List tables in database"""
    try:
        connection = Connection.from_id(connection_id)
        connection.open()
        
        # Execute tables query
        tables_sql = connection.tables_query(is_admin)
        tables = connection.exec(tables_sql)
        
        connection.close()
        
        return SuccessResponse(
            data={"tables": tables},
            message=f"Found {len(tables)} tables"
        )
        
    except Exception as e:
        logger.error(f"Failed to list tables for {connection_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Phase 4: Dependency Injection

#### 4.1 Common Dependencies
```python
# api/dependencies.py
from fastapi import HTTPException, Depends, Path
from typing import Optional
from state_database import StateDatabase
from models.connection import Connection
from models.query import Query

async def get_state_db() -> StateDatabase:
    """Get StateDatabase instance"""
    return StateDatabase()

async def get_connection_id(connection_id: str = Path(...)) -> str:
    """Validate and return connection ID"""
    if not connection_id:
        raise HTTPException(status_code=400, detail="Connection ID required")
    return connection_id

async def get_connection(
    connection_id: str = Depends(get_connection_id),
    state_db: StateDatabase = Depends(get_state_db)
) -> str:
    """Validate connection exists and return ID"""
    connection_data = state_db.get_connection(connection_id)
    if not connection_data:
        raise HTTPException(status_code=404, detail="Connection not found")
    return connection_id

async def get_query(
    query_id: str = Path(...),
    state_db: StateDatabase = Depends(get_state_db)
) -> str:
    """Validate query exists and return ID"""
    query_data = state_db.get_query(query_id)
    if not query_data:
        raise HTTPException(status_code=404, detail="Query not found")
    return query_id

async def get_connection_instance(
    connection_id: str = Depends(get_connection)
) -> Connection:
    """Get Connection instance"""
    try:
        return Connection.from_id(connection_id)
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create connection instance: {str(e)}"
        )
```

#### 4.2 Authentication Dependencies
```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Validate JWT token and return user info"""
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"username": username, "permissions": payload.get("permissions", [])}
        
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require admin permissions"""
    if "admin" not in current_user.get("permissions", []):
        raise HTTPException(status_code=403, detail="Admin permissions required")
    return current_user
```

### Phase 5: Error Handling

#### 5.1 Global Exception Handlers
```python
# main.py - Application setup
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

app = FastAPI()

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent format"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "code": exc.status_code
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "Validation error",
            "detail": exc.errors()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error"
        }
    )
```

#### 5.2 Custom Exceptions
```python
# exceptions.py
class XldbProxyException(Exception):
    """Base exception for xldb_proxy"""
    def __init__(self, message: str, code: str = None):
        self.message = message
        self.code = code
        super().__init__(message)

class ConnectionError(XldbProxyException):
    """Database connection related errors"""
    pass

class QueryExecutionError(XldbProxyException):
    """Query execution related errors"""
    pass

class ValidationError(XldbProxyException):
    """Input validation errors"""
    pass
```

### Phase 6: Testing

#### 6.1 Test Structure
```python
# tests/api/test_connections.py
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.fixture
def sample_connection_data():
    return {
        "name": "test_connection",
        "engine": "sqlite",
        "sql": {
            "dbms_host": ":memory:",
            "user": "test"
        }
    }

def test_create_connection(sample_connection_data):
    """Test connection creation"""
    response = client.post("/connections", json=sample_connection_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["success"] is True
    assert data["data"]["name"] == sample_connection_data["name"]
    assert data["data"]["engine"] == sample_connection_data["engine"]

def test_get_connection(sample_connection_data):
    """Test getting connection by ID"""
    # Create connection
    create_response = client.post("/connections", json=sample_connection_data)
    connection_id = create_response.json()["data"]["id"]
    
    # Get connection
    response = client.get(f"/connections/{connection_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["success"] is True
    assert data["data"]["id"] == connection_id

def test_connection_not_found():
    """Test getting non-existent connection"""
    response = client.get("/connections/non-existent-id")
    assert response.status_code == 404
    
    data = response.json()
    assert data["success"] is False
    assert "not found" in data["error"].lower()
```

#### 6.2 Integration Tests
```python
def test_full_connection_workflow(sample_connection_data):
    """Test complete connection CRUD workflow"""
    # Create
    create_response = client.post("/connections", json=sample_connection_data)
    assert create_response.status_code == 200
    connection_id = create_response.json()["data"]["id"]
    
    # Read
    get_response = client.get(f"/connections/{connection_id}")
    assert get_response.status_code == 200
    
    # Update
    update_data = {"name": "updated_connection"}
    update_response = client.put(f"/connections/{connection_id}", json=update_data)
    assert update_response.status_code == 200
    assert update_response.json()["data"]["name"] == "updated_connection"
    
    # Check connection
    check_response = client.post(f"/connections/{connection_id}/check")
    assert check_response.status_code == 200
    
    # Delete
    delete_response = client.delete(f"/connections/{connection_id}")
    assert delete_response.status_code == 200
    
    # Verify deletion
    get_response = client.get(f"/connections/{connection_id}")
    assert get_response.status_code == 404
```

## Quality Guidelines

### API Design
- Use clear, resource-based URLs
- Implement proper HTTP status codes
- Provide comprehensive error messages
- Support pagination for list endpoints
- Include filtering and search capabilities

### Request/Response Models
- Use Pydantic for validation
- Provide clear field descriptions
- Implement proper validation rules
- Use consistent naming conventions
- Include example values in documentation

### Error Handling
- Use appropriate HTTP status codes
- Provide helpful error messages
- Log errors for debugging
- Never expose sensitive information
- Include error codes for client handling

### Testing
- Test all CRUD operations
- Test error scenarios
- Test validation rules
- Include integration tests
- Test authentication and authorization

### Documentation
- Use FastAPI automatic documentation
- Provide endpoint descriptions
- Include request/response examples
- Document authentication requirements
- Explain error codes

---

*This guide ensures consistent, high-quality API development that integrates seamlessly with the xldb_proxy architecture and provides excellent developer experience.*