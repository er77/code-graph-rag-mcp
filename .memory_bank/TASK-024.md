# Task ID: TASK-024: Implement Missing SQL Engines

- **Agent**: dev-sqlengines
- **Priority**: HIGHEST
- **Type**: SQL Engine Implementation
- **Status**: READY FOR DELEGATION
- **Source**: Research Trinity Analysis

## 1. Overview

This task directs the `dev-sqlengines` agent to implement six new SQL engines, as prioritized by the Research Trinity analysis. All implementations must strictly adhere to the GRACE (Generative Programming, Reasoning, and Code Engineering) framework to ensure consistency, maintainability, and advanced AI-native capabilities.

## 2. GRACE Framework Compliance

All implementations must satisfy the following GRACE principles:

- **Observable AI Belief State**: Each engine must log its internal state and decision-making processes using the project's standard logging format.
- **End-to-End Traceability**: All generated code, documentation, and artifacts must be marked with `<!-- TASK-024 -->` for clear traceability.
- **Machine-Readable Blueprints**: For each engine, a `blueprint.json` file must be created detailing the implementation plan before coding begins.
- **Semantic Scaffolding**: Code must be structured with XML-like comment anchors (e.g., `<core_logic>`, `</core_logic>`) to delineate functional blocks.
- **Deterministic Generation**: Implementations must be based on approved patterns. New patterns must be clearly defined and documented.

---

## 3. Engine Implementation Specifications

### 3.1. TimescaleDB

- **Pattern**: Standard SQL (PostgreSQL extension)
- **Complexity**: 4/10
- **Driver Library**: `psycopg2-binary` (verify version in `requirements.txt`)
- **Core Interface**:
    - Implement the standard `BaseSQLEngine` interface.
    - Connection logic should handle standard PostgreSQL parameters.
    - Pay special attention to data type mappings for time-series data.
- **Integration**:
    - Add `timescaledb` to the engine map in `main.py`.
    - Ensure `psycopg2-binary` is listed in `requirements.txt`.
- **Memory Bank**:
    - Create `sql_timescaledb.md` in `sqlengines/docs/`.
    - Document connection string format and any specific performance considerations.
- **Testing**:
    - Create a test suite in `tests/test_timescaledb.py`.
    - Tests should cover connection, basic queries, and a simple time-series data insertion/retrieval.

### 3.2. SAP HANA

- **Pattern**: Standard SQL
- **Complexity**: 6/10
- **Driver Library**: `hdbcli`
- **Core Interface**:
    - Implement the standard `BaseSQLEngine` interface.
    - Connection logic will use the `hdbcli` driver.
- **Integration**:
    - Add `sap_hana` to the engine map in `main.py`.
    - Add `hdbcli` to `requirements.txt`.
- **Memory Bank**:
    - Create `sql_sap_hana.md` in `sqlengines/docs/`.
    - Document driver installation prerequisites and connection parameters.
- **Testing**:
    - Create `tests/test_sap_hana.py`.
    - Tests should validate connection and execution of a simple `SELECT` statement.

### 3.3. Vertica

- **Pattern**: Standard SQL (Columnar)
- **Complexity**: 6/10
- **Driver Library**: `vertica-python`
- **Core Interface**:
    - Implement `BaseSQLEngine`.
    - Focus on efficient handling of large result sets, typical for columnar databases.
- **Integration**:
    - Add `vertica` to `main.py`.
    - Add `vertica-python` to `requirements.txt`.
- **Memory Bank**:
    - Create `sql_vertica.md` in `sqlengines/docs/`.
    - Document connection options and any specific syntax variations.
- **Testing**:
    - Create `tests/test_vertica.py`.
    - Tests should cover connection and a query that leverages a columnar feature if possible (e.g., a simple aggregation).

### 3.4. Apache Drill

- **Pattern**: NEW Schema-Free
- **Complexity**: 7/10
- **Driver Library**: `pydrill`
- **Core Interface**:
    - Define a new `SchemaFreeBaseEngine` inheriting from `BaseEngine`.
    - This new base class will handle queries against data sources like filesystems or NoSQL databases without a predefined schema.
    - The `get_schema` method may need to be adapted to infer schema from a sample of data.
- **Integration**:
    - Add `apache_drill` to `main.py`.
    - Add `pydrill` to `requirements.txt`.
- **Memory Bank**:
    - Create `pattern_schema_free.md` in `.memory_bank/patterns/`.
    - Create `sql_apache_drill.md` in `sqlengines/docs/`.
    - Document the new pattern and the engine's capabilities for querying diverse data sources.
- **Testing**:
    - Create `tests/test_apache_drill.py`.
    - Tests should include querying a local file (e.g., a CSV or JSON file) through Drill.

### 3.5. Kafka (ksqlDB)

- **Pattern**: NEW Streaming
- **Complexity**: 8/10
- **Driver Library**: `ksql-python`
- **Core Interface**:
    - Define a new `StreamingBaseEngine` inheriting from `BaseEngine`.
    - This engine will interact with ksqlDB's REST API.
    - Implement methods for creating streams/tables and running push/pull queries.
    - The concept of a "cursor" will need to be adapted for continuous streams.
- **Integration**:
    - Add `kafka_ksqldb` to `main.py`.
    - Add `ksql-python` to `requirements.txt`.
- **Memory Bank**:
    - Create `pattern_streaming.md` in `.memory_bank/patterns/`.
    - Create `sql_kafka_ksqldb.md` in `sqlengines/docs/`.
    - Document the streaming pattern, ksqlDB setup, and how to formulate streaming queries.
- **Testing**:
    - Create `tests/test_kafka_ksqldb.py`.
    - This will be more complex and may require a local Kafka/ksqlDB setup (or mocked API).
    - Tests should cover creating a stream from a topic and running a simple pull query.

### 3.6. RabbitMQ

- **Pattern**: NEW Message Queue
- **Complexity**: 8/10
- **Driver Library**: `pika`
- **Core Interface**:
    - Define a new `MessageQueueBaseEngine`. This is a conceptual stretch of "SQL engine" and will require significant abstraction.
    - The "query" could be interpreted as publishing a message or consuming from a queue.
    - `get_schema` could return information about exchanges and queues.
    - This engine will not be a traditional SQL engine but will adapt the `BaseEngine` interface to the messaging paradigm.
- **Integration**:
    - Add `rabbitmq` to `main.py`.
    - Add `pika` to `requirements.txt`.
- **Memory Bank**:
    - Create `pattern_message_queue.md` in `.memory_bank/patterns/`.
    - Create `sql_rabbitmq.md` in `sqlengines/docs/`.
    - Clearly document how messaging concepts are mapped to the engine's interface.
- **Testing**:
    - Create `tests/test_rabbitmq.py`.
    - Requires a running RabbitMQ instance (or mocked equivalent).
    - Tests should cover publishing a message to an exchange and consuming it from a queue.

## 4. Deliverables

- Six new engine implementation files in the `sqlengines/` directory.
- Updates to `main.py` and `requirements.txt`.
- All required documentation in the `.memory_bank/` and `sqlengines/docs/` directories.
- Comprehensive test suites for each new engine.
- A final summary report detailing the implementation process and any challenges encountered.