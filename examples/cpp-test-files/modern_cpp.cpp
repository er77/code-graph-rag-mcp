#include <iostream>
#include <vector>
#include <memory>
#include <functional>
#include <algorithm>
#include <future>
#include <thread>
#include <chrono>
#include <optional>
#include <variant>

// Namespace example
namespace math {
    namespace geometry {
        class Point {
        public:
            double x, y;
            Point(double x = 0, double y = 0) : x(x), y(y) {}
        };
    }

    namespace algebra {
        template<typename T>
        T power(T base, int exponent) {
            T result = 1;
            for (int i = 0; i < exponent; ++i) {
                result *= base;
            }
            return result;
        }
    }
}

// Lambda expressions and std::function
class LambdaExamples {
public:
    static void demonstrate() {
        // Simple lambda
        auto square = [](int x) { return x * x; };

        // Lambda with capture
        int multiplier = 5;
        auto multiply_by = [multiplier](int x) { return x * multiplier; };

        // Lambda with mutable capture
        auto counter = [count = 0]() mutable -> int { return ++count; };

        // Generic lambda (C++14)
        auto add = [](auto a, auto b) { return a + b; };

        // Lambda with perfect forwarding
        auto forwarder = [](auto&& arg) -> decltype(auto) {
            return std::forward<decltype(arg)>(arg);
        };

        std::cout << "Square of 4: " << square(4) << std::endl;
        std::cout << "5 * 6: " << multiply_by(6) << std::endl;
        std::cout << "Counter: " << counter() << ", " << counter() << std::endl;
    }
};

// Modern C++ features
class ModernFeatures {
private:
    std::unique_ptr<int> value;
    std::optional<std::string> name;
    std::variant<int, double, std::string> data;

public:
    ModernFeatures() : value(std::make_unique<int>(42)) {}

    // Range-based for loop with structured binding
    static void process_pairs() {
        std::vector<std::pair<int, std::string>> pairs = {
            {1, "one"}, {2, "two"}, {3, "three"}
        };

        for (const auto& [number, word] : pairs) {
            std::cout << number << ": " << word << std::endl;
        }
    }

    // Auto and type deduction
    static auto get_complex_type() -> std::vector<std::unique_ptr<int>> {
        std::vector<std::unique_ptr<int>> vec;
        vec.push_back(std::make_unique<int>(1));
        vec.push_back(std::make_unique<int>(2));
        return vec;
    }

    // Constexpr functions
    static constexpr int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }

    // Variadic templates
    template<typename... Args>
    static void print_all(Args... args) {
        ((std::cout << args << " "), ...);
        std::cout << std::endl;
    }

    // Move semantics
    ModernFeatures(ModernFeatures&& other) noexcept
        : value(std::move(other.value)), name(std::move(other.name)), data(std::move(other.data)) {
    }

    ModernFeatures& operator=(ModernFeatures&& other) noexcept {
        if (this != &other) {
            value = std::move(other.value);
            name = std::move(other.name);
            data = std::move(other.data);
        }
        return *this;
    }

    // Perfect forwarding constructor
    template<typename T>
    void set_data(T&& value) {
        data = std::forward<T>(value);
    }

    // std::optional usage
    void set_name(const std::string& n) {
        name = n;
    }

    std::optional<std::string> get_name() const {
        return name;
    }

    // std::variant usage
    template<typename T>
    void visit_data() const {
        std::visit([](const auto& value) {
            std::cout << "Data: " << value << std::endl;
        }, data);
    }
};

// Async programming
class AsyncExample {
public:
    static std::future<int> async_computation() {
        return std::async(std::launch::async, []() -> int {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            return 42;
        });
    }

    static void demonstrate_async() {
        auto future = async_computation();
        std::cout << "Doing other work..." << std::endl;
        int result = future.get();
        std::cout << "Async result: " << result << std::endl;
    }
};

// RAII with smart pointers
class ResourceManager {
private:
    std::shared_ptr<std::vector<int>> shared_resource;
    std::weak_ptr<std::vector<int>> weak_reference;

public:
    ResourceManager() : shared_resource(std::make_shared<std::vector<int>>()) {
        weak_reference = shared_resource;
    }

    void add_value(int value) {
        if (auto locked = weak_reference.lock()) {
            locked->push_back(value);
        }
    }

    size_t resource_use_count() const {
        return shared_resource.use_count();
    }

    std::shared_ptr<std::vector<int>> get_shared_resource() {
        return shared_resource;
    }
};

// Exception safety and RAII
class ExceptionSafeClass {
private:
    std::unique_ptr<int[]> data;
    size_t size;

public:
    ExceptionSafeClass(size_t s) : data(std::make_unique<int[]>(s)), size(s) {
        // Strong exception safety guarantee
        std::fill(data.get(), data.get() + size, 0);
    }

    // Copy constructor with strong exception safety
    ExceptionSafeClass(const ExceptionSafeClass& other)
        : data(std::make_unique<int[]>(other.size)), size(other.size) {
        std::copy(other.data.get(), other.data.get() + size, data.get());
    }

    // Copy assignment with strong exception safety
    ExceptionSafeClass& operator=(const ExceptionSafeClass& other) {
        if (this != &other) {
            auto new_data = std::make_unique<int[]>(other.size);
            std::copy(other.data.get(), other.data.get() + other.size, new_data.get());

            data = std::move(new_data);
            size = other.size;
        }
        return *this;
    }

    int& operator[](size_t index) {
        if (index >= size) {
            throw std::out_of_range("Index out of range");
        }
        return data[index];
    }

    const int& operator[](size_t index) const {
        if (index >= size) {
            throw std::out_of_range("Index out of range");
        }
        return data[index];
    }

    size_t get_size() const noexcept { return size; }
};