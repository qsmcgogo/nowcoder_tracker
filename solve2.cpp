#include <iostream>
using namespace std;

int main() {
    int _;
    cin>>_;
    while(_--){
        int x,y,i;
        cin>>x>>y;
        cout<<((x^y)&(-(x^y)))<<'\n';
    }
}