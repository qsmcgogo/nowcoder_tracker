#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, q;
    if (!(cin >> n >> q)) return 0;
    int len = 2 * n + 1;
    vector<long long> a(len + 1);
    for (int i = 1; i <= len; ++i) cin >> a[i];

    // diff[i] = a_{2i} - a_{2i-1}, 1 <= i <= n
    vector<long long> diff(n + 1);
    for (int i = 1; i <= n; ++i) {
        diff[i] = a[2 * i] - a[2 * i - 1];
    }

    auto solve_all = [&](long long start_carry) {
        long long carry = start_carry;
        long long ans = 0;
        for (int i = 1; i <= n; ++i) {
            long long need = diff[i] - carry;
            long long t = 0;
            if (need > 0) {
                t = (need + 1) / 2;  // ceil
            }
            ans += t;
            carry = t;
        }
        return ans;
    };

    auto output_ans = [&]() {
        cout << solve_all(0) << '\n';
    };

    output_ans();
    for (int _ = 0; _ < q; ++_) {
        int x;
        long long v;
        cin >> x >> v;
        a[x] = v;
        if (x % 2 == 0) {
            int id = x / 2;
            diff[id] = a[x] - a[x - 1];
        } else {
            int id = (x + 1) / 2;
            diff[id] = a[x + 1] - a[x];
        }
        output_ans();
    }
    return 0;
}

