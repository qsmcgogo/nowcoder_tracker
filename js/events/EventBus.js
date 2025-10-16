/**
 * 事件总线模块
 * 用于模块间的解耦通信
 */

export class EventBus {
    constructor() {
        this.events = new Map();
    }
    
    /**
     * 订阅事件
     * @param {string} event 事件名称
     * @param {Function} callback 回调函数
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
    }
    
    /**
     * 取消订阅事件
     * @param {string} event 事件名称
     * @param {Function} callback 回调函数
     */
    off(event, callback) {
        if (!this.events.has(event)) return;
        
        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
        
        if (callbacks.length === 0) {
            this.events.delete(event);
        }
    }
    
    /**
     * 发布事件
     * @param {string} event 事件名称
     * @param {*} data 事件数据
     */
    emit(event, data = null) {
        if (!this.events.has(event)) return;
        
        const callbacks = this.events.get(event);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event callback for ${event}:`, error);
            }
        });
    }
    
    /**
     * 只订阅一次事件
     * @param {string} event 事件名称
     * @param {Function} callback 回调函数
     */
    once(event, callback) {
        const onceCallback = (data) => {
            callback(data);
            this.off(event, onceCallback);
        };
        this.on(event, onceCallback);
    }
    
    /**
     * 清除所有事件监听器
     */
    clear() {
        this.events.clear();
    }
}

// 创建全局事件总线实例
export const eventBus = new EventBus();

// 定义常用事件常量
export const EVENTS = {
    // 视图切换事件
    MAIN_TAB_CHANGED: 'mainTabChanged',
    VIEW_CHANGED: 'viewChanged',
    CONTEST_TAB_CHANGED: 'contestTabChanged',
    PRACTICE_TAB_CHANGED: 'practiceTabChanged',
    INTERVIEW_TAB_CHANGED: 'interviewTabChanged',
    
    // 数据加载事件
    DATA_LOADING: 'dataLoading',
    DATA_LOADED: 'dataLoaded',
    DATA_ERROR: 'dataError',
    
    // 用户相关事件
    USER_LOGIN: 'userLogin',
    USER_LOGOUT: 'userLogout',
    USER_SEARCH: 'userSearch',
    
    // 每日一题事件
    DAILY_PROBLEM_LOADED: 'dailyProblemLoaded',
    CHECK_IN_SUCCESS: 'checkInSuccess',
    
    // 卡片生成事件
    CARD_GENERATED: 'cardGenerated',
    
    // 页面状态事件
    PAGE_LOADED: 'pageLoaded',
    PAGE_ERROR: 'pageError'
};
