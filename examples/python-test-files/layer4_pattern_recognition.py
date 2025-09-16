"""
TASK-003B Layer 4: Pattern Recognition Test File

This file tests pattern recognition capabilities including:
- Context manager pattern detection (with statements)
- Exception handling structure analysis (try/except/finally)
- Comprehensive pattern classification system
- Circular dependency detection for imports
- Python idiom and best practice recognition

Test Coverage:
- Context manager patterns and protocols
- Exception handling hierarchies and patterns
- Common Python idioms and design patterns
- Resource management patterns
- Error handling strategies
"""

from typing import Any, Dict, List, Optional, Union, Generator, AsyncGenerator, Protocol, Type
from contextlib import contextmanager, asynccontextmanager, ExitStack, AsyncExitStack
from abc import ABC, abstractmethod
import asyncio
import logging
import threading
from pathlib import Path
import tempfile
import sqlite3
from dataclasses import dataclass
import weakref
from collections import defaultdict, namedtuple
from functools import wraps, lru_cache, singledispatch
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import time

# =============================================================================
# 1. CONTEXT MANAGER PATTERNS
# =============================================================================

class BasicContextManager:
    """Basic context manager implementation."""
    
    def __init__(self, resource_name: str):
        self.resource_name = resource_name
        self.resource = None
    
    def __enter__(self) -> 'BasicContextManager':
        """Enter the runtime context."""
        print(f"Acquiring resource: {self.resource_name}")
        self.resource = f"resource_{self.resource_name}"
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> Optional[bool]:
        """Exit the runtime context."""
        print(f"Releasing resource: {self.resource_name}")
        if exc_type is not None:
            print(f"Exception occurred: {exc_type.__name__}: {exc_val}")
        self.resource = None
        return False  # Don't suppress exceptions

class ExceptionSuppressingContextManager:
    """Context manager that can suppress specific exceptions."""
    
    def __init__(self, suppress_types: tuple = ()):
        self.suppress_types = suppress_types
    
    def __enter__(self) -> 'ExceptionSuppressingContextManager':
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        """Exit context, optionally suppressing exceptions."""
        if exc_type is not None and issubclass(exc_type, self.suppress_types):
            print(f"Suppressing exception: {exc_type.__name__}: {exc_val}")
            return True  # Suppress the exception
        return False

@contextmanager
def file_manager(filename: str, mode: str = 'r') -> Generator[Any, None, None]:
    """Context manager using contextlib.contextmanager decorator."""
    print(f"Opening file: {filename}")
    try:
        if mode.startswith('w'):
            # For write mode, create a temporary file
            with tempfile.NamedTemporaryFile(mode=mode, delete=False) as f:
                yield f
        else:
            # For read mode, try to open existing file
            try:
                with open(filename, mode) as f:
                    yield f
            except FileNotFoundError:
                print(f"File not found: {filename}, creating empty file")
                with open(filename, 'w') as f:
                    pass
                with open(filename, mode) as f:
                    yield f
    except Exception as e:
        print(f"Error managing file {filename}: {e}")
        raise
    finally:
        print(f"File management complete for: {filename}")

@contextmanager
def database_transaction(db_path: str) -> Generator[sqlite3.Connection, None, None]:
    """Context manager for database transactions."""
    conn = sqlite3.connect(db_path)
    try:
        print(f"Starting database transaction: {db_path}")
        yield conn
        conn.commit()
        print("Transaction committed")
    except Exception as e:
        print(f"Transaction failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()
        print("Database connection closed")

@asynccontextmanager
async def async_resource_manager(resource_id: str) -> AsyncGenerator[Dict[str, Any], None]:
    """Async context manager for resource management."""
    print(f"Acquiring async resource: {resource_id}")
    resource = {"id": resource_id, "status": "active", "created_at": time.time()}
    
    try:
        await asyncio.sleep(0.1)  # Simulate async setup
        yield resource
    except Exception as e:
        print(f"Error with async resource {resource_id}: {e}")
        resource["status"] = "error"
        raise
    finally:
        await asyncio.sleep(0.1)  # Simulate async cleanup
        resource["status"] = "closed"
        print(f"Released async resource: {resource_id}")

class NestedContextManager:
    """Context manager demonstrating nested context management."""
    
    def __init__(self, name: str):
        self.name = name
        self.nested_managers: List[Any] = []
    
    def __enter__(self) -> 'NestedContextManager':
        print(f"Entering nested context: {self.name}")
        
        # Use ExitStack to manage multiple context managers
        self.exit_stack = ExitStack()
        self.exit_stack.__enter__()
        
        # Add multiple nested context managers
        for i in range(3):
            cm = BasicContextManager(f"{self.name}_nested_{i}")
            self.exit_stack.enter_context(cm)
            self.nested_managers.append(cm)
        
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"Exiting nested context: {self.name}")
        return self.exit_stack.__exit__(exc_type, exc_val, exc_tb)

# =============================================================================
# 2. EXCEPTION HANDLING PATTERNS
# =============================================================================

class CustomBusinessException(Exception):
    """Custom business logic exception."""
    
    def __init__(self, message: str, error_code: str, context: Dict[str, Any] = None):
        super().__init__(message)
        self.error_code = error_code
        self.context = context or {}
        self.timestamp = time.time()

class ValidationError(CustomBusinessException):
    """Validation specific exception."""
    pass

class ProcessingError(CustomBusinessException):
    """Processing specific exception."""
    pass

class RetryableError(CustomBusinessException):
    """Exception that indicates operation should be retried."""
    pass

def simple_exception_handling(data: Any) -> str:
    """Function demonstrating simple exception handling."""
    try:
        result = str(data).upper()
        if len(result) == 0:
            raise ValueError("Empty string not allowed")
        return result
    except (TypeError, AttributeError) as e:
        print(f"Type error: {e}")
        return "TYPE_ERROR"
    except ValueError as e:
        print(f"Value error: {e}")
        return "VALUE_ERROR"
    except Exception as e:
        print(f"Unexpected error: {e}")
        return "UNKNOWN_ERROR"

def complex_exception_handling_with_finally(file_path: str, data: Dict[str, Any]) -> bool:
    """Function demonstrating complex exception handling with finally."""
    file_handle = None
    temp_resource = None
    success = False
    
    try:
        # Multiple potential failure points
        print(f"Processing file: {file_path}")
        
        # Resource acquisition that might fail
        file_handle = open(file_path, 'w')
        temp_resource = tempfile.NamedTemporaryFile(delete=False)
        
        # Processing that might fail
        if not isinstance(data, dict):
            raise ValidationError("Data must be a dictionary", "INVALID_TYPE", {"type": type(data).__name__})
        
        if "required_field" not in data:
            raise ValidationError("Missing required field", "MISSING_FIELD", {"fields": list(data.keys())})
        
        # Simulation of processing that might fail
        processed_data = json.dumps(data, indent=2)
        if len(processed_data) > 1000:
            raise ProcessingError("Data too large", "DATA_TOO_LARGE", {"size": len(processed_data)})
        
        # Write to files
        file_handle.write(processed_data)
        temp_resource.write(processed_data.encode())
        
        success = True
        return True
        
    except ValidationError as e:
        print(f"Validation error: {e} (Code: {e.error_code})")
        print(f"Context: {e.context}")
        return False
    except ProcessingError as e:
        print(f"Processing error: {e} (Code: {e.error_code})")
        print(f"Context: {e.context}")
        return False
    except FileNotFoundError as e:
        print(f"File not found: {e}")
        return False
    except PermissionError as e:
        print(f"Permission denied: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False
    finally:
        # Cleanup resources regardless of success/failure
        print(f"Cleanup - Success: {success}")
        
        if file_handle:
            try:
                file_handle.close()
                print("File handle closed")
            except Exception as e:
                print(f"Error closing file handle: {e}")
        
        if temp_resource:
            try:
                temp_resource.close()
                Path(temp_resource.name).unlink(missing_ok=True)
                print("Temp resource cleaned up")
            except Exception as e:
                print(f"Error cleaning temp resource: {e}")

def nested_exception_handling(operations: List[callable]) -> Dict[str, Any]:
    """Function demonstrating nested exception handling."""
    results = {"operations": [], "errors": [], "summary": {}}
    
    try:
        for i, operation in enumerate(operations):
            try:
                print(f"Executing operation {i}")
                result = operation()
                results["operations"].append({"index": i, "result": result, "status": "success"})
            except RetryableError as e:
                print(f"Retryable error in operation {i}: {e}")
                # Retry logic
                try:
                    print(f"Retrying operation {i}")
                    result = operation()
                    results["operations"].append({"index": i, "result": result, "status": "retry_success"})
                except Exception as retry_error:
                    print(f"Retry failed for operation {i}: {retry_error}")
                    results["errors"].append({"index": i, "error": str(retry_error), "type": "retry_failed"})
            except CustomBusinessException as e:
                print(f"Business error in operation {i}: {e}")
                results["errors"].append({
                    "index": i, 
                    "error": str(e), 
                    "error_code": e.error_code,
                    "context": e.context,
                    "type": "business"
                })
            except Exception as e:
                print(f"Unexpected error in operation {i}: {e}")
                results["errors"].append({"index": i, "error": str(e), "type": "unexpected"})
    except Exception as e:
        print(f"Critical error in operation loop: {e}")
        results["critical_error"] = str(e)
    finally:
        # Summary statistics
        results["summary"] = {
            "total_operations": len(operations),
            "successful": len([op for op in results["operations"] if op["status"] in ["success", "retry_success"]]),
            "failed": len(results["errors"]),
            "retry_successes": len([op for op in results["operations"] if op["status"] == "retry_success"])
        }
    
    return results

def exception_chaining_and_raising(data: Any, strict_mode: bool = False) -> Any:
    """Function demonstrating exception chaining and re-raising."""
    try:
        # First level processing
        try:
            processed = str(data).strip()
            if not processed:
                raise ValueError("Empty data after processing")
        except (TypeError, AttributeError) as e:
            # Chain the exception with context
            raise ProcessingError("Failed to process data", "PROCESSING_FAILED", {"original_type": type(data).__name__}) from e
        
        # Second level validation
        try:
            if strict_mode and len(processed) < 3:
                raise ValidationError("Data too short in strict mode", "DATA_TOO_SHORT", {"length": len(processed)})
        except ValidationError:
            if strict_mode:
                raise  # Re-raise in strict mode
            else:
                print("Validation error ignored in non-strict mode")
        
        return processed
        
    except ProcessingError:
        # Log and re-raise processing errors
        logging.error("Processing error occurred", exc_info=True)
        raise
    except Exception as e:
        # Wrap unexpected errors
        raise RuntimeError(f"Unexpected error in exception_chaining_and_raising: {e}") from e

# =============================================================================
# 3. DESIGN PATTERNS IMPLEMENTATION
# =============================================================================

class Singleton:
    """Singleton pattern implementation."""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, name: str = "default"):
        if not hasattr(self, 'initialized'):
            self.name = name
            self.data = {}
            self.initialized = True

class ObserverPattern:
    """Observer pattern implementation."""
    
    def __init__(self):
        self._observers: List[callable] = []
        self._state: Dict[str, Any] = {}
    
    def subscribe(self, observer: callable) -> None:
        """Subscribe an observer to state changes."""
        if observer not in self._observers:
            self._observers.append(observer)
    
    def unsubscribe(self, observer: callable) -> None:
        """Unsubscribe an observer."""
        if observer in self._observers:
            self._observers.remove(observer)
    
    def notify(self, event: str, data: Any) -> None:
        """Notify all observers of state change."""
        for observer in self._observers:
            try:
                observer(event, data, self._state.copy())
            except Exception as e:
                print(f"Observer error: {e}")
    
    def set_state(self, key: str, value: Any) -> None:
        """Set state and notify observers."""
        old_value = self._state.get(key)
        self._state[key] = value
        self.notify("state_changed", {"key": key, "old_value": old_value, "new_value": value})

class FactoryPattern:
    """Factory pattern for creating objects."""
    
    _creators: Dict[str, callable] = {}
    
    @classmethod
    def register_creator(cls, type_name: str, creator: callable) -> None:
        """Register a creator for a type."""
        cls._creators[type_name] = creator
    
    @classmethod
    def create(cls, type_name: str, *args, **kwargs) -> Any:
        """Create an object of the specified type."""
        creator = cls._creators.get(type_name)
        if not creator:
            raise ValueError(f"Unknown type: {type_name}")
        
        try:
            return creator(*args, **kwargs)
        except Exception as e:
            raise RuntimeError(f"Failed to create {type_name}: {e}") from e

class BuilderPattern:
    """Builder pattern for complex object construction."""
    
    def __init__(self):
        self._product = {}
        self._steps_completed = []
    
    def set_name(self, name: str) -> 'BuilderPattern':
        """Set the name property."""
        self._product["name"] = name
        self._steps_completed.append("name")
        return self
    
    def set_config(self, config: Dict[str, Any]) -> 'BuilderPattern':
        """Set the configuration."""
        self._product["config"] = config.copy()
        self._steps_completed.append("config")
        return self
    
    def add_component(self, component_name: str, component_data: Any) -> 'BuilderPattern':
        """Add a component."""
        if "components" not in self._product:
            self._product["components"] = {}
        self._product["components"][component_name] = component_data
        self._steps_completed.append(f"component_{component_name}")
        return self
    
    def build(self) -> Dict[str, Any]:
        """Build the final product."""
        if "name" not in self._product:
            raise ValueError("Name is required")
        
        product = self._product.copy()
        product["_metadata"] = {
            "steps_completed": self._steps_completed.copy(),
            "build_time": time.time()
        }
        
        # Reset builder for next use
        self._product = {}
        self._steps_completed = []
        
        return product

# Strategy pattern
class StrategyPattern:
    """Strategy pattern for interchangeable algorithms."""
    
    def __init__(self, strategy: callable = None):
        self._strategy = strategy or self._default_strategy
    
    def set_strategy(self, strategy: callable) -> None:
        """Change the strategy."""
        self._strategy = strategy
    
    def execute(self, data: Any) -> Any:
        """Execute the current strategy."""
        try:
            return self._strategy(data)
        except Exception as e:
            print(f"Strategy execution failed: {e}")
            return self._default_strategy(data)
    
    @staticmethod
    def _default_strategy(data: Any) -> str:
        """Default strategy implementation."""
        return f"default_processing_{data}"

# =============================================================================
# 4. RESOURCE MANAGEMENT PATTERNS
# =============================================================================

class ResourcePool:
    """Resource pool pattern for managing limited resources."""
    
    def __init__(self, resource_factory: callable, max_size: int = 10):
        self._resource_factory = resource_factory
        self._max_size = max_size
        self._pool = []
        self._active = set()
        self._lock = threading.Lock()
    
    def acquire(self) -> Any:
        """Acquire a resource from the pool."""
        with self._lock:
            if self._pool:
                resource = self._pool.pop()
            elif len(self._active) < self._max_size:
                resource = self._resource_factory()
            else:
                raise RuntimeError("Resource pool exhausted")
            
            self._active.add(id(resource))
            return resource
    
    def release(self, resource: Any) -> None:
        """Release a resource back to the pool."""
        with self._lock:
            resource_id = id(resource)
            if resource_id in self._active:
                self._active.remove(resource_id)
                if len(self._pool) < self._max_size:
                    self._pool.append(resource)
    
    @contextmanager
    def get_resource(self) -> Generator[Any, None, None]:
        """Context manager for automatic resource management."""
        resource = self.acquire()
        try:
            yield resource
        finally:
            self.release(resource)

class WeakReferenceManager:
    """Manager using weak references to avoid circular dependencies."""
    
    def __init__(self):
        self._references: Dict[str, weakref.ReferenceType] = {}
        self._callbacks: Dict[str, List[callable]] = defaultdict(list)
    
    def register(self, name: str, obj: Any, callback: callable = None) -> None:
        """Register an object with optional callback on deletion."""
        def cleanup_callback(ref):
            print(f"Object {name} was garbage collected")
            for cb in self._callbacks[name]:
                try:
                    cb(name, ref)
                except Exception as e:
                    print(f"Callback error: {e}")
            del self._callbacks[name]
        
        self._references[name] = weakref.ref(obj, cleanup_callback)
        if callback:
            self._callbacks[name].append(callback)
    
    def get(self, name: str) -> Optional[Any]:
        """Get object by name (returns None if garbage collected)."""
        ref = self._references.get(name)
        return ref() if ref else None
    
    def cleanup_dead_references(self) -> List[str]:
        """Remove dead references and return their names."""
        dead_names = []
        for name, ref in list(self._references.items()):
            if ref() is None:
                del self._references[name]
                dead_names.append(name)
        return dead_names

# =============================================================================
# 5. ASYNC PATTERNS AND CONCURRENCY
# =============================================================================

async def async_retry_pattern(
    operation: callable, 
    max_retries: int = 3, 
    delay: float = 1.0,
    backoff_factor: float = 2.0
) -> Any:
    """Async retry pattern with exponential backoff."""
    last_exception = None
    current_delay = delay
    
    for attempt in range(max_retries + 1):
        try:
            print(f"Attempt {attempt + 1}/{max_retries + 1}")
            result = await operation()
            return result
        except RetryableError as e:
            last_exception = e
            print(f"Retryable error on attempt {attempt + 1}: {e}")
            
            if attempt < max_retries:
                print(f"Waiting {current_delay}s before retry...")
                await asyncio.sleep(current_delay)
                current_delay *= backoff_factor
            else:
                print("Max retries exceeded")
        except Exception as e:
            print(f"Non-retryable error: {e}")
            raise
    
    raise RuntimeError(f"Operation failed after {max_retries + 1} attempts") from last_exception

async def async_semaphore_pattern(operations: List[callable], max_concurrent: int = 5) -> List[Any]:
    """Async semaphore pattern for limiting concurrency."""
    semaphore = asyncio.Semaphore(max_concurrent)
    results = []
    
    async def execute_with_semaphore(operation, index):
        async with semaphore:
            try:
                print(f"Starting operation {index}")
                result = await operation()
                print(f"Completed operation {index}")
                return {"index": index, "result": result, "status": "success"}
            except Exception as e:
                print(f"Operation {index} failed: {e}")
                return {"index": index, "error": str(e), "status": "failed"}
    
    # Execute all operations with controlled concurrency
    tasks = [execute_with_semaphore(op, i) for i, op in enumerate(operations)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    return results

class AsyncContextPool:
    """Async context manager pool for resource management."""
    
    def __init__(self, resource_factory: callable, max_size: int = 10):
        self._resource_factory = resource_factory
        self._max_size = max_size
        self._pool = asyncio.Queue(maxsize=max_size)
        self._active_count = 0
        self._lock = asyncio.Lock()
    
    async def _create_resource(self) -> Any:
        """Create a new resource."""
        return await self._resource_factory()
    
    @asynccontextmanager
    async def get_resource(self) -> AsyncGenerator[Any, None]:
        """Get a resource from the pool with automatic cleanup."""
        async with self._lock:
            try:
                # Try to get from pool
                resource = self._pool.get_nowait()
            except asyncio.QueueEmpty:
                if self._active_count < self._max_size:
                    resource = await self._create_resource()
                    self._active_count += 1
                else:
                    # Wait for a resource to become available
                    resource = await self._pool.get()
        
        try:
            yield resource
        finally:
            # Return to pool
            try:
                self._pool.put_nowait(resource)
            except asyncio.QueueFull:
                # Pool is full, resource will be discarded
                async with self._lock:
                    self._active_count -= 1

# =============================================================================
# 6. FUNCTIONAL PATTERNS AND DECORATORS
# =============================================================================

def retry_decorator(max_retries: int = 3, delay: float = 1.0, exceptions: tuple = (Exception,)):
    """Decorator for automatic retry with exponential backoff."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        print(f"Retry {attempt + 1}/{max_retries} after {current_delay}s: {e}")
                        time.sleep(current_delay)
                        current_delay *= 2
                    else:
                        print(f"Max retries exceeded for {func.__name__}")
                except Exception:
                    # Non-retryable exception
                    raise
            
            raise last_exception
        return wrapper
    return decorator

def timing_decorator(func):
    """Decorator to measure function execution time."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            print(f"{func.__name__} executed in {execution_time:.4f}s")
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            print(f"{func.__name__} failed after {execution_time:.4f}s: {e}")
            raise
    return wrapper

def memoization_with_ttl(ttl_seconds: int = 300):
    """Decorator for memoization with time-to-live."""
    def decorator(func):
        cache = {}
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key
            key = str(args) + str(sorted(kwargs.items()))
            current_time = time.time()
            
            # Check if cached result is still valid
            if key in cache:
                result, timestamp = cache[key]
                if current_time - timestamp < ttl_seconds:
                    print(f"Cache hit for {func.__name__}")
                    return result
                else:
                    print(f"Cache expired for {func.__name__}")
                    del cache[key]
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            cache[key] = (result, current_time)
            print(f"Cached result for {func.__name__}")
            return result
        
        # Add cache management methods
        wrapper.clear_cache = lambda: cache.clear()
        wrapper.cache_info = lambda: {"size": len(cache), "keys": list(cache.keys())}
        
        return wrapper
    return decorator

@singledispatch
def process_data(data):
    """Single dispatch pattern for processing different data types."""
    return f"unknown_type: {type(data).__name__}"

@process_data.register(str)
def _(data: str) -> str:
    """Process string data."""
    return f"string_processed: {data.upper()}"

@process_data.register(int)
def _(data: int) -> str:
    """Process integer data."""
    return f"int_processed: {data * 2}"

@process_data.register(list)
def _(data: list) -> str:
    """Process list data."""
    return f"list_processed: {len(data)} items"

@process_data.register(dict)
def _(data: dict) -> str:
    """Process dictionary data."""
    return f"dict_processed: {list(data.keys())}"

if __name__ == "__main__":
    import json
    
    # Test pattern recognition
    print("Testing Layer 4 Pattern Recognition:")
    
    # Test context managers
    with BasicContextManager("test_resource") as cm:
        print(f"Using resource: {cm.resource}")
    
    # Test exception handling
    try:
        result = complex_exception_handling_with_finally("test.txt", {"required_field": "value"})
        print(f"Exception handling result: {result}")
    except Exception as e:
        print(f"Exception caught: {e}")
    
    # Test design patterns
    singleton1 = Singleton("first")
    singleton2 = Singleton("second")
    print(f"Singleton test: {singleton1 is singleton2}, name: {singleton1.name}")
    
    # Test builder pattern
    builder = BuilderPattern()
    product = (builder
               .set_name("test_product")
               .set_config({"debug": True})
               .add_component("engine", "v8")
               .add_component("ui", "react")
               .build())
    print(f"Builder pattern result: {product}")
    
    # Test single dispatch
    print(f"Single dispatch - string: {process_data('hello')}")
    print(f"Single dispatch - int: {process_data(42)}")
    print(f"Single dispatch - list: {process_data([1, 2, 3])}")
    print(f"Single dispatch - dict: {process_data({'a': 1, 'b': 2})}")