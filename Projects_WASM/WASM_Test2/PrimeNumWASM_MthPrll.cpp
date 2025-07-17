
#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <pthread.h>  // For pthreads

// Segment size (tune for cache: e.g., 1MB = 1024*1024*8 bits)
const long long SEGMENT_SIZE = 1LL << 20; // 1MB
const int NUM_THREADS = 4;  // Adjust based on your PTHREAD_POOL_SIZE

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

// Thread argument struct
struct ThreadArg {
  long long start_seg;
  long long end_seg;
  const std::vector<long long>* small_primes;
  long long* total_count;
  pthread_mutex_t* mutex;
  long long N;
};

// Thread function
void* thread_func(void* arg) {
  ThreadArg* t_arg = static_cast<ThreadArg*>(arg);
  std::vector<char> seg(SEGMENT_SIZE);
  long long local_count = 0;

  for (long long s = t_arg->start_seg; s < t_arg->end_seg; ++s) {
    long long low = s * SEGMENT_SIZE;
    long long high = std::min(low + SEGMENT_SIZE - 1, t_arg->N);
    long long seg_count = 0;
    sieve_segment(low, high, *(t_arg->small_primes), seg, seg_count);
    local_count += seg_count;
  }

  // Lock and add to total
  pthread_mutex_lock(t_arg->mutex);
  *(t_arg->total_count) += local_count;
  pthread_mutex_unlock(t_arg->mutex);

  return nullptr;
}

int main() {
  long long N = 1000000000LL; // Test with smaller N for WASM
  auto start = std::chrono::high_resolution_clock::now();
  long long sqrt_n = static_cast<long long>(std::sqrt(N));
  auto small_primes = generate_small_primes(sqrt_n);
  long long num_segments = (N + SEGMENT_SIZE - 1) / SEGMENT_SIZE;
  long long total_count = 0;

  // Pthreads setup
  pthread_t threads[NUM_THREADS];
  ThreadArg args[NUM_THREADS];
  pthread_mutex_t mutex;
  pthread_mutex_init(&mutex, nullptr);

  long long seg_per_thread = num_segments / NUM_THREADS;
  long long remainder = num_segments % NUM_THREADS;

  long long current_seg = 0;
  for (int t = 0; t < NUM_THREADS; ++t) {
    args[t].start_seg = current_seg;
    args[t].end_seg = current_seg + seg_per_thread + (t < remainder ? 1 : 0);
    args[t].small_primes = &small_primes;
    args[t].total_count = &total_count;
    args[t].mutex = &mutex;
    args[t].N = N;
    pthread_create(&threads[t], nullptr, thread_func, &args[t]);
    current_seg = args[t].end_seg;
  }

  // Join threads
  for (int t = 0; t < NUM_THREADS; ++t) {
    pthread_join(threads[t], nullptr);
  }
  pthread_mutex_destroy(&mutex);

  auto end = std::chrono::high_resolution_clock::now();
  std::chrono::duration<double> duration = end - start;
  std::cout << "Pthreads Parallel: " << total_count << " primes found up to " << N << std::endl;
  std::cout << "Threads Used: " << NUM_THREADS << std::endl;
  std::cout << "Time: " << duration.count() << " seconds" << std::endl;

  return 0;
}

/*
Limitations:
Multi-threading in WASM requires browser support for SharedArrayBuffer (enabled in modern Chrome, Firefox, Edge; may need flags like chrome://flags/#shared-array-buffers).
Large N (e.g., 10^12) could hit browser memory limits (default ~4GB; adjustable but risky). Test with smaller N first (e.g., 10^8).
No direct file I/O (e.g., std::ofstream for storing primes) in browser WASM—output goes to console or JavaScript. Node.js allows more flexibility.
Running requires a web server (browsers block local file loading for security).
Not all OpenMP features are fully supported; simple parallel for loops like in your code work fine.


For multi-threading to work:
Add HTTP headers for cross-origin isolation (required for SharedArrayBuffer). Use a server that sets Cross-Origin-Embedder-Policy: require-corp and Cross-Origin-Opener-Policy: same-origin. Simple way: Use Emscripten's built-in server with emrun --browser=chrome prime_sieve.html.




#include <iostream>
#include <vector>
#include <chrono>
#include <cmath>
#include <fstream> // Optional; remove if not using I/O
using namespace std::chrono; 
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
    auto start = std::chrono::high_resolution_clock::now();

  long long N = 1000000000LL; // 10^12; adjust for 7-10 min (test small first)
  // auto start = std::chrono::high_resolution_clock::now();
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
      // Optional: Store primes (add if needed, but slows I/O and may not work in browser)
      // std::ofstream out("primes_part" + std::to_string(s) + ".txt");
      // for (long long i = low; i <= high; ++i) if (seg[i - low]) out << i << "\n";
    }
  }
  auto end = std::chrono::high_resolution_clock::now();
  std::chrono::duration<double> duration = end - start;
  std::cout << "OpenMP Parallel: " << total_count << " primes found up to " << N << std::endl;
  std::cout << "Time: " << duration.count() << " seconds" << std::endl;
  // Note: Threads used is hardcoded or omitted; actual parallelism via PTHREAD_POOL_SIZE

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
    long long N = 10000000000LL; // 10^12; adjust for 7-10 min (test small first)
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
*/
// Prime number sieve using OpenMP for parallel processing
// This code implements a segmented sieve algorithm to find prime numbers
// up to a large number N (e.g., 10^12) using OpenMP for parallel execution.
// The algorithm divides the range into segments and processes each segment
// in parallel, using small primes generated from a simple sieve up to sqrt(N). 
// Compilation requires OpenMP support and can be done with Emscripten for WebAssembly.
//Compilation command example: emcc -O3 -std=c++17 -fopenmp -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=4 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=67108864 prime_sieve_openmp.cpp -o prime_sieve.html
//Compilation command : emcc -O3 -std=c++17 -fopenmp -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=4 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=67108864 PrimeNumWASM_MthPrll.cpp -o PrimeNumWASM_MthPrll.html
// Compilation command for Emscripten:
// emcc -O3 -std=c++17 -fopenmp -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=4 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=67108864 prime_sieve_openmp.cpp -o prime_sieve.html
//Compilation command : emcc -O3 -std=c++17 -fopenmp -s USE_PTHREADS=1 -s PTHREAD_POOL_SIZE=4 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=268435456 PrimeNumWASM_MthPrll.cpp -o PrimeNumWASM_MthPrll.html
// Compilation command explanation:
/*
Explanation of flags:
-O3: High optimizations (speed).
-std=c++17: C++17 standard.
-fopenmp: Enables OpenMP (compiles to pthreads for WASM threads).
-s USE_PTHREADS=1: Enables multi-threading in WASM.
-s PTHREAD_POOL_SIZE=4: Sets thread pool size (adjust to your cores, e.g., 8; matches omp_get_max_threads()).
-s ALLOW_MEMORY_GROWTH=1: Allows dynamic memory increase for large N (prevents out-of-memory errors).
-s INITIAL_MEMORY=67108864: Starts with 64MB (adjust higher for big N, e.g., 268435456 for 256MB).
-o prime_sieve.html: Outputs prime_sieve.html (loader), prime_sieve.js (glue code), and prime_sieve.wasm (binary module).
This produces WASM by default. Compilation takes seconds to minutes.
Step 4: Run the WASM Module
You can't run .wasm directly like an exe— it needs a host environment.

Option 1: In a Web Browser (Recommended for Demo)

Start a local web server (Python is built-in on Windows 10+):
text

Collapse

Wrap

Copy
python -m http.server 8000
If Python not found, install from microsoft.com/python or use Node.js (npx http-server).
Open a browser (Chrome/Firefox) and go to http://localhost:8000/prime_sieve.html.
The program runs automatically:
Output appears in the browser console (press F12 > Console).
Example: "OpenMP Parallel: X primes found up to Y" with time and threads.
For multi-threading to work:
Add HTTP headers for cross-origin isolation (required for SharedArrayBuffer). Use a server that sets Cross-Origin-Embedder-Policy: require-corp and Cross-Origin-Opener-Policy: same-origin. Simple way: Use Emscripten's built-in server with emrun --browser=chrome prime_sieve.html.
If threads show as 1, check browser flags.
Option 2: In Node.js (For Command-Line Execution)

Install Node.js if not present (nodejs.org).
Run:
text

Collapse

Wrap

Copy
node --experimental-wasm-threads --experimental-wasm-bulk-memory prime_sieve.js
Output goes to the console.
Flags enable threads and memory features.
Step 5: Test and Tune
Quick Test: Set N=100000000LL (10^8) in code, recompile. Runs in ~1-5 seconds.
Full Run: For N=10^12, expect 1-10 minutes depending on threads/browser. Monitor memory in browser dev tools.
Debug Issues:
omp.h not found: Ensure Emscripten is activated; it's included.
No threads: Add -s ENVIRONMENT=worker if needed; check browser console for errors.
Memory Errors: Increase INITIAL_MEMORY or use ALLOW_MEMORY_GROWTH.
Compilation Fails: Update Emscripten or check docs at emscripten.org (search "OpenMP support").
Integration: To use in a web app (e.g., React), import the .js module and call the exported function.
This turns your program into a WASM module for web use. For CSE, it's great for browser-based demos. If stuck, share error messages!

*/




// Note: Adjust N for testing; large values may take significant time
// Ensure OpenMP is supported in your environment
// and that you have sufficient memory for large segments.
// For large N, consider using a file to store results instead of printing
// to console to avoid performance issues.
// 