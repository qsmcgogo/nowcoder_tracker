#include <bits/stdc++.h>
using namespace std;

int main() {
    int n,m,k,x,i;
    cin>>n>>m>>k;
    priority_queue<int>q;
    for(i=0;i<n;i++){
        cin>>x;
        q.push(x);
        if(q.size()>k)q.pop();
    }
    while(m--){
        int op;
        cin>>op;
        if(op==2){
            if(q.size()==k)cout<<q.top()<<'\n';
            else cout<<-1<<'\n';
        }
        else{
            cin>>x;
            q.push(x);
            if(q.size()>k)q.pop();
        }
    }

}