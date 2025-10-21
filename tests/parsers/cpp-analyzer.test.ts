/**
 * TASK-20251005191500: C++ Analyzer Test Suite
 *
 * Comprehensive tests for C++ language analyzer including:
 * - Classes and inheritance
 * - Templates (limited support)
 * - Namespaces
 * - Operator overloading
 * - Circuit breaker validation
 */

import { beforeEach, describe, expect, it } from "@jest/globals";
import { CppAnalyzer } from "../../src/parsers/cpp-analyzer";
import { TreeSitterParser } from "../../src/parsers/tree-sitter-parser";

describe("CppAnalyzer", () => {
  let _analyzer: CppAnalyzer;
  let parser: TreeSitterParser;

  beforeEach(async () => {
    _analyzer = new CppAnalyzer();
    parser = new TreeSitterParser();
    await parser.initialize();
  });

  describe("Class Analysis", () => {
    it("should extract basic classes", async () => {
      const code = `
class MyClass {
public:
    MyClass() {}
    ~MyClass() {}
    void publicMethod() {}
private:
    int privateField;
protected:
    void protectedMethod() {}
};
      `;

      const result = await parser.parse("test.cpp", code, "hash1");
      expect(result.entities).toBeDefined();

      const classEntity = result.entities.find((e) => e.name === "MyClass");
      expect(classEntity).toBeDefined();
      expect(classEntity?.type).toBe("class");

      const constructorMethod = result.entities.find((e) => e.name === "MyClass::MyClass");
      expect(constructorMethod).toBeDefined();
      expect(constructorMethod?.type).toBe("method"); // No specific constructor type

      const destructor = result.entities.find((e) => e.name === "MyClass::~MyClass");
      expect(destructor).toBeDefined();
      expect(destructor?.type).toBe("method"); // No specific destructor type

      const publicMethod = result.entities.find((e) => e.name === "MyClass::publicMethod");
      expect(publicMethod).toBeDefined();
      expect(publicMethod?.modifiers).not.toContain("private");
      expect(publicMethod?.modifiers).not.toContain("protected");

      const privateField = result.entities.find((e) => e.name === "MyClass::privateField");
      expect(privateField).toBeDefined();
      expect(privateField?.modifiers).toContain("private");
    });

    it("should handle inheritance correctly", async () => {
      const code = `
class Base {
public:
    virtual void virtualMethod() = 0;
};

class Derived : public Base {
public:
    void virtualMethod() override {}
};

class MultiDerived : public Base, protected Derived {
public:
    void virtualMethod() override final {}
};
      `;

      const result = await parser.parse("test.cpp", code, "hash2");

      const baseClass = result.entities.find((e) => e.name === "Base");
      expect(baseClass).toBeDefined();
      expect(baseClass?.modifiers).toContain("abstract");

      const derivedClass = result.entities.find((e) => e.name === "Derived");
      expect(derivedClass).toBeDefined();

      const overrideMethod = result.entities.find((e) => e.name === "Derived::virtualMethod");
      expect(overrideMethod?.modifiers).toContain("override");

      const finalMethod = result.entities.find((e) => e.name === "MultiDerived::virtualMethod");
      expect(finalMethod?.modifiers).toContain("final");
    });

    it("should handle final classes", async () => {
      const code = `
class FinalClass final {
public:
    void method() {}
};
      `;

      const result = await parser.parse("test.cpp", code, "hash3");
      const finalClass = result.entities.find((e) => e.name === "FinalClass");
      expect(finalClass?.modifiers).toContain("final");
    });
  });

  describe("Namespace Analysis", () => {
    it("should extract namespaces and nested entities", async () => {
      const code = `
namespace MyNamespace {
    class NestedClass {
    public:
        void method() {}
    };

    void standaloneFunction() {}

    namespace InnerNamespace {
        void innerFunction() {}
    }
}
      `;

      const result = await parser.parse("test.cpp", code, "hash4");

      const namespace = result.entities.find((e) => e.name === "MyNamespace");
      expect(namespace).toBeDefined();
      expect(namespace?.type).toBe("module"); // Namespaces are represented as modules
      expect(namespace?.modifiers).toContain("namespace");

      const nestedClass = result.entities.find((e) => e.name === "MyNamespace::NestedClass");
      expect(nestedClass).toBeDefined();

      const standaloneFunc = result.entities.find((e) => e.name === "MyNamespace::standaloneFunction");
      expect(standaloneFunc).toBeDefined();

      const innerNamespace = result.entities.find((e) => e.name === "MyNamespace::InnerNamespace");
      expect(innerNamespace).toBeDefined();
    });
  });

  describe("Operator Overloading", () => {
    it("should detect operator overloading", async () => {
      const code = `
class Vector {
public:
    Vector operator+(const Vector& other) const {}
    Vector& operator+=(const Vector& other) {}
    bool operator==(const Vector& other) const {}
    int& operator[](size_t index) {}
    void operator()() {}

    friend Vector operator*(double scalar, const Vector& v);
};
      `;

      const result = await parser.parse("test.cpp", code, "hash5");

      const plusOperator = result.entities.find((e) => e.name === "Vector::operator+");
      expect(plusOperator).toBeDefined();
      expect(plusOperator?.modifiers).toContain("operator");
      expect(plusOperator?.modifiers).toContain("const");
      const bracketOperator = result.entities.find((e) => e.name === "Vector::operator[]");
      expect(bracketOperator).toBeDefined();
      const callOperator = result.entities.find((e) => e.name === "Vector::operator()");
      expect(callOperator).toBeDefined();
    });
  });

  describe("Template Support (Limited)", () => {
    it("should extract simple template classes", async () => {
      const code = `
template<typename T>
class Container {
public:
    void add(T item) {}
    T get(size_t index) {}
private:
    T* data;
};
      `;

      const result = await parser.parse("test.cpp", code, "hash6");

      const templateClass = result.entities.find((e) => e.name === "Container");
      expect(templateClass).toBeDefined();
      expect(templateClass?.modifiers).toContain("template");
      expect(templateClass?.modifiers?.some((m) => m.includes("T"))).toBe(true);
    });

    it("should extract simple template functions", async () => {
      const code = `
template<typename T>
T max(T a, T b) {
    return a > b ? a : b;
}

template<class T, class U>
void swap(T& a, U& b) {}
      `;

      const result = await parser.parse("test.cpp", code, "hash7");

      const maxFunc = result.entities.find((e) => e.name === "max");
      expect(maxFunc).toBeDefined();
      expect(maxFunc?.modifiers).toContain("template");

      const swapFunc = result.entities.find((e) => e.name === "swap");
      expect(swapFunc).toBeDefined();
      expect(swapFunc?.modifiers?.some((m) => m.includes("T"))).toBe(true);
      expect(swapFunc?.modifiers?.some((m) => m.includes("U"))).toBe(true);
    });

    it("should skip complex template metaprogramming", async () => {
      const code = `
// This should be skipped due to complexity
template<typename T>
typename std::enable_if<std::is_integral<T>::value, bool>::type
is_odd(T i) { return i % 2; }

// This should also be skipped (variadic template)
template<typename... Args>
void print(Args... args) {}

// Simple template should still work
template<typename T>
class SimpleClass {};
      `;

      const result = await parser.parse("test.cpp", code, "hash8");

      // Complex templates should be skipped
      const enableIfFunc = result.entities.find((e) => e.name === "is_odd");
      expect(enableIfFunc).toBeUndefined();

      const variadicFunc = result.entities.find((e) => e.name === "print");
      expect(variadicFunc).toBeUndefined();

      // Simple template should still be extracted
      const simpleClass = result.entities.find((e) => e.name === "SimpleClass");
      expect(simpleClass).toBeDefined();
    });
  });

  describe("Method Qualifiers", () => {
    it("should detect const, static, and noexcept methods", async () => {
      const code = `
class TestClass {
public:
    void normalMethod() {}
    void constMethod() const {}
    static void staticMethod() {}
    void noexceptMethod() noexcept {}
    void complexMethod() const noexcept {}

    virtual void virtualMethod() {}
    virtual void pureVirtual() = 0;
};
      `;

      const result = await parser.parse("test.cpp", code, "hash9");

      const constMethod = result.entities.find((e) => e.name === "TestClass::constMethod");
      expect(constMethod?.modifiers).toContain("const");

      const staticMethod = result.entities.find((e) => e.name === "TestClass::staticMethod");
      expect(staticMethod?.modifiers).toContain("static");

      const noexceptMethod = result.entities.find((e) => e.name === "TestClass::noexceptMethod");
      expect(noexceptMethod?.modifiers).toContain("noexcept");

      const complexMethod = result.entities.find((e) => e.name === "TestClass::complexMethod");
      expect(complexMethod?.modifiers).toContain("const");
      expect(complexMethod?.modifiers).toContain("noexcept");

      const virtualMethod = result.entities.find((e) => e.name === "TestClass::virtualMethod");
      expect(virtualMethod?.modifiers).toContain("virtual");
    });
  });

  describe("Enum Support", () => {
    it("should extract enums and enum classes", async () => {
      const code = `
enum Color {
    RED,
    GREEN,
    BLUE
};

enum class Status : int {
    OK = 0,
    ERROR = 1,
    PENDING = 2
};
      `;

      const result = await parser.parse("test.cpp", code, "hash10");

      const colorEnum = result.entities.find((e) => e.name === "Color");
      expect(colorEnum).toBeDefined();
      expect(colorEnum?.type).toBe("enum");

      const redValue = result.entities.find((e) => e.name === "Color::RED");
      expect(redValue).toBeDefined();
      expect(redValue?.type).toBe("constant"); // enum values are constants
      expect(redValue?.modifiers).toContain("enum_value");

      const statusEnum = result.entities.find((e) => e.name === "Status");
      expect(statusEnum).toBeDefined();
      expect(statusEnum?.modifiers).toContain("scoped");
    });
  });

  describe("Circuit Breakers", () => {
    it("should handle deeply nested classes without stack overflow", async () => {
      // Generate deeply nested classes
      let code = "";
      for (let i = 0; i < 60; i++) {
        code += `class Level${i} {\n`;
      }
      code += "int value;";
      for (let i = 0; i < 60; i++) {
        code += "\n};";
      }

      // Should not throw, but may return partial results
      const result = await parser.parse("test.cpp", code, "hash11");
      expect(result).toBeDefined();
      expect(result.entities).toBeDefined();
    });

    it("should handle complex inheritance hierarchies", async () => {
      const code = `
class A {};
class B : public A {};
class C : public A {};
class D : public B, public C {};
class E : public D {};
class F : public D {};
class G : public E, public F {};
class H : public G {};
class I : public H {};
class J : public I {};
      `;

      const result = await parser.parse("test.cpp", code, "hash12");
      expect(result).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it("should skip files that exceed complexity threshold", async () => {
      // Generate a highly complex template structure
      const code = `
template<template<typename...> class... Templates>
struct meta_list {};

template<typename T, typename = std::enable_if_t<std::is_integral_v<T>>>
class ComplexTemplate {
    template<typename U, typename... Args>
    auto method(U&& u, Args&&... args) -> decltype(auto) {
        return std::forward<U>(u);
    }
};
      `;

      const result = await parser.parse("test.cpp", code, "hash13");
      expect(result).toBeDefined();
      // Complex template should be skipped
      const complexTemplate = result.entities.find((e) => e.name === "ComplexTemplate");
      expect(complexTemplate).toBeUndefined();
    });
  });

  describe("Friend Declarations", () => {
    it("should detect friend classes and functions", async () => {
      const code = `
class A {
    friend class B;
    friend void globalFunction();
    friend A operator+(const A&, const A&);
private:
    int secret;
};

class B {
public:
    void accessA(A& a) {}
};
      `;

      const result = await parser.parse("test.cpp", code, "hash14");

      // Check that relationships are created for friends
      // Note: The actual relationship checking would need to be implemented
      // in the test based on how relationships are returned
      expect(result.entities).toBeDefined();

      const classA = result.entities.find((e) => e.name === "A");
      expect(classA).toBeDefined();
    });
  });

  describe("Using Declarations", () => {
    it("should handle using declarations and aliases", async () => {
      const code = `
using namespace std;
using std::vector;
using IntVector = vector<int>;

namespace MyNamespace {
    using StringList = std::list<std::string>;
}
      `;

      const result = await parser.parse("test.cpp", code, "hash15");
      expect(result).toBeDefined();
      expect(result.entities).toBeDefined();
    });
  });
});
