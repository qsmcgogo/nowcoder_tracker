#include <iostream>
using namespace std;

int main() {
    int _;
    cin>>_;
    while(_--){
        int x,y,i;
        cin>>x>>y;
        if(!min(x,y)){cout<<1<<'\n';continue;}
        for(i=0;1;i++){
            if((x>>i&1)^(y>>i&1))break;
        }
        cout<<(1<<i)<<'\n';
    }
}