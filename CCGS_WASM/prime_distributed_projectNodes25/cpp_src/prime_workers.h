
#pragma once
#include <cstdint>

// Change back to uint64_t
inline bool is_prime(uint64_t n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    for (uint64_t i = 5; i <= n / i; i = i + 6) {
        if (n % i == 0 || n % (i + 2) == 0)
            return false;
    }
    return true;
}

extern "C" {
    // Make sure these all use uint64_t
    uint64_t worker_func_0(uint64_t start, uint64_t end);
    uint64_t worker_func_1(uint64_t start, uint64_t end);
    uint64_t worker_func_2(uint64_t start, uint64_t end);
    uint64_t worker_func_3(uint64_t start, uint64_t end);
    uint64_t worker_func_4(uint64_t start, uint64_t end);
    uint64_t worker_func_5(uint64_t start, uint64_t end);
    uint64_t worker_func_6(uint64_t start, uint64_t end);
    uint64_t worker_func_7(uint64_t start, uint64_t end);
    uint64_t worker_func_8(uint64_t start, uint64_t end);
    uint64_t worker_func_9(uint64_t start, uint64_t end);
}


/*

#pragma once
#include <cstdint>

A common prime checking utility.
The loop condition is changed from i * i <= n to i <= n / i
to prevent potential integer overflows with large numbers.
 
 Change all uint64_t to uint64_t


inline bool is_prime(uint64_t n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    for (uint64_t i = 5; i <= n / i; i = i + 6) {
        if (n % i == 0 || n % (i + 2) == 0)
            return false;
    }
    return true;
}

extern "C" {
    uint64_t worker_func_0(uint64_t start, uint64_t end);
    uint64_t worker_func_1(uint64_t start, uint64_t end);
    uint64_t worker_func_2(uint64_t start, uint64_t end);
    uint64_t worker_func_3(uint64_t start, uint64_t end);
    uint64_t worker_func_4(uint64_t start, uint64_t end);
    uint64_t worker_func_5(uint64_t start, uint64_t end);
    uint64_t worker_func_6(uint64_t start, uint64_t end);
    uint64_t worker_func_7(uint64_t start, uint64_t end);
    uint64_t worker_func_8(uint64_t start, uint64_t end);
    uint64_t worker_func_9(uint64_t start, uint64_t end);
}

*/