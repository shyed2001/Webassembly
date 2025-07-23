

#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream>
#include <omp.h>
#include <algorithm> // Added for std::min and std::max

// Sieve a segment [low, high] using small primes
void sieve_segment(long long low, long long high, const std::vector<long long>& small_primes, 
                   std::vector<bool>& is_prime_seg, long long& local_count) {
    for (auto p : small_primes) {
        if (p * p > high) break;
        long long start = std::max(p * p, (low + p - 1) / p * p);
        for (long long j = start; j <= high; j += p) {
            if (j >= low) is_prime_seg[j - low] = false;
        }
    }
    // Count primes in segment
    for (size_t i = 0; i < is_prime_seg.size(); ++i) {
        if (is_prime_seg[i]) local_count++;
    }
}
 
int main() {
    long long N = 400000000000LL; 
               // 40000000000 10^10; use LL suffix for clarity
    auto start = std::chrono::high_resolution_clock::now();
    
    // Step 1: Small primes up to sqrt(N)
    long long sqrt_n = static_cast<long long>(std::sqrt(N));
    std::vector<bool> small_is_prime(sqrt_n + 1, true);
    small_is_prime[0] = small_is_prime[1] = false;
    for (long long i = 2; i <= sqrt_n; ++i) {
        if (small_is_prime[i]) {
            for (long long j = i * i; j <= sqrt_n; j += i) {
                small_is_prime[j] = false;
            }
        }
    }
    std::vector<long long> small_primes;
    small_primes.reserve(sqrt_n / 10); // Approx prime count
    for (long long i = 2; i <= sqrt_n; ++i) {
        if (small_is_prime[i]) small_primes.push_back(i);
    }
// panel.riyadwebhost01840395957
    // Step 2: Parallel segmented sieve
    int num_threads = omp_get_max_threads();
    long long seg_size = (N - 1) / num_threads + 1;
    std::vector<std::vector<bool>> segments(num_threads);
    std::vector<long long> counts(num_threads, 0);

    #pragma omp parallel for schedule(static)
    for (int t = 0; t < num_threads; ++t) {
        long long low = t * seg_size + 2;
        long long high = std::min(N, (t + 1) * seg_size);
        if (low > high) continue;

        segments[t] = std::vector<bool>(high - low + 1, true);
        if (low <= 1) segments[t][1 - low] = false; // Handle if low <=1, though unlikely

        sieve_segment(low, high, small_primes, segments[t], counts[t]);
    }

    // Step 3: Aggregate count
    long long total_count = 0;
    for (int t = 0; t < num_threads; ++t) {
        total_count += counts[t];
    }

    // Step 4: Store primes (optional: commented out to reduce I/O and focus on counting)
    /*
    std::ofstream out("primes.txt");
    for (int t = 0; t < num_threads; ++t) {
        long long low = t * seg_size + 2;
        long long high = std::min(N, (t + 1) * seg_size);
        if (low > high) continue;
        for (size_t i = 0; i < segments[t].size(); ++i) {
            if (segments[t][i]) out << (low + i) << "\n";
        }
    }
    out.close();
    */

    // Get actual threads used (fix for display)
    int threads_used = 0;
    #pragma omp parallel
    {
        #pragma omp master
        threads_used = omp_get_num_threads();
    }

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = end - start;
    std::cout << "Parallel (OpenMP): " << total_count << " primes found up to " << N << std::endl;
    std::cout << "Threads Used: " << threads_used << std::endl;
    std::cout << "Time: " << duration.count() << " seconds" << std::endl;

    return 0;
}






/* 
PS F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests> g++ -O3 -std=c++17 -fopenmp -march=native PrNumMthrPrll.cpp -o PrNumMthrPllexec.exe
clang++ -O3 -std=c++17 -fopenmp -march=native PrNumMthrPrll.cpp -o PrNumMthrPllexec.exe
PS F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests> $env:OMP_NUM_THREADS=8; .\PrNumMthrPllexec
Parallel (OpenMP): 455052510 primes found up to 10000000000
Threads Used: 8
Time: 89.5849 seconds
PS F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests> 




#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream>
#include <omp.h>

// Sieve a segment [low, high] using small primes
void sieve_segment(long long low, long long high, const std::vector<long long>& small_primes, 
                  std::vector<bool>& is_prime_seg, long long& local_count) {
    for (auto p : small_primes) {
        if (p * p > high) break;
        long long start = std::max(p * p, (low + p - 1) / p * p);
        for (long long j = start; j <= high; j += p) {
            if (j >= low) is_prime_seg[j - low] = false;
        }
    }
    // Count primes in segment
    for (size_t i = 0; i < is_prime_seg.size(); ++i) {
        if (is_prime_seg[i]) local_count++;
    }
}

int main() {
    long long N = 4000000000LL; // 10^11 for ~7-10 min single-threaded
    auto start = std::chrono::high_resolution_clock::now();

    // Step 1: Small primes up to sqrt(N)
    long long sqrt_n = static_cast<long long>(std::sqrt(N));
    std::vector<bool> small_is_prime(sqrt_n + 1, true);
    small_is_prime[0] = small_is_prime[1] = false;
    for (long long i = 2; i <= sqrt_n; ++i) {
        if (small_is_prime[i]) {
            for (long long j = i * i; j <= sqrt_n; j += i) {
                small_is_prime[j] = false;
            }
        }
    }
    std::vector<long long> small_primes;
    small_primes.reserve(sqrt_n / 10); // Approx prime count
    for (long long i = 2; i <= sqrt_n; ++i) {
        if (small_is_prime[i]) small_primes.push_back(i);
    }

    // Step 2: Parallel segmented sieve
    int num_threads = omp_get_max_threads();
    long long seg_size = (N - 1) / num_threads + 1;
    std::vector<std::vector<bool>> segments(num_threads);
    std::vector<long long> counts(num_threads, 0);

    #pragma omp parallel for schedule(static)
    for (int t = 0; t < num_threads; ++t) {
        long long low = t * seg_size + 2;
        long long high = std::min(N, (t + 1) * seg_size);
        if (low > high) continue;

        segments[t] = std::vector<bool>(high - low + 1, true);
        if (low == 2) segments[t][0] = true;
        if (low <= 1) segments[t][1 - low] = false;

        sieve_segment(low, high, small_primes, segments[t], counts[t]);
    }

    // Step 3: Aggregate count
    long long total_count = 0;
    for (int t = 0; t < num_threads; ++t) {
        total_count += counts[t];
    }

    // Step 4: Store primes (optional: comment out to reduce I/O)
    std::ofstream out("primes.txt");
    for (int t = 0; t < num_threads; ++t) {
        long long low = t * seg_size + 2;
        long long high = std::min(N, (t + 1) * seg_size);
        if (low > high) continue;
        for (size_t i = 0; i < segments[t].size(); ++i) {
            if (segments[t][i]) out << (low + i) << "\n";
        }
    }
    out.close();

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = end - start;
    std::cout << "Parallel (OpenMP): " << total_count << " primes found up to " << N << std::endl;
    std::cout << "Threads Used: " << omp_get_num_threads() << std::endl;
    std::cout << "Time: " << duration.count() << " seconds" << std::endl;

    return 0;
}

*/


/* 
Execution Command : PS F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests> g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o PrNumMthrPllexec
PS F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests> .\PrNumMthrPllexec


#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream>
#include <omp.h>

// Heavy compute task: Trial division to verify a number is prime (simulates crypto workload)
bool is_prime_trial(long long n) {
    if (n < 2) return false;
    if (n == 2) return true;
    if (n % 2 == 0) return false;
    for (long long i = 3; i * i <= n; i += 2) {
        if (n % i == 0) return false;
    }
    return true;
}

void sieve_segment(long long low, long long high, const std::vector<long long>& small_primes, std::vector<bool>& is_prime_seg, long long& local_count) {
    for (auto p : small_primes) {
        if (p * p > high) break;
        long long start = std::max(p * p, (low + p - 1) / p * p);
        for (long long j = start; j <= high; j += p) {
            if (j >= low) is_prime_seg[j - low] = false;
        }
    }
    // Heavy task: Verify each candidate prime with trial division
    for (size_t i = 0; i < is_prime_seg.size(); ++i) {
        if (is_prime_seg[i]) {
            if (is_prime_trial(low + i)) local_count++;
        }
    }
}

int main() {
    long long N = 10000000000; // 10^10 for ~7-10 min
    auto start = std::chrono::high_resolution_clock::now();

    // Small primes up to sqrt(N)
    long long sqrt_n = static_cast<long long>(std::sqrt(N));
    std::vector<bool> small_is_prime(sqrt_n + 1, true);
    small_is_prime[0] = small_is_prime[1] = false;
    for (long long i = 2; i <= sqrt_n; ++i) {
        if (small_is_prime[i]) {
            for (long long j = i * i; j <= sqrt_n; j += i) {
                small_is_prime[j] = false;
            }
        }
    }
    std::vector<long long> small_primes;
    for (long long i = 2; i <= sqrt_n; ++i) {
        if (small_is_prime[i]) small_primes.push_back(i);
    }

    // Parallel segmented sieve
    int num_threads = omp_get_max_threads();
    long long seg_size = (N - 1) / num_threads + 1;
    std::vector<std::vector<bool>> segments(num_threads);
    std::vector<long long> counts(num_threads, 0);

    #pragma omp parallel for schedule(static)
    for (int t = 0; t < num_threads; ++t) {
        long long low = t * seg_size + 2;
        long long high = std::min(N, (t + 1) * seg_size);
        if (low > high) continue;

        segments[t] = std::vector<bool>(high - low + 1, true);
        if (low == 2) segments[t][0] = true;
        if (low <= 1) segments[t][1 - low] = false;

        sieve_segment(low, high, small_primes, segments[t], counts[t]);
    }

    // Aggregate and store (optional: comment out for compute-only focus)
    long long total_count = 0;
    std::ofstream out("primes.txt");
    for (int t = 0; t < num_threads; ++t) {
        total_count += counts[t];
        long long low = t * seg_size + 2;
        long long high = std::min(N, (t + 1) * seg_size);
        if (low > high) continue;
        for (size_t i = 0; i < segments[t].size(); ++i) {
            if (segments[t][i]) out << (low + i) << "\n";
        }
    }
    out.close();
    std::cout << omp_get_num_threads() << std::endl;
    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = end - start;
    std::cout << "Parallel (OpenMP): " << total_count << " primes found up to " << N << std::endl;
    std::cout << "Time: " << duration.count() << " seconds" << std::endl;
    return 0;
}
*/

/*
#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream>
#include <omp.h>

// Heavy compute task: Trial division to verify a number is prime (simulates crypto workload)
bool is_prime_trial(long long n) {
    if (n < 2) return false;
    if (n == 2) return true;
    if (n % 2 == 0) return false;
    for (long long i = 3; i * i <= n; i += 2) {
        if (n % i == 0) return false;
    }
    return true;
}

void sieve_segment(long long low, long long high, const std::vector<long long>& small_primes, std::vector<bool>& is_prime_seg, long long& local_count) {
    for (auto p : small_primes) {
        if (p * p > high) break;
        long long start = std::max(p * p, (low + p - 1) / p * p);
        for (long long j = start; j <= high; j += p) {
            if (j >= low) is_prime_seg[j - low] = false;
        }
    }
    // Heavy task: Verify each candidate prime with trial division
    for (size_t i = 0; i < is_prime_seg.size(); ++i) {
        if (is_prime_seg[i]) {
            if (is_prime_trial(low + i)) local_count++;
        }
    }
}

int main() {
    long long N = 10000000000; // 10^10 for ~7-10 min
    auto start = std::chrono::high_resolution_clock::now();

    // Small primes up to sqrt(N)
    long long sqrt_n = static_cast<long long>(std::sqrt(N));
    std::vector<bool> small_is_prime(sqrt_n + 1, true);
    small_is_prime[0] = small_is_prime[1] = false;
    for (long long i = 2; i <= sqrt_n; ++i) {
        if (small_is_prime[i]) {
            for (long long j = i * i; j <= sqrt_n; j += i) {
                small_is_prime[j] = false;
            }
        }
    }
    std::vector<long long> small_primes;
    for (long long i = 2; i <= sqrt_n; ++i) {
        if (small_is_prime[i]) small_primes.push_back(i);
    }

    // Parallel segmented sieve
    int num_threads = omp_get_max_threads();
    long long seg_size = (N - 1) / num_threads + 1;
    std::vector<std::vector<bool>> segments(num_threads);
    std::vector<long long> counts(num_threads, 0);

    #pragma omp parallel for schedule(static)
    for (int t = 0; t < num_threads; ++t) {
        long long low = t * seg_size + 2;
        long long high = std::min(N, (t + 1) * seg_size);
        if (low > high) continue;

        segments[t] = std::vector<bool>(high - low + 1, true);
        if (low == 2) segments[t][0] = true;
        if (low <= 1) segments[t][1 - low] = false;

        sieve_segment(low, high, small_primes, segments[t], counts[t]);
    }

    // Aggregate and store (optional: comment out for compute-only focus)
    long long total_count = 0;
    std::ofstream out("primes.txt");
    for (int t = 0; t < num_threads; ++t) {
        total_count += counts[t];
        long long low = t * seg_size + 2;
        long long high = std::min(N, (t + 1) * seg_size);
        if (low > high) continue;
        for (size_t i = 0; i < segments[t].size(); ++i) {
            if (segments[t][i]) out << (low + i) << "\n";
        }
    }
    out.close();

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = end - start;
    std::cout << "Parallel (OpenMP): " << total_count << " primes found up to " << N << std::endl;
    std::cout << "Time: " << duration.count() << " seconds" << std::endl;
    return 0;
}

*/