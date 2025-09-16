"""
TASK-003B Layer 1: Enhanced Basic Parsing Test File

This file tests enhanced basic parsing capabilities including:
- Method type classification (instance, static, class methods)
- Complex type hints (Union, Optional, Generic)
- Advanced decorator patterns and chaining
- Class method extraction within class definitions

Test Coverage:
- Instance methods, static methods, class methods
- Complex type annotations with Union, Optional, Generic
- Multiple decorators and decorator chaining
- Property methods and descriptors
"""

from typing import Union, Optional, Generic, TypeVar, List, Dict, Tuple, Callable, Any
from abc import ABC, abstractmethod
from dataclasses import dataclass
import asyncio
from functools import wraps, lru_cache
from contextlib import contextmanager

T = TypeVar('T')
U = TypeVar('U')
V = TypeVar('V', bound=str)

# =============================================================================
# 1. COMPLEX TYPE HINTS AND ANNOTATIONS
# =============================================================================

def complex_function(
    param1: Union[str, int, None] = None,
    param2: Optional[List[Dict[str, Any]]] = None,
    param3: Callable[[int, str], bool] = lambda x, y: True,
    param4: Tuple[int, ...] = (),
    *args: Any,
    **kwargs: Dict[str, Union[int, str]]
) -> Optional[Dict[str, Union[List[int], Tuple[str, ...]]]]:
    """Function with complex type annotations."""
    pass

def generic_function(items: List[T], mapper: Callable[[T], U]) -> List[U]:
    """Generic function with type variables."""
    return [mapper(item) for item in items]

async def async_complex_function(
    data: Dict[str, List[Optional[int]]],
    callback: Optional[Callable[[str], Callable[[], None]]] = None
) -> Union[str, List[Dict[str, Any]], None]:
    """Async function with nested complex types."""
    await asyncio.sleep(0.1)
    return None

# =============================================================================
# 2. ADVANCED DECORATOR PATTERNS
# =============================================================================

def custom_decorator(func_or_class):
    """Custom decorator that can be applied to functions or classes."""
    @wraps(func_or_class)
    def wrapper(*args, **kwargs):
        print(f"Calling {func_or_class.__name__}")
        return func_or_class(*args, **kwargs)
    return wrapper

def parametrized_decorator(param1: str, param2: int = 0):
    """Parametrized decorator with type hints."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            print(f"Param1: {param1}, Param2: {param2}")
            return func(*args, **kwargs)
        return wrapper
    return decorator

# Test decorator chaining
@custom_decorator
@parametrized_decorator("test", 42)
@lru_cache(maxsize=128)
def heavily_decorated_function(x: int, y: str) -> Tuple[int, str]:
    """Function with multiple chained decorators."""
    return (x, y)

# =============================================================================
# 3. METHOD TYPE CLASSIFICATION
# =============================================================================

class AdvancedClass(ABC, Generic[T]):
    """Class demonstrating all method types and advanced features."""
    
    class_var: Dict[str, int] = {}
    _private_var: Optional[str] = None
    
    def __init__(self, value: T, name: str = "default") -> None:
        """Constructor with type hints."""
        self.value = value
        self.name = name
        self._protected = "protected"
        self.__private = "private"
    
    # Instance methods
    def instance_method(self, param: Union[int, str]) -> bool:
        """Regular instance method."""
        return True
    
    def _protected_method(self, data: List[T]) -> Optional[T]:
        """Protected instance method."""
        return data[0] if data else None
    
    def __private_method(self, value: Any) -> str:
        """Private instance method."""
        return str(value)
    
    # Class methods
    @classmethod
    def class_method(cls, param: Dict[str, Any]) -> 'AdvancedClass[str]':
        """Class method with forward reference."""
        return cls("created", "class_method")
    
    @classmethod
    def alternative_constructor(
        cls, 
        data: Dict[str, Union[int, str, List[Any]]]
    ) -> 'AdvancedClass[Any]':
        """Alternative constructor pattern."""
        return cls(data.get("value"), str(data.get("name", "alt")))
    
    # Static methods
    @staticmethod
    def static_method(x: int, y: int) -> int:
        """Static method."""
        return x + y
    
    @staticmethod
    def static_validator(value: Any) -> bool:
        """Static validation method."""
        return value is not None
    
    # Property methods
    @property
    def computed_property(self) -> str:
        """Computed property."""
        return f"{self.name}_{self.value}"
    
    @computed_property.setter
    def computed_property(self, value: str) -> None:
        """Property setter."""
        parts = value.split("_", 1)
        if len(parts) == 2:
            self.name, self.value = parts[0], parts[1]
    
    @computed_property.deleter
    def computed_property(self) -> None:
        """Property deleter."""
        self.name = ""
        self.value = None
    
    # Abstract methods
    @abstractmethod
    def abstract_method(self, param: T) -> Optional[U]:
        """Abstract method to be implemented by subclasses."""
        pass
    
    @abstractmethod
    async def async_abstract_method(self, data: List[T]) -> Dict[str, Any]:
        """Async abstract method."""
        pass
    
    # Decorated methods
    @custom_decorator
    @parametrized_decorator("method", 1)
    def decorated_method(self, items: List[T]) -> Tuple[int, List[T]]:
        """Method with multiple decorators."""
        return len(items), items
    
    @lru_cache(maxsize=None)
    def cached_method(self, key: str) -> Optional[str]:
        """Method with caching decorator."""
        return self.class_var.get(key)

# =============================================================================
# 4. INHERITANCE AND METHOD CLASSIFICATION
# =============================================================================

class ConcreteClass(AdvancedClass[str]):
    """Concrete implementation of AdvancedClass."""
    
    def __init__(self, value: str, name: str = "concrete", extra: int = 0):
        """Constructor that calls parent."""
        super().__init__(value, name)
        self.extra = extra
    
    # Override abstract methods
    def abstract_method(self, param: str) -> Optional[int]:
        """Concrete implementation of abstract method."""
        return len(param) if param else None
    
    async def async_abstract_method(self, data: List[str]) -> Dict[str, Any]:
        """Concrete async implementation."""
        await asyncio.sleep(0.01)
        return {"count": len(data), "items": data}
    
    # Override instance method
    def instance_method(self, param: Union[int, str]) -> bool:
        """Override parent instance method."""
        result = super().instance_method(param)
        return result and isinstance(param, (int, str))
    
    # Additional class method
    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> 'ConcreteClass':
        """Factory method from configuration."""
        return cls(
            value=config.get("value", "default"),
            name=config.get("name", "config"),
            extra=config.get("extra", 0)
        )
    
    # Method with complex signature
    def complex_signature_method(
        self,
        required: str,
        optional: Optional[int] = None,
        *args: Union[str, int],
        flag: bool = False,
        **kwargs: Any
    ) -> Tuple[str, Optional[int], Tuple[Union[str, int], ...], bool, Dict[str, Any]]:
        """Method demonstrating complex parameter patterns."""
        return (required, optional, args, flag, kwargs)

# =============================================================================
# 5. MULTIPLE INHERITANCE AND MIXINS
# =============================================================================

class MixinA:
    """First mixin class."""
    
    def mixin_a_method(self) -> str:
        return "mixin_a"
    
    def shared_method(self) -> str:
        return "from_mixin_a"

class MixinB:
    """Second mixin class."""
    
    def mixin_b_method(self) -> str:
        return "mixin_b"
    
    def shared_method(self) -> str:
        return "from_mixin_b"

class MultipleInheritanceClass(MixinA, MixinB, ConcreteClass):
    """Class demonstrating multiple inheritance and MRO."""
    
    def __init__(self, value: str):
        ConcreteClass.__init__(self, value, "multiple")
        self.mixin_data = "initialized"
    
    def shared_method(self) -> str:
        """Override shared method to demonstrate MRO."""
        parent_result = super().shared_method()
        return f"multiple_{parent_result}"
    
    def demonstrate_mro(self) -> List[str]:
        """Method that uses MRO to call parent methods."""
        results = []
        for cls in self.__class__.__mro__:
            if hasattr(cls, 'shared_method') and cls != self.__class__:
                results.append(f"{cls.__name__}: {cls.shared_method(self)}")
        return results

# =============================================================================
# 6. NESTED CLASSES AND INNER METHODS
# =============================================================================

class OuterClass:
    """Class with nested classes and complex structure."""
    
    outer_attr: str = "outer"
    
    def __init__(self, name: str):
        self.name = name
    
    class InnerClass:
        """Nested inner class."""
        
        inner_attr: int = 42
        
        def __init__(self, value: int):
            self.value = value
        
        def inner_method(self) -> str:
            return f"inner_{self.value}"
        
        @classmethod
        def inner_class_method(cls) -> 'OuterClass.InnerClass':
            return cls(cls.inner_attr)
        
        class DeeplyNestedClass:
            """Deeply nested class."""
            
            def deeply_nested_method(self, x: Any) -> bool:
                return x is not None
    
    def create_inner(self, value: int) -> InnerClass:
        """Method that creates inner class instance."""
        return self.InnerClass(value)
    
    def outer_method_with_inner_logic(self) -> Dict[str, Any]:
        """Method that uses inner class."""
        inner = self.create_inner(10)
        deeply_nested = self.InnerClass.DeeplyNestedClass()
        
        return {
            "outer": self.name,
            "inner": inner.inner_method(),
            "deeply_nested_result": deeply_nested.deeply_nested_method("test")
        }

# =============================================================================
# 7. LAMBDA AND COMPLEX FUNCTION EXPRESSIONS
# =============================================================================

# Simple lambda
simple_lambda = lambda x: x * 2

# Complex lambda with type hints (Note: mypy-style comment annotations)
complex_lambda: Callable[[List[int], int], List[int]] = lambda lst, n: [x for x in lst if x > n]

# Lambda in method context
class LambdaContainer:
    """Class containing various lambda expressions."""
    
    def __init__(self):
        self.processor = lambda x: str(x).upper()
        self.validator = lambda item: isinstance(item, (str, int)) and item
    
    def method_with_lambdas(self, data: List[Any]) -> List[str]:
        """Method using lambda expressions."""
        filtered = filter(self.validator, data)
        processed = map(self.processor, filtered)
        return list(processed)
    
    @property
    def lambda_property(self) -> Callable[[Any], bool]:
        """Property returning a lambda."""
        return lambda x: hasattr(x, '__str__')

# =============================================================================
# 8. FUNCTION ANNOTATIONS AND METADATA
# =============================================================================

def annotated_function(
    param: str, 
    /, 
    positional_or_keyword: int = 0, 
    *, 
    keyword_only: bool = True
) -> Tuple[str, int, bool]:
    """Function demonstrating all parameter types."""
    return (param, positional_or_keyword, keyword_only)

def function_with_metadata(x: int) -> int:
    """Function with custom metadata."""
    function_with_metadata.custom_attr = "metadata"
    return x * 2

# Add metadata after definition
function_with_metadata.version = "1.0"
function_with_metadata.author = "test"

if __name__ == "__main__":
    # Test code to validate parsing
    concrete = ConcreteClass("test")
    result = concrete.complex_signature_method("required", 42, "extra", flag=True, custom="value")
    print(f"Complex signature result: {result}")