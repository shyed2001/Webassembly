#include <iostream>
#include <vector>
#include <cmath>
#include <numeric>
#include <algorithm> // Required for std::upper_bound
#include <omp.h>     // Required for OpenMP

/**
 * @brief Generates primes up to a given limit using a simple sieve.
 * @param limit The upper bound for prime generation.
 * @return A vector of integers containing primes up to limit.
 */
std::vector<int> prime_sieve(int limit) {
    std::vector<bool> is_prime(limit + 1, true);
    if (limit >= 0) is_prime[0] = false;
    if (limit >= 1) is_prime[1] = false;
    for (int p = 2; p * p <= limit; ++p) {
        if (is_prime[p]) {
            for (int i = p * p; i <= limit; i += p)
                is_prime[i] = false;
        }
    }
    std::vector<int> primes;
    for (int p = 2; p <= limit; ++p) {
        if (is_prime[p]) {
            primes.push_back(p);
        }
    }
    return primes;
}

/**
 * @brief Efficiently counts primes up to m using a pre-computed list.
 * @param m The number to count primes up to.
 * @param primes A sorted vector of pre-computed primes.
 * @return The number of primes less than or equal to m.
 */
long long get_pi(long long m, const std::vector<int>& primes) {
    // std::upper_bound finds the first element in the range that is greater than m.
    // The distance from the beginning is the count of elements <= m.
    return std::upper_bound(primes.begin(), primes.end(), m) - primes.begin();
}

/**
 * @brief The phi function, counting numbers <= m not divisible by the first b primes.
 * This is a core component of the Meissel-Lehmer algorithm.
 */
long long phi(long long m, int b, const std::vector<int>& primes, std::vector<std::vector<long long>>& phi_cache) {
    if (b == 0) return m;
    if (b < phi_cache.size() && m < phi_cache[b].size() && phi_cache[b][m] != 0) {
        return phi_cache[b][m];
    }
    
    long long result = phi(m, b - 1, primes, phi_cache) - phi(m / primes[b - 1], b - 1, primes, phi_cache);
    
    if (b < phi_cache.size() && m < phi_cache[b].size()) {
        phi_cache[b][m] = result;
    }
    return result;
}

/**
 * @brief Calculates pi(n) using a parallelized Meissel-Lehmer algorithm.
 * @param n The upper bound for counting primes.
 * @return The number of primes less than or equal to n.
 */
long long meissel_lehmer_parallel(long long n) {
    if (n < 2) return 0;

    long long y = cbrtl(n);    // Use cbrtl for long double precision
    long long z = sqrtl(n);    // Use sqrtl for long double precision
    std::vector<int> primes = prime_sieve(z);

    long long pi_y = get_pi(y, primes);

    // A slightly more robust 2D cache for phi(m, b).
    // This avoids large memory allocation if m or b is large.
    // The dimensions are chosen based on the parameters used in this function.
    std::vector<std::vector<long long>> phi_cache(pi_y + 1, std::vector<long long>(y + 1, 0));
    
    // Term 1: The main combinatorial part
    long long term1 = phi(n, pi_y, primes, phi_cache) + pi_y - 1;
    
    // Term 2: The correction term (P2)
    long long term2 = 0;
    long long pi_z = primes.size();

    // Parallelize the main computational loop
    #pragma omp parallel for reduction(+:term2) schedule(dynamic)
    for (long long i = pi_y; i < pi_z; ++i) {
        term2 += get_pi(n / primes[i], primes) - i;
    }

    return term1 - term2;
}

int main() {
    long long N = 100000000LL; // Let's try a larger number: 10^8
    std::cout << "Calculating pi(" << N << ") using parallel Meissel-Lehmer..." << std::endl;
    
    double start_time = omp_get_wtime();
    long long result = meissel_lehmer_parallel(N);
    double end_time = omp_get_wtime();
    
    std::cout << "pi(" << N << ") = " << result << std::endl; // For 10^8, should be 5761455
    std::cout << "Time taken: " << end_time - start_time << " seconds" << std::endl;
    
    return 0;
}
// g++ -std=c++17 -Wall -O3 -fopenmp meissel_lehmer_parallel.cpp -o meissel_lehmer_parallel_OFFICE.exe
// clang++ -std=c++17 -Wall -O3 -fopenmp meissel_lehmer_parallel.cpp -o meissel_lehmer_parallel_OFFICE.exe

// execution command : .\meissel_lehmer_parallel_OFFICE.exe 