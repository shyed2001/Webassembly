// PrimeNumST.cpp
// This program finds all prime numbers up to a specified limit using a single-threaded approach.

#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream>

int main() {
    long long N = 4000000000LL; // Adjust for ~5-10 min runtime
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

// Compilation command: g++ -O3 -std=c++17 -fopenmp PrimeNumST.cpp -o PrimeNumST.exe
// Execution command: ./PrimeNumST.exe
// clang++ -O3 -std=c++17 -fopenmp PrimeNumST.cpp -o PrimeNumST.exe
// Note: Ensure to adjust the value of N for practical runtime and output size.
// Output will be stored in primes.txt
// Make sure to have sufficient disk space for the output file.
// This code is designed to run with C++17 standard and uses optimizations for performance.
// Ensure to compile with optimizations enabled for best performance.
// The output file 'primes.txt' will contain all prime numbers found up to the specified limit N.
// Note: The program may take a significant amount of time to run for large values of N.
// The output file will be large; consider adjusting N for practical use cases.
// The program uses a simple Sieve of Eratosthenes algorithm to find prime numbers.
// The algorithm is efficient for finding all primes up to a large number.
// The program is single-threaded and designed for educational purposes.
// It can be optimized further or parallelized for better performance on larger datasets.

