# Testing Workflow

## 🎯 Overview

Comprehensive testing strategy for xldb_proxy that ensures reliability, performance, and compatibility across all supported database engines and system components.

## 🧪 Testing Architecture

### Test Categories

#### 1. Unit Tests
- **Scope**: Individual functions and methods
- **Location**: `tests/unit/`
- **Coverage Target**: 90% minimum
- **Execution**: Fast, isolated, no external dependencies

#### 2. Integration Tests
- **Scope**: Component interactions and SQL engine connectivity
- **Location**: `tests/integration/`
- **Coverage Target**: All critical paths
- **Execution**: Requires database instances or mocks

#### 3. End-to-End Tests
- **Scope**: Full API workflows and user scenarios
- **Location**: `tests/e2e/`
- **Coverage Target**: All user-facing features
- **Execution**: Full system deployment

#### 4. Performance Tests
- **Scope**: Load testing, concurrency, memory usage
- **Location**: `tests/performance/`
- **Coverage Target**: All performance-critical components
- **Execution**: Dedicated testing environment

## 🔧 Testing Setup

### Development Environment
```bash
# Install testing dependencies
pip install pytest pytest-asyncio pytest-cov httpx

# Install optional database drivers for full testing
pip install clickhouse-driver mysql-connector-python psycopg2

# Run basic test suite
pytest

# Run with coverage
pytest --cov=. --cov-report=html
```

### Test Configuration
```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def test_connection_params():
    return {
        "name": "test_connection",
        "engine": "sqlite",
        "sql": {
            "database": ":memory:",
            "user": "",
            "password": ""
        }
    }
```

## 🏗️ Agent-Specific Testing

### dev-sqlengines Testing Responsibilities
**ONLY dev-sqlengines agent can work on**:
- SQL engine unit tests
- Database connectivity tests
- SQL query validation tests
- Engine performance tests

### dev-agent Testing Responsibilities
**dev-agent handles all OTHER testing**:
- API endpoint tests
- Configuration tests
- File service tests
- General integration tests

## 📋 Testing Workflows

### 1. Pre-Commit Testing
```bash
# TASK-XXX: Pre-commit validation
# Run before any code commit

# 1. Linting and type checking
python -m flake8 .
python -m mypy .

# 2. Unit tests
pytest tests/unit/ -v

# 3. Fast integration tests
pytest tests/integration/ -k "not slow" -v

# 4. Coverage check
pytest --cov=. --cov-fail-under=85
```

### 2. SQL Engine Testing (dev-sqlengines only)
```bash
# TASK-XXX: SQL Engine validation

# Test engine registration
python -c "
from models.connection import Connection
engines = ['clickhouse', 'mysql', 'postgres', 'oracle', 'mssql', 'sqlite', 'duckdb', 'htg']
for engine in engines:
    assert engine in Connection.engines, f'{engine} not registered'
print('All engines registered successfully')
"

# Test specific engine
pytest tests/integration/test_engines/test_mysql.py -v

# Test all engines (requires database instances)
pytest tests/integration/test_engines/ -v
```

### 3. API Testing
```bash
# TASK-XXX: API validation

# Test API endpoints
pytest tests/integration/test_api/ -v

# Test with live server
uvicorn main:app --host 127.0.0.1 --port 55080 &
SERVER_PID=$!

# Run API tests against live server
pytest tests/e2e/ --base-url http://127.0.0.1:55080 -v

# Cleanup
kill $SERVER_PID
```

### 4. Full Test Suite
```bash
# TASK-XXX: Complete validation

# 1. All unit tests
pytest tests/unit/ -v

# 2. All integration tests
pytest tests/integration/ -v

# 3. End-to-end tests
pytest tests/e2e/ -v

# 4. Performance tests
pytest tests/performance/ -v

# 5. Generate comprehensive report
pytest --cov=. --cov-report=html --cov-report=term-missing
```

## 🗂️ Test Structure

### Unit Tests Structure
```
tests/unit/
├── test_connection_models.py
├── test_query_models.py
├── test_configuration.py
├── test_utilities.py
└── engines/
    ├── test_engine_base.py
    ├── test_mysql_engine.py
    ├── test_postgres_engine.py
    └── test_sqlite_engine.py
```

### Integration Tests Structure
```
tests/integration/
├── test_api_connections.py
├── test_api_queries.py
├── test_file_services.py
├── test_xmla_endpoints.py
└── engines/
    ├── test_engine_connectivity.py
    ├── test_cross_engine_queries.py
    └── test_engine_performance.py
```

### End-to-End Tests Structure
```
tests/e2e/
├── test_user_workflows.py
├── test_multi_database_scenarios.py
├── test_error_handling.py
└── test_security.py
```

## 🧪 Test Implementation Examples

### Unit Test Example
```python
# tests/unit/test_connection_models.py
import pytest
from models.connection import NewConnectionParams

def test_connection_params_validation():
    """Test connection parameter validation"""
    # Valid parameters
    params = NewConnectionParams(
        name="test",
        engine="mysql",
        sql={
            "dbms_host": "localhost",
            "dbms_port": 3306,
            "database": "test",
            "user": "test",
            "password": "test"
        }
    )
    assert params.name == "test"
    assert params.engine == "mysql"

    # Invalid parameters
    with pytest.raises(ValueError):
        NewConnectionParams(
            name="",  # Empty name should fail
            engine="mysql"
        )
```

### SQL Engine Integration Test
```python
# tests/integration/engines/test_mysql_engine.py
import pytest
from models.connection import Connection, NewConnectionParams

@pytest.mark.integration
def test_mysql_engine_connection():
    """Test MySQL engine connection lifecycle"""
    params = NewConnectionParams(
        name="test_mysql",
        engine="mysql",
        sql={
            "dbms_host": "localhost",
            "dbms_port": 3306,
            "database": "test",
            "user": "test",
            "password": "test"
        }
    )

    engine = Connection.engine_connection(params)

    # Test connection
    engine.open()
    assert engine.connection is not None

    # Test basic query
    result = engine.exec("SELECT 1 as test_column")
    assert len(result) == 1

    # Test metadata queries
    tables_sql = engine.tables_query(is_admin=True)
    assert "information_schema" in tables_sql.lower()

    # Cleanup
    engine.close()

@pytest.mark.integration
@pytest.mark.slow
def test_mysql_engine_performance():
    """Test MySQL engine performance characteristics"""
    engine = create_test_mysql_engine()

    # Test connection time
    start_time = time.time()
    engine.open()
    connection_time = time.time() - start_time
    assert connection_time < 5.0  # Connection should be under 5 seconds

    # Test query performance
    start_time = time.time()
    result = engine.exec("SELECT COUNT(*) FROM large_table")
    query_time = time.time() - start_time
    assert query_time < 10.0  # Query should complete reasonably fast

    engine.close()
```

### API Integration Test
```python
# tests/integration/test_api_connections.py
def test_connection_crud_workflow(client):
    """Test complete connection CRUD workflow"""
    # Create connection
    connection_data = {
        "name": "test_api_connection",
        "engine": "sqlite",
        "sql": {
            "database": ":memory:"
        }
    }

    response = client.post("/connections", json=connection_data)
    assert response.status_code == 201
    connection_id = response.json()["id"]

    # Read connection
    response = client.get(f"/connections/{connection_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "test_api_connection"

    # Test connection
    response = client.post(f"/connections/{connection_id}/test")
    assert response.status_code == 200

    # Update connection
    update_data = {"name": "updated_connection"}
    response = client.patch(f"/connections/{connection_id}", json=update_data)
    assert response.status_code == 200

    # Delete connection
    response = client.delete(f"/connections/{connection_id}")
    assert response.status_code == 204
```

### End-to-End Test Example
```python
# tests/e2e/test_user_workflows.py
def test_complete_data_analysis_workflow(client):
    """Test complete user workflow from connection to query results"""
    # 1. Create database connection
    connection_response = client.post("/connections", json={
        "name": "analytics_db",
        "engine": "duckdb",
        "sql": {"database": "test_analytics.db"}
    })
    connection_id = connection_response.json()["id"]

    # 2. Upload data file
    with open("test_data.csv", "rb") as f:
        files = {"file": ("test_data.csv", f, "text/csv")}
        upload_response = client.post("/files/upload", files=files)
    assert upload_response.status_code == 200

    # 3. Create query to analyze uploaded data
    query_response = client.post("/queries", json={
        "name": "data_analysis",
        "connection_id": connection_id,
        "query": "SELECT category, COUNT(*) FROM test_data GROUP BY category"
    })
    query_id = query_response.json()["id"]

    # 4. Execute query
    execution_response = client.post(f"/queries/{query_id}/execute")
    assert execution_response.status_code == 200
    results = execution_response.json()

    # 5. Verify results
    assert "data" in results
    assert len(results["data"]) > 0

    # 6. Download results
    download_response = client.get(f"/queries/{query_id}/results/csv")
    assert download_response.status_code == 200
    assert "text/csv" in download_response.headers["content-type"]
```

## 🎯 Testing Best Practices

### Test Data Management
```python
# Use fixtures for reusable test data
@pytest.fixture
def sample_data():
    return {
        "users": [
            {"id": 1, "name": "Alice", "email": "alice@example.com"},
            {"id": 2, "name": "Bob", "email": "bob@example.com"}
        ],
        "orders": [
            {"id": 1, "user_id": 1, "amount": 100.00},
            {"id": 2, "user_id": 2, "amount": 250.00}
        ]
    }

# Use parameterized tests for multiple scenarios
@pytest.mark.parametrize("engine,expected_tables", [
    ("sqlite", ["sqlite_master"]),
    ("mysql", ["information_schema"]),
    ("postgres", ["pg_catalog"])
])
def test_system_tables(engine, expected_tables):
    connection = create_test_connection(engine)
    tables = connection.get_system_tables()
    for expected in expected_tables:
        assert any(expected in table.lower() for table in tables)
```

### Error Testing
```python
def test_connection_error_handling():
    """Test proper error handling for connection failures"""
    # Invalid host
    with pytest.raises(HTTPException) as exc_info:
        params = create_invalid_connection_params()
        engine = Connection.engine_connection(params)
        engine.open()
    assert exc_info.value.status_code == 500
    assert "connection failed" in exc_info.value.detail.lower()

def test_sql_injection_prevention():
    """Test SQL injection prevention"""
    malicious_query = "SELECT * FROM users; DROP TABLE users; --"

    # Should be properly escaped or rejected
    with pytest.raises(HTTPException) as exc_info:
        engine = create_test_engine()
        engine.exec(malicious_query)
    assert exc_info.value.status_code == 400
```

### Performance Testing
```python
import time
import concurrent.futures

def test_concurrent_connections():
    """Test handling multiple concurrent connections"""
    def create_and_test_connection(thread_id):
        params = create_test_connection_params(f"thread_{thread_id}")
        engine = Connection.engine_connection(params)
        engine.open()
        result = engine.exec("SELECT 1")
        engine.close()
        return len(result)

    # Test 50 concurrent connections
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(create_and_test_connection, i) for i in range(50)]
        results = [future.result() for future in futures]

    assert all(result == 1 for result in results)

def test_memory_usage():
    """Test memory usage with large result sets"""
    import psutil
    import os

    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss

    # Execute large query
    engine = create_test_engine()
    large_result = engine.exec("SELECT * FROM large_table LIMIT 100000")

    peak_memory = process.memory_info().rss
    memory_increase = peak_memory - initial_memory

    # Memory increase should be reasonable (< 500MB for 100k rows)
    assert memory_increase < 500 * 1024 * 1024
```

## 📊 Test Reporting

### Coverage Reporting
```bash
# Generate HTML coverage report
pytest --cov=. --cov-report=html

# Open coverage report
open htmlcov/index.html  # macOS
# xdg-open htmlcov/index.html  # Linux
```

### Performance Reporting
```python
# Custom performance test reporter
def pytest_runtest_teardown(item, nextitem):
    """Log performance metrics after each test"""
    if hasattr(item, 'execution_time'):
        with open('performance_log.txt', 'a') as f:
            f.write(f"{item.nodeid}: {item.execution_time:.3f}s\n")
```

### Test Metrics
```bash
# Generate test metrics report
pytest --junit-xml=test-results.xml --cov=. --cov-report=xml

# Integration with CI/CD
python scripts/generate_test_report.py test-results.xml coverage.xml
```

## 🔄 Continuous Testing

### Pre-commit Hooks
```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: tests
        name: tests
        entry: pytest
        language: system
        types: [python]
        args: [tests/unit/, --cov=., --cov-fail-under=85]
```

### CI/CD Integration
```yaml
# GitHub Actions example
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.10, 3.11, 3.12]
        database: [mysql, postgres, sqlite]

    steps:
    - uses: actions/checkout@v2
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: ${{ matrix.python-version }}

    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install -r requirements-test.txt

    - name: Run tests
      run: |
        pytest --cov=. --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v1
```

## 📋 Testing Checklists

### Pre-Release Testing
- [ ] All unit tests pass (90%+ coverage)
- [ ] All integration tests pass
- [ ] End-to-end workflows validated
- [ ] Performance benchmarks meet targets
- [ ] Security tests pass
- [ ] All SQL engines tested
- [ ] Documentation examples work
- [ ] API contracts validated

### SQL Engine Testing (dev-sqlengines)
- [ ] Engine auto-registration works
- [ ] Connection lifecycle (open/close) works
- [ ] All required interface methods implemented
- [ ] Metadata queries return correct format
- [ ] Error handling is consistent
- [ ] Performance meets targets
- [ ] SSL/TLS support (if applicable)
- [ ] Connection pooling works

### Deployment Testing
- [ ] Docker build succeeds
- [ ] Configuration validation works
- [ ] Health check endpoints respond
- [ ] Logging configuration works
- [ ] Memory usage within limits
- [ ] Graceful shutdown works

---

*This testing workflow ensures comprehensive validation of xldb_proxy functionality while maintaining quality standards and performance targets.*

**Last Updated**: 2025-01-18 | **Next Review**: 2025-02-18