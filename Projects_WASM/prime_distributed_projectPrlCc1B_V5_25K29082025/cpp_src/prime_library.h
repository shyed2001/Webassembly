//File: prime_distributed_projectPrlCc1B%20V5%2810K%29/cpp_src/prime_library.h
#pragma once
#include <cstdint>

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
    // Single generic function to count primes in a range
    uint64_t count_primes_in_range(uint64_t start, uint64_t end); // <--- New generic function
}