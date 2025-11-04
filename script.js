// 引入主应用
import { app } from './js/App.js';

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
    app.init();
    // 开发辅助：在控制台触发成就弹窗
    try {
        window.__achv = app.achvNotifier;
        window.__achvTest = (types = [1,2,3,4,6]) => app.achvNotifier.diffAndNotify(types);
        console.log('[Dev] 使用 __achvTest([1,2,3,4,6]) 可手动检查并弹出成就');
    } catch (_) {}
});