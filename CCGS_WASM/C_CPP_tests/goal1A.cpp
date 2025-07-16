#include <iostream>      // Standard input/output library for console operations (e.g., std::cout for printing results).
#include <fstream>       // File stream library for reading from files (e.g., std::ifstream for input file handling).
#include <sstream>       // String stream library for parsing comma-separated values (CSV) from each line.
#include <vector>        // Dynamic array container to store collections of transactions and features efficiently.
#include <string>        // String manipulation library for handling text data from the CSV.
#include <chrono>        // High-resolution timing library to measure execution time accurately.
#include <cmath>         // Math library providing functions like sin(), cos(), atan2() for calculations.
#include <unordered_map> // Hash map for fast lookups; used here to track the last transaction time per credit card number.
#include <algorithm>     // For std::sort and std::lower_bound.

// Define PI constant manually for portability.
const double PI = std::acos(-1.0);

// --- Trim Function ---
// Definition: Removes leading and trailing whitespace (spaces and tabs) from a string.
// Description: Helps clean parsed CSV fields in case of extra spaces, preventing parsing errors in std::stod/stoll.
// Explanation: Uses find_first_not_of and find_last_not_of to identify non-whitespace boundaries. Returns empty string if all whitespace.
std::string trim(const std::string& str) {
    size_t first = str.find_first_not_of(" \t");
    if (first == std::string::npos) return "";
    size_t last = str.find_last_not_of(" \t");
    return str.substr(first, last - first + 1);
}

// --- CSV Parsing Function ---
// Definition: Parses a CSV line into fields, handling double-quoted fields with embedded commas.
// Description: Simple parser that toggles quote mode to ignore commas inside quotes. Assumes no escaped quotes ("") inside fields.
// Explanation: Necessary because the dataset has quoted fields like merchant names with commas.
std::vector<std::string> parse_csv_line(const std::string& line) {
    std::vector<std::string> fields;
    std::string field;
    bool in_quote = false;
    for (char c : line) {
        if (c == '"') {
            in_quote = !in_quote;
            // Don't add the quote to the field (strip quotes).
        } else if (c == ',' && !in_quote) {
            fields.push_back(field);
            field.clear();
        } else {
            field += c;
        }
    }
    if (!field.empty()) {
        fields.push_back(field);
    }
    return fields;
}

// --- Data Structures ---
struct Transaction {
    long long cc_num;
    long unix_time;
    double amt;
    double lat, lon;
    double merch_lat, merch_lon;
    int is_fraud; // Added for fraud detection evaluation
    std::string category; // Added for category-based risk
};

struct TransactionFeatures {
    double haversine_dist;
    long time_since_last_trans;
    // Added more features for intensive computation
    double velocity;
    double z_score_amt;
    int trans_count_1h;
    int trans_count_24h;
    int trans_count_7d;
    double amt_sum_24h;
    bool is_night;
    double category_risk;
    bool predicted_fraud;
};

// --- Haversine Function ---
double haversine(double lat1, double lon1, double lat2, double lon2) {
    const double R = 6371.0;
    double lat_rad1 = lat1 * PI / 180.0;
    double lon_rad1 = lon1 * PI / 180.0;
    double lat_rad2 = lat2 * PI / 180.0;
    double lon_rad2 = lon2 * PI / 180.0;

    double dlat = lat_rad2 - lat_rad1;
    double dlon = lon_rad2 - lon_rad1;

    double a = sin(dlat / 2) * sin(dlat / 2) +
               cos(lat_rad1) * cos(lat_rad2) *
               sin(dlon / 2) * sin(dlon / 2);
    double c = 2 * atan2(sqrt(a), sqrt(1 - a));

    return R * c;
}

int main() {
    std::ifstream file("data.csv");
    if (!file.is_open()) {
        std::cerr << "Error: Could not open data.csv" << std::endl;
        return 1;
    }

    std::string line;
    std::getline(file, line); // Skip header.

    std::vector<Transaction> transactions;
    while (std::getline(file, line)) {
        auto parts = parse_csv_line(line);
        if (parts.size() != 23) { // Dataset has 23 fields (leading index + 22 columns)
            std::cerr << "Invalid field count: " << parts.size() << " (expected 23) for line: " << line << std::endl;
            continue;
        }

        // Trim all parts to remove any potential leading/trailing spaces.
        for (auto& part : parts) {
            part = trim(part);
        }

        Transaction t;
        // Extract specific columns (0-based, with leading index).
        try {
            t.cc_num = std::stoll(parts[2]);
            t.unix_time = std::stol(parts[19]);
            t.amt = std::stod(parts[5]);
            t.lat = std::stod(parts[13]);
            t.lon = std::stod(parts[14]);
            t.merch_lat = std::stod(parts[20]);
            t.merch_lon = std::stod(parts[21]);
            t.is_fraud = std::stoi(parts[22]);
            t.category = parts[4];
            transactions.push_back(t);
        } catch (const std::exception& e) {
            std::cerr << "Skipping invalid line: " << line << " error: " << e.what() << std::endl;
            continue;
        }
    }
    file.close();

    // Group transactions by cc_num for per-card computations
    std::unordered_map<long long, std::vector<Transaction>> groups;
    for (auto& t : transactions) {
        groups[t.cc_num].push_back(t);
    }
    transactions.clear(); // Free memory

    // Predefine category risk scores (based on common high-risk categories from fraud detection literature)
    std::unordered_map<std::string, double> category_risk = {
        {"misc_net", 0.8},
        {"shopping_net", 0.9},
        {"shopping_pos", 0.7},
        {"grocery_pos", 0.3},
        {"gas_transport", 0.4},
        {"entertainment", 0.5},
        {"food_dining", 0.2},
        {"grocery_net", 0.3},
        // Add more as needed; default 0.5
    };

    // --- Processing --- (Extended with fraud detection computations)
    auto start = std::chrono::high_resolution_clock::now();

    std::vector<TransactionFeatures> features;
    size_t total_trans = 0;
    for (const auto& p : groups) total_trans += p.second.size();
    features.reserve(total_trans);

    long long actual_frauds = 0;
    long long predicted_frauds = 0;
    long long tp = 0, fp = 0, tn = 0, fn = 0;

    for (auto& pair : groups) {
        auto& group = pair.second;
        if (group.empty()) continue;

        // Sort by unix_time for time-based features
        std::sort(group.begin(), group.end(), [](const Transaction& a, const Transaction& b) {
            return a.unix_time < b.unix_time;
        });

        // Compute mean and std for amount z-scores
        double sum_amt = 0.0;
        for (const auto& tr : group) {
            sum_amt += tr.amt;
            actual_frauds += tr.is_fraud;
        }
        double mean_amt = sum_amt / group.size();

        double sum_sq_diff = 0.0;
        for (const auto& tr : group) {
            double diff = tr.amt - mean_amt;
            sum_sq_diff += diff * diff;
        }
        double std_amt = (group.size() > 1) ? std::sqrt(sum_sq_diff / (group.size() - 1)) : 0.0;

        // Compute prefix sums for efficient sum queries
        std::vector<double> prefix_amt(group.size() + 1, 0.0);
        for (size_t i = 1; i <= group.size(); ++i) {
            prefix_amt[i] = prefix_amt[i - 1] + group[i - 1].amt;
        }

        // Process each transaction in the sorted group
        for (size_t i = 0; i < group.size(); ++i) {
            const auto& tr = group[i];
            TransactionFeatures f;

            f.haversine_dist = haversine(tr.lat, tr.lon, tr.merch_lat, tr.merch_lon);
            f.time_since_last_trans = (i > 0) ? tr.unix_time - group[i - 1].unix_time : -1;
            f.velocity = (f.time_since_last_trans > 0) ? f.haversine_dist / f.time_since_last_trans : 0.0;
            f.z_score_amt = (std_amt > 0.0) ? (tr.amt - mean_amt) / std_amt : 0.0;

            // Time of day features
            long seconds_in_day = tr.unix_time % 86400;
            int hour = static_cast<int>(seconds_in_day / 3600);
            f.is_night = (hour < 6 || hour >= 22);

            // Category risk
            auto it_risk = category_risk.find(tr.category);
            f.category_risk = (it_risk != category_risk.end()) ? it_risk->second : 0.5;

            // Aggregation features: trans count and amt sum in time windows (using lower_bound on sorted times)
            // 1 hour (3600s)
            long time_1h = tr.unix_time - 3600;
            auto it_1h = std::lower_bound(group.begin(), group.begin() + i, time_1h,
                                          [](const Transaction& a, long val) { return a.unix_time < val; });
            size_t idx_1h = it_1h - group.begin();
            f.trans_count_1h = i - idx_1h;

            // 24 hours (86400s)
            long time_24h = tr.unix_time - 86400;
            auto it_24h = std::lower_bound(group.begin(), group.begin() + i, time_24h,
                                           [](const Transaction& a, long val) { return a.unix_time < val; });
            size_t idx_24h = it_24h - group.begin();
            f.trans_count_24h = i - idx_24h;
            f.amt_sum_24h = prefix_amt[i] - prefix_amt[idx_24h];

            // 7 days (604800s)
            long time_7d = tr.unix_time - 604800;
            auto it_7d = std::lower_bound(group.begin(), group.begin() + i, time_7d,
                                          [](const Transaction& a, long val) { return a.unix_time < val; });
            size_t idx_7d = it_7d - group.begin();
            f.trans_count_7d = i - idx_7d;

            // Simple rule-based fraud prediction (based on common thresholds from fraud detection methods)
            f.predicted_fraud = (f.haversine_dist > 100.0) ||
                                (f.time_since_last_trans > 0 && f.time_since_last_trans < 300) ||
                                (f.z_score_amt > 3.0) ||
                                (f.trans_count_1h > 3) ||
                                (f.trans_count_24h > 20) ||
                                (f.trans_count_7d > 100) ||
                                (f.amt_sum_24h > 5000.0) ||
                                (f.is_night && tr.amt > 200.0) ||
                                (f.category_risk > 0.6 && tr.amt > 100.0) ||
                                (f.velocity > 0.1); // km/s threshold for suspicious speed

            // Update confusion matrix counters
            if (f.predicted_fraud) {
                predicted_frauds++;
                if (tr.is_fraud) tp++;
                else fp++;
            } else {
                if (tr.is_fraud) fn++;
                else tn++;
            }

            features.push_back(f);
        }
    }

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = end - start;
    
    std::cout << "Goal 1: Single-Threaded" << std::endl;
    std::cout << "Processed " << features.size() << " transactions." << std::endl;
    std::cout << "Time taken: " << duration.count() << " seconds." << std::endl;

    // Show fraud detection results
    std::cout << "Actual Frauds: " << actual_frauds << std::endl;
    std::cout << "Predicted Frauds: " << predicted_frauds << std::endl;
    std::cout << "True Positives (TP): " << tp << std::endl;
    std::cout << "False Positives (FP): " << fp << std::endl;
    std::cout << "True Negatives (TN): " << tn << std::endl;
    std::cout << "False Negatives (FN): " << fn << std::endl;
    double accuracy = static_cast<double>(tp + tn) / total_trans;
    double precision = (tp > 0) ? static_cast<double>(tp) / (tp + fp) : 0.0;
    double recall = (tp > 0) ? static_cast<double>(tp) / (tp + fn) : 0.0;
    std::cout << "Accuracy: " << accuracy << std::endl;
    std::cout << "Precision: " << precision << std::endl;
    std::cout << "Recall: " << recall << std::endl;

    return 0;
}