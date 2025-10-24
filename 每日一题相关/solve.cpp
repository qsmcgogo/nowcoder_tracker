#include <iostream>
using namespace std;
int a[202020];
int main() {
    int n,i;
    cin>>n;
    int res=0;
    for(i=1;i<=n;i++)cin>>a[i];
    for(i=1;i<=n;i++){
        int x,y;
        cin>>x>>y;
        res+=min(a[i],a[x]+a[y]);
    }
    cout<<res;
}