#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream>

int main() {
    long long N = 10000000000; // Adjust for ~5-10 min runtime
    auto start = std::chrono::high_resolution_clock::now();

    std::vector<bool> is_prime(N+1, true);
    is_prime[0] = is_prime[1] = false;
    for (long long i = 2; i * i <= N; ++i) {
        if (is_prime[i]) {
            for (long long j = i * i; j <= N; j += i) {
                is_prime[j] = false;
            }
        }
    }

    // Count and store primes
    long long count = 0;
    std::ofstream out("primes.txt");
    for (long long i = 2; i <= N; ++i) {
        if (is_prime[i]) {
            count++;
            out << i << "\n"; // Store/show (limit output for large N to avoid slowdown)
        }
    }
    out.close();

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = end - start;
    std::cout << "Single-Threaded: " << count << " primes found up to " << N << std::endl;
    std::cout << "Time: " << duration.count() << " seconds" << std::endl;
    return 0;
}