#include "prime_workers.h"

// Implementation for worker 1.
uint64_t worker_func_1(uint64_t start, uint64_t end) {
    uint64_t count = 0;
    for (uint64_t i = start; i <= end; ++i) {
        if (is_prime(i)) {
            count++;
        }
    }
    return count;
}