#include <iostream>
#include <string>
#include <vector>
#include <memory>

// Simple class
class Rectangle {
private:
    double width;
    double height;

public:
    Rectangle(double w, double h) : width(w), height(h) {}

    virtual ~Rectangle() = default;

    double area() const {
        return width * height;
    }

    virtual double perimeter() const {
        return 2 * (width + height);
    }

    // Static member function
    static Rectangle createSquare(double side) {
        return Rectangle(side, side);
    }

    // Getters and setters
    double getWidth() const { return width; }
    double getHeight() const { return height; }

    void setWidth(double w) { width = w; }
    void setHeight(double h) { height = h; }
};

// Inheritance example
class Square : public Rectangle {
public:
    Square(double side) : Rectangle(side, side) {}

    double perimeter() const override {
        return 4 * getWidth();
    }

    void setSide(double side) {
        setWidth(side);
        setHeight(side);
    }
};

// Abstract base class
class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
    virtual double perimeter() const = 0;
    virtual void draw() const = 0;
};

// Multiple inheritance
class Drawable {
public:
    virtual ~Drawable() = default;
    virtual void setColor(const std::string& color) = 0;
    virtual std::string getColor() const = 0;
};

class ColoredRectangle : public Rectangle, public Drawable {
private:
    std::string color;

public:
    ColoredRectangle(double w, double h, const std::string& c)
        : Rectangle(w, h), color(c) {}

    void setColor(const std::string& c) override {
        color = c;
    }

    std::string getColor() const override {
        return color;
    }
};

// Class with operator overloading
class Vector2D {
private:
    double x, y;

public:
    Vector2D(double x = 0, double y = 0) : x(x), y(y) {}

    // Operator overloading
    Vector2D operator+(const Vector2D& other) const {
        return Vector2D(x + other.x, y + other.y);
    }

    Vector2D& operator+=(const Vector2D& other) {
        x += other.x;
        y += other.y;
        return *this;
    }

    bool operator==(const Vector2D& other) const {
        return x == other.x && y == other.y;
    }

    friend std::ostream& operator<<(std::ostream& os, const Vector2D& v) {
        os << "(" << v.x << ", " << v.y << ")";
        return os;
    }

    double magnitude() const {
        return std::sqrt(x * x + y * y);
    }
};

// RAII example
class FileHandler {
private:
    std::FILE* file;
    std::string filename;

public:
    explicit FileHandler(const std::string& fname)
        : filename(fname), file(std::fopen(fname.c_str(), "r")) {
        if (!file) {
            throw std::runtime_error("Could not open file: " + filename);
        }
    }

    ~FileHandler() {
        if (file) {
            std::fclose(file);
        }
    }

    // Delete copy constructor and assignment operator
    FileHandler(const FileHandler&) = delete;
    FileHandler& operator=(const FileHandler&) = delete;

    // Move constructor and assignment operator
    FileHandler(FileHandler&& other) noexcept
        : file(other.file), filename(std::move(other.filename)) {
        other.file = nullptr;
    }

    FileHandler& operator=(FileHandler&& other) noexcept {
        if (this != &other) {
            if (file) {
                std::fclose(file);
            }
            file = other.file;
            filename = std::move(other.filename);
            other.file = nullptr;
        }
        return *this;
    }

    bool isOpen() const { return file != nullptr; }
    std::FILE* get() const { return file; }
};