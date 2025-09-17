#include <stdio.h>
#include <string.h>

// Basic struct definition
struct Point {
    double x;
    double y;
};

// Typedef struct
typedef struct {
    char name[50];
    int age;
    float salary;
} Employee;

// Struct with function pointers
typedef struct {
    int (*add)(int, int);
    int (*subtract)(int, int);
    void (*print_result)(int);
} Calculator;

// Union definition
union Data {
    int integer;
    float floating;
    char string[20];
};

// Enum definition
enum Status {
    PENDING = 0,
    APPROVED = 1,
    REJECTED = 2,
    COMPLETED = 3
};

// Enum with custom values
typedef enum {
    RED = 0xFF0000,
    GREEN = 0x00FF00,
    BLUE = 0x0000FF,
    WHITE = 0xFFFFFF
} Color;

// Functions working with structs
struct Point create_point(double x, double y) {
    struct Point p;
    p.x = x;
    p.y = y;
    return p;
}

double distance(struct Point p1, struct Point p2) {
    double dx = p1.x - p2.x;
    double dy = p1.y - p2.y;
    return sqrt(dx * dx + dy * dy);
}

Employee* create_employee(const char* name, int age, float salary) {
    Employee* emp = malloc(sizeof(Employee));
    if (emp) {
        strncpy(emp->name, name, sizeof(emp->name) - 1);
        emp->name[sizeof(emp->name) - 1] = '\0';
        emp->age = age;
        emp->salary = salary;
    }
    return emp;
}

void print_employee(const Employee* emp) {
    if (emp) {
        printf("Employee: %s, Age: %d, Salary: %.2f\n",
               emp->name, emp->age, emp->salary);
    }
}