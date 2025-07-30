// cpp_src/prime_worker.cpp
#include "prime_library.h" // Assuming prime_library.h is in the parent directory

extern "C" {
    uint64_t count_primes_in_range(uint64_t start, uint64_t end) {
        uint64_t count = 0;
        for (uint64_t i = start; i <= end; ++i) {
            if (is_prime(i)) {
                count++;
            }
        }
        return count;
    }
}
