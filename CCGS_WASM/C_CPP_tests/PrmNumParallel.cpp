#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream>
#include <omp.h>

// Segment size (tune for cache: e.g., 1MB = 1024*1024*8 bits)
const long long SEGMENT_SIZE = 1LL << 20; // 1MB

// Generate small primes up to sqrt(N) using simple sieve
std::vector<long long> generate_small_primes(long long limit) {
    std::vector<char> is_prime(limit + 1, 1);
    is_prime[0] = is_prime[1] = 0;
    for (long long i = 2; i * i <= limit; ++i) {
        if (is_prime[i]) {
            for (long long j = i * i; j <= limit; j += i) {
                is_prime[j] = 0;
            }
        }
    }
    std::vector<long long> primes;
    primes.reserve(limit / 10); // Approximate prime count
    for (long long i = 2; i <= limit; ++i) {
        if (is_prime[i]) primes.push_back(i);
    }
    return primes;
}

// Sieve a single segment [low, high]
void sieve_segment(long long low, long long high, const std::vector<long long>& small_primes, std::vector<char>& seg, long long& local_count) {
    std::fill(seg.begin(), seg.end(), 1);
    if (low == 0) seg[0] = seg[1] = 0; // Handle 0/1 if in segment

    for (auto p : small_primes) {
        if (p * p > high) break;
        long long start = std::max(p * p, ((low + p - 1) / p) * p);
        for (long long j = start; j <= high; j += p) {
            seg[j - low] = 0;
        }
    }

    // Count primes in segment
    for (auto val : seg) {
        if (val) local_count++;
    }
}

int main() {
    long long N = 1000000000000LL; // 10^12; adjust for 7-10 min (test small first)
    auto start = std::chrono::high_resolution_clock::now();

    long long sqrt_n = static_cast<long long>(std::sqrt(N));
    auto small_primes = generate_small_primes(sqrt_n);

    long long num_segments = (N + SEGMENT_SIZE - 1) / SEGMENT_SIZE;
    long long total_count = 0;

    #pragma omp parallel reduction(+:total_count)
    {
        std::vector<char> seg(SEGMENT_SIZE);
        #pragma omp for schedule(static)
        for (long long s = 0; s < num_segments; ++s) {
            long long low = s * SEGMENT_SIZE;
            long long high = std::min(low + SEGMENT_SIZE - 1, N);
            long long local_count = 0;
            sieve_segment(low, high, small_primes, seg, local_count);
            total_count += local_count;
            // Optional: Store primes (add if needed, but slows I/O)
            // std::ofstream out("primes_part" + std::to_string(s) + ".txt");
            // for (long long i = low; i <= high; ++i) if (seg[i - low]) out << i << "\n";
        }
    }

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = end - start;
    std::cout << "OpenMP Parallel: " << total_count << " primes found up to " << N << std::endl;
    std::cout << "Threads Used: " << omp_get_max_threads() << std::endl;
    std::cout << "Time: " << duration.count() << " seconds" << std::endl;
    return 0;
}