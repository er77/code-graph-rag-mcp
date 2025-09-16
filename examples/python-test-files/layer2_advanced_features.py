"""
TASK-003B Layer 2: Advanced Feature Analysis Test File

This file tests advanced feature analysis including:
- Property decorator analysis (@property, @setter, @getter)
- Magic method detection (__init__, __str__, __repr__, __call__, etc.)
- Async/await pattern recognition
- Generator and iterator pattern analysis (yield, yield from)
- Dataclass and named tuple recognition

Test Coverage:
- All Python magic/dunder methods
- Property decorators and descriptors
- Async/await patterns and async generators
- Generator functions and yield expressions
- Dataclasses, NamedTuple, and other special classes
"""

from typing import Iterator, AsyncIterator, Generator, AsyncGenerator, NamedTuple, Any, Optional, List, Dict, Tuple
from dataclasses import dataclass, field, InitVar
from collections import namedtuple
from abc import ABC, abstractmethod
import asyncio
from contextlib import contextmanager, asynccontextmanager
from enum import Enum, IntEnum, Flag, auto

# =============================================================================
# 1. MAGIC/DUNDER METHODS COMPREHENSIVE TEST
# =============================================================================

class MagicMethodsClass:
    """Class demonstrating all major magic methods."""
    
    def __init__(self, value: Any, name: str = "magic"):
        """Object initialization."""
        self.value = value
        self.name = name
        self.items = []
    
    def __new__(cls, *args, **kwargs):
        """Object creation (before __init__)."""
        print(f"Creating new instance of {cls.__name__}")
        return super().__new__(cls)
    
    def __del__(self):
        """Object destruction."""
        print(f"Deleting {self.name}")
    
    # String representation methods
    def __str__(self) -> str:
        """String representation for end users."""
        return f"{self.name}: {self.value}"
    
    def __repr__(self) -> str:
        """String representation for developers."""
        return f"MagicMethodsClass(value={self.value!r}, name={self.name!r})"
    
    def __format__(self, format_spec: str) -> str:
        """Custom format specification."""
        if format_spec == 'upper':
            return str(self).upper()
        return str(self)
    
    def __bytes__(self) -> bytes:
        """Bytes representation."""
        return str(self).encode('utf-8')
    
    # Comparison methods
    def __eq__(self, other) -> bool:
        """Equality comparison."""
        if isinstance(other, MagicMethodsClass):
            return self.value == other.value
        return self.value == other
    
    def __ne__(self, other) -> bool:
        """Not equal comparison."""
        return not self.__eq__(other)
    
    def __lt__(self, other) -> bool:
        """Less than comparison."""
        if isinstance(other, MagicMethodsClass):
            return self.value < other.value
        return self.value < other
    
    def __le__(self, other) -> bool:
        """Less than or equal comparison."""
        return self.__lt__(other) or self.__eq__(other)
    
    def __gt__(self, other) -> bool:
        """Greater than comparison."""
        return not self.__le__(other)
    
    def __ge__(self, other) -> bool:
        """Greater than or equal comparison."""
        return not self.__lt__(other)
    
    def __hash__(self) -> int:
        """Hash value for use in sets and dicts."""
        return hash((self.value, self.name))
    
    # Arithmetic operators
    def __add__(self, other) -> 'MagicMethodsClass':
        """Addition operator."""
        if isinstance(other, MagicMethodsClass):
            return MagicMethodsClass(self.value + other.value, f"{self.name}+{other.name}")
        return MagicMethodsClass(self.value + other, self.name)
    
    def __radd__(self, other) -> 'MagicMethodsClass':
        """Reverse addition."""
        return MagicMethodsClass(other + self.value, self.name)
    
    def __iadd__(self, other) -> 'MagicMethodsClass':
        """In-place addition."""
        if isinstance(other, MagicMethodsClass):
            self.value += other.value
        else:
            self.value += other
        return self
    
    def __sub__(self, other) -> 'MagicMethodsClass':
        """Subtraction operator."""
        return MagicMethodsClass(self.value - other, self.name)
    
    def __mul__(self, other) -> 'MagicMethodsClass':
        """Multiplication operator."""
        return MagicMethodsClass(self.value * other, self.name)
    
    def __truediv__(self, other) -> 'MagicMethodsClass':
        """True division operator."""
        return MagicMethodsClass(self.value / other, self.name)
    
    def __floordiv__(self, other) -> 'MagicMethodsClass':
        """Floor division operator."""
        return MagicMethodsClass(self.value // other, self.name)
    
    def __mod__(self, other) -> 'MagicMethodsClass':
        """Modulo operator."""
        return MagicMethodsClass(self.value % other, self.name)
    
    def __pow__(self, other) -> 'MagicMethodsClass':
        """Power operator."""
        return MagicMethodsClass(self.value ** other, self.name)
    
    # Bitwise operators
    def __and__(self, other) -> 'MagicMethodsClass':
        """Bitwise AND."""
        return MagicMethodsClass(self.value & other, self.name)
    
    def __or__(self, other) -> 'MagicMethodsClass':
        """Bitwise OR."""
        return MagicMethodsClass(self.value | other, self.name)
    
    def __xor__(self, other) -> 'MagicMethodsClass':
        """Bitwise XOR."""
        return MagicMethodsClass(self.value ^ other, self.name)
    
    def __lshift__(self, other) -> 'MagicMethodsClass':
        """Left bitwise shift."""
        return MagicMethodsClass(self.value << other, self.name)
    
    def __rshift__(self, other) -> 'MagicMethodsClass':
        """Right bitwise shift."""
        return MagicMethodsClass(self.value >> other, self.name)
    
    def __invert__(self) -> 'MagicMethodsClass':
        """Bitwise NOT."""
        return MagicMethodsClass(~self.value, self.name)
    
    # Container/sequence methods
    def __len__(self) -> int:
        """Length of the container."""
        return len(self.items)
    
    def __getitem__(self, key) -> Any:
        """Get item by key/index."""
        return self.items[key]
    
    def __setitem__(self, key, value) -> None:
        """Set item by key/index."""
        self.items[key] = value
    
    def __delitem__(self, key) -> None:
        """Delete item by key/index."""
        del self.items[key]
    
    def __contains__(self, item) -> bool:
        """Check if item is contained."""
        return item in self.items
    
    def __iter__(self) -> Iterator[Any]:
        """Iterator protocol."""
        return iter(self.items)
    
    def __reversed__(self) -> Iterator[Any]:
        """Reverse iterator."""
        return reversed(self.items)
    
    # Attribute access
    def __getattr__(self, name: str) -> Any:
        """Get attribute that doesn't exist normally."""
        return f"dynamic_{name}"
    
    def __setattr__(self, name: str, value: Any) -> None:
        """Set attribute."""
        super().__setattr__(name, value)
    
    def __delattr__(self, name: str) -> None:
        """Delete attribute."""
        super().__delattr__(name)
    
    def __getattribute__(self, name: str) -> Any:
        """Get any attribute (careful with recursion)."""
        return super().__getattribute__(name)
    
    # Callable protocol
    def __call__(self, *args, **kwargs) -> str:
        """Make instance callable."""
        return f"Called {self.name} with args={args}, kwargs={kwargs}"
    
    # Context manager
    def __enter__(self) -> 'MagicMethodsClass':
        """Enter context manager."""
        print(f"Entering context for {self.name}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> Optional[bool]:
        """Exit context manager."""
        print(f"Exiting context for {self.name}")
        return None  # Don't suppress exceptions
    
    # Copy protocol
    def __copy__(self) -> 'MagicMethodsClass':
        """Shallow copy."""
        return MagicMethodsClass(self.value, f"{self.name}_copy")
    
    def __deepcopy__(self, memo) -> 'MagicMethodsClass':
        """Deep copy."""
        import copy
        return MagicMethodsClass(copy.deepcopy(self.value, memo), f"{self.name}_deepcopy")

# =============================================================================
# 2. PROPERTY DECORATORS AND DESCRIPTORS
# =============================================================================

class PropertyDescriptorClass:
    """Class demonstrating various property patterns."""
    
    def __init__(self, initial_value: int = 0):
        self._value = initial_value
        self._computed = 0
        self._cached_result = None
        self._dirty = True
    
    @property
    def value(self) -> int:
        """Simple property getter."""
        return self._value
    
    @value.setter
    def value(self, new_value: int) -> None:
        """Property setter with validation."""
        if not isinstance(new_value, int):
            raise TypeError("Value must be an integer")
        if new_value < 0:
            raise ValueError("Value must be non-negative")
        self._value = new_value
        self._dirty = True  # Mark cached result as dirty
    
    @value.deleter
    def value(self) -> None:
        """Property deleter."""
        self._value = 0
        self._dirty = True
    
    @property
    def computed_property(self) -> int:
        """Property with complex computation."""
        if self._dirty or self._cached_result is None:
            # Expensive computation
            self._cached_result = self._value ** 2 + sum(range(self._value))
            self._dirty = False
        return self._cached_result
    
    @property
    def read_only_property(self) -> str:
        """Read-only property (no setter)."""
        return f"readonly_{self._value}"
    
    # Property with custom getter/setter names
    def _get_special_value(self) -> float:
        """Custom getter method."""
        return self._value * 3.14159
    
    def _set_special_value(self, value: float) -> None:
        """Custom setter method."""
        self._value = int(value / 3.14159)
    
    special_value = property(_get_special_value, _set_special_value, doc="Special computed value")

# Custom descriptor class
class ValidatedDescriptor:
    """Custom descriptor with validation."""
    
    def __init__(self, min_value: int = 0, max_value: int = 100):
        self.min_value = min_value
        self.max_value = max_value
        self.name = None
    
    def __set_name__(self, owner, name):
        """Set the name of the descriptor."""
        self.name = name
        self.private_name = f'_{name}'
    
    def __get__(self, obj, objtype=None) -> int:
        """Descriptor getter."""
        if obj is None:
            return self
        return getattr(obj, self.private_name, 0)
    
    def __set__(self, obj, value: int) -> None:
        """Descriptor setter with validation."""
        if not isinstance(value, int):
            raise TypeError(f"{self.name} must be an integer")
        if not (self.min_value <= value <= self.max_value):
            raise ValueError(f"{self.name} must be between {self.min_value} and {self.max_value}")
        setattr(obj, self.private_name, value)
    
    def __delete__(self, obj) -> None:
        """Descriptor deleter."""
        delattr(obj, self.private_name)

class ClassWithDescriptors:
    """Class using custom descriptors."""
    
    score = ValidatedDescriptor(0, 100)
    rating = ValidatedDescriptor(1, 5)
    
    def __init__(self, score: int = 50, rating: int = 3):
        self.score = score
        self.rating = rating

# =============================================================================
# 3. ASYNC/AWAIT PATTERNS
# =============================================================================

async def simple_async_function(delay: float = 1.0) -> str:
    """Simple async function."""
    await asyncio.sleep(delay)
    return f"Completed after {delay}s"

async def async_function_with_complex_logic(
    urls: List[str], 
    timeout: float = 5.0
) -> Dict[str, Any]:
    """Async function with complex operations."""
    results = {}
    
    async def fetch_url(url: str) -> str:
        """Nested async function."""
        await asyncio.sleep(0.1)  # Simulate network delay
        return f"content_from_{url}"
    
    # Parallel execution
    tasks = [fetch_url(url) for url in urls]
    try:
        responses = await asyncio.wait_for(asyncio.gather(*tasks), timeout=timeout)
        results = dict(zip(urls, responses))
    except asyncio.TimeoutError:
        results = {"error": "timeout"}
    
    return results

class AsyncClass:
    """Class with async methods."""
    
    def __init__(self, name: str):
        self.name = name
        self._cache: Dict[str, Any] = {}
    
    async def async_method(self, key: str) -> Optional[str]:
        """Async instance method."""
        if key in self._cache:
            return self._cache[key]
        
        # Simulate async operation
        await asyncio.sleep(0.1)
        result = f"async_result_{key}_{self.name}"
        self._cache[key] = result
        return result
    
    @classmethod
    async def async_class_method(cls, data: Dict[str, Any]) -> 'AsyncClass':
        """Async class method."""
        await asyncio.sleep(0.05)
        return cls(data.get("name", "async_created"))
    
    @staticmethod
    async def async_static_method(value: str) -> str:
        """Async static method."""
        await asyncio.sleep(0.02)
        return value.upper()
    
    # Async context manager
    async def __aenter__(self) -> 'AsyncClass':
        """Async context manager entry."""
        await asyncio.sleep(0.01)
        print(f"Entering async context for {self.name}")
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await asyncio.sleep(0.01)
        print(f"Exiting async context for {self.name}")
    
    # Async iterator
    def __aiter__(self) -> AsyncIterator[str]:
        """Return async iterator."""
        return self
    
    async def __anext__(self) -> str:
        """Async iterator next method."""
        if hasattr(self, '_iter_count'):
            self._iter_count += 1
        else:
            self._iter_count = 0
        
        if self._iter_count >= 3:
            raise StopAsyncIteration
        
        await asyncio.sleep(0.1)
        return f"async_item_{self._iter_count}_{self.name}"

# =============================================================================
# 4. GENERATOR AND ITERATOR PATTERNS
# =============================================================================

def simple_generator(n: int) -> Generator[int, None, None]:
    """Simple generator function."""
    for i in range(n):
        yield i

def generator_with_send(initial: int = 0) -> Generator[int, Optional[int], str]:
    """Generator that accepts sent values."""
    current = initial
    sent_value = None
    
    while True:
        sent_value = yield current
        if sent_value is None:
            current += 1
        elif sent_value == -1:
            break
        else:
            current = sent_value
    
    return f"Generator finished with value {current}"

def generator_with_yield_from(iterables: List[List[int]]) -> Generator[int, None, None]:
    """Generator using yield from."""
    for iterable in iterables:
        yield from iterable
        yield -1  # Separator

def recursive_generator(data: Any, max_depth: int = 3) -> Generator[Any, None, None]:
    """Recursive generator for nested structures."""
    if max_depth <= 0:
        yield data
        return
    
    if isinstance(data, (list, tuple)):
        for item in data:
            yield from recursive_generator(item, max_depth - 1)
    elif isinstance(data, dict):
        for key, value in data.items():
            yield key
            yield from recursive_generator(value, max_depth - 1)
    else:
        yield data

async def async_generator(n: int) -> AsyncGenerator[int, None]:
    """Async generator function."""
    for i in range(n):
        await asyncio.sleep(0.01)
        yield i

async def async_generator_with_send(
    initial: int = 0
) -> AsyncGenerator[int, Optional[int]]:
    """Async generator that accepts sent values."""
    current = initial
    sent_value = None
    
    while True:
        sent_value = yield current
        await asyncio.sleep(0.01)
        
        if sent_value is None:
            current += 1
        elif sent_value == -1:
            break
        else:
            current = sent_value

class IteratorClass:
    """Class implementing iterator protocol."""
    
    def __init__(self, data: List[Any]):
        self.data = data
        self.index = 0
    
    def __iter__(self) -> Iterator[Any]:
        """Return iterator."""
        return self
    
    def __next__(self) -> Any:
        """Get next item."""
        if self.index >= len(self.data):
            raise StopIteration
        
        value = self.data[self.index]
        self.index += 1
        return value

# =============================================================================
# 5. DATACLASSES AND NAMED TUPLES
# =============================================================================

@dataclass
class SimpleDataClass:
    """Simple dataclass with basic fields."""
    name: str
    age: int
    active: bool = True

@dataclass
class AdvancedDataClass:
    """Advanced dataclass with various field types."""
    id: int
    name: str
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    score: float = field(default=0.0, compare=False)
    _internal: str = field(default="private", init=False, repr=False)
    
    def __post_init__(self):
        """Post-initialization processing."""
        self._internal = f"processed_{self.name}"

@dataclass(frozen=True)
class FrozenDataClass:
    """Immutable dataclass."""
    x: int
    y: int
    
    @property
    def distance(self) -> float:
        """Computed property in frozen dataclass."""
        return (self.x ** 2 + self.y ** 2) ** 0.5

@dataclass
class DataClassWithInitVar:
    """Dataclass with InitVar fields."""
    name: str
    processed_name: str = field(init=False)
    transformation: InitVar[str] = "upper"
    
    def __post_init__(self, transformation: str):
        """Process InitVar parameters."""
        if transformation == "upper":
            self.processed_name = self.name.upper()
        elif transformation == "lower":
            self.processed_name = self.name.lower()
        else:
            self.processed_name = self.name

# Named tuples
SimpleNamedTuple = namedtuple('SimpleNamedTuple', ['x', 'y', 'z'])

# Named tuple with defaults (Python 3.7+)
AdvancedNamedTuple = namedtuple(
    'AdvancedNamedTuple', 
    ['name', 'value', 'optional'], 
    defaults=[None]
)

class CustomNamedTuple(NamedTuple):
    """Custom named tuple with type hints."""
    name: str
    count: int
    active: bool = True
    
    def description(self) -> str:
        """Method in named tuple."""
        status = "active" if self.active else "inactive"
        return f"{self.name}: {self.count} ({status})"

# =============================================================================
# 6. ENUMS AND FLAGS
# =============================================================================

class SimpleEnum(Enum):
    """Simple enumeration."""
    RED = "red"
    GREEN = "green"
    BLUE = "blue"

class IntBasedEnum(IntEnum):
    """Integer-based enumeration."""
    LOW = 1
    MEDIUM = 2
    HIGH = 3

class AutoEnum(Enum):
    """Enumeration with auto-generated values."""
    FIRST = auto()
    SECOND = auto()
    THIRD = auto()

class FlagEnum(Flag):
    """Flag enumeration for bitwise operations."""
    READ = auto()
    WRITE = auto()
    EXECUTE = auto()
    
    # Compound flags
    READ_WRITE = READ | WRITE
    ALL = READ | WRITE | EXECUTE

# =============================================================================
# 7. CONTEXT MANAGERS
# =============================================================================

@contextmanager
def simple_context_manager(name: str) -> Generator[str, None, None]:
    """Simple context manager using contextlib."""
    print(f"Entering context: {name}")
    try:
        yield f"resource_{name}"
    except Exception as e:
        print(f"Exception in context: {e}")
        raise
    finally:
        print(f"Exiting context: {name}")

@asynccontextmanager
async def async_context_manager(name: str) -> AsyncGenerator[str, None]:
    """Async context manager."""
    print(f"Entering async context: {name}")
    try:
        await asyncio.sleep(0.01)
        yield f"async_resource_{name}"
    except Exception as e:
        print(f"Exception in async context: {e}")
        raise
    finally:
        await asyncio.sleep(0.01)
        print(f"Exiting async context: {name}")

class ResourceManager:
    """Class-based context manager."""
    
    def __init__(self, resource_name: str):
        self.resource_name = resource_name
        self.resource = None
    
    def __enter__(self) -> 'ResourceManager':
        """Acquire resource."""
        print(f"Acquiring resource: {self.resource_name}")
        self.resource = f"acquired_{self.resource_name}"
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> Optional[bool]:
        """Release resource."""
        print(f"Releasing resource: {self.resource_name}")
        self.resource = None
        if exc_type is not None:
            print(f"Exception occurred: {exc_type.__name__}: {exc_val}")
        return False  # Don't suppress exceptions

if __name__ == "__main__":
    # Test advanced features
    print("Testing Layer 2 Advanced Features:")
    
    # Test magic methods
    magic1 = MagicMethodsClass(10, "test1")
    magic2 = MagicMethodsClass(20, "test2")
    print(f"Magic comparison: {magic1 < magic2}")
    print(f"Magic addition: {magic1 + magic2}")
    
    # Test properties
    prop_obj = PropertyDescriptorClass(5)
    print(f"Computed property: {prop_obj.computed_property}")
    
    # Test dataclass
    data_obj = AdvancedDataClass(1, "test", ["tag1", "tag2"])
    print(f"Dataclass: {data_obj}")