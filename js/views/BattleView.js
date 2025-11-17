/**
 * 对战平台视图模块
 * 处理对战相关的UI和逻辑
 */
import { eventBus, EVENTS } from '../events/EventBus.js';

export class BattleView {
    constructor(elements, state, api) {
        this.elements = elements;
        this.state = state;
        this.api = api;
        this.container = this.elements.battleContainer;
        this.matchingTimer = null;
        this.pollingInterval = null;
        this.matchStartTime = null;
    }

    render() {
        if (!this.container) return;
        
        const isAdmin = this.state.isAdmin === true;
        const adminTestHtml = isAdmin ? `
            <div style="margin-bottom: 20px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
                <div style="font-weight: 600; margin-bottom: 12px; color: #333;">管理员测试</div>
                <button id="battle-test-match-btn" class="admin-btn" style="background: #1890ff; color: #fff; border: 1px solid #1890ff;">
                    测试匹配
                </button>
            </div>
        ` : '';
        
        this.container.innerHTML = `
            <div class="battle-placeholder" style="padding: 40px; text-align: center;">
                <div style="font-size: 24px; color: #666; margin-bottom: 20px;">
                    ⚔️ 对战平台
                </div>
                ${adminTestHtml}
                <div style="font-size: 16px; color: #999;">
                    功能开发中，敬请期待...
                </div>
            </div>
        `;
        
        // 绑定管理员测试匹配按钮
        if (isAdmin) {
            this.bindTestMatchButton();
        }
    }

    /**
     * 获取管理员段位分
     * @returns {number} 段位分
     */
    getAdminRankScore() {
        const userId = this.state.loggedInUserId;
        // 管理员段位分映射
        const adminScores = {
            '919247': 1000,
            '999991351': 1050
        };
        return adminScores[String(userId)] || 1000;
    }

    /**
     * 绑定测试匹配按钮
     */
    bindTestMatchButton() {
        const btn = document.getElementById('battle-test-match-btn');
        if (!btn) return;
        
        btn.addEventListener('click', () => {
            this.startTestMatch();
        });
    }

    /**
     * 开始测试匹配
     */
    async startTestMatch() {
        const btn = document.getElementById('battle-test-match-btn');
        if (!btn) return;
        
        // 禁用按钮
        btn.disabled = true;
        btn.textContent = '匹配中...';
        
        // 显示等待提示框
        this.showMatchingModal();
        
        try {
            const rankScore = this.getAdminRankScore();
            const result = await this.api.battleMatch(rankScore, '1v1');
            
            if (result.matched) {
                // 立即匹配成功
                this.hideMatchingModal();
                this.showMatchResult(result);
                btn.disabled = false;
                btn.textContent = '测试匹配';
            } else {
                // 未匹配成功，开始轮询
                this.startPolling();
            }
        } catch (error) {
            console.error('匹配失败:', error);
            this.hideMatchingModal();
            alert(`匹配失败: ${error.message || '未知错误'}`);
            btn.disabled = false;
            btn.textContent = '测试匹配';
        }
    }

    /**
     * 显示匹配等待提示框
     */
    showMatchingModal() {
        // 移除已存在的模态框
        const existing = document.getElementById('battle-matching-modal');
        if (existing) existing.remove();
        
        this.matchStartTime = Date.now();
        const modal = document.createElement('div');
        modal.id = 'battle-matching-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h3>匹配中...</h3>
                    <button id="battle-matching-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="text-align:center;padding:30px 20px;">
                    <div style="font-size:48px;margin-bottom:16px;">⏳</div>
                    <div style="font-size:16px;color:#666;margin-bottom:8px;">正在寻找对手...</div>
                    <div id="battle-matching-timer" style="font-size:14px;color:#999;">已等待 0 秒</div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;">
                    <button id="battle-matching-cancel" class="admin-btn" style="background:#ff4d4f;color:#fff;border:1px solid #ff4d4f;">取消匹配</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 绑定关闭和取消按钮
        const closeBtn = document.getElementById('battle-matching-close');
        const cancelBtn = document.getElementById('battle-matching-cancel');
        
        const closeModal = () => {
            this.cancelMatch();
            this.hideMatchingModal();
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        
        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // 开始计时
        this.startTimer();
    }

    /**
     * 开始计时
     */
    startTimer() {
        const timerEl = document.getElementById('battle-matching-timer');
        if (!timerEl) return;
        
        this.matchingTimer = setInterval(() => {
            if (!this.matchStartTime) return;
            const elapsed = Math.floor((Date.now() - this.matchStartTime) / 1000);
            timerEl.textContent = `已等待 ${elapsed} 秒`;
        }, 1000);
    }

    /**
     * 停止计时
     */
    stopTimer() {
        if (this.matchingTimer) {
            clearInterval(this.matchingTimer);
            this.matchingTimer = null;
        }
    }

    /**
     * 隐藏匹配等待提示框
     */
    hideMatchingModal() {
        this.stopTimer();
        this.stopPolling();
        const modal = document.getElementById('battle-matching-modal');
        if (modal) modal.remove();
        this.matchStartTime = null;
    }

    /**
     * 开始轮询匹配结果
     */
    startPolling() {
        // 清除之前的轮询
        this.stopPolling();
        
        // 每2秒轮询一次
        this.pollingInterval = setInterval(async () => {
            try {
                const result = await this.api.battlePoll();
                if (result.matched && result.roomId) {
                    // 匹配成功
                    this.hideMatchingModal();
                    this.showMatchResult(result);
                    
                    // 恢复按钮
                    const btn = document.getElementById('battle-test-match-btn');
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = '测试匹配';
                    }
                }
            } catch (error) {
                console.error('轮询失败:', error);
                // 轮询失败不中断，继续尝试
            }
        }, 2000);
    }

    /**
     * 停止轮询
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * 取消匹配
     */
    async cancelMatch() {
        try {
            await this.api.battleCancel('1v1');
        } catch (error) {
            console.error('取消匹配失败:', error);
        }
        
        // 恢复按钮
        const btn = document.getElementById('battle-test-match-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '测试匹配';
        }
    }

    /**
     * 显示匹配结果
     */
    showMatchResult(result) {
        // 移除已存在的结果模态框
        const existing = document.getElementById('battle-match-result-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'battle-match-result-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h3>匹配成功！</h3>
                    <button id="battle-result-close" class="modal-close" aria-label="关闭">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
                        <div style="font-size:18px;font-weight:600;color:#333;margin-bottom:8px;">匹配成功</div>
                    </div>
                    <div style="background:#f5f5f5;padding:12px;border-radius:6px;margin-bottom:12px;">
                        <div style="margin-bottom:8px;"><strong>房间ID:</strong> <code style="background:#fff;padding:2px 6px;border-radius:3px;">${result.roomId || '-'}</code></div>
                        ${result.opponentId ? `<div><strong>对手ID:</strong> ${result.opponentId}</div>` : ''}
                    </div>
                </div>
                <div class="modal-actions" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:center;">
                    <button id="battle-result-ok" class="admin-btn" style="background:#52c41a;color:#fff;border:1px solid #52c41a;">我知道了</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 绑定关闭按钮
        const closeBtn = document.getElementById('battle-result-close');
        const okBtn = document.getElementById('battle-result-ok');
        
        const closeResult = () => {
            modal.remove();
        };
        
        if (closeBtn) closeBtn.addEventListener('click', closeResult);
        if (okBtn) okBtn.addEventListener('click', closeResult);
        
        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeResult();
            }
        });
    }

    hide() {
        const section = document.getElementById('battle');
        if (section) section.classList.remove('active');
        
        // 清理定时器和轮询
        this.stopTimer();
        this.stopPolling();
    }
}

