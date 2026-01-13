export class DifyView {
    constructor(elements, state, apiService) {
        this.container = document.getElementById('dify-container');
        this.state = state;
    }

    render() {
        if (!this.container) {
            // Lazy load container if not passed in initial elements
            this.container = document.getElementById('dify-container');
        }
        if (!this.container) return;

        // 权限 gate：仅 Dify 管理员（或 tracker 管理员）可访问
        const canAccess = (this.state && this.state.canAccessDify) ? this.state.canAccessDify() : (this.state && this.state.isAdmin === true);
        if (!canAccess) {
            this.container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #666;">
                    <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
                    <h2 style="margin-bottom: 10px;">无权限访问 AI 助手</h2>
                    <p style="margin:0;">需要 Dify 管理员权限（后端：/dify/admin/check）。</p>
                </div>
            `;
            return;
        }

        const config = this.getDifyConfig();
        
        if (!config || !config.url) {
            this.container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; color: #666;">
                    <div style="font-size: 64px; margin-bottom: 20px;">🤖</div>
                    <h2 style="margin-bottom: 10px;">AI 助手未配置</h2>
                    <p>请联系管理员在设置页面配置 Dify 助手地址。</p>
                </div>
            `;
            return;
        }

        let iframeSrc = config.url;
        // Basic validation
        if (!iframeSrc.startsWith('http')) {
             this.container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #ff4d4f;">
                    配置错误：无效的 URL
                </div>
            `;
            return;
        }

        // Protocol adaptation:
        // If current page is HTTPS and target is HTTP, browser will block it (Mixed Content).
        // Try to upgrade to HTTPS.
        if (window.location.protocol === 'https:' && iframeSrc.startsWith('http:')) {
            const newSrc = iframeSrc.replace(/^http:/, 'https:');
            console.warn(`[DifyView] Upgrading HTTP URL to HTTPS to avoid Mixed Content: ${iframeSrc} -> ${newSrc}`);
            iframeSrc = newSrc;
        }

        // 增加 loading 提示和兜底链接
        this.container.innerHTML = `
            <div style="width: 100%; height: calc(100vh - 80px); min-height: 600px; background: #f5f5f5; position: relative; display: flex; flex-direction: column;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #999; z-index: 0;">
                    <div style="margin-bottom: 12px;">正在加载 AI 助手...</div>
                    <div style="font-size: 12px; max-width: 300px; text-align: center; line-height: 1.5;">
                        如果长时间白屏，可能是因为浏览器安全策略拦截了非安全连接 (HTTP)。<br>
                        <a href="${iframeSrc}" target="_blank" rel="noopener noreferrer" style="color: #1890ff; text-decoration: underline; cursor: pointer;">
                            点击此处在新窗口打开
                        </a>
                    </div>
                </div>
                <iframe
                    src="${iframeSrc}"
                    style="flex: 1; width: 100%; border: none; position: relative; z-index: 1;"
                    allow="microphone; camera; clipboard-read; clipboard-write;"
                    referrerpolicy="no-referrer">
                </iframe>
            </div>
        `;
    }

    getDifyConfig() {
        try {
            const stored = localStorage.getItem('tracker_dify_config');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to parse dify config', e);
        }
        return null;
    }
}
