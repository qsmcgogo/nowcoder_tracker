# 牛客周赛爬虫使用说明

## 功能说明

这个爬虫脚本可以自动获取牛客网的周赛比赛信息，包括：
- 比赛列表（牛客周赛 Round 105, 104, 103等）
- 每场比赛的题目信息
- 题目难度估算

## 安装依赖

```bash
npm install
```

## 使用方法

### 1. 运行爬虫

```bash
npm run crawl
```

或者直接运行：

```bash
node crawler.js
```

### 2. 自定义爬取数量

修改 `crawler.js` 中的 `main()` 函数：

```javascript
// 获取最近10场比赛的数据
const data = await crawler.getAllContestData(10);
```

### 3. 输出文件

爬取完成后，数据会保存到 `nowcoder_weekly_contests.json` 文件中。

## 数据格式

输出的JSON文件格式如下：

```json
{
  "contests": [
    {
      "name": "牛客周赛 Round 105",
      "round": 105,
      "problems": [
        {
          "letter": "A",
          "title": "题目名称",
          "difficulty": 1200
        }
      ]
    }
  ]
}
```

## 注意事项

1. **请求频率**：脚本会在每次请求之间添加1秒延迟，避免对服务器造成压力
2. **错误处理**：如果某个比赛获取失败，会跳过并继续下一个
3. **难度估算**：题目难度是基于关键词估算的，可能与实际难度有差异
4. **网络问题**：确保网络连接正常，可能需要代理访问

## 集成到网页

获取到数据后，可以将数据集成到网页中：

1. 将 `nowcoder_weekly_contests.json` 文件放在网页目录下
2. 修改 `script.js` 中的 `contestData` 对象，使用真实数据替换模拟数据
3. 或者创建一个API接口来动态加载数据

## 法律声明

请遵守牛客网的使用条款和robots.txt规则，合理使用爬虫功能，不要对服务器造成过大压力。


