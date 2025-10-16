#include<bits/stdc++.h>
using namespace std;
string check[8]={"500","000","750","250","125","375","625","875"};      //注意这里的顺序，无0的放后面可以规避前导零特判。
int tong[101010];
int main(){
    string s;
    cin>>s;
    int sum=0,i,j;
    for(i=0;i<s.length();i++){
        tong[s[i]-'0']++;
        sum+=s[i]-'0';
    }
    if(sum%3!=0){cout<<-1;return 0;}
    for(i=0;i<8;i++){
        int sum=0;
        for(j=0;j<3;j++){
            tong[check[i][j]-'0']--;        //这里的处理技巧：先减掉，然后判断。如果不合法再加回来。
        }
        for(j=0;j<=9;j++){
            if(tong[j]<0)break;
        }
        if(j==10){
            for(j=9;j>=0;j--)while(tong[j])cout<<j,tong[j]--;
            cout<<check[i];
            return 0;
        }
        for(j=0;j<3;j++){
            tong[check[i][j]-'0']++;
        }
    }
    cout<<-1;
}