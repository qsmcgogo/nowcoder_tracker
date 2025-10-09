#include<bits/stdc++.h>
using namespace std;
int a[101010];
map<int,int>vis;
map<int,int>mp,mp2;
int main(){
    int n,i,k;
    cin>>n>>k;
    for(i=0;i<n;i++)cin>>a[i],mp[a[i]]=i;
    sort(a,a+n);
    for(i=0;i<n;i++)mp2[a[i]]=i;
    
    int l=0,j;
    for(i=0;i<n;i++){
        if(!vis[a[i]]){
            map<int,int>s;
            for(int p=a[i];mp.count(p);p+=k){
                s[mp[p]%k]++;
                vis[p]=1;
            }
            for(int p=a[i];mp.count(p);p+=k){
                s[mp2[p]%k]--;
                if(s[mp2[p]%k]<0)return cout<<"No",0;
            }
        }
    }
    cout<<"Yes";
}