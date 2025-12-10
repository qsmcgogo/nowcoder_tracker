#include<bits/stdc++.h>
using namespace std;
#define int long long

int n,q,a[505050];
struct node{
    int l,r;
    int mn,mx,lv,rv,ok;
};
node t[1010100];
void pushup(int p){
    t[p].mn=min(t[p*2].mn,t[p*2+1].mn);
    t[p].mx=max(t[p*2].mx,t[p*2+1].mx);
    t[p].lv=t[p*2].lv;
    t[p].rv=t[p*2+1].rv;
    t[p].ok=t[p*2].ok&&t[p*2+1].ok&&(t[p*2].rv<=t[p*2+1].lv);
}
void build(int p,int l,int r){
    t[p].l=l;
    t[p].r=r;
    if(l==r){
        t[p].mn=t[p].mx=a[l];
        t[p].lv=t[p].rv=a[l];
        t[p].ok=1;
        return;
    }
    int mid=(l+r)>>1;
    build(p*2,l,mid);build(p*2+1,mid+1,r);
    pushup(p);
}
void update(int p,int i,int v){
    // cout<<p<<" "<<t[p].l<<" "<<t[p].r<<"\n";
    if(t[p].l==t[p].r){t[p].mn=t[p].mx=v;t[p].lv=t[p].rv=v;t[p].ok=1;return;}
    int mid=(t[p].l+t[p].r)>>1;
    if(i<=mid)update(p*2,i,v);
    else update(p*2+1,i,v);
    pushup(p);
}
int askmin(int p,int L,int R){
    if(L<=t[p].l&&t[p].r<=R)return t[p].mn;
    int mid=(t[p].l+t[p].r)>>1,res=LLONG_MAX;
    if(L<=mid)res=min(res,askmin(p*2,L,R));
    if(R>mid)res=min(res,askmin(p*2+1,L,R));
    return res;
}
int askmax(int p,int L,int R){
    if(L<=t[p].l&&t[p].r<=R)return t[p].mx;
    int mid=(t[p].l+t[p].r)>>1,res=LLONG_MIN;
    if(L<=mid)res=max(res,askmax(p*2,L,R));
    if(R>mid)res=max(res,askmax(p*2+1,L,R));
    return res;
}
int prhuai(int p){
    if(t[p].ok)return -1;
    if(t[p].l==t[p].r)return t[p].l;
    int mid=(t[p].l+t[p].r)>>1;
    if(!t[p*2].ok)return prhuai(p*2);
    if(t[p*2].rv>t[p*2+1].lv)return mid;
    return prhuai(p*2+1);
}
int edhuai(int p){
    if(t[p].ok)return -1;
    if(t[p].l==t[p].r)return t[p].l;
    int mid=(t[p].l+t[p].r)>>1;
    if(!t[p*2+1].ok)return edhuai(p*2+1);
    if(t[p*2].rv>t[p*2+1].lv)return mid+1;
    return edhuai(p*2);
}
int gaopr(int p,int L,int R,int x){
    if(L>R)return -1;
    if(R<t[p].l||t[p].r<L||t[p].mx<=x)return -1;
    if(t[p].l==t[p].r)return t[p].l;
    int mid=(t[p].l+t[p].r)>>1,res=gaopr(p*2,L,R,x);
    if(res!=-1)return res;
    return gaopr(p*2+1,L,R,x);
}
int gaoed(int p,int L,int R,int x){
    if(L>R)return -1;
    if(R<t[p].l||t[p].r<L||t[p].mn>=x)return -1;
    if(t[p].l==t[p].r)return t[p].l;
    int mid=(t[p].l+t[p].r)>>1,res=gaoed(p*2+1,L,R,x);
    if(res!=-1)return res;
    return gaoed(p*2,L,R,x);
}
pair<int,int> solve(){
    if(t[1].ok)return {-1,-1};
    int l=prhuai(1);
    int r=edhuai(1);
    while(1){
        // cout<<"d"<<'\n';
        int mn=askmin(1,l,r);
        int mx=askmax(1,l,r);
        int nl=gaopr(1,1,l,mn); 
        if(nl==-1)nl=l; 
        else nl=min(nl,l);
        int nr=gaoed(1,r,n,mx); 
        if(nr==-1)nr=r; 
        else nr=max(nr,r);
        if(nl==l&&nr==r)break;
        l=nl;r=nr;
        //cout<<'?'<<l<<" "<<r<<"\n";
    }
    return {l,r};
}
signed main(){
    ios::sync_with_stdio(false);
    cin.tie(0);
    int T;cin>>T;
    while(T--){
        cin>>n;
        for(int i=1;i<=n;i++)cin>>a[i];
        build(1,1,n);
        cin>>q;
        auto ans=solve();
        cout<<ans.first<<" "<<ans.second<<"\n";
        while(q--){
            int p,x;cin>>p>>x;
            update(1,p,x);
            ans=solve();
            cout<<ans.first<<" "<<ans.second<<"\n";
        }
    }
}