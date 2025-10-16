#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    int n, m;
    cin >> n >> m;
    
    vector<int> a(n);
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }
    
    // 优化思路：分阶段计算
    // 将整个过程分为若干阶段，每个阶段内伤害值固定
    vector<pair<int, int>> phases; // (damage, duration)
    
    int currentDamage = 2;
    int remainingDamage = m;
    vector<int> remaining = a;
    
    while (remainingDamage > 0) {
        // 计算当前伤害值能持续多久（直到有随从死亡）
        int minTurns = remainingDamage;
        
        for (int i = 0; i < n; i++) {
            if (remaining[i] > 0) {
                // 计算这个随从还需要几次攻击才能死亡
                int turnsToDeath = (remaining[i] + currentDamage - 1) / currentDamage;
                minTurns = min(minTurns, turnsToDeath);
            }
        }
        
        // 当前阶段持续minTurns轮
        phases.push_back({currentDamage, minTurns});
        remainingDamage -= minTurns;
        
        // 更新剩余血量
        for (int i = 0; i < n; i++) {
            if (remaining[i] > 0) {
                remaining[i] -= currentDamage * minTurns;
                if (remaining[i] <= 0) {
                    currentDamage++; // 恰好击杀
                }
            }
        }
    }
    
    // 计算总伤害
    long long totalDamage = 0;
    for (auto& phase : phases) {
        int damage = phase.first;
        int duration = phase.second;
        totalDamage += (long long)damage * duration;
    }
    
    cout << totalDamage << endl;
    return 0;
}