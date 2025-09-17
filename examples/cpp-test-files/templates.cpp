#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <algorithm>
#include <type_traits>

// Function template
template<typename T>
T max(T a, T b) {
    return (a > b) ? a : b;
}

// Function template with multiple parameters
template<typename T, typename U>
auto add(T a, U b) -> decltype(a + b) {
    return a + b;
}

// Class template
template<typename T>
class Stack {
private:
    std::vector<T> elements;

public:
    void push(const T& item) {
        elements.push_back(item);
    }

    T pop() {
        if (elements.empty()) {
            throw std::runtime_error("Stack is empty");
        }
        T item = elements.back();
        elements.pop_back();
        return item;
    }

    bool empty() const {
        return elements.empty();
    }

    size_t size() const {
        return elements.size();
    }

    const T& top() const {
        if (elements.empty()) {
            throw std::runtime_error("Stack is empty");
        }
        return elements.back();
    }
};

// Template specialization
template<>
class Stack<bool> {
private:
    std::vector<char> elements; // Use char instead of bool for efficiency

public:
    void push(bool item) {
        elements.push_back(item ? 1 : 0);
    }

    bool pop() {
        if (elements.empty()) {
            throw std::runtime_error("Stack is empty");
        }
        bool item = elements.back() != 0;
        elements.pop_back();
        return item;
    }

    bool empty() const {
        return elements.empty();
    }

    size_t size() const {
        return elements.size();
    }
};

// Variadic template
template<typename... Args>
void print(Args... args) {
    ((std::cout << args << " "), ...);  // C++17 fold expression
    std::cout << std::endl;
}

// Template metaprogramming with SFINAE
template<typename T>
typename std::enable_if<std::is_arithmetic<T>::value, bool>::type
is_positive(T value) {
    return value > 0;
}

template<typename T>
typename std::enable_if<!std::is_arithmetic<T>::value, bool>::type
is_positive(const T&) {
    return false; // Non-arithmetic types are considered not positive
}

// Concept-like template (C++11 style)
template<typename T>
class Printable {
public:
    static_assert(std::is_same<decltype(std::declval<std::ostream&>() << std::declval<T>()), std::ostream&>::value,
                  "Type must be printable to ostream");
};

// Template with template parameter
template<template<typename> class Container, typename T>
void print_container(const Container<T>& container) {
    for (const auto& item : container) {
        std::cout << item << " ";
    }
    std::cout << std::endl;
}

// Smart pointer template
template<typename T>
class unique_ptr {
private:
    T* ptr;

public:
    explicit unique_ptr(T* p = nullptr) : ptr(p) {}

    ~unique_ptr() {
        delete ptr;
    }

    // Move constructor
    unique_ptr(unique_ptr&& other) noexcept : ptr(other.ptr) {
        other.ptr = nullptr;
    }

    // Move assignment
    unique_ptr& operator=(unique_ptr&& other) noexcept {
        if (this != &other) {
            delete ptr;
            ptr = other.ptr;
            other.ptr = nullptr;
        }
        return *this;
    }

    // Delete copy constructor and assignment
    unique_ptr(const unique_ptr&) = delete;
    unique_ptr& operator=(const unique_ptr&) = delete;

    T& operator*() const {
        return *ptr;
    }

    T* operator->() const {
        return ptr;
    }

    T* get() const {
        return ptr;
    }

    T* release() {
        T* temp = ptr;
        ptr = nullptr;
        return temp;
    }

    void reset(T* p = nullptr) {
        delete ptr;
        ptr = p;
    }

    explicit operator bool() const {
        return ptr != nullptr;
    }
};

// Template alias
template<typename T>
using Vec = std::vector<T>;

template<typename K, typename V>
using Map = std::map<K, V>;

// Constexpr template function
template<int N>
constexpr int factorial() {
    if constexpr (N <= 1) {
        return 1;
    } else {
        return N * factorial<N - 1>();
    }
}

// Template with default parameters
template<typename T = int, size_t Size = 10>
class Array {
private:
    T data[Size];

public:
    constexpr size_t size() const { return Size; }

    T& operator[](size_t index) {
        return data[index];
    }

    const T& operator[](size_t index) const {
        return data[index];
    }

    T* begin() { return data; }
    T* end() { return data + Size; }
    const T* begin() const { return data; }
    const T* end() const { return data + Size; }
};