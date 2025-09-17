#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Simple function
int add(int a, int b) {
    return a + b;
}

// Function with static modifier
static int multiply(int x, int y) {
    return x * y;
}

// Function with extern modifier
extern void print_hello(void);

// Inline function
inline double square(double n) {
    return n * n;
}

// Function with no parameters
void cleanup(void) {
    printf("Cleaning up resources\n");
}

// Function with complex parameters
char* concat_strings(const char* str1, const char* str2, size_t max_len) {
    char* result = malloc(max_len + 1);
    if (result) {
        strncpy(result, str1, max_len);
        strncat(result, str2, max_len - strlen(str1));
    }
    return result;
}

// Main function
int main(int argc, char* argv[]) {
    int result = add(5, 3);
    printf("Result: %d\n", result);

    double sq = square(4.5);
    printf("Square: %.2f\n", sq);

    cleanup();
    return 0;
}