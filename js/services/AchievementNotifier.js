import { eventBus, EVENTS } from '../events/EventBus.js';

export class AchievementNotifier {
    constructor(api) {
        this.api = api;
        this.queue = [];
        this.showing = false;
        this.root = document.getElementById('toast-root');
        if (!this.root) {
            this.root = document.createElement('div');
            this.root.id = 'toast-root';
            this.root.className = 'toast-root';
            document.body.appendChild(this.root);
        }
        try {
            const saved = JSON.parse(localStorage.getItem('achv.seen') || '[]');
            this.seen = new Set(saved);
        } catch (_) {
            this.seen = new Set();
        }

        // 事件绑定：登录后冷启动成就（仅初始化已获得为已读，不弹出）
        eventBus.on(EVENTS.USER_LOGIN, async () => {
            if (localStorage.getItem('achv.seen')) return;
            try {
                const list = await this._fetchAll([1,2,3,4,6]);
                const got = list.filter(b => Number(b.status) === 1).map(b => b.id);
                this._markSeen(got);
            } catch (_) {}
        });

        // 打卡成功：检查打卡相关成就
        eventBus.on(EVENTS.CHECK_IN_SUCCESS, async () => {
            // 给后端留一点落库时间
            setTimeout(() => this.diffAndNotify([1,2,3]), 1500);
        });
    }

    async diffAndNotify(types) {
        try {
            const list = await this._fetchAll(types);
            const newOnes = list.filter(b => Number(b.status) === 1 && !this.seen.has(b.id));
            if (newOnes.length === 0) return;
            // 逐个入队并标记已读
            newOnes.forEach(b => this._enqueue(b));
            this._markSeen(newOnes.map(b => b.id));
        } catch (e) {
            console.warn('diffAndNotify failed', e);
        }
    }

    async _fetchAll(types) {
        const data = await this.api.fetchBadgeList(types);
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.data)) return data.data;
        if (data && data.data && typeof data.data === 'object') return Object.values(data.data);
        return [];
    }

    _markSeen(ids) {
        ids.forEach(id => this.seen.add(id));
        localStorage.setItem('achv.seen', JSON.stringify(Array.from(this.seen)));
    }

    _enqueue(badge) {
        this.queue.push(badge);
        if (!this.showing) this._showNext();
    }

    _showNext() {
        const badge = this.queue.shift();
        if (!badge) { this.showing = false; return; }
        this.showing = true;
        const el = this._renderToast(badge);
        this.root.appendChild(el);
        requestAnimationFrame(() => el.classList.add('toast-enter-active'));
        const ttl = 5000;
        const timer = setTimeout(() => close(), ttl);
        const close = () => {
            el.classList.remove('toast-enter-active');
            el.classList.add('toast-leave-active');
            setTimeout(() => {
                el.remove();
                this._showNext();
            }, 200);
            clearTimeout(timer);
        };
        el.addEventListener('click', close);
    }

    _renderToast(b) {
        const el = document.createElement('div');
        el.className = 'toast toast-enter';
        const icon = document.createElement('div');
        icon.className = 'toast__icon';
        if (b.colorUrl) {
            const img = document.createElement('img');
            img.src = b.colorUrl;
            img.alt = b.name || '';
            img.referrerPolicy = 'no-referrer';
            icon.appendChild(img);
        } else {
            icon.textContent = '⭐';
        }
        const body = document.createElement('div');
        body.className = 'toast__body';
        const title = document.createElement('div');
        title.className = 'toast__title';
        title.textContent = b.name || '获得成就';
        const desc = document.createElement('div');
        desc.className = 'toast__desc';
        desc.textContent = b.detail || '';
        body.appendChild(title);
        if (b.detail) body.appendChild(desc);

        const points = document.createElement('div');
        points.className = 'toast__points';
        points.textContent = `+${Number(b.score) || 0}`;

        el.appendChild(icon);
        el.appendChild(body);
        el.appendChild(points);
        return el;
    }
}


