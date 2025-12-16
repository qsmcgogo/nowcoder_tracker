/**
 * 管理员视图
 * 只有管理员用户才能看到和访问此视图
 */

export class AdminView {
    constructor(elements, state, apiService) {
        this.container = elements.adminContainer;
        this.apiService = apiService;
        this.state = state;
        this.currentTab = 'clock'; // 'clock' 或 'battle'
        this.clockPage = 1;
        this.battlePage = 1;
        // 每日一题搜索条件
        this.clockSearchStartDate = null;
        this.clockSearchEndDate = null;
    }

    /**
     * 渲染管理员页面
     */
    render() {
        if (!this.container) {
            console.warn('[AdminView] admin-container not found');
            return;
        }

        // 检查管理员权限
        if (!this.state.isAdmin) {
            this.container.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <div style="font-size: 18px; color: #999; margin-bottom: 12px;">无权限访问</div>
                    <div style="font-size: 14px; color: #ccc;">此页面仅限管理员访问</div>
                </div>
            `;
            return;
        }

        // 渲染管理员页面内容
        this.container.innerHTML = `
            <div style="padding: 20px;">
                <h2 style="font-size: 24px; font-weight: 600; color: #333; margin-bottom: 24px;">
                    ⚙️ 管理员面板
                </h2>
                
                <!-- 标签页切换 -->
                <div style="display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 2px solid #f0f0f0;">
                    <button id="admin-tab-clock" class="admin-tab-btn" style="padding: 12px 24px; border: none; background: transparent; font-size: 16px; font-weight: 600; color: #666; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px;">
                        每日一题管理
                    </button>
                    <button id="admin-tab-battle" class="admin-tab-btn" style="padding: 12px 24px; border: none; background: transparent; font-size: 16px; font-weight: 600; color: #666; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px;">
                        对战题目管理
                    </button>
                </div>

                <!-- 每日一题管理 -->
                <div id="admin-clock-panel" class="admin-panel" style="display: block;">
                    ${this.renderClockPanel()}
                </div>

                <!-- 对战题目管理 -->
                <div id="admin-battle-panel" class="admin-panel" style="display: none;">
                    ${this.renderBattlePanel()}
                </div>
            </div>
        `;

        // 绑定事件
        this.bindEvents();
        
        // 加载初始数据
        this.loadClockList();
        this.loadBattleList();
    }

    /**
     * 渲染每日一题管理面板
     */
    renderClockPanel() {
        return `
            <div>
                <!-- 操作栏 -->
                <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button id="admin-clock-add-btn" style="background: #52c41a; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        ➕ 新增
                    </button>
                    <div style="flex: 1;"></div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 14px; color: #666;">开始日期:</label>
                        <input type="date" id="admin-clock-start-date" 
                               style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <label style="font-size: 14px; color: #666;">结束日期:</label>
                        <input type="date" id="admin-clock-end-date" 
                               style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <button id="admin-clock-search-btn" style="background: #1890ff; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            搜索
                        </button>
                        <button id="admin-clock-reset-btn" style="background: #999; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            重置
                        </button>
                    </div>
                </div>

                <!-- 列表 -->
                <div id="admin-clock-list" style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; overflow: hidden;">
                    <div style="padding: 20px; text-align: center; color: #999;">加载中...</div>
                </div>

                <!-- 分页 -->
                <div id="admin-clock-pagination" style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 20px;">
                </div>
            </div>
        `;
    }

    /**
     * 渲染对战题目管理面板
     */
    renderBattlePanel() {
        return `
            <div>
                <!-- 操作栏 -->
                <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button id="admin-battle-add-btn" style="background: #52c41a; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        ➕ 新增
                    </button>
                    <button id="admin-battle-batch-add-btn" style="background: #1890ff; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        📦 批量添加
                    </button>
                    <button id="admin-battle-batch-delete-btn" style="background: #ff4d4f; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        🗑️ 批量删除
                    </button>
                    <div style="flex: 1;"></div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-right: 12px;">
                        <label style="font-size: 14px; color: #666;">题目ID:</label>
                        <input type="number" id="admin-battle-problem-id-search" placeholder="输入题目ID查询" 
                               style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 150px;">
                        <button id="admin-battle-search-by-id-btn" style="background: #722ed1; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            查询
                        </button>
                    </div>
                    <input type="number" id="admin-battle-level-min" placeholder="最小难度" 
                           style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 100px;">
                    <span style="color: #666;">-</span>
                    <input type="number" id="admin-battle-level-max" placeholder="最大难度" 
                           style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; width: 100px;">
                    <select id="admin-battle-order-by" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="id">ID</option>
                        <option value="levelScore">难度</option>
                        <option value="matchCount">匹配次数</option>
                        <option value="acCount">AC次数</option>
                        <option value="avgSeconds">平均用时</option>
                    </select>
                    <select id="admin-battle-order" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <option value="DESC">降序</option>
                        <option value="ASC">升序</option>
                    </select>
                    <button id="admin-battle-search-btn" style="background: #1890ff; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        搜索
                    </button>
                </div>

                <!-- 列表 -->
                <div id="admin-battle-list" style="background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; overflow: hidden;">
                    <div style="padding: 20px; text-align: center; color: #999;">加载中...</div>
                </div>

                <!-- 分页 -->
                <div id="admin-battle-pagination" style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 20px;">
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 标签页切换
        document.getElementById('admin-tab-clock').addEventListener('click', () => {
            this.switchTab('clock');
        });
        document.getElementById('admin-tab-battle').addEventListener('click', () => {
            this.switchTab('battle');
        });

        // 每日一题操作
        document.getElementById('admin-clock-add-btn').addEventListener('click', () => {
            this.showClockModal();
        });
        document.getElementById('admin-clock-search-btn').addEventListener('click', () => {
            this.handleClockSearch();
        });
        document.getElementById('admin-clock-reset-btn').addEventListener('click', () => {
            this.resetClockSearch();
        });

        // 对战题目操作
        document.getElementById('admin-battle-add-btn').addEventListener('click', () => {
            this.showBattleModal();
        });
        document.getElementById('admin-battle-batch-add-btn').addEventListener('click', () => {
            this.showBattleBatchAddModal();
        });
        document.getElementById('admin-battle-batch-delete-btn').addEventListener('click', () => {
            this.handleBatchDelete();
        });
        document.getElementById('admin-battle-search-btn').addEventListener('click', () => {
            this.loadBattleList();
        });
        document.getElementById('admin-battle-search-by-id-btn').addEventListener('click', () => {
            this.searchBattleByProblemId();
        });
    }

    /**
     * 切换标签页
     */
    switchTab(tab) {
        this.currentTab = tab;
        const clockPanel = document.getElementById('admin-clock-panel');
        const battlePanel = document.getElementById('admin-battle-panel');
        const clockBtn = document.getElementById('admin-tab-clock');
        const battleBtn = document.getElementById('admin-tab-battle');

        if (tab === 'clock') {
            clockPanel.style.display = 'block';
            battlePanel.style.display = 'none';
            clockBtn.style.color = '#1890ff';
            clockBtn.style.borderBottomColor = '#1890ff';
            battleBtn.style.color = '#666';
            battleBtn.style.borderBottomColor = 'transparent';
        } else {
            clockPanel.style.display = 'none';
            battlePanel.style.display = 'block';
            battleBtn.style.color = '#1890ff';
            battleBtn.style.borderBottomColor = '#1890ff';
            clockBtn.style.color = '#666';
            clockBtn.style.borderBottomColor = 'transparent';
        }
    }

    /**
     * 处理每日一题搜索
     */
    handleClockSearch() {
        const startDate = document.getElementById('admin-clock-start-date').value;
        const endDate = document.getElementById('admin-clock-end-date').value;
        
        if (!startDate || !endDate) {
            alert('请选择开始日期和结束日期');
            return;
        }
        
        if (startDate > endDate) {
            alert('开始日期不能晚于结束日期');
            return;
        }
        
        this.clockSearchStartDate = startDate;
        this.clockSearchEndDate = endDate;
        this.clockPage = 1;
        this.loadClockList(1);
    }

    /**
     * 重置每日一题搜索
     */
    resetClockSearch() {
        document.getElementById('admin-clock-start-date').value = '';
        document.getElementById('admin-clock-end-date').value = '';
        this.clockSearchStartDate = null;
        this.clockSearchEndDate = null;
        this.clockPage = 1;
        this.loadClockList(1);
    }

    /**
     * 加载每日一题列表
     */
    async loadClockList(page = 1) {
        this.clockPage = page;
        const listEl = document.getElementById('admin-clock-list');
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">加载中...</div>';

        try {
            let data;
            // 如果有搜索条件，使用时间段查询接口
            if (this.clockSearchStartDate && this.clockSearchEndDate) {
                data = await this.apiService.adminClockQuestionListByDateRange(
                    this.clockSearchStartDate, 
                    this.clockSearchEndDate, 
                    page, 
                    20
                );
            } else {
                // 否则使用普通列表接口
                data = await this.apiService.adminClockQuestionList(page, 20);
            }
            this.renderClockList(data);
            this.renderClockPagination(data.total, data.page, data.limit);
        } catch (error) {
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">加载失败: ${error.message}</div>`;
        }
    }

    /**
     * 渲染每日一题列表
     */
    renderClockList(data) {
        const listEl = document.getElementById('admin-clock-list');
        if (!data.list || data.list.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无数据</div>';
            return;
        }

        const rows = data.list.map(item => {
            // 处理日期：可能是字符串 "2025-01-15 10:00:00" 或时间戳
            let date = '-';
            if (item.createTime) {
                if (typeof item.createTime === 'string') {
                    // 字符串格式直接提取日期部分，避免时区问题
                    date = item.createTime.split(' ')[0];
                } else if (typeof item.createTime === 'number') {
                    // 时间戳转日期字符串，使用本地时区
                    const d = new Date(item.createTime);
                    // 使用本地时区的年月日，避免时区转换问题
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    date = `${year}-${month}-${day}`;
                }
            }
            return `
                <div style="display: flex; align-items: center; padding: 16px; border-bottom: 1px solid #f0f0f0; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">日期: ${date}</div>
                        <div style="font-size: 13px; color: #666;">
                            题目ID: ${item.questionId || '-'} | 
                            问题ID: ${item.problemId || '-'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="admin-clock-edit-btn" data-id="${item.id}" style="background: #1890ff; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            编辑
                        </button>
                        <button class="admin-clock-delete-btn" data-id="${item.id}" data-date="${date}" style="background: #ff4d4f; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = rows;
        
        // 绑定编辑和删除按钮事件
        listEl.querySelectorAll('.admin-clock-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.editClock(id);
            });
        });
        
        listEl.querySelectorAll('.admin-clock-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const date = btn.dataset.date;
                this.deleteClock(id, date);
            });
        });
    }

    /**
     * 渲染每日一题分页
     */
    renderClockPagination(total, page, limit) {
        const paginationEl = document.getElementById('admin-clock-pagination');
        const totalPages = Math.ceil(total / limit);
        
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = '';
        if (page > 1) {
            html += `<button class="admin-clock-prev-btn" data-page="${page - 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">上一页</button>`;
        }
        html += `<span style="color: #666; margin: 0 12px;">第 ${page} / ${totalPages} 页 (共 ${total} 条)</span>`;
        if (page < totalPages) {
            html += `<button class="admin-clock-next-btn" data-page="${page + 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">下一页</button>`;
        }
        
        // 添加跳转输入框
        html += `<span style="margin-left: 16px; color: #666;">跳转到:</span>`;
        html += `<input type="number" id="admin-clock-goto-page" min="1" max="${totalPages}" value="${page}" 
                        style="width: 60px; padding: 4px 8px; margin: 0 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center;">`;
        html += `<button class="admin-clock-goto-btn" style="padding: 6px 12px; border: 1px solid #1890ff; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">跳转</button>`;

        paginationEl.innerHTML = html;
        
        // 绑定分页按钮事件
        paginationEl.querySelectorAll('.admin-clock-prev-btn, .admin-clock-next-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPage = parseInt(btn.dataset.page);
                this.loadClockList(targetPage);
            });
        });
        
        // 绑定跳转按钮事件
        const gotoBtn = paginationEl.querySelector('.admin-clock-goto-btn');
        const gotoInput = paginationEl.querySelector('#admin-clock-goto-page');
        if (gotoBtn && gotoInput) {
            gotoBtn.addEventListener('click', () => {
                const targetPage = parseInt(gotoInput.value);
                if (targetPage >= 1 && targetPage <= totalPages) {
                    this.loadClockList(targetPage);
                } else {
                    alert(`请输入 1-${totalPages} 之间的页码`);
                }
            });
            
            // 支持回车键跳转
            gotoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    gotoBtn.click();
                }
            });
        }
    }

    /**
     * 根据problemId查询对战题目
     */
    async searchBattleByProblemId() {
        const problemIdInput = document.getElementById('admin-battle-problem-id-search');
        const problemId = problemIdInput.value.trim();
        
        // 如果查询框为空，显示全部题目
        if (!problemId) {
            this.battlePage = 1;
            this.loadBattleList(1);
            return;
        }
        
        const problemIdNum = parseInt(problemId);
        if (isNaN(problemIdNum) || problemIdNum <= 0) {
            alert('请输入有效的题目ID');
            return;
        }
        
        const listEl = document.getElementById('admin-battle-list');
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">查询中...</div>';

        try {
            const item = await this.apiService.adminBattleProblemGetByProblemId(problemIdNum);
            
            if (item) {
                // 如果查询到结果，显示在列表中
                const data = {
                    total: 1,
                    page: 1,
                    limit: 20,
                    list: [item]
                };
                this.renderBattleList(data);
                // 隐藏分页，因为只有一条结果
                const paginationEl = document.getElementById('admin-battle-pagination');
                if (paginationEl) {
                    paginationEl.innerHTML = '<div style="padding: 12px; text-align: center; color: #666;">查询到1条结果</div>';
                }
            } else {
                listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">未找到题目ID为 ${problemId} 的对战题目</div>`;
                const paginationEl = document.getElementById('admin-battle-pagination');
                if (paginationEl) {
                    paginationEl.innerHTML = '';
                }
            }
        } catch (error) {
            // 如果接口返回404或查询失败，显示未找到
            if (error.message.includes('404') || error.message.includes('查询失败')) {
                listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">未找到题目ID为 ${problemId} 的对战题目</div>`;
            } else {
                listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">查询失败: ${error.message}</div>`;
            }
            const paginationEl = document.getElementById('admin-battle-pagination');
            if (paginationEl) {
                paginationEl.innerHTML = '';
            }
        }
    }

    /**
     * 加载对战题目列表
     */
    async loadBattleList(page = 1) {
        this.battlePage = page;
        const listEl = document.getElementById('admin-battle-list');
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">加载中...</div>';

        try {
            const levelMin = parseInt(document.getElementById('admin-battle-level-min').value) || 0;
            const levelMax = parseInt(document.getElementById('admin-battle-level-max').value) || 0;
            const orderBy = document.getElementById('admin-battle-order-by').value;
            const order = document.getElementById('admin-battle-order').value;

            const data = await this.apiService.adminBattleProblemList(page, 20, levelMin, levelMax, orderBy, order);
            this.renderBattleList(data);
            this.renderBattlePagination(data.total, data.page, data.limit);
        } catch (error) {
            listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4d4f;">加载失败: ${error.message}</div>`;
        }
    }

    /**
     * 渲染对战题目列表
     */
    renderBattleList(data) {
        const listEl = document.getElementById('admin-battle-list');
        if (!data.list || data.list.length === 0) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无数据</div>';
            return;
        }

        const rows = data.list.map(item => {
            return `
                <div style="display: flex; align-items: center; padding: 16px; border-bottom: 1px solid #f0f0f0; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; margin-bottom: 4px;">题目ID: ${item.problemId}</div>
                        <div style="font-size: 13px; color: #666;">
                            难度: ${item.levelScore} | 
                            匹配: ${item.matchCount} | 
                            AC: ${item.acCount} | 
                            平均用时: ${item.avgSeconds}s
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="admin-battle-edit-btn" data-id="${item.id}" style="background: #1890ff; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            编辑
                        </button>
                        <button class="admin-battle-check-delete-btn" data-id="${item.id}" style="background: #faad14; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            检查删除
                        </button>
                        <button class="admin-battle-delete-btn" data-id="${item.id}" style="background: #ff4d4f; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = rows;
        
        // 绑定编辑和删除按钮事件
        listEl.querySelectorAll('.admin-battle-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.editBattle(id);
            });
        });
        
        listEl.querySelectorAll('.admin-battle-check-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.checkDeleteBattle(id);
            });
        });
        
        listEl.querySelectorAll('.admin-battle-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.deleteBattle(id);
            });
        });
    }

    /**
     * 渲染对战题目分页
     */
    renderBattlePagination(total, page, limit) {
        const paginationEl = document.getElementById('admin-battle-pagination');
        const totalPages = Math.ceil(total / limit);
        
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = '';
        if (page > 1) {
            html += `<button class="admin-battle-prev-btn" data-page="${page - 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">上一页</button>`;
        }
        html += `<span style="color: #666; margin: 0 12px;">第 ${page} / ${totalPages} 页 (共 ${total} 条)</span>`;
        if (page < totalPages) {
            html += `<button class="admin-battle-next-btn" data-page="${page + 1}" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">下一页</button>`;
        }
        
        // 添加跳转输入框
        html += `<span style="margin-left: 16px; color: #666;">跳转到:</span>`;
        html += `<input type="number" id="admin-battle-goto-page" min="1" max="${totalPages}" value="${page}" 
                        style="width: 60px; padding: 4px 8px; margin: 0 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center;">`;
        html += `<button class="admin-battle-goto-btn" style="padding: 6px 12px; border: 1px solid #1890ff; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">跳转</button>`;

        paginationEl.innerHTML = html;
        
        // 绑定分页按钮事件
        paginationEl.querySelectorAll('.admin-battle-prev-btn, .admin-battle-next-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPage = parseInt(btn.dataset.page);
                this.loadBattleList(targetPage);
            });
        });
        
        // 绑定跳转按钮事件
        const gotoBtn = paginationEl.querySelector('.admin-battle-goto-btn');
        const gotoInput = paginationEl.querySelector('#admin-battle-goto-page');
        if (gotoBtn && gotoInput) {
            gotoBtn.addEventListener('click', () => {
                const targetPage = parseInt(gotoInput.value);
                if (targetPage >= 1 && targetPage <= totalPages) {
                    this.loadBattleList(targetPage);
                } else {
                    alert(`请输入 1-${totalPages} 之间的页码`);
                }
            });
            
            // 支持回车键跳转
            gotoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    gotoBtn.click();
                }
            });
        }
    }

    /**
     * 格式化日期为 YYYY-MM-DD
     */
    formatDate(dateValue) {
        if (!dateValue) return '';
        if (typeof dateValue === 'string') {
            // 字符串格式直接提取日期部分，避免时区问题
            return dateValue.split(' ')[0];
        }
        if (typeof dateValue === 'number') {
            // 时间戳转日期字符串，使用本地时区
            const d = new Date(dateValue);
            // 使用本地时区的年月日，避免时区转换问题
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return '';
    }

    /**
     * 显示每日一题新增/编辑模态框
     */
    showClockModal(item = null) {
        const isEdit = !!item;
        const dateValue = item ? this.formatDate(item.createTime) : '';
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑' : '新增'}每日一题</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">日期 (YYYY-MM-DD) *</label>
                        <input type="date" id="clock-modal-date" value="${dateValue}" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">题目ID (questionId)</label>
                        <input type="number" id="clock-modal-question-id" value="${item?.questionId || ''}" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">问题ID (problemId)</label>
                        <input type="number" id="clock-modal-problem-id" value="${item?.problemId || ''}" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div id="clock-modal-error" style="color: #ff4d4f; margin-top: 12px; display: none;"></div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="clock-modal-submit" style="padding: 8px 16px; border: none; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">
                        ${isEdit ? '更新' : '添加'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('clock-modal-submit').addEventListener('click', async () => {
            const errorEl = document.getElementById('clock-modal-error');
            errorEl.style.display = 'none';

            const date = document.getElementById('clock-modal-date').value;
            const questionId = document.getElementById('clock-modal-question-id').value;
            const problemId = document.getElementById('clock-modal-problem-id').value;

            if (!date) {
                errorEl.textContent = '请填写日期';
                errorEl.style.display = 'block';
                return;
            }

            if (!questionId && !problemId) {
                errorEl.textContent = '题目ID和问题ID至少填写一个';
                errorEl.style.display = 'block';
                return;
            }

            try {
                if (isEdit) {
                    // 编辑时使用按日期更新的接口，支持修改日期
                    await this.apiService.adminClockQuestionUpdate(date, questionId || null, problemId || null, '');
                } else {
                    await this.apiService.adminClockQuestionAdd(date, questionId || null, problemId || null, '');
                }
                modal.remove();
                this.loadClockList(this.clockPage);
                alert(isEdit ? '更新成功' : '添加成功');
            } catch (error) {
                errorEl.textContent = error.message || '操作失败';
                errorEl.style.display = 'block';
            }
        });

        // 移除点击外部关闭的功能，只能通过取消按钮关闭
    }

    /**
     * 编辑每日一题
     */
    async editClock(id) {
        try {
            const item = await this.apiService.adminClockQuestionGet(id);
            this.showClockModal(item);
        } catch (error) {
            alert('加载失败: ' + error.message);
        }
    }

    /**
     * 删除每日一题
     */
    async deleteClock(id, date) {
        if (!confirm(`确定要删除 ${date} 的每日一题吗？`)) return;

        try {
            await this.apiService.adminClockQuestionDeleteById(id);
            this.loadClockList(this.clockPage);
            alert('删除成功');
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    }

    /**
     * 显示对战题目新增/编辑模态框
     */
    showBattleModal(item = null) {
        const isEdit = !!item;
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑' : '新增'}对战题目</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">题目ID (problemId) *</label>
                        <input type="number" id="battle-modal-problem-id" value="${item?.problemId || ''}" 
                               ${isEdit ? 'readonly' : ''} style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">难度等级分 *</label>
                        <input type="number" id="battle-modal-level-score" value="${item?.levelScore || ''}" 
                               min="1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    ${isEdit ? `
                        <div style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; font-size: 13px; color: #666;">
                            <div>匹配次数: ${item.matchCount || 0}</div>
                            <div>AC次数: ${item.acCount || 0}</div>
                            <div>平均用时: ${item.avgSeconds || 0}秒</div>
                        </div>
                    ` : ''}
                    <div id="battle-modal-error" style="color: #ff4d4f; margin-top: 12px; display: none;"></div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="battle-modal-submit" style="padding: 8px 16px; border: none; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">
                        ${isEdit ? '更新' : '添加'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('battle-modal-submit').addEventListener('click', async () => {
            const errorEl = document.getElementById('battle-modal-error');
            errorEl.style.display = 'none';

            const problemId = document.getElementById('battle-modal-problem-id').value;
            const levelScore = parseInt(document.getElementById('battle-modal-level-score').value);

            if (!problemId) {
                errorEl.textContent = '请填写题目ID';
                errorEl.style.display = 'block';
                return;
            }

            if (!levelScore || levelScore <= 0) {
                errorEl.textContent = '难度等级分必须是正数';
                errorEl.style.display = 'block';
                return;
            }

            try {
                if (isEdit) {
                    await this.apiService.adminBattleProblemUpdate(item.id, levelScore);
                } else {
                    await this.apiService.adminBattleProblemAdd(problemId, levelScore);
                }
                modal.remove();
                this.loadBattleList(this.battlePage);
                alert(isEdit ? '更新成功' : '添加成功');
            } catch (error) {
                errorEl.textContent = error.message || '操作失败';
                errorEl.style.display = 'block';
            }
        });

        // 移除点击外部关闭的功能，只能通过取消按钮关闭
    }

    /**
     * 显示批量添加模态框
     */
    showBattleBatchAddModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>批量添加对战题目</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 12px; color: #666; font-size: 13px;">
                        每行一个，格式：problemId,levelScore<br>
                        例如：12345,1600
                    </div>
                    <textarea id="battle-batch-text" rows="15" 
                              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px;"
                              placeholder="12345,1600&#10;12346,1700&#10;12347,1800"></textarea>
                    <div id="battle-batch-error" style="color: #ff4d4f; margin-top: 12px; display: none;"></div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="battle-batch-submit" style="padding: 8px 16px; border: none; background: #1890ff; color: #fff; border-radius: 4px; cursor: pointer;">
                        添加
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('battle-batch-submit').addEventListener('click', async () => {
            const errorEl = document.getElementById('battle-batch-error');
            errorEl.style.display = 'none';

            const text = document.getElementById('battle-batch-text').value.trim();
            if (!text) {
                errorEl.textContent = '请填写题目数据';
                errorEl.style.display = 'block';
                return;
            }

            const lines = text.split('\n').filter(line => line.trim());
            const items = [];
            for (const line of lines) {
                const parts = line.split(',').map(s => s.trim());
                if (parts.length !== 2) {
                    errorEl.textContent = `格式错误: ${line}`;
                    errorEl.style.display = 'block';
                    return;
                }
                const problemId = parseInt(parts[0]);
                const levelScore = parseInt(parts[1]);
                if (!problemId || !levelScore || levelScore <= 0) {
                    errorEl.textContent = `数据错误: ${line} (难度必须是正数)`;
                    errorEl.style.display = 'block';
                    return;
                }
                items.push({ problemId, levelScore });
            }

            try {
                const result = await this.apiService.adminBattleProblemBatchAdd(items);
                modal.remove();
                this.loadBattleList(this.battlePage);
                if (result.failCount > 0) {
                    alert(`成功添加 ${result.successCount} 条，失败 ${result.failCount} 条\n失败项：\n${result.failItems.map(item => `题目${item.problemId}: ${item.reason}`).join('\n')}`);
                } else {
                    alert(`成功添加 ${result.successCount} 条`);
                }
            } catch (error) {
                errorEl.textContent = error.message || '批量添加失败';
                errorEl.style.display = 'block';
            }
        });

        // 移除点击外部关闭的功能，只能通过取消按钮关闭
    }

    /**
     * 编辑对战题目
     */
    async editBattle(id) {
        try {
            const item = await this.apiService.adminBattleProblemGet(id);
            this.showBattleModal(item);
        } catch (error) {
            alert('加载失败: ' + error.message);
        }
    }

    /**
     * 检查删除对战题目
     */
    async checkDeleteBattle(id) {
        try {
            const result = await this.apiService.adminBattleProblemCheckDelete(id);
            const riskColors = { low: '#52c41a', medium: '#faad14', high: '#ff4d4f' };
            const riskTexts = { low: '低风险', medium: '中等风险', high: '高风险' };
            
            let message = `删除风险评估\n\n`;
            message += `风险等级: ${riskTexts[result.riskLevel]}\n`;
            message += `匹配次数: ${result.matchCount}\n`;
            message += `AC次数: ${result.acCount}\n`;
            if (result.warnings && result.warnings.length > 0) {
                message += `\n警告:\n${result.warnings.join('\n')}\n`;
            }
            message += `\n确定要删除吗？`;

            if (confirm(message)) {
                await this.deleteBattle(id);
            }
        } catch (error) {
            alert('检查失败: ' + error.message);
        }
    }

    /**
     * 删除对战题目
     */
    async deleteBattle(id) {
        if (!confirm('确定要删除这道题目吗？')) return;

        try {
            await this.apiService.adminBattleProblemDelete(id);
            this.loadBattleList(this.battlePage);
            alert('删除成功');
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    }

    /**
     * 批量删除对战题目
     */
    /**
     * 显示批量删除模态框
     */
    showBatchDeleteModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>批量删除对战题目</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">problemId列表 *</label>
                        <textarea id="batch-delete-problem-ids" 
                                  placeholder="请输入problemId，支持用换行、空格或逗号分隔&#10;例如：&#10;12345&#10;12346, 12347&#10;12348 12349" 
                                  style="width: 100%; min-height: 150px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 14px; resize: vertical;"></textarea>
                        <div style="margin-top: 6px; font-size: 12px; color: #666;">
                            提示：支持换行、空格或逗号分隔多个problemId
                        </div>
                    </div>
                    <div id="batch-delete-error" style="color: #ff4d4f; margin-top: 12px; display: none;"></div>
                </div>
                <div class="modal-actions" style="padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="batch-delete-submit" style="padding: 8px 16px; border: none; background: #ff4d4f; color: #fff; border-radius: 4px; cursor: pointer;">
                        批量删除
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const errorEl = modal.querySelector('#batch-delete-error');
        const submitBtn = modal.querySelector('#batch-delete-submit');
        const problemIdsInput = modal.querySelector('#batch-delete-problem-ids');

        submitBtn.addEventListener('click', async () => {
            const problemIdsText = problemIdsInput.value.trim();
            if (!problemIdsText) {
                errorEl.textContent = '请输入problemId列表';
                errorEl.style.display = 'block';
                return;
            }

            // 解析problemId：支持换行、空格、逗号分隔
            const problemIds = problemIdsText
                .split(/[\n\r,，\s]+/)
                .map(id => id.trim())
                .filter(id => id.length > 0)
                .map(id => parseInt(id))
                .filter(id => !isNaN(id) && id > 0);

            if (problemIds.length === 0) {
                errorEl.textContent = '未找到有效的problemId';
                errorEl.style.display = 'block';
                return;
            }

            // 去重
            const uniqueProblemIds = [...new Set(problemIds)];

            errorEl.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = '查询中...';

            try {
                // 根据problemId查询对应的记录ID
                const recordIds = [];
                const notFoundIds = [];
                
                for (const problemId of uniqueProblemIds) {
                    try {
                        const item = await this.apiService.adminBattleProblemGetByProblemId(problemId);
                        if (item && item.id) {
                            recordIds.push(item.id);
                        } else {
                            notFoundIds.push(problemId);
                        }
                    } catch (error) {
                        // 如果查询失败，说明题目不存在
                        notFoundIds.push(problemId);
                    }
                }

                if (recordIds.length === 0) {
                    errorEl.textContent = '未找到任何有效的对战题目记录';
                    errorEl.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = '批量删除';
                    return;
                }

                // 如果有不存在的problemId，提示用户
                let confirmMessage = `确定要删除 ${recordIds.length} 道题目吗？`;
                if (notFoundIds.length > 0) {
                    confirmMessage += `\n\n注意：以下problemId未找到（将跳过）：\n${notFoundIds.join(', ')}`;
                }

                if (!confirm(confirmMessage)) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '批量删除';
                    return;
                }

                submitBtn.textContent = '删除中...';
                
                // 执行批量删除
                await this.apiService.adminBattleProblemBatchDelete(recordIds);
                modal.remove();
                this.loadBattleList(this.battlePage);
                
                let successMessage = `成功删除 ${recordIds.length} 道题目`;
                if (notFoundIds.length > 0) {
                    successMessage += `\n跳过 ${notFoundIds.length} 个不存在的problemId：${notFoundIds.join(', ')}`;
                }
                alert(successMessage);
            } catch (error) {
                errorEl.textContent = error.message || '批量删除失败';
                errorEl.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = '批量删除';
            }
        });

        // 移除点击外部关闭的功能，只能通过取消按钮关闭
    }

    async handleBatchDelete() {
        this.showBatchDeleteModal();
    }

    /**
     * 隐藏视图
     */
    hide() {
        // 可以在这里添加清理逻辑
    }
}
    