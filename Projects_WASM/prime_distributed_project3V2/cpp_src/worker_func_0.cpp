#include "prime_workers.h"

// Implementation for worker 0.
uint32_t worker_func_0(uint32_t start, uint32_t end) {
    uint32_t count = 0;
    for (uint32_t i = start; i <= end; ++i) {
        if (is_prime(i)) {
            count++;
        }
    }
    return count;
}