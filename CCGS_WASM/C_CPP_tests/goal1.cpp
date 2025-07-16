#include <iostream>      // Standard input/output library for console operations (e.g., std::cout for printing results).
#include <fstream>       // File stream library for reading from files (e.g., std::ifstream for input file handling).
#include <sstream>       // String stream library for parsing comma-separated values (CSV) from each line.
#include <vector>        // Dynamic array container to store collections of transactions and features efficiently.
#include <string>        // String manipulation library for handling text data from the CSV.
#include <chrono>        // High-resolution timing library to measure execution time accurately.
#include <cmath>         // Math library providing functions like sin(), cos(), atan2() for calculations.
#include <unordered_map> // Hash map for fast lookups; used here to track the last transaction time per credit card number.

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
// Explanation: Necessary because the dataset has quoted fields like merchant names with commas. If your CSV file does not quote fields with commas (e.g., merchant or job), it is invalid CSV and will cause incorrect splitting. Ensure fields with commas are quoted (e.g., "fraud_Rippin, Kub and Mann") to parse correctly.
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
};

struct TransactionFeatures {
    double haversine_dist;
    long time_since_last_trans;
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
        // Check for exact number of fields to catch parsing errors (e.g., unquoted commas causing extra splits).
        if (parts.size() != 23) { // Note: Dataset has 23 columns (including index and is_fraud, but we parse 22 + index? Wait, header has 22 fields after index? Count: trans_date_trans_time to is_fraud is 22 columns, but pasted has index as first.
        // The header is trans_date_trans_time,cc_num,... is_fraud, 22 columns.
        // But pasted has 0 as first, so 23 fields.
        // Adjust to 23 for your pasted format (with leading index).
        std::cerr << "Invalid field count: " << parts.size() << " (expected 23) for line: " << line << std::endl;
        continue;
    }

        // Trim all parts to remove any potential leading/trailing spaces.
        for (auto& part : parts) {
            part = trim(part);
        }

        Transaction t;
        // Extract specific columns from Kaggle dataset (0-based indices, with leading index as col 0).
        // cc_num (2), unix_time (19), amt (5), lat (13), lon (14), merch_lat (20), merch_long (21)
        try {
            t.cc_num = std::stoll(parts[2]);
            t.unix_time = std::stol(parts[19]);
            t.amt = std::stod(parts[5]);
            t.lat = std::stod(parts[13]);
            t.lon = std::stod(parts[14]);
            t.merch_lat = std::stod(parts[20]);
            t.merch_lon = std::stod(parts[21]);
            transactions.push_back(t);
        } catch (const std::exception& e) {
            std::cerr << "Skipping invalid line: " << line << " error: " << e.what() << std::endl;
            continue;
        }
    }
    file.close();

    // --- Processing ---
    auto start = std::chrono::high_resolution_clock::now();

    std::vector<TransactionFeatures> features;
    features.reserve(transactions.size());
    std::unordered_map<long long, long> last_trans_time;

    for (const auto& t : transactions) {
        TransactionFeatures f;
        f.haversine_dist = haversine(t.lat, t.lon, t.merch_lat, t.merch_lon);

        if (last_trans_time.count(t.cc_num)) {
            f.time_since_last_trans = t.unix_time - last_trans_time[t.cc_num];
        } else {
            f.time_since_last_trans = -1;
        }
        last_trans_time[t.cc_num] = t.unix_time;
        
        features.push_back(f);
    }

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> duration = end - start;
    
    std::cout << "Goal 1: Single-Threaded" << std::endl;
    std::cout << "Processed " << features.size() << " transactions." << std::endl;
    std::cout << "Time taken: " << duration.count() << " seconds." << std::endl;

    return 0;
}