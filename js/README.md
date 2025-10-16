# 代码重构说明

## 目录结构

```
js/
├── config.js                  # 应用配置常量
├── services/
│   └── ApiService.js         # API服务层
├── components/
│   └── CardGenerator.js      # 卡片生成组件
└── utils/
    └── helpers.js            # 工具函数集合
```

## 使用示例

### 1. 在 script.js 中引入模块（示例）

```javascript
// 引入配置和服务
import { APP_CONFIG } from './js/config.js';
import { ApiService } from './js/services/ApiService.js';
import { CardGenerator } from './js/components/CardGenerator.js';
import * as helpers from './js/utils/helpers.js';

class NowcoderTracker {
    constructor() {
        // 初始化服务
        this.apiService = new ApiService();
        this.cardGenerator = new CardGenerator(this.channelPut);
        
        // 使用配置
        this.contestsPageSize = APP_CONFIG.CONTESTS_PAGE_SIZE;
        this.practicePageSize = APP_CONFIG.PRACTICE_PAGE_SIZE;
        
        // ... 其他初始化
    }
    
    // 使用工具函数
    buildUrl(url) {
        return helpers.buildUrlWithChannelPut(url, this.channelPut);
    }
    
    // 使用API服务
    async fetchUserData(userId) {
        return await this.apiService.fetchUserData(userId);
    }
    
    // 使用卡片生成器
    async generateCard() {
        if (!this.lastSearchedUserData) return;
        
        const { user1, user2 } = this.lastSearchedUserData;
        
        let cardDataUrl;
        if (user1 && user2) {
            cardDataUrl = await this.cardGenerator.drawComparisonCard(user1, user2);
        } else if (user1) {
            cardDataUrl = await this.cardGenerator.drawSingleCard(user1);
        }
        
        // 显示卡片
        this.elements.cardImage.src = cardDataUrl;
        this.elements.cardModal.classList.add('visible');
    }
}
```

### 2. 在 HTML 中使用模块

需要在 `index.html` 中添加：

```html
<script type="module" src="script.js"></script>
```

注意：使用 ES6 模块需要：
1. 在 script 标签添加 `type="module"`
2. 通过 HTTP 服务器运行（不能直接用 file:// 协议）

## 已重构的功能

### ✅ 配置管理 (config.js)
- API端点配置
- 分页大小配置
- 难度映射和颜色配置
- 奖励配置

### ✅ 工具函数 (utils/helpers.js)
- URL构建
- 日期格式化
- 图片加载
- 难度信息处理
- 提示框工具
- 分页链接创建

### ✅ API服务 (services/ApiService.js)
- 用户数据获取
- 排行榜数据
- 比赛数据
- 题目差异
- 每日一题
- 打卡相关
- 练习题目

### ✅ 卡片生成 (components/CardGenerator.js)
- 单人卡片生成
- 对比卡片生成
- 头像处理
- Canvas绘制

## 迁移步骤

### 方案A：渐进式迁移（推荐）

1. **保留原 script.js**
2. **逐步替换函数调用**
   - 先替换工具函数
   - 再替换API调用
   - 最后替换组件

示例：
```javascript
// 原代码
const url = this.buildUrlWithChannelPut(baseUrl);

// 迁移后
import { buildUrlWithChannelPut } from './js/utils/helpers.js';
const url = buildUrlWithChannelPut(baseUrl, this.channelPut);
```

### 方案B：完全重构

1. **创建新的入口文件** `script-new.js`
2. **使用模块化架构重写**
3. **测试通过后替换**

## 优势

✅ **代码更清晰** - 职责分离，易于理解
✅ **易于维护** - 修改某个功能只需关注对应模块
✅ **便于测试** - 每个模块可独立测试
✅ **减少耦合** - 模块间通过接口通信
✅ **提高复用** - 工具函数和服务可在多处使用

## 注意事项

⚠️ **浏览器兼容性** - ES6 模块需要现代浏览器支持
⚠️ **CORS问题** - 本地开发需要使用 HTTP 服务器
⚠️ **打包优化** - 生产环境建议使用 webpack/vite 等工具打包

## 下一步计划

- [ ] 提取视图层（ContestView, PracticeView等）
- [ ] 添加状态管理服务
- [ ] 提取事件管理
- [ ] 添加单元测试
- [ ] 使用 TypeScript 增强类型安全

