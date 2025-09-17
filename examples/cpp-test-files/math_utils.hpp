#ifndef MATH_UTILS_HPP
#define MATH_UTILS_HPP

#include <cmath>
#include <vector>
#include <complex>

namespace MathUtils {
    // Constants
    constexpr double PI = 3.14159265358979323846;
    constexpr double E = 2.71828182845904523536;

    // Function declarations
    double deg_to_rad(double degrees);
    double rad_to_deg(double radians);

    // Template function declarations
    template<typename T>
    T abs(const T& value);

    template<typename T>
    T clamp(const T& value, const T& min, const T& max);

    // Class declarations
    template<typename T>
    class Vector3D {
    private:
        T x, y, z;

    public:
        Vector3D(T x = T{}, T y = T{}, T z = T{});

        // Getters
        T getX() const { return x; }
        T getY() const { return y; }
        T getZ() const { return z; }

        // Setters
        void setX(T x) { this->x = x; }
        void setY(T y) { this->y = y; }
        void setZ(T z) { this->z = z; }

        // Vector operations
        Vector3D<T> operator+(const Vector3D<T>& other) const;
        Vector3D<T> operator-(const Vector3D<T>& other) const;
        Vector3D<T> operator*(T scalar) const;
        T dot(const Vector3D<T>& other) const;
        Vector3D<T> cross(const Vector3D<T>& other) const;
        T magnitude() const;
        Vector3D<T> normalized() const;
    };

    // Specialized class for complex numbers
    class ComplexMath {
    public:
        using Complex = std::complex<double>;

        static Complex add(const Complex& a, const Complex& b);
        static Complex multiply(const Complex& a, const Complex& b);
        static double magnitude(const Complex& c);
        static double phase(const Complex& c);
        static Complex conjugate(const Complex& c);
    };

    // Statistical functions
    class Statistics {
    public:
        template<typename Iterator>
        static auto mean(Iterator begin, Iterator end) -> typename std::iterator_traits<Iterator>::value_type;

        template<typename Iterator>
        static auto variance(Iterator begin, Iterator end) -> typename std::iterator_traits<Iterator>::value_type;

        template<typename Container>
        static auto median(Container& data) -> typename Container::value_type;

        static double standard_deviation(const std::vector<double>& data);
        static double correlation(const std::vector<double>& x, const std::vector<double>& y);
    };

    // Matrix class template
    template<typename T, size_t Rows, size_t Cols>
    class Matrix {
    private:
        T data[Rows][Cols];

    public:
        Matrix();
        Matrix(const T& value);
        Matrix(const Matrix<T, Rows, Cols>& other);

        Matrix<T, Rows, Cols>& operator=(const Matrix<T, Rows, Cols>& other);

        T& operator()(size_t row, size_t col);
        const T& operator()(size_t row, size_t col) const;

        Matrix<T, Rows, Cols> operator+(const Matrix<T, Rows, Cols>& other) const;
        Matrix<T, Rows, Cols> operator-(const Matrix<T, Rows, Cols>& other) const;

        template<size_t OtherCols>
        Matrix<T, Rows, OtherCols> operator*(const Matrix<T, Cols, OtherCols>& other) const;

        Matrix<T, Rows, Cols> operator*(const T& scalar) const;

        Matrix<T, Cols, Rows> transpose() const;
        T determinant() const; // Only for square matrices
        Matrix<T, Rows, Cols> inverse() const; // Only for square matrices

        constexpr size_t rows() const { return Rows; }
        constexpr size_t cols() const { return Cols; }
    };

    // Type aliases for common matrix types
    using Matrix2d = Matrix<double, 2, 2>;
    using Matrix3d = Matrix<double, 3, 3>;
    using Matrix4d = Matrix<double, 4, 4>;

    using Vector2d = Vector3D<double>;
    using Vector3f = Vector3D<float>;

    // Function templates implementation
    template<typename T>
    inline T abs(const T& value) {
        return (value >= T{}) ? value : -value;
    }

    template<typename T>
    inline T clamp(const T& value, const T& min, const T& max) {
        return (value < min) ? min : (value > max) ? max : value;
    }

    // Macro definitions
    #define SQUARE(x) ((x) * (x))
    #define MAX(a, b) ((a) > (b) ? (a) : (b))
    #define MIN(a, b) ((a) < (b) ? (a) : (b))

} // namespace MathUtils

#endif // MATH_UTILS_HPP