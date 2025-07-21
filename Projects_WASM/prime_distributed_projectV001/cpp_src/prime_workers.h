#pragma once
#include <cstdint>

/**
 * A common prime checking utility.
 * The loop condition is changed from i * i <= n to i <= n / i
 * to prevent potential integer overflows with large numbers.
 */
// Change all uint32_t to uint32_t
inline bool is_prime(uint32_t n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    for (uint32_t i = 5; i <= n / i; i = i + 6) {
        if (n % i == 0 || n % (i + 2) == 0)
            return false;
    }
    return true;
}

extern "C" {
    uint32_t worker_func_0(uint32_t start, uint32_t end);
    uint32_t worker_func_1(uint32_t start, uint32_t end);
    uint32_t worker_func_2(uint32_t start, uint32_t end);
    uint32_t worker_func_3(uint32_t start, uint32_t end);
    uint32_t worker_func_4(uint32_t start, uint32_t end);
    uint32_t worker_func_5(uint32_t start, uint32_t end);
    uint32_t worker_func_6(uint32_t start, uint32_t end);
    uint32_t worker_func_7(uint32_t start, uint32_t end);
    uint32_t worker_func_8(uint32_t start, uint32_t end);
    uint32_t worker_func_9(uint32_t start, uint32_t end);
}