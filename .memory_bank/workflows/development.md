# Development Workflow

This document outlines the development workflow for the xldb_proxy project, including setup, coding practices, testing, and deployment procedures.

## Development Environment Setup

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd xldb_back

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy configuration
cp xldb-sql-proxy.conf.example xldb-sql-proxy.conf

# 5. Edit configuration for development
nano xldb-sql-proxy.conf
```

### Development Configuration

Set up development-specific settings in `xldb-sql-proxy.conf`:

```toml
# Development settings
host = "127.0.0.1"
port = 55080
uvicorn_log_level = "debug"
uvicorn_workers = 1
query_timeout = 3600  # 1 hour for debugging
```

### IDE Configuration

#### VS Code Settings

Create `.vscode/settings.json`:

```json
{
    "python.defaultInterpreterPath": "./venv/bin/python",
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "python.formatting.provider": "black",
    "python.sortImports.args": ["--profile", "black"],
    "files.exclude": {
        "**/__pycache__": true,
        "**/*.pyc": true
    }
}
```

#### PyCharm Configuration

1. Set Python interpreter to `./venv/bin/python`
2. Configure code style to follow Black formatting
3. Enable type checking with mypy
4. Set up run configuration for uvicorn

## Development Server Management

### Starting Development Server

```bash
# Standard development server
uvicorn main:app --host 127.0.0.1 --port 55080 --reload --log-config uvicorn.yaml

# Kill existing servers before starting new ones
pkill -f "uvicorn main:app" || true

# Start with specific log level
uvicorn main:app --host 127.0.0.1 --port 55080 --reload --log-level debug
```

### Hot Reloading

The development server supports hot reloading for rapid development:

- **Python files**: Automatically reloaded on change
- **Configuration files**: Require manual restart
- **Template files**: Automatically reloaded
- **Static files**: Automatically served

### Environment Variables

Set development environment variables:

```bash
export XLDB_ENV=development
export XLDB_DEBUG=true
export XLDB_LOG_LEVEL=debug
```

## Coding Workflow

### Feature Development Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/user-authentication
   ```

2. **Follow Coding Standards**
   - Follow patterns in `.memory_bank/patterns/coding_standards.md`
   - Use consistent import organization
   - Add comprehensive type hints
   - Include proper documentation

3. **Implement Feature**
   ```python
   # Example: Adding new API endpoint
   @router.post("/auth/login")
   def login(credentials: LoginCredentials) -> LoginResponse:
       """Authenticate user and return session token"""
       # Implementation following coding standards
   ```

4. **Add Tests**
   ```python
   def test_user_login_success():
       response = client.post("/auth/login", json={
           "username": "test_user",
           "password": "test_password"
       })
       assert response.status_code == 200
       assert "access_token" in response.json()
   ```

5. **Update Documentation**
   - Update API documentation
   - Add/update Memory Bank guides if needed
   - Update change log

### Database Engine Development

For new database engines, follow the specialized workflow:

1. **Create Engine File**
   ```bash
   touch sqlengines/newdb.py
   ```

2. **Implement Engine Interface**
   ```python
   from models.connection import Connection
   
   class EngineConnectionNewDB(Connection):
       names = ["newdb"]
       
       def open(self):
           # Implementation
       
       def close(self):
           # Implementation
       
       def tables_query(self, is_admin: bool) -> str:
           # Implementation
   ```

3. **Add Engine Registration**
   ```python
   # In main.py
   import sqlengines.newdb  # Auto-registers engine
   ```

4. **Create Engine Tests**
   ```python
   def test_newdb_connection():
       params = ConnectionParams(
           sql=SqlConnectionParams(
               engine_type="newdb",
               dbms_host="localhost"
           )
       )
       engine = EngineConnectionNewDB(params)
       # Test implementation
   ```

### Code Quality Checks

Before committing, run quality checks:

```bash
# Format code
black .

# Sort imports
isort .

# Type checking
mypy .

# Linting
pylint xldb_proxy/

# Security checking
bandit -r .
```

## Testing Workflow

### Test Categories

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test component interactions
3. **Engine Tests**: Test database engine implementations
4. **API Tests**: Test REST API endpoints
5. **End-to-End Tests**: Test complete workflows

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_connection.py

# Run tests with coverage
pytest --cov=xldb_proxy --cov-report=html

# Run tests for specific engine
pytest tests/test_engines/ -k "postgres"

# Run tests with verbose output
pytest -v -s
```

### Test Database Setup

For engine testing, set up test databases:

```bash
# PostgreSQL test database
docker run --name postgres-test -e POSTGRES_PASSWORD=testpass -d postgres

# MySQL test database  
docker run --name mysql-test -e MYSQL_ROOT_PASSWORD=testpass -d mysql

# ClickHouse test database
docker run --name clickhouse-test -d clickhouse/clickhouse-server
```

### Parameterized Testing

Use parameterized tests for multiple engines:

```python
@pytest.mark.parametrize("engine_type", ["postgres", "mysql", "clickhouse"])
def test_connection_open(engine_type):
    params = get_test_connection_params(engine_type)
    connection = Connection.engine_connection(params)
    connection.open()
    assert connection.connection is not None
    connection.close()
```

## Version Control Workflow

### Git Workflow

1. **Feature Branches**
   ```bash
   git checkout -b feature/description
   # Make changes
   git add .
   git commit -m "feat: add user authentication"
   git push origin feature/description
   ```

2. **Commit Message Format**
   ```
   type(scope): description
   
   - feat: new feature
   - fix: bug fix
   - docs: documentation changes
   - style: formatting changes
   - refactor: code refactoring
   - test: adding tests
   - chore: maintenance tasks
   ```

3. **Pull Request Process**
   - Create pull request with descriptive title
   - Include test results and coverage
   - Request code review
   - Address feedback
   - Merge after approval

### Branch Protection

Main branch requires:
- Pull request reviews
- Status checks passing
- Up-to-date branches
- No force pushes

## Code Review Process

### Review Checklist

**Functionality**
- [ ] Code implements requirements correctly
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] Performance is acceptable

**Code Quality**
- [ ] Follows coding standards
- [ ] Has appropriate type hints
- [ ] Includes comprehensive documentation
- [ ] Is well-tested

**Security**
- [ ] No hardcoded credentials
- [ ] Input validation is present
- [ ] SQL injection prevention
- [ ] Encryption for sensitive data

**Architecture**
- [ ] Follows established patterns
- [ ] Integrates properly with existing code
- [ ] Doesn't introduce technical debt
- [ ] Maintains backward compatibility

### Review Guidelines

**For Reviewers:**
1. Focus on logic, security, and maintainability
2. Check for adherence to coding standards
3. Verify test coverage and quality
4. Consider performance implications
5. Provide constructive feedback

**For Authors:**
1. Self-review before requesting review
2. Provide clear PR description
3. Include test results
4. Respond to feedback promptly
5. Update documentation as needed

## Debugging Workflow

### Local Debugging

1. **Set Debug Mode**
   ```toml
   # xldb-sql-proxy.conf
   uvicorn_log_level = "debug"
   ```

2. **Use Debug Logging**
   ```python
   from logger_conf import debug_log
   
   debug_log("Processing connection request")
   debug_log({"connection_id": conn_id, "params": params})
   ```

3. **Interactive Debugging**
   ```python
   import pdb
   pdb.set_trace()  # Breakpoint for debugging
   ```

### Database Debugging

1. **Enable SQL Logging**
   ```python
   import logging
   logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
   ```

2. **Query Performance Analysis**
   ```python
   import time
   start_time = time.time()
   result = execute_query(sql)
   execution_time = time.time() - start_time
   debug_log(f"Query executed in {execution_time:.3f}s")
   ```

3. **Connection Pool Monitoring**
   ```python
   debug_log(f"Active connections: {connection_pool.size}")
   debug_log(f"Available connections: {connection_pool.available}")
   ```

### Production Debugging

1. **Log Analysis**
   ```bash
   # Monitor real-time logs
   tail -f logs/xldb.log | grep ERROR
   
   # Search for specific errors
   grep "Connection failed" logs/xldb.log
   ```

2. **Health Check Monitoring**
   ```bash
   # Check service health
   curl http://localhost:55080/ping
   
   # Monitor response times
   curl -w "@curl-format.txt" -o /dev/null -s http://localhost:55080/connections
   ```

## Performance Optimization

### Profiling

1. **Code Profiling**
   ```python
   import cProfile
   import pstats
   
   profiler = cProfile.Profile()
   profiler.enable()
   # Code to profile
   profiler.disable()
   
   stats = pstats.Stats(profiler)
   stats.sort_stats('cumulative')
   stats.print_stats(10)
   ```

2. **Memory Profiling**
   ```python
   from memory_profiler import profile
   
   @profile
   def memory_intensive_function():
       # Function to profile
       pass
   ```

3. **Database Performance**
   ```python
   # Monitor query performance
   def timed_query(connection, query):
       start = time.time()
       result = connection.execute(query)
       duration = time.time() - start
       
       if duration > 1.0:  # Log slow queries
           debug_log(f"Slow query ({duration:.2f}s): {query[:100]}...")
       
       return result
   ```

### Optimization Strategies

1. **Connection Pooling**
   - Reuse database connections
   - Configure appropriate pool sizes
   - Monitor connection usage

2. **Query Optimization**
   - Use appropriate indexes
   - Optimize complex queries
   - Implement query caching

3. **Response Optimization**
   - Use pagination for large datasets
   - Implement streaming for real-time data
   - Compress large responses

## Documentation Workflow

### Memory Bank Updates

When making significant changes:

1. **Update Relevant Guides**
   ```bash
   # Update specific subsystem guide
   vim .memory_bank/guides/api_development.md
   ```

2. **Document Architectural Decisions**
   ```bash
   # Create new ADR if needed
   vim .memory_bank/patterns/architectural_decisions.md
   ```

3. **Update Current Tasks**
   ```bash
   # Update task status
   vim .memory_bank/current_tasks.md
   ```

### API Documentation

Keep API documentation current:

1. **FastAPI Auto-documentation**
   - Ensure docstrings are comprehensive
   - Include examples in endpoint descriptions
   - Document all parameters and responses

2. **Manual Documentation**
   ```bash
   # Update API reference
   vim .memory_bank/guides/api_reference.md
   ```

## Deployment Preparation

### Pre-deployment Checklist

- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Configuration reviewed
- [ ] Database migrations prepared
- [ ] Backup procedures verified

### Staging Deployment

1. **Deploy to Staging**
   ```bash
   # Deploy to staging environment
   docker-compose -f docker-compose.staging.yml up -d
   ```

2. **Smoke Testing**
   ```bash
   # Basic functionality tests
   curl http://staging.example.com/ping
   curl http://staging.example.com/connections
   ```

3. **Performance Testing**
   ```bash
   # Load testing with sample data
   python scripts/load_test.py --host staging.example.com
   ```

This development workflow ensures consistent, high-quality development practices while maintaining the flexibility needed for rapid feature development and deployment.