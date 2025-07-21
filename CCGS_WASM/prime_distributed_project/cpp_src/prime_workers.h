#pragma once
#include <cstdint>

/**
 * A common prime checking utility.
 * It's marked 'inline' to prevent "multiple definition" errors when the linker
 * combines all 10 of your .cpp files, as each will include this header.
 */
inline bool is_prime(uint64_t n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    for (uint64_t i = 5; i * i <= n; i = i + 6) {
        if (n % i == 0 || n % (i + 2) == 0)
            return false;
    }
    return true;
}

/**
 * The 'extern "C"' block tells the C++ compiler not to mangle these function names.
 * This is crucial because it allows JavaScript to call them by their exact names,
 * e.g., wasmModule.ccall('worker_func_0', ...).
 */
extern "C" {
    // Declaration for the function in worker_func_0.cpp
    uint64_t worker_func_0(uint64_t start, uint64_t end);

    // Declaration for the function in worker_func_1.cpp
    uint64_t worker_func_1(uint64_t start, uint64_t end);

    // Declaration for the function in worker_func_2.cpp
    uint64_t worker_func_2(uint64_t start, uint64_t end);

    // Declaration for the function in worker_func_3.cpp
    uint64_t worker_func_3(uint64_t start, uint64_t end);

    // Declaration for the function in worker_func_4.cpp
    uint64_t worker_func_4(uint64_t start, uint64_t end);

    // Declaration for the function in worker_func_5.cpp
    uint64_t worker_func_5(uint64_t start, uint64_t end);

    // Declaration for the function in worker_func_6.cpp
    uint64_t worker_func_6(uint64_t start, uint64_t end);

    // Declaration for the function in worker_func_7.cpp
    uint64_t worker_func_7(uint64_t start, uint64_t end);

    // Declaration for the function in worker_func_8.cpp
    uint64_t worker_func_8(uint64_t start, uint64_t end);
    
    // Declaration for the function in worker_func_9.cpp
    uint64_t worker_func_9(uint64_t start, uint64_t end);
}