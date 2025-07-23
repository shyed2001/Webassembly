// PrimeNumParallel.cpp
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
    long long N = 400000000000LL; // 10^12; adjust for 7-10 min (test small first)
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

// Compilation command: g++ -O3 -std=c++17 -fopenmp PrmNumParallel.cpp -o exec
// Execution command: ./exec

// clang++ -O3 -std=c++17 -fopenmp PrmNumParallel.cpp -o PrmNumParallel.exe
// execution command: ./PrmNumParallel.exe
/*
Microsoft Windows [Version 10.0.26100.4652]
(c) Microsoft Corporation. All rights reserved.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 goal1.cpp -o goal1
'F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>goal1.cpp: In function 'double haversine(double, double, double, double)':
'goal1.cpp:' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>goal1.cpp:33:30: error: 'M_PI' was not declared in this scope
The filename, directory name, or volume label syntax is incorrect.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>     double lat_rad1 = lat1 * M_PI / 180.0; // Convert degrees to radians for trigonometric functions.        
'double' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>                           
   ^~~~
'~~~' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>goal1.cpp: In function 'int main()':
'goal1.cpp:' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>goal1.cpp:77:40: error: 'struct Transaction' has no member named 'merch_long'; did you mean 'merch_lon'?      
The filename, directory name, or volume label syntax is incorrect.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>         std::getline(ss, part, ','); t.merch_long = std::stod(part); // Parse merchant longitude.
The filename, directory name, or volume label syntax is incorrect.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>                           
             ^~~~~~~~~~
'~~~~~~~~~' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>                           
             merch_lon
'merch_lon' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>goal1.cpp:97:67: error: 'const struct Transaction' has no member named 'merch_long'; did you mean 'merch_lon'?

The filename, directory name, or volume label syntax is incorrect.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>         f.haversine_dist = haversine(t.lat, t.lon, t.merch_lat, t.merch_long); // Compute distance.
'f.haversine_dist' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>                           
                                        ^~~~~~~~~~
'~~~~~~~~~' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>                           
                                        merch_lon
'merch_lon' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 goal1.cpp -o goal1
'F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests' is not recognized as an inoperable program operable program or batch file.


F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>g++ -O3 -std=c++17 goal1.cpp -o goal1
g++: error: goal1.cpp: No such file or directory
g++: fatal error: no input files
compilation terminated.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>emcc -v                    
'emcc' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>emcc --v
'emcc' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>emcc --version
'emcc' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>emcc -version 
'emcc' is not recognized as an internal or external command,
operable program or batch file.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>g++ -O3 -std=c++17 goal1.cpp -o goal1
g++: error: goal1.cpp: No such file or directory
g++: fatal error: no input files
compilation terminated.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM>cd C_CPP_tests

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 goal1.cpp -o goal1
goal1.cpp: In function 'double haversine(double, double, double, double)':
goal1.cpp:33:30: error: 'M_PI' was not declared in this scope
     double lat_rad1 = lat1 * M_PI / 180.0; // Convert degrees to radians for trigonometric functions.
                              ^~~~
goal1.cpp: In function 'int main()':
goal1.cpp:77:40: error: 'struct Transaction' has no member named 'merch_long'; did you mean 'merch_lon'?
         std::getline(ss, part, ','); t.merch_long = std::stod(part); // Parse merchant longitude.
                                        ^~~~~~~~~~
                                        merch_lon
goal1.cpp:97:67: error: 'const struct Transaction' has no member named 'merch_long'; did you mean 'merch_lon'?
         f.haversine_dist = haversine(t.lat, t.lon, t.merch_lat, t.merch_long); // Compute distance.
                                                                   ^~~~~~~~~~      
                                                                   merch_lon       

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 goal1.cpp -o goal1

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\goal1.exe
terminate called after throwing an instance of 'std::invalid_argument'
  what():  stod

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>dir
 Volume in drive F is New Volume
 Volume Serial Number is FE14-0AA7

 Directory of F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests  

07/16/2025  11:30 PM    <DIR>          .
07/16/2025  11:14 PM    <DIR>          ..
04/26/2025  05:10 PM       351,238,196 data.csv
04/26/2025  05:10 PM       351,238,196 fraudTrain.csv
07/16/2025  11:25 PM             8,449 goal1.cpp
07/16/2025  11:26 PM           106,723 goal1.exe
               4 File(s)    702,591,564 bytes
               2 Dir(s)  173,553,922,048 bytes free

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\goal1.exe
terminate called after throwing an instance of 'std::invalid_argument'  
  what():  stod

-O3 -std=c++17 goal1.cpp -o goal1

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\goal1.exe    
Goal 1: Single-Threaded
Processed 0 transactions.
Time taken: 0 seconds.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 goal1.cpp -o goal1

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\goal1.exe    
Goal 1: Single-Threaded
Processed 0 transactions.
Time taken: 0 seconds.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 goal1.cpp -o goal1

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\goal1.exe    
Goal 1: Single-Threaded
Processed 1296675 transactions.
Time taken: 0.476473 seconds.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c+
+17 goal1A.cpp -o goal1A

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\goal1A.exe   
Goal 1: Single-Threaded
Processed 1296675 transactions.
Time taken: 0.839081 seconds.
Actual Frauds: 7506
Predicted Frauds: 393402
True Positives (TP): 6158
True Positives (TP): 6158
False Positives (FP): 387244
True Negatives (TN): 901925
False Negatives (FN): 1348
Accuracy: 0.700317
Precision: 0.0156532
True Positives (TP): 6158
False Positives (FP): 387244
True Negatives (TN): 901925
False Negatives (FN): 1348
Accuracy: 0.700317
True Positives (TP): 6158
False Positives (FP): 387244
True Negatives (TN): 901925
True Positives (TP): 6158
False Positives (FP): 387244
True Positives (TP): 6158
True Positives (TP): 6158
True Positives (TP): 6158
True Positives (TP): 6158
False Positives (FP): 387244
False Positives (FP): 387244
True Negatives (TN): 901925
True Negatives (TN): 901925
False Negatives (FN): 1348
Accuracy: 0.700317
Precision: 0.0156532
Recall: 0.82041

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp file.cpp -o exec
g++: error: file.cpp: No such file or directory
g++: fatal error: no input files
compilation terminated.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrimeNumST.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe 
Single-Threaded: 78498 primes found up to 1000000
Time: 0.037473 seconds

Single-Threaded: 78498 primes found up to 1000000
Time: 0.037473 seconds

Time: 0.037473 seconds


F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c+F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrimeNumST.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe     
+17 -fopenmp PrimeNumST.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe     

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe     
Single-Threaded: 50847534 primes found up to 1000000000
Time: 30.3988 seconds
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe     
Single-Threaded: 50847534 primes found up to 1000000000
Time: 30.3988 seconds
Single-Threaded: 50847534 primes found up to 1000000000
Time: 30.3988 seconds


F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrimeNumST.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrimeNumST.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe     

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe     
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe     
Single-Threaded: 455052511 primes found up to 10000000000
Single-Threaded: 455052511 primes found up to 10000000000
Time: 384.62 seconds
Time: 384.62 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMTh.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe     
Multi-Threaded: 50847534 primes found up to 1000000000
Time: 37.4495 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMTh.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe
Multi-Threaded: 5761455 primes found up to 100000000
Time: 2.99659 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMTh.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe
Multi-Threaded: 50847534 primes found up to 1000000000
Time: 40.5433 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMTh.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe     
Multi-Threaded: 664579 primes found up to 10000000
Time: 0.749903 seconds
Time: 0.749903 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMTh.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
Multi-Threaded: 50847534 primes found up to 1000000000
Time: 30.3045 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthPrll.cpp -o exec
g++: error: PrNumMthPrll.cpp: No such file or directory
g++: fatal error: no input files
compilation terminated.

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec
PrNumMthrPrll.cpp: In function 'int main()':
PrNumMthrPrll.cpp:16:33: error: invalid controlling predicate
     for (long long i = 2; i * i <= N; ++i) {
                           ~~~~~~^~~~

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec
PrNumMthrPrll.cpp: In function 'int main()':
PrNumMthrPrll.cpp:16:33: error: invalid controlling predicate
     for (long long i = 2; i * i <= N; ++i) {
                           ~~~~~~^~~~

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
Parallel (OpenMP): 50847534 primes found up to 1000000000
Time: 32.6458 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
Parallel (OpenMP): 50847534 primes found up to 1000000000
Time: 34.1116 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMTh.cpp -o exec     

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe
Multi-Threaded: 50847534 primes found up to 1000000000
Time: 44.0442 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMTh.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
Multi-Threaded: 50847534 primes found up to 1000000000
Time: 39.7917 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
^C
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
^C
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
^C
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
^C
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
^C
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe
^C
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe
Parallel (OpenMP): 664578 primes found up to 10000000
Time: 3.24949 seconds
Max Prime Gap: 154
Sample Primes (first 10): 2 3 5 7 11 13 17 19 23 29

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
Parallel (OpenMP): 5761454 primes found up to 100000000
Time: 84.9811 seconds
Max Prime Gap: 220
Sample Primes (first 10): 2 3 5 7 11 13 17 19 23 29

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
^C
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
Parallel (OpenMP): 5761454 primes found up to 100000000
Threads Used: 1
Time: 6.48093 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
Parallel (OpenMP): 50847534 primes found up to 1000000000
Threads Used: 1
Time: 42.5283 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
Parallel (OpenMP): 455052510 primes found up to 10000000000
Threads Used: 1
Time: 356.979 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrmNumParallel.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
^C
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
^C
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrNumMthrPrll.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrmNumParallel.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe
OpenMP Parallel: 6424750 primes found up to 100000000
Threads Used: 8
Time: 0.13554 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrmNumParallel.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
OpenMP Parallel: 455321822 primes found up to 10000000000
Threads Used: 8
Time: 19.6136 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrmNumParallel.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
OpenMP Parallel: 455321822 primes found up to 10000000000
Threads Used: 8
Time: 20.0264 seconds

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>g++ -O3 -std=c++17 -fopenmp PrmNumParallel.cpp -o exec

F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>.\exec.exe       
^C                                   
F:\GitHubDesktop\GitHubCloneFiles\Webassembly\CCGS_WASM\C_CPP_tests>

*/