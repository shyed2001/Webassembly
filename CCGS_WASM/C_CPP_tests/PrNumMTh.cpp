// PrNumMTh.cpp
// This program finds all prime numbers up to a specified limit using a multi-threaded approach.
#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream>
#include <thread>
#include <mutex>
#include <atomic>

std::mutex mtx; // For synchronization

void sieve_segment(long long low, long long high, const std::vector<long long>& primes, std::vector<bool>& is_prime_seg) {
    for (auto p : primes) {
        if (p * p > high) break;
        long long start = std::max(p * p, (low + p - 1) / p * p);
        for (long long j = start; j <= high; j += p) {
            if (j >= low) is_prime_seg[j - low] = false;
        }
    }
}

int main() {
    long long N = 4000000000LL; // Adjust as needed
    int num_threads = 12; // Adjust based on cores
    auto start = std::chrono::high_resolution_clock::now();

    // Find small primes up to sqrt(N) sequentially
    long long sqrt_n = std::sqrt(N);
    std::vector<bool> small_is_prime(sqrt_n + 1, true);
    small_is_prime[0] = small_is_prime[1] = false;
    for (long long i = 2; i * i <= sqrt_n; ++i) {
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

    // Divide into segments
    long long seg_size = N / num_threads;
    std::vector<std::thread> threads;
    std::vector<std::vector<bool>> segments(num_threads);
    std::atomic<long long> count(0);

    for (int t = 0; t < num_threads; ++t) {
        long long low = t * seg_size + 1;
        long long high = (t == num_threads - 1) ? N : (t + 1) * seg_size;
        if (low == 1) low = 2; // Skip 0/1

        threads.emplace_back([low, high, &small_primes, &segments, t, &count]() {
            segments[t] = std::vector<bool>(high - low + 1, true);
            sieve_segment(low, high, small_primes, segments[t]);

            long long local_count = 0;
            for (size_t i = 0; i < segments[t].size(); ++i) {
                if (segments[t][i]) local_count++;
            }
            count += local_count;
        });
    }

    for (auto& th : threads) th.join();

    // Store (combine segments)
    std::ofstream out("primes.txt");
    for (int t = 0; t < num_threads; ++t) {
        long long low = t * seg_size + 1;
        if (low == 1) low = 2;
        for (size_t i = 0; i < segments[t].size(); ++i) {
            if (segments[t][i]) out << (low + i) << "\n";
        }
    }
    out.close();

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = end - start;
    std::cout << "Multi-Threaded: "<< num_threads << " threads: " << count << " primes found up to " << N << std::endl;
    std::cout << "Time: " << duration.count() << " seconds" << std::endl;
    return 0;
}

// Compilation command: clang++ -O3 -std=c++17 -fopenmp PrNumMTh.cpp -o PrNumMTh.exe
// Execution command: ./PrNumMTh.exe
// Note: Ensure to adjust the value of N for practical runtime and output size.
