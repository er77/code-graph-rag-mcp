# Testing Strategy Guide

## Overview

This guide defines the comprehensive testing strategy for xldb_proxy, covering unit tests, integration tests, API tests, and database engine testing. It provides frameworks, patterns, and best practices for ensuring code quality and reliability.

## Testing Architecture

### Test Organization
```
tests/
├── unit/                    # Unit tests
│   ├── test_connection.py   # Connection model tests
│   ├── test_query.py        # Query model tests
│   └── test_state_db.py     # StateDatabase tests
├── integration/             # Integration tests
│   ├── test_engines/        # Database engine tests
│   ├── test_api/           # API endpoint tests
│   └── test_workflows/      # End-to-end workflows
├── fixtures/               # Test data and fixtures
├── conftest.py             # Pytest configuration
└── README.md               # Testing documentation
```

### Test Categories

#### 1. Unit Tests
**Scope**: Individual functions and classes
**Purpose**: Verify isolated component behavior
**Tools**: pytest, unittest.mock
**Coverage Target**: 90%+

#### 2. Integration Tests
**Scope**: Component interactions
**Purpose**: Verify system integration
**Tools**: pytest, TestClient
**Coverage Target**: Critical paths

#### 3. API Tests
**Scope**: HTTP endpoints
**Purpose**: Verify API contracts
**Tools**: FastAPI TestClient
**Coverage Target**: All endpoints

#### 4. Database Engine Tests
**Scope**: SQL engine implementations
**Purpose**: Verify database connectivity
**Tools**: pytest with real databases
**Coverage Target**: All supported engines

## Testing Framework Setup

### conftest.py Configuration
```python
# tests/conftest.py
import pytest
import tempfile
import os
from fastapi.testclient import TestClient
from typing import Dict, Any

from main import app
from state_database import StateDatabase
from models.connection import Connection

@pytest.fixture(scope="session")
def test_app():
    """FastAPI test application"""
    return TestClient(app)

@pytest.fixture
def temp_state_db():
    """Temporary StateDatabase for testing"""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
        tmp_path = tmp.name
    
    # Override StateDatabase path
    original_path = StateDatabase._db_path
    StateDatabase._db_path = tmp_path
    
    # Initialize test database
    state_db = StateDatabase()
    yield state_db
    
    # Cleanup
    StateDatabase._db_path = original_path
    os.unlink(tmp_path)

@pytest.fixture
def sample_connection_params():
    """Sample connection parameters for testing"""
    return {
        "name": "test_connection",
        "engine": "sqlite",
        "sql": {
            "dbms_host": ":memory:",
            "user": "test",
            "database": "test"
        }
    }

@pytest.fixture
def mock_connection(sample_connection_params):
    """Mock connection instance"""
    return Connection.create(**sample_connection_params)

# Database-specific fixtures
@pytest.fixture
def sqlite_params():
    return {
        "engine": "sqlite",
        "sql": {
            "dbms_host": ":memory:",
            "user": "test"
        }
    }

@pytest.fixture
def mysql_params():
    return {
        "engine": "mysql",
        "sql": {
            "dbms_host": os.getenv("MYSQL_HOST", "localhost"),
            "dbms_port": int(os.getenv("MYSQL_PORT", "3306")),
            "user": os.getenv("MYSQL_USER", "test"),
            "password": os.getenv("MYSQL_PASSWORD", "test"),
            "database": os.getenv("MYSQL_DATABASE", "test")
        }
    }

@pytest.fixture
def postgresql_params():
    return {
        "engine": "postgresql", 
        "sql": {
            "dbms_host": os.getenv("POSTGRES_HOST", "localhost"),
            "dbms_port": int(os.getenv("POSTGRES_PORT", "5432")),
            "user": os.getenv("POSTGRES_USER", "test"),
            "password": os.getenv("POSTGRES_PASSWORD", "test"),
            "database": os.getenv("POSTGRES_DATABASE", "test")
        }
    }

# Parametrized engine testing
DATABASE_ENGINES = [
    "sqlite",
    pytest.param("mysql", marks=pytest.mark.skipif(
        not os.getenv("MYSQL_HOST"), reason="MySQL not configured"
    )),
    pytest.param("postgresql", marks=pytest.mark.skipif(
        not os.getenv("POSTGRES_HOST"), reason="PostgreSQL not configured"
    )),
]

@pytest.fixture(params=DATABASE_ENGINES)
def engine_params(request, sqlite_params, mysql_params, postgresql_params):
    """Parametrized database engine parameters"""
    engine_map = {
        "sqlite": sqlite_params,
        "mysql": mysql_params,
        "postgresql": postgresql_params
    }
    return engine_map[request.param]
```

### Pytest Configuration
```ini
# pytest.ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -v
    --tb=short
    --strict-markers
    --disable-warnings
    --cov=.
    --cov-report=term-missing
    --cov-report=html:htmlcov
    --cov-fail-under=80

markers =
    unit: Unit tests
    integration: Integration tests
    api: API tests
    database: Database tests
    slow: Slow running tests
    skipif: Skip test conditionally
```

## Unit Testing Patterns

### Connection Model Tests
```python
# tests/unit/test_connection.py
import pytest
from unittest.mock import Mock, patch
from models.connection import Connection
from exceptions import ConnectionError

class TestConnection:
    """Unit tests for Connection model"""
    
    def test_connection_creation(self, sample_connection_params):
        """Test connection instance creation"""
        conn = Connection.create(**sample_connection_params)
        assert conn.name == sample_connection_params["name"]
        assert conn.engine == sample_connection_params["engine"]
        
    def test_connection_validation(self):
        """Test connection parameter validation"""
        with pytest.raises(ValueError):
            Connection.create(
                name="",  # Empty name should fail
                engine="sqlite",
                sql={"dbms_host": ":memory:"}
            )
    
    def test_engine_registration(self):
        """Test engine auto-registration"""
        assert "sqlite" in Connection._engines
        assert "mysql" in Connection._engines
        assert "postgresql" in Connection._engines
    
    @patch('sqlengines.sqlite.sqlite3.connect')
    def test_connection_open_close(self, mock_connect, sample_connection_params):
        """Test connection open and close operations"""
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        
        conn = Connection.create(**sample_connection_params)
        conn.open()
        
        assert conn.connection == mock_conn
        assert conn.cursor == mock_cursor
        mock_connect.assert_called_once()
        
        conn.close()
        mock_cursor.close.assert_called_once()
        mock_conn.close.assert_called_once()
```

### Query Model Tests
```python
# tests/unit/test_query.py
import pytest
from models.query import Query
from models.connection import Connection

class TestQuery:
    """Unit tests for Query model"""
    
    def test_query_creation(self, mock_connection):
        """Test query instance creation"""
        query = Query.create(
            connection=mock_connection,
            sql="SELECT 1",
            name="test_query"
        )
        assert query.sql == "SELECT 1"
        assert query.name == "test_query"
        assert query.connection == mock_connection
    
    def test_query_validation(self, mock_connection):
        """Test query SQL validation"""
        with pytest.raises(ValueError):
            Query.create(
                connection=mock_connection,
                sql="",  # Empty SQL should fail
                name="test_query"
            )
    
    @patch('models.query.Query.execute')
    def test_query_execution(self, mock_execute, mock_connection):
        """Test query execution"""
        mock_execute.return_value = [{"result": 1}]
        
        query = Query.create(
            connection=mock_connection,
            sql="SELECT 1",
            name="test_query"
        )
        
        result = query.execute()
        assert result == [{"result": 1}]
        mock_execute.assert_called_once()
```

### StateDatabase Tests
```python
# tests/unit/test_state_database.py
import pytest
from state_database import StateDatabase

class TestStateDatabase:
    """Unit tests for StateDatabase"""
    
    def test_connection_crud(self, temp_state_db, sample_connection_params):
        """Test connection CRUD operations"""
        # Create
        conn_id = temp_state_db.create_connection(**sample_connection_params)
        assert conn_id is not None
        
        # Read
        conn_data = temp_state_db.get_connection(conn_id)
        assert conn_data["name"] == sample_connection_params["name"]
        assert conn_data["engine"] == sample_connection_params["engine"]
        
        # Update
        temp_state_db.update_connection(conn_id, {"name": "updated_name"})
        updated_data = temp_state_db.get_connection(conn_id)
        assert updated_data["name"] == "updated_name"
        
        # Delete
        temp_state_db.delete_connection(conn_id)
        deleted_data = temp_state_db.get_connection(conn_id)
        assert deleted_data is None
        
    def test_query_crud(self, temp_state_db, sample_connection_params):
        """Test query CRUD operations"""
        # Create connection first
        conn_id = temp_state_db.create_connection(**sample_connection_params)
        
        # Create query
        query_data = {
            "connection_id": conn_id,
            "sql": "SELECT 1",
            "name": "test_query"
        }
        query_id = temp_state_db.create_query(**query_data)
        assert query_id is not None
        
        # Read query
        query_result = temp_state_db.get_query(query_id)
        assert query_result["sql"] == "SELECT 1"
        assert query_result["connection_id"] == conn_id
```

## Integration Testing Patterns

### Database Engine Tests
```python
# tests/integration/test_engines/test_sqlite.py
import pytest
from models.connection import Connection

class TestSQLiteEngine:
    """Integration tests for SQLite engine"""
    
    def test_sqlite_connection(self, sqlite_params):
        """Test SQLite connection establishment"""
        conn = Connection.create(**sqlite_params)
        conn.open()
        
        assert conn.connection is not None
        assert conn.cursor is not None
        
        conn.close()
    
    def test_sqlite_query_execution(self, sqlite_params):
        """Test SQLite query execution"""
        conn = Connection.create(**sqlite_params)
        conn.open()
        
        # Create test table
        conn.exec("CREATE TABLE test_table (id INTEGER, name TEXT)")
        conn.exec("INSERT INTO test_table VALUES (1, 'test')")
        
        # Query data
        result = conn.exec("SELECT * FROM test_table")
        assert len(result) == 1
        assert result[0]["id"] == 1
        assert result[0]["name"] == "test"
        
        conn.close()
    
    def test_sqlite_metadata(self, sqlite_params):
        """Test SQLite metadata queries"""
        conn = Connection.create(**sqlite_params)
        conn.open()
        
        # Create test table
        conn.exec("CREATE TABLE test_table (id INTEGER, name TEXT)")
        
        # Test tables query
        tables_sql = conn.tables_query(is_admin=True)
        tables = conn.exec(tables_sql)
        
        table_names = [t["name"] for t in tables]
        assert "test_table" in table_names
        
        # Test fields query
        fields_sql = conn.fields_query(True, "test_table", "table")
        fields = conn.exec(fields_sql)
        
        field_names = [f["name"] for f in fields]
        assert "id" in field_names
        assert "name" in field_names
        
        conn.close()

# Parametrized tests for multiple engines
@pytest.mark.database
class TestAllEngines:
    """Test all database engines with same test patterns"""
    
    def test_basic_connection(self, engine_params):
        """Test basic connection for all engines"""
        conn = Connection.create(**engine_params)
        conn.open()
        
        # Test connection check
        check_result = conn.exec(conn.check_query())
        assert len(check_result) >= 1
        
        conn.close()
    
    def test_metadata_discovery(self, engine_params):
        """Test metadata discovery for all engines"""
        conn = Connection.create(**engine_params)
        conn.open()
        
        # Test tables query
        tables_sql = conn.tables_query(is_admin=True)
        assert "table" in tables_sql.lower()
        
        # Test views query  
        views_sql = conn.views_query(is_admin=True)
        assert "view" in views_sql.lower()
        
        conn.close()
```

### API Integration Tests
```python
# tests/integration/test_api/test_connection_api.py
import pytest
from fastapi.testclient import TestClient

class TestConnectionAPI:
    """Integration tests for connection API"""
    
    def test_connection_lifecycle(self, test_app, sample_connection_params):
        """Test complete connection lifecycle through API"""
        # Create connection
        response = test_app.post("/connections", json=sample_connection_params)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        connection_id = data["data"]["id"]
        
        # Get connection
        response = test_app.get(f"/connections/{connection_id}")
        assert response.status_code == 200
        assert response.json()["data"]["name"] == sample_connection_params["name"]
        
        # Test connection
        response = test_app.post(f"/connections/{connection_id}/check")
        assert response.status_code == 200
        assert response.json()["data"]["status"] == "connected"
        
        # List tables
        response = test_app.get(f"/connections/{connection_id}/tables")
        assert response.status_code == 200
        
        # Update connection
        update_data = {"name": "updated_connection"}
        response = test_app.put(f"/connections/{connection_id}", json=update_data)
        assert response.status_code == 200
        assert response.json()["data"]["name"] == "updated_connection"
        
        # Delete connection
        response = test_app.delete(f"/connections/{connection_id}")
        assert response.status_code == 200
        
        # Verify deletion
        response = test_app.get(f"/connections/{connection_id}")
        assert response.status_code == 404
    
    def test_connection_error_handling(self, test_app):
        """Test API error handling"""
        # Test invalid engine
        invalid_params = {
            "name": "test",
            "engine": "invalid_engine",
            "sql": {"dbms_host": "localhost"}
        }
        response = test_app.post("/connections", json=invalid_params)
        assert response.status_code == 400
        
        # Test missing parameters
        incomplete_params = {"name": "test"}
        response = test_app.post("/connections", json=incomplete_params)
        assert response.status_code == 422
        
        # Test non-existent connection
        response = test_app.get("/connections/non-existent")
        assert response.status_code == 404
```

### End-to-End Workflow Tests
```python
# tests/integration/test_workflows/test_complete_workflow.py
import pytest

class TestCompleteWorkflow:
    """End-to-end workflow tests"""
    
    def test_data_analysis_workflow(self, test_app, sqlite_params):
        """Test complete data analysis workflow"""
        # 1. Create connection
        response = test_app.post("/connections", json=sqlite_params)
        connection_id = response.json()["data"]["id"]
        
        # 2. Create data model
        model_data = {
            "name": "test_model",
            "connection_id": connection_id,
            "tables": ["customers", "orders"]
        }
        response = test_app.post("/data-models", json=model_data)
        model_id = response.json()["data"]["id"]
        
        # 3. Create and execute query
        query_data = {
            "name": "customer_analysis",
            "connection_id": connection_id,
            "sql": """
                SELECT customer_id, COUNT(*) as order_count
                FROM orders 
                GROUP BY customer_id
            """
        }
        response = test_app.post("/queries", json=query_data)
        query_id = response.json()["data"]["id"]
        
        # 4. Execute query
        response = test_app.post(f"/queries/{query_id}/execute")
        assert response.status_code == 200
        results = response.json()["data"]["results"]
        
        # 5. Export results
        response = test_app.get(f"/queries/{query_id}/export?format=csv")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/csv"
```

## Performance Testing

### Load Testing
```python
# tests/performance/test_load.py
import pytest
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

class TestPerformance:
    """Performance and load tests"""
    
    @pytest.mark.slow
    def test_concurrent_connections(self, test_app, sqlite_params):
        """Test multiple concurrent connections"""
        def create_connection():
            response = test_app.post("/connections", json=sqlite_params)
            return response.status_code == 200
        
        # Test 10 concurrent connections
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(create_connection) for _ in range(10)]
            results = [f.result() for f in futures]
        
        # All connections should succeed
        assert all(results)
    
    @pytest.mark.slow
    def test_query_performance(self, test_app, sample_connection_params):
        """Test query execution performance"""
        # Create connection
        response = test_app.post("/connections", json=sample_connection_params)
        connection_id = response.json()["data"]["id"]
        
        # Create large dataset
        large_query = {
            "name": "large_query",
            "connection_id": connection_id,
            "sql": "SELECT * FROM large_table LIMIT 10000"
        }
        response = test_app.post("/queries", json=large_query)
        query_id = response.json()["data"]["id"]
        
        # Measure execution time
        start_time = time.time()
        response = test_app.post(f"/queries/{query_id}/execute")
        execution_time = time.time() - start_time
        
        assert response.status_code == 200
        assert execution_time < 30  # Should complete within 30 seconds
```

## Test Data Management

### Fixtures and Sample Data
```python
# tests/fixtures/sample_data.py
import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent

def load_sample_connections():
    """Load sample connection configurations"""
    with open(FIXTURES_DIR / "connections.json") as f:
        return json.load(f)

def load_sample_queries():
    """Load sample SQL queries"""
    with open(FIXTURES_DIR / "queries.json") as f:
        return json.load(f)

# tests/fixtures/connections.json
{
    "sqlite_memory": {
        "name": "SQLite Memory",
        "engine": "sqlite",
        "sql": {
            "dbms_host": ":memory:"
        }
    },
    "mysql_local": {
        "name": "MySQL Local",
        "engine": "mysql", 
        "sql": {
            "dbms_host": "localhost",
            "dbms_port": 3306,
            "user": "test",
            "password": "test",
            "database": "test"
        }
    }
}
```

### Database Setup and Teardown
```python
# tests/fixtures/database_setup.py
import pytest
import sqlite3
import tempfile

@pytest.fixture
def sqlite_with_data():
    """SQLite database with sample data"""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
        db_path = tmp.name
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE
        )
    """)
    
    cursor.execute("""
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER,
            amount DECIMAL(10,2),
            order_date DATE,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    """)
    
    # Insert sample data
    cursor.execute("INSERT INTO customers VALUES (1, 'John Doe', 'john@example.com')")
    cursor.execute("INSERT INTO customers VALUES (2, 'Jane Smith', 'jane@example.com')")
    
    cursor.execute("INSERT INTO orders VALUES (1, 1, 100.50, '2023-01-01')")
    cursor.execute("INSERT INTO orders VALUES (2, 1, 75.25, '2023-01-02')")
    cursor.execute("INSERT INTO orders VALUES (3, 2, 200.00, '2023-01-03')")
    
    conn.commit()
    conn.close()
    
    yield db_path
    
    # Cleanup
    os.unlink(db_path)
```

## Continuous Integration

### GitHub Actions Configuration
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: test
          MYSQL_USER: test
          MYSQL_PASSWORD: test
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3
        
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: test
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
        
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install pytest pytest-cov pytest-asyncio
        
    - name: Run unit tests
      run: pytest tests/unit/ -v --cov=./ --cov-report=xml
      
    - name: Run integration tests
      run: pytest tests/integration/ -v
      env:
        MYSQL_HOST: localhost
        MYSQL_PORT: 3306
        MYSQL_USER: test
        MYSQL_PASSWORD: test
        MYSQL_DATABASE: test
        POSTGRES_HOST: localhost
        POSTGRES_PORT: 5432
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DATABASE: test
        
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
```

## Quality Metrics

### Coverage Requirements
- **Unit Tests**: 90%+ line coverage
- **Integration Tests**: Critical path coverage
- **API Tests**: 100% endpoint coverage
- **Overall**: 85%+ combined coverage

### Performance Benchmarks
- **Connection Time**: < 5 seconds
- **Query Execution**: < 30 seconds for large datasets
- **API Response**: < 1 second for simple operations
- **Concurrent Connections**: Support 50+ simultaneous connections

### Test Reliability
- **Flaky Test Rate**: < 1%
- **Test Execution Time**: < 10 minutes for full suite
- **Test Isolation**: Zero test interdependencies
- **Environment Independence**: Tests pass in any environment

---

*This testing strategy ensures robust, reliable, and maintainable code quality across the entire xldb_proxy system.*