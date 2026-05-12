import { eventBus, EVENTS } from '../events/EventBus.js';

const CARD_PRESENTATION_CONFIG = {
    defaultSystem: {
        name: '牛客娘卡册',
        subtitle: '做题、对战、打卡，都会慢慢变成一张张会发光的收藏。'
    },
    albums: {
        saichang_kuangxiangqu: {
            name: '赛场狂想曲',
            subtitle: '灯牌亮起，倒计时归零。把那些解出题目的瞬间，收进这本热闹的赛场纪念册。',
            expectedTotal: 12,
            coverImage: '',
            rewardCollect: '集齐全部 12 张卡牌，可获得 300 牛币奖励，达成后自动发放。',
            rewardFullUr: '全部卡牌满级后，可获得限定实体卡奖励，请联系工作人员领取。'
        },
        default: {
            subtitle: '每张卡都记录一次小小的高光时刻，慢慢翻，总会凑成属于你的题场回忆。',
            expectedTotal: 0,
            coverImage: './牛客娘/笑.png',
            rewardCollect: '全收集奖励：300 牛币，达成后自动发放。',
            rewardFullUr: '全满级奖励：限定实体卡奖励，请联系工作人员领取。'
        }
    }
};

const CARD_DRAW_COVER_IMAGE = 'https://uploadfiles.nowcoder.com/compress/mw1000/images/20260509/919247_1778323736733/D2B5CA33BD970F64A6301FA75AE2EB22';
const CURRENT_CARD_SHOP_ALBUM_CODE = 'saichang_kuangxiangqu';

const RARITY_STYLE = {
    LOCKED: { label: 'LOCKED', color: '#cbd5e1' },
    N: { label: 'N', color: '#64748b' },
    R: { label: 'R', color: '#22c55e' },
    SR: { label: 'SR', color: '#3b82f6' },
    SSR: { label: 'SSR', color: '#a855f7' },
    UR: { label: 'UR', color: '#f97316' }
};

export class CardView {
    constructor(elements, state, api) {
        this.elements = elements;
        this.state = state;
        this.api = api;
        this.container = this.elements.cardsContainer;
        this.pageMode = 'overview';
        this.mode = 'api';
        this.activeAlbumCode = '';
        this.activeHomeTab = 'overview';
        this.overviewData = null;
        this.albumDetailCache = {};
        this.loading = false;
        this.errorMessage = '';
        this.drawOverlay = null;
        this.fragmentShopOverlay = null;
        this.cardPreviewOverlay = null;
        this.probabilityOverlay = null;
        this.fragmentConfirmOverlay = null;
        this.fragmentShopFilters = {
            rarity: 'all',
            ownership: 'all'
        };
        this.mockData = this.buildMockData();
        this.bindEvents();
    }

    bindEvents() {
        eventBus.on(EVENTS.MAIN_TAB_CHANGED, (tab) => {
            if (tab === 'cards') this.render();
        });
    }

    async render(forceRefresh = false) {
        if (!this.container) return;
        if (!this.overviewData || forceRefresh) {
            await this.loadOverview(forceRefresh);
            return;
        }
        if (this.pageMode === 'detail' && this.activeAlbumCode && !this.albumDetailCache[this.activeAlbumCode]) {
            await this.loadAlbumDetail(this.activeAlbumCode, forceRefresh);
            return;
        }
        this.renderCurrentView();
    }

    async loadOverview(forceRefresh = false) {
        this.loading = true;
        this.errorMessage = '';
        this.renderCurrentView();
        try {
            const data = await this.api.getTrackerCardOverview();
            this.overviewData = this.normalizeOverviewData(data);
            this.mode = 'api';
            if (!this.activeAlbumCode && this.overviewData.albums.length) {
                this.activeAlbumCode = this.overviewData.albums[0].code;
            }
            if (forceRefresh && this.activeAlbumCode) {
                delete this.albumDetailCache[this.activeAlbumCode];
            }
        } catch (e) {
            this.mode = 'mock-fallback';
            this.overviewData = this.buildOverviewFromMock();
            this.errorMessage = e && e.message ? `接口异常，已回退到演示数据：${e.message}` : '接口异常，已回退到演示数据';
            if (!this.activeAlbumCode) {
                this.activeAlbumCode = this.overviewData.albums[0]?.code || '';
            }
        } finally {
            this.loading = false;
            this.renderCurrentView();
        }
    }

    async loadAlbumDetail(albumCode, forceRefresh = false) {
        if (!albumCode) return;
        this.loading = true;
        this.errorMessage = '';
        this.renderCurrentView();
        try {
            const data = await this.api.getTrackerCardAlbumDetail(albumCode);
            this.albumDetailCache[albumCode] = this.normalizeAlbumDetail(data, albumCode);
            this.mode = this.mode === 'mock-fallback' ? 'api+mock' : 'api';
        } catch (e) {
            const fallback = this.getMockAlbumDetail(albumCode);
            if (fallback) {
                this.albumDetailCache[albumCode] = fallback;
                this.mode = 'mock-fallback';
                this.errorMessage = e && e.message ? `卡册详情接口异常，已回退到演示数据：${e.message}` : '卡册详情接口异常，已回退到演示数据';
            } else {
                this.errorMessage = e && e.message ? e.message : '获取卡册详情失败';
            }
        } finally {
            this.loading = false;
            this.renderCurrentView();
        }
    }

    renderCurrentView() {
        if (!this.container) return;
        if (this.loading && !this.overviewData) {
            this.container.innerHTML = this.renderLoading('卡牌数据加载中...');
            return;
        }
        if (!this.overviewData) {
            this.container.innerHTML = this.renderError(this.errorMessage || '暂无卡牌数据');
            return;
        }
        if (this.pageMode === 'detail') {
            const detail = this.albumDetailCache[this.activeAlbumCode];
            if (!detail) {
                this.container.innerHTML = this.renderLoading('卡册详情加载中...');
                return;
            }
            this.container.innerHTML = this.renderAlbumDetail(detail);
        } else {
            this.container.innerHTML = this.renderOverview();
        }
        this.bindRenderedEvents();
    }

    renderLoading(text) {
        return `
            <div class="battle-s1-page">
                <div class="battle-s1-panel" style="margin-top: 20px; text-align: center; padding: 48px 24px;">
                    <div class="battle-s1-panel__headline">${text}</div>
                </div>
            </div>
        `;
    }

    renderError(text) {
        return `
            <div class="battle-s1-page">
                <div class="battle-s1-panel" style="margin-top: 20px; text-align: center; padding: 48px 24px;">
                    <div class="battle-s1-panel__headline" style="color:#ff4d4f;">加载失败</div>
                    <div class="battle-s1-panel__desc" style="margin-top: 8px;">${text}</div>
                    <button class="battle-s1-btn battle-s1-btn--primary" id="battle-s1-retry">重试</button>
                </div>
            </div>
        `;
    }

    renderOverview() {
        const system = this.overviewData.system;
        const tabs = [
            ['overview', '概览'],
            ['draw', '抽卡'],
            ['shop', '商店'],
            ['rank', '排行榜']
        ];
        const shopAlbumCode = CURRENT_CARD_SHOP_ALBUM_CODE;
        const shopDetail = this.albumDetailCache[shopAlbumCode] || this.getMockAlbumDetail(shopAlbumCode);
        const drawCoverImage = CARD_DRAW_COVER_IMAGE;
        const drawAlbumName = CARD_PRESENTATION_CONFIG.albums[CURRENT_CARD_SHOP_ALBUM_CODE].name;
        return `
            <div class="battle-s1-page">
                <section class="battle-s1-home-head">
                    <div>
                        <div class="battle-s1-home-head__title-row">
                            <h1 class="battle-s1-title">${system.name}</h1>
                            <div class="battle-s1-help">
                                <button class="battle-s1-help__button" aria-label="查看卡片规则">?</button>
                                <div class="battle-s1-help__popover">
                                    <div><b>解锁</b>：抽到第一张卡后点亮。</div>
                                    <div><b>成长</b>：重复卡会推进等级，N 为 1~4，R 为 5~24，SR 为 25~124，SSR 为 125~624，UR 为 625 max。</div>
                                    <div><b>升阶</b>：每 5 张同等价重复卡升到下一稀有度。</div>
                                    <div><b>碎片</b>：满级后重复卡转碎片；5 个同稀有度碎片可换指定卡。</div>
                                    <div><b>抽卡券</b>：每日打卡 +10；对战每日首胜 +5；对战 AC 胜利 +4，AC 失败 +2。</div>
                                </div>
                            </div>
                        </div>
                        ${this.errorMessage ? `<div class="battle-s1-panel__desc" style="margin-top:12px; color:#d46b08;">${this.errorMessage}</div>` : ''}
                    </div>
                    <div class="battle-s1-home-tabs">
                        ${tabs.map(([key, label]) => `
                            <button class="${this.activeHomeTab === key ? 'is-active' : ''}" data-card-home-tab="${key}">${label}</button>
                        `).join('')}
                    </div>
                </section>

                ${this.activeHomeTab === 'overview' ? `
                    <section class="battle-s1-main battle-s1-main--overview-only">
                        <div class="battle-s1-panel">
                            <div class="battle-s1-overview-stats">
                                <div>
                                    <span>已拥有</span>
                                    <strong>${system.collected} / ${system.total}</strong>
                                </div>
                                <div>
                                    <span>已满级</span>
                                    <strong>${system.maxed} / ${system.total}</strong>
                                </div>
                                <div>
                                    <span>抽卡券</span>
                                    <strong>${system.tickets}</strong>
                                </div>
                            </div>
                            <div class="battle-s1-album-showcase">
                                ${this.overviewData.albums.length
                                    ? this.overviewData.albums.map(album => this.renderAlbumCard(album)).join('')
                                    : `<div class="battle-s1-panel__desc" style="margin-top:8px;">当前卡册定义还未同步完成，稍后再来看看。</div>`
                                }
                            </div>
                        </div>
                    </section>
                ` : ''}

                ${this.activeHomeTab === 'draw' ? `
                    <section class="battle-s1-main battle-s1-main--draw">
                        <div class="battle-s1-panel battle-s1-draw-panel">
                            <div class="battle-s1-draw-panel__head">
                                <div class="battle-s1-panel__title">抽卡</div>
                                <div class="battle-s1-draw-panel__tools">
                                    <div class="battle-s1-ticket-pill">抽卡券 <strong>${system.tickets}</strong></div>
                                    <button class="battle-s1-probability-btn" id="battle-s1-probability-btn">概率说明</button>
                                </div>
                            </div>
                            <div class="battle-s1-draw-stage">
                                <div class="battle-s1-draw-stage__core">
                                    <img class="battle-s1-draw-stage__cover" src="${this.escapeHtml(drawCoverImage)}" alt="${this.escapeHtml(drawAlbumName)}">
                                </div>
                                <div class="battle-s1-draw-stage__tips">
                                <div>十连保底 1 张 SR+</div>
                                <div>100 抽保底 1 张 SSR+</div>
                                <div>重复卡用于升星，满级后才会转碎片</div>
                                </div>
                                <div class="battle-s1-draw-stage__actions">
                                    <button class="battle-s1-btn battle-s1-btn--ghost" id="battle-s1-single-draw" ${system.tickets < 1 ? 'disabled' : ''}>单抽</button>
                                    <button class="battle-s1-btn battle-s1-btn--primary" id="battle-s1-ten-draw" ${system.tickets < 10 ? 'disabled' : ''}>十连</button>
                                </div>
                                <div class="battle-s1-pity">
                                    <div>距离十连保底重置：${system.pityTen}/10</div>
                                    <div>距离百抽保底：${system.pityHundred}/100</div>
                                </div>
                            </div>
                        </div>

                        <div class="battle-s1-panel battle-s1-reward-panel">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                                <div class="battle-s1-panel__title">碎片余额</div>
                                <button class="battle-s1-btn battle-s1-btn--ghost" id="battle-s1-fragment-shop" style="padding:8px 14px; font-size:12px;">碎片商店</button>
                            </div>
                            <div class="battle-s1-fragments">
                                ${Object.entries(system.fragments).map(([rarity, count]) => `
                                    <div class="battle-s1-fragment battle-s1-fragment--${rarity}">
                                        <span>${rarity.toUpperCase()}</span>
                                        <strong>${count}</strong>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="battle-s1-fragment__tip">碎片可换指定卡，也可以在相邻稀有度之间转换。</div>
                        </div>
                    </section>
                ` : ''}

                ${this.activeHomeTab === 'rank' ? `
                    <section class="battle-s1-panel battle-s1-rank-placeholder">
                        <div class="battle-s1-panel__headline">排行榜</div>
                        <div class="battle-s1-panel__desc">卡片排行榜还在准备中，之后会在这里展示收集进度、满级数量和稀有卡持有情况。</div>
                    </section>
                ` : ''}

                ${this.activeHomeTab === 'shop' ? `
                    <section class="battle-s1-panel">
                        ${shopDetail ? this.renderFragmentShopContent(shopDetail, system.fragments, false) : `
                            <div class="battle-s1-panel__headline">碎片商店</div>
                            <div class="battle-s1-panel__desc">卡册数据加载中，请稍后再试。</div>
                        `}
                    </section>
                ` : ''}
            </div>
        `;
    }

    renderAlbumCard(album) {
        const cover = album.coverImage || './牛客娘/笑.png';
        const collectPercent = album.total > 0 ? Math.max(0, Math.min(100, Math.round((album.collected / album.total) * 100))) : 0;
        const maxedPercent = album.total > 0 ? Math.max(0, Math.min(100, Math.round((album.maxed / album.total) * 100))) : 0;
        return `
            <button class="battle-s1-album-showcase__card" data-open-album="${album.code}">
                <div class="battle-s1-album-showcase__art">
                    <img src="${cover}" alt="${album.name}">
                    <div class="battle-s1-album-showcase__veil"></div>
                    <div class="battle-s1-album-showcase__album-tag">ALBUM 01</div>
                </div>
                <div class="battle-s1-album-showcase__body">
                    <div class="battle-s1-album-showcase__eyebrow">COLLECTOR'S EDITION</div>
                    <div class="battle-s1-album-showcase__title">${album.name}</div>
                    <div class="battle-s1-album-showcase__sub">${album.subtitle || CARD_PRESENTATION_CONFIG.albums.default.subtitle}</div>
                    <div class="battle-s1-album-showcase__meters">
                        <div class="battle-s1-album-showcase__meter">
                            <div class="battle-s1-album-showcase__meter-head">
                                <span>收集进度</span>
                                <strong>${album.collected}/${album.total}</strong>
                            </div>
                            <div class="battle-s1-album-showcase__meter-track">
                                <div class="battle-s1-album-showcase__meter-fill battle-s1-album-showcase__meter-fill--collect" style="width:${collectPercent}%"></div>
                            </div>
                        </div>
                        <div class="battle-s1-album-showcase__meter">
                            <div class="battle-s1-album-showcase__meter-head">
                                <span>满级进度</span>
                                <strong>${album.maxed}/${album.total}</strong>
                            </div>
                            <div class="battle-s1-album-showcase__meter-track">
                                <div class="battle-s1-album-showcase__meter-fill battle-s1-album-showcase__meter-fill--maxed" style="width:${maxedPercent}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="battle-s1-album-showcase__footer">
                        <div class="battle-s1-album-showcase__hint">进入卡册查看 12 张正式卡面与成长状态</div>
                        <div class="battle-s1-album-showcase__cta">打开卡册</div>
                    </div>
                </div>
            </button>
        `;
    }

    renderAlbumDetail(detail) {
        const rewardCollect = this.normalizeConfigText(detail.rewardCollect || CARD_PRESENTATION_CONFIG.albums.default.rewardCollect);
        const rewardFullUr = this.normalizeConfigText(detail.rewardFullUr || CARD_PRESENTATION_CONFIG.albums.default.rewardFullUr);
        const ownedCards = detail.cards.filter(card => card.isUnlocked);
        const isFullMaxed = Number(detail.totalCount || 0) > 0 && Number(detail.maxedCount || 0) >= Number(detail.totalCount || 0);
        return `
            <div class="battle-s1-page">
                <section class="battle-s1-hero battle-s1-hero--compact">
                    <div class="battle-s1-hero__copy">
                        <button class="battle-s1-back" id="battle-s1-back">&larr; 返回卡册首页</button>
                        <h1 class="battle-s1-title">${detail.albumName}</h1>
                        <p class="battle-s1-subtitle">${detail.albumSubtitle || CARD_PRESENTATION_CONFIG.albums.default.subtitle}</p>
                        ${this.errorMessage ? `<div class="battle-s1-panel__desc" style="margin-top:12px; color:#d46b08;">${this.errorMessage}</div>` : ''}
                    </div>
                    <div class="battle-s1-hero__stats battle-s1-hero__stats--compact">
                        <div class="battle-s1-stat-card">
                            <div class="battle-s1-stat-label">收集进度</div>
                            <div class="battle-s1-stat-value">${detail.collectedCount} / ${detail.totalCount}</div>
                        </div>
                        <div class="battle-s1-stat-card">
                            <div class="battle-s1-stat-label">满级进度</div>
                            <div class="battle-s1-stat-value">${detail.maxedCount} / ${detail.totalCount}</div>
                        </div>
                    </div>
                </section>

                <section class="battle-s1-main battle-s1-main--detail">
                    <div class="battle-s1-content">
                        <div class="battle-s1-card-grid battle-s1-card-grid--detail">
                            ${ownedCards.length ? ownedCards.map(card => this.renderCard(card)).join('') : `
                                <div class="battle-s1-empty-owned">
                                    <div class="battle-s1-empty-owned__title">这本卡册还没有点亮</div>
                                    <div class="battle-s1-empty-owned__desc">先去抽几次卡吧，第一张出现时会更有感觉。</div>
                                </div>
                            `}
                        </div>
                    </div>
                    <aside class="battle-s1-sidebar">
                        <div class="battle-s1-panel battle-s1-reward-panel">
                            <div class="battle-s1-panel__title">当前卡册奖励</div>
                            ${rewardCollect ? `
                                <div class="battle-s1-reward-item">
                                    <div class="battle-s1-reward-label">全收集奖励</div>
                                    <div class="battle-s1-reward-value">${rewardCollect}</div>
                                </div>
                            ` : ''}
                            ${rewardFullUr ? `
                                <div class="battle-s1-reward-item">
                                    <div class="battle-s1-reward-label">全满级奖励</div>
                                    <div class="battle-s1-reward-value">${rewardFullUr}</div>
                                </div>
                            ` : ''}
                            ${!rewardCollect && !rewardFullUr ? `
                                <div class="battle-s1-panel__desc" style="margin-top: 0;">
                                    卡册奖励将在后续配置完成后开放展示。
                                </div>
                            ` : ''}
                            ${isFullMaxed ? `
                                <button class="battle-s1-btn battle-s1-btn--primary battle-s1-reward-contact" data-card-full-max-contact>
                                    联系工作人员领取
                                </button>
                            ` : ''}
                            <div class="battle-s1-fragment__tip">重复卡会优先推进成长；卡牌满级后，再次获得才会自动转为同稀有度碎片。</div>
                        </div>
                    </aside>
                </section>
            </div>
        `;
    }

    renderCard(card) {
        const rarityKey = this.rarityCodeToLabel(card.currentRarity);
        const rarity = rarityKey.toLowerCase();
        const style = RARITY_STYLE[rarityKey] || RARITY_STYLE.LOCKED;
        const levelText = this.getCardLevelText(card);
        const name = card.cardName || '未命名卡牌';
        const previewKey = card.cardId || card.cardCode || '';
        const stateClass = [
            previewKey ? 'is-previewable' : '',
            card.isMaxed ? 'is-maxed' : ''
        ].filter(Boolean).join(' ');
        const previewAttrs = previewKey
            ? `data-preview-card-id="${this.escapeHtml(previewKey)}" tabindex="0" role="button" aria-label="查看 ${this.escapeHtml(name)} 大图"`
            : '';
        return `
            <div class="battle-s1-card battle-s1-card--${rarity} ${stateClass}" ${previewAttrs}>
                <div class="battle-s1-card__frame"></div>
                <div class="battle-s1-card__avatar">
                    <img src="${this.escapeHtml(card.imageUrl || './牛客娘/笑.png')}" alt="${this.escapeHtml(name)}">
                </div>
                <div class="battle-s1-card__footer">
                    <div class="battle-s1-card__name">${this.escapeHtml(name)}</div>
                    <div class="battle-s1-card__level" style="border-color:${style.color}; color:${style.color};">${levelText}</div>
                </div>
            </div>
        `;
    }

    bindRenderedEvents() {
        const retry = this.container.querySelector('#battle-s1-retry');
        if (retry) retry.addEventListener('click', () => this.render(true));

        this.container.querySelectorAll('[data-open-album]').forEach(button => {
            button.addEventListener('click', async () => {
                this.activeAlbumCode = button.dataset.openAlbum;
                this.pageMode = 'detail';
                await this.loadAlbumDetail(this.activeAlbumCode);
            });
        });

        const single = this.container.querySelector('#battle-s1-single-draw');
        const ten = this.container.querySelector('#battle-s1-ten-draw');
        if (single) single.addEventListener('click', async () => this.handleDraw('single'));
        if (ten) ten.addEventListener('click', async () => this.handleDraw('ten'));
        const probabilityBtn = this.container.querySelector('#battle-s1-probability-btn');
        if (probabilityBtn) probabilityBtn.addEventListener('click', () => this.openProbabilityOverlay());
        const fragmentShop = this.container.querySelector('#battle-s1-fragment-shop');
        if (fragmentShop) fragmentShop.addEventListener('click', async () => this.openFragmentShop());
        this.container.querySelectorAll('[data-fragment-exchange]').forEach(button => {
            button.addEventListener('click', async () => {
                const cardId = Number(button.dataset.cardId || 0);
                const rarity = Number(button.dataset.fragmentRarity || 0);
                this.openFragmentExchangeConfirm(cardId, rarity, 'page');
            });
        });
        this.container.querySelectorAll('[data-fragment-filter]').forEach(button => {
            button.addEventListener('click', () => {
                this.fragmentShopFilters[button.dataset.fragmentFilter] = button.dataset.filterValue;
                this.renderCurrentView();
            });
        });
        this.container.querySelectorAll('[data-fragment-convert]').forEach(button => {
            button.addEventListener('click', async () => {
                const fromRarity = Number(button.dataset.fromRarity || 0);
                const toRarity = Number(button.dataset.toRarity || 0);
                this.openFragmentConvertConfirm(fromRarity, toRarity, 'page');
            });
        });
        this.container.querySelectorAll('[data-card-home-tab]').forEach(button => {
            button.addEventListener('click', () => {
                this.activeHomeTab = button.dataset.cardHomeTab || 'overview';
                if (this.activeHomeTab === 'shop') {
                    this.ensureShopAlbumDetail().then(() => this.renderCurrentView());
                } else {
                    this.renderCurrentView();
                }
            });
        });

        const back = this.container.querySelector('#battle-s1-back');
        if (back) {
            back.addEventListener('click', () => {
                this.pageMode = 'overview';
                this.renderCurrentView();
            });
        }

        this.container.querySelectorAll('[data-card-full-max-contact]').forEach(button => {
            button.addEventListener('click', () => {
                alert('请加入 QQ 群 659028468 联系工作人员领取实体卡奖励。');
            });
        });

        this.container.querySelectorAll('[data-preview-card-id]').forEach(cardEl => {
            const open = () => {
                const detail = this.albumDetailCache[this.activeAlbumCode];
                const card = detail?.cards?.find(item => String(item.cardId || item.cardCode || '') === String(cardEl.dataset.previewCardId));
                if (card && card.isUnlocked) this.openCardPreview(card);
            };
            cardEl.addEventListener('click', open);
            cardEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                }
            });
        });
    }

    async handleDraw(drawType) {
        try {
            const data = await this.api.trackerCardDraw(drawType);
            const results = (data.results || []).map(item => this.normalizeDrawResult(item));
            this.openDrawOverlay(results, drawType === 'ten' ? 10 : 1);
            this.patchOverviewByDrawResponse(data);
            if (this.pageMode === 'detail' && this.activeAlbumCode) {
                delete this.albumDetailCache[this.activeAlbumCode];
                await this.loadAlbumDetail(this.activeAlbumCode, true);
            } else {
                this.renderCurrentView();
            }
        } catch (e) {
            alert(e && e.message ? e.message : '抽卡失败');
        }
    }

    openDrawOverlay(results, drawCount) {
        this.closeDrawOverlay();
        const overlay = document.createElement('div');
        overlay.className = 'battle-s1-draw-overlay';
        overlay.innerHTML = `
            <div class="battle-s1-draw-overlay__panel">
                <div class="battle-s1-draw-overlay__head">
                    <div>
                        <div class="battle-s1-panel__eyebrow">${drawCount === 10 ? '十连结果' : '单抽结果'}</div>
                        <div class="battle-s1-panel__headline">牛客娘卡包已开启</div>
                    </div>
                    <button class="battle-s1-draw-overlay__close" aria-label="关闭">&times;</button>
                </div>
                <div class="battle-s1-draw-overlay__stage">
                    ${results.map((card, index) => `
                        <div class="battle-s1-draw-result battle-s1-draw-result--${card.rarity.toLowerCase()} ${card.isNew ? 'is-new' : ''}" style="animation-delay:${index * 80}ms;">
                            <div class="battle-s1-draw-result__halo"></div>
                            <div class="battle-s1-draw-result__flash"></div>
                            ${card.isNew ? '<div class="battle-s1-draw-result__new">NEW</div>' : ''}
                            <div class="battle-s1-draw-result__rarity">${card.rarity}</div>
                            <img src="${card.imageUrl}" alt="${card.cardName}">
                            <div class="battle-s1-draw-result__name">${card.convertedToFragment ? `${card.cardName} · 转碎片` : card.cardName}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="battle-s1-draw-overlay__actions">
                    <button class="battle-s1-btn battle-s1-btn--ghost" id="battle-s1-draw-again">再来一次</button>
                    <button class="battle-s1-btn battle-s1-btn--primary" id="battle-s1-draw-ok">收下结果</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.drawOverlay = overlay;
        const close = () => this.closeDrawOverlay();
        overlay.querySelector('.battle-s1-draw-overlay__close')?.addEventListener('click', close);
        overlay.querySelector('#battle-s1-draw-ok')?.addEventListener('click', close);
        overlay.querySelector('#battle-s1-draw-again')?.addEventListener('click', async () => {
            this.closeDrawOverlay();
            await this.handleDraw(drawCount === 10 ? 'ten' : 'single');
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }

    closeDrawOverlay() {
        if (this.drawOverlay) {
            this.drawOverlay.remove();
            this.drawOverlay = null;
        }
    }

    async openFragmentShop() {
        const albumCode = CURRENT_CARD_SHOP_ALBUM_CODE;
        if (albumCode && !this.albumDetailCache[albumCode]) {
            await this.loadAlbumDetail(albumCode);
        }
        const detail = this.albumDetailCache[albumCode] || this.getMockAlbumDetail(albumCode);
        const fragments = this.overviewData?.system?.fragments || { n: 0, r: 0, sr: 0, ssr: 0, ur: 0 };
        this.closeFragmentShop();
        const overlay = document.createElement('div');
        overlay.className = 'battle-s1-draw-overlay';
        overlay.innerHTML = `
            <div class="battle-s1-draw-overlay__panel">
                <div class="battle-s1-draw-overlay__head">
                    <div></div>
                    <button class="battle-s1-draw-overlay__close" aria-label="关闭">&times;</button>
                </div>
                ${this.renderFragmentShopContent(detail, fragments, true)}
            </div>
        `;
        document.body.appendChild(overlay);
        this.fragmentShopOverlay = overlay;
        overlay.querySelector('.battle-s1-draw-overlay__close')?.addEventListener('click', () => this.closeFragmentShop());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeFragmentShop();
        });
        overlay.querySelectorAll('[data-fragment-exchange]').forEach(button => {
            button.addEventListener('click', async () => {
                const cardId = Number(button.dataset.cardId || 0);
                const rarity = Number(button.dataset.fragmentRarity || 0);
                this.openFragmentExchangeConfirm(cardId, rarity, 'overlay');
            });
        });
        overlay.querySelectorAll('[data-fragment-filter]').forEach(button => {
            button.addEventListener('click', async () => {
                this.fragmentShopFilters[button.dataset.fragmentFilter] = button.dataset.filterValue;
                await this.openFragmentShop();
            });
        });
        overlay.querySelectorAll('[data-fragment-convert]').forEach(button => {
            button.addEventListener('click', async () => {
                const fromRarity = Number(button.dataset.fromRarity || 0);
                const toRarity = Number(button.dataset.toRarity || 0);
                this.openFragmentConvertConfirm(fromRarity, toRarity, 'overlay');
            });
        });
    }

    renderFragmentShopContent(detail, fragments, darkMode) {
        const cards = Array.isArray(detail?.cards) ? detail.cards : [];
        const filteredCards = this.filterFragmentShopCards(cards);
        const descStyle = darkMode ? ' style="margin-top:8px; color:rgba(255,255,255,0.72);"' : '';
        const emptyStyle = darkMode
            ? 'grid-column:1 / -1; padding:20px; border-radius:18px; background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.8);'
            : 'grid-column:1 / -1; padding:20px; border-radius:18px; background:#f8fafc; color:#687082;';
        return `
            <div>
                <div class="battle-s1-panel__eyebrow">FRAGMENT SHOP</div>
                <div class="battle-s1-panel__headline">碎片商店</div>
                <div class="battle-s1-panel__desc"${descStyle}>
                    用碎片补齐缺口，或者把多出来的碎片换成更需要的稀有度。本期默认开放赛场狂想曲。
                </div>
            </div>
            <div class="battle-s1-fragments" style="margin-top:18px;">
                ${Object.entries(fragments).map(([rarity, count]) => `
                    <div class="battle-s1-fragment battle-s1-fragment--${rarity}">
                        <span>${rarity.toUpperCase()}</span>
                        <strong>${count}</strong>
                    </div>
                `).join('')}
            </div>
            <div class="battle-s1-fragment-shop-tools ${darkMode ? 'is-dark' : ''}">
                <div>
                    <div class="battle-s1-fragment-shop-tools__label">稀有度</div>
                    <div class="battle-s1-fragment-shop-filter ${darkMode ? 'is-dark' : ''}" data-filter-group="rarity">
                        ${['all', 'n', 'r', 'sr', 'ssr', 'ur'].map(value => `
                            <button class="${this.fragmentShopFilters.rarity === value ? 'is-active' : ''}" data-fragment-filter="rarity" data-filter-value="${value}">
                                ${value === 'all' ? '全部' : value.toUpperCase()}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div>
                    <div class="battle-s1-fragment-shop-tools__label">拥有状态</div>
                    <div class="battle-s1-fragment-shop-filter ${darkMode ? 'is-dark' : ''}" data-filter-group="ownership">
                        ${[
                            ['all', '全部'],
                            ['locked', '未拥有'],
                            ['owned', '已拥有'],
                            ['maxed', '已满级']
                        ].map(([value, label]) => `
                            <button class="${this.fragmentShopFilters.ownership === value ? 'is-active' : ''}" data-fragment-filter="ownership" data-filter-value="${value}">
                                ${label}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="battle-s1-fragment-convert-box ${darkMode ? 'is-dark' : ''}">
                <div>
                    <div class="battle-s1-fragment-convert-box__title">跨稀有度碎片兑换</div>
                    <div class="battle-s1-fragment-convert-box__desc">相邻稀有度支持双向转换：低阶向高阶按 20:1，高阶向低阶按 1:1。</div>
                </div>
                <div class="battle-s1-fragment-convert-box__actions">
                    ${this.renderFragmentConvertActions(fragments)}
                </div>
            </div>
            <div class="battle-s1-fragment-shop-grid ${darkMode ? 'is-dark' : ''}">
                ${cards.length && filteredCards.length ? filteredCards.map(card => this.renderFragmentShopItem(card, fragments, darkMode)).join('') : `
                    <div style="${emptyStyle}">
                        ${cards.length ? '当前筛选条件下没有卡牌。' : '当前还没有可兑换的正式卡牌定义，请等后端卡牌配置同步后再试。'}
                    </div>
                `}
            </div>
        `;
    }

    async ensureShopAlbumDetail() {
        const albumCode = CURRENT_CARD_SHOP_ALBUM_CODE;
        if (albumCode && !this.albumDetailCache[albumCode]) {
            await this.loadAlbumDetail(albumCode);
        }
    }

    renderFragmentConvertActions(fragments) {
        return [
            ['n', 'r', 1, 2, 20],
            ['r', 'sr', 2, 3, 20],
            ['sr', 'ssr', 3, 4, 20],
            ['ssr', 'ur', 4, 5, 20],
            ['r', 'n', 2, 1, 1],
            ['sr', 'r', 3, 2, 1],
            ['ssr', 'sr', 4, 3, 1],
            ['ur', 'ssr', 5, 4, 1]
        ].map(([fromKey, toKey, fromRarity, toRarity, need]) => {
            const count = Number(fragments[fromKey] || 0);
            return `
                <button class="battle-s1-fragment-convert-action" data-fragment-convert="1" data-from-rarity="${fromRarity}" data-to-rarity="${toRarity}" ${count >= need ? '' : 'disabled'}>
                    ${fromKey.toUpperCase()} ${need}:1 ${toKey.toUpperCase()}
                </button>
            `;
        }).join('');
    }

    renderFragmentShopItem(card, fragments, darkMode = false) {
        const rarityLabel = this.rarityCodeToLabel(card.initialRarity);
        const rarityKey = rarityLabel.toLowerCase();
        const fragmentCount = Number(fragments[rarityKey] || 0);
        const isMaxed = !!card.isMaxed;
        const isUnlocked = !!card.isUnlocked;
        const canExchange = !isMaxed && fragmentCount >= 5 && Number(card.cardId || 0) > 0;
        const statusText = isMaxed ? '已满级' : (isUnlocked ? '已拥有' : '未拥有');
        const disabledReason = isMaxed ? '已满级不可兑换' : (fragmentCount < 5 ? '碎片不足' : '兑换');
        return `
            <div class="battle-s1-fragment-shop-item ${darkMode ? 'is-dark' : ''} ${isMaxed ? 'is-maxed' : ''}">
                <div class="battle-s1-fragment-shop-item__art">
                    <img src="${card.imageUrl || './牛客娘/笑.png'}" alt="${this.escapeHtml(card.cardName || '卡牌')}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div class="battle-s1-fragment-shop-item__body">
                    <div class="battle-s1-fragment-shop-item__head">
                        <div class="battle-s1-fragment-shop-item__name">${this.escapeHtml(card.cardName || '未命名卡牌')}</div>
                        <div class="battle-s1-fragment-shop-item__badges">
                            <span>${rarityLabel}</span>
                            <span>${statusText}</span>
                        </div>
                    </div>
                    <div class="battle-s1-fragment-shop-item__desc">使用 5 个 ${rarityLabel} 碎片兑换指定卡。</div>
                    <div class="battle-s1-fragment-shop-item__meta">
                        <div>当前余额：<b>${fragmentCount}</b> / 5</div>
                        <button class="battle-s1-btn battle-s1-btn--primary" data-fragment-exchange="1" data-card-id="${Number(card.cardId || 0)}" data-fragment-rarity="${Number(card.initialRarity || 0)}" ${canExchange ? '' : 'disabled'}>
                            ${canExchange ? '兑换' : disabledReason}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    filterFragmentShopCards(cards) {
        const rarityFilter = this.fragmentShopFilters.rarity;
        const ownershipFilter = this.fragmentShopFilters.ownership;
        return cards.filter(card => {
            const rarityKey = this.rarityCodeToLabel(card.initialRarity).toLowerCase();
            if (rarityFilter !== 'all' && rarityKey !== rarityFilter) return false;
            if (ownershipFilter === 'locked') return !card.isUnlocked;
            if (ownershipFilter === 'owned') return card.isUnlocked && !card.isMaxed;
            if (ownershipFilter === 'maxed') return card.isMaxed;
            return true;
        });
    }

    closeFragmentShop() {
        if (this.fragmentShopOverlay) {
            this.fragmentShopOverlay.remove();
            this.fragmentShopOverlay = null;
        }
    }

    openCardPreview(card) {
        this.closeCardPreview();
        const rarityKey = this.rarityCodeToLabel(card.currentRarity);
        const initialRarity = this.rarityCodeToLabel(card.initialRarity);
        const levelText = this.getCardLevelText(card);
        const need = card.isMaxed ? 0 : Math.max(1, Number(card.progressNeed || 5));
        const owned = card.isMaxed ? need : Math.max(0, Number(card.progressCount || 0));
        const progressPercent = card.isMaxed ? 100 : Math.min(100, Math.round((owned / need) * 100));
        const overlay = document.createElement('div');
        overlay.className = 'battle-s1-card-preview-overlay';
        overlay.innerHTML = `
            <div class="battle-s1-card-preview">
                <button class="battle-s1-card-preview__close" aria-label="关闭">&times;</button>
                <div class="battle-s1-card-preview__art battle-s1-card-preview__art--${rarityKey.toLowerCase()}">
                    <img src="${this.escapeHtml(card.imageUrl || './牛客娘/笑.png')}" alt="${this.escapeHtml(card.cardName || '卡牌')}">
                </div>
                <div class="battle-s1-card-preview__meta">
                    <div class="battle-s1-card-preview__rarity battle-s1-card-detail__rarity--${rarityKey.toLowerCase()}">${rarityKey}</div>
                    <div>
                        <div class="battle-s1-card-preview__name">${this.escapeHtml(card.cardName || '未命名卡牌')}</div>
                        <div class="battle-s1-card-preview__sub">${this.escapeHtml(card.albumName || '卡册')} · 初始 ${initialRarity} · ${levelText}</div>
                    </div>
                </div>
                <div class="battle-s1-card-preview__stats">
                    <div>
                        <span>累计获得</span>
                        <strong>${Number(card.obtainedTotalCount || 0)}</strong>
                    </div>
                    <div>
                        <span>有效成长</span>
                        <strong>${Number(card.effectiveCopyCount || 0)}</strong>
                    </div>
                    <div>
                        <span>下一阶进度</span>
                        <strong>${card.isMaxed ? 'MAX' : `${owned}/${need}`}</strong>
                    </div>
                </div>
                <div class="battle-s1-card-preview__progress">
                    <div class="battle-s1-card-preview__progress-fill battle-s1-card__progress-fill--${rarityKey.toLowerCase()}" style="width:${progressPercent}%"></div>
                </div>
                ${card.flavorText ? `<div class="battle-s1-card-preview__quote">${this.escapeHtml(card.flavorText)}</div>` : ''}
            </div>
        `;
        document.body.appendChild(overlay);
        this.cardPreviewOverlay = overlay;
        const close = () => this.closeCardPreview();
        overlay.querySelector('.battle-s1-card-preview__close')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        const onKeydown = (e) => {
            if (e.key === 'Escape') close();
        };
        overlay._cardPreviewKeydown = onKeydown;
        document.addEventListener('keydown', onKeydown);
    }

    closeCardPreview() {
        if (this.cardPreviewOverlay) {
            if (this.cardPreviewOverlay._cardPreviewKeydown) {
                document.removeEventListener('keydown', this.cardPreviewOverlay._cardPreviewKeydown);
            }
            this.cardPreviewOverlay.remove();
            this.cardPreviewOverlay = null;
        }
    }

    openProbabilityOverlay() {
        this.closeProbabilityOverlay();
        const overlay = document.createElement('div');
        overlay.className = 'battle-s1-probability-overlay';
        overlay.innerHTML = `
            <div class="battle-s1-probability-modal">
                <button class="battle-s1-probability-modal__close" aria-label="关闭">&times;</button>
                <div class="battle-s1-probability-modal__eyebrow">DRAW RATE</div>
                <div class="battle-s1-probability-modal__title">抽卡概率说明</div>
                <div class="battle-s1-probability-modal__desc">每次抽卡将从当前可抽取的卡牌中随机获得 1 张卡牌。</div>

                <div class="battle-s1-probability-rates">
                    ${[
                        ['N', '58.9%', 'n'],
                        ['R', '28.0%', 'r'],
                        ['SR', '11.0%', 'sr'],
                        ['SSR', '2.0%', 'ssr'],
                        ['UR', '0.1%', 'ur']
                    ].map(([rarity, rate, cls]) => `
                        <div class="battle-s1-probability-rate battle-s1-probability-rate--${cls}">
                            <span>${rarity}</span>
                            <strong>${rate}</strong>
                        </div>
                    `).join('')}
                </div>

                <div class="battle-s1-probability-sections">
                    <div class="battle-s1-probability-section">
                        <div class="battle-s1-probability-section__title">保底规则</div>
                        <ul>
                            <li>每 10 抽必定获得 SR 或以上稀有度卡牌。</li>
                            <li>每 100 抽必定获得 SSR 或以上稀有度卡牌。</li>
                            <li>抽到 SR 或以上卡牌后，10 抽保底进度重置。</li>
                            <li>抽到 SSR 或以上卡牌后，100 抽保底进度重置。</li>
                        </ul>
                    </div>
                    <div class="battle-s1-probability-section">
                        <div class="battle-s1-probability-section__title">重复卡牌规则</div>
                        <ul>
                            <li>未满级卡牌重复获得时，会增加该卡牌的成长进度。</li>
                            <li>卡牌满级后再次获得，会自动转化为对应稀有度碎片。</li>
                            <li>碎片可用于兑换指定卡牌。</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.probabilityOverlay = overlay;
        const close = () => this.closeProbabilityOverlay();
        overlay.querySelector('.battle-s1-probability-modal__close')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        const onKeydown = (e) => {
            if (e.key === 'Escape') close();
        };
        overlay._probabilityKeydown = onKeydown;
        document.addEventListener('keydown', onKeydown);
    }

    closeProbabilityOverlay() {
        if (this.probabilityOverlay) {
            if (this.probabilityOverlay._probabilityKeydown) {
                document.removeEventListener('keydown', this.probabilityOverlay._probabilityKeydown);
            }
            this.probabilityOverlay.remove();
            this.probabilityOverlay = null;
        }
    }

    openFragmentExchangeConfirm(cardId, fragmentRarity, source = 'page') {
        const card = this.findCardForFragmentExchange(cardId);
        const cardName = card?.cardName || '这张卡';
        const rarityLabel = this.rarityCodeToLabel(fragmentRarity);
        this.closeFragmentConfirm();
        const overlay = document.createElement('div');
        overlay.className = 'battle-s1-confirm-overlay';
        overlay.innerHTML = `
            <div class="battle-s1-confirm-modal">
                <button class="battle-s1-confirm-modal__close" aria-label="关闭">&times;</button>
                <div class="battle-s1-confirm-modal__eyebrow">FRAGMENT EXCHANGE</div>
                <div class="battle-s1-confirm-modal__title">确认兑换</div>
                <div class="battle-s1-confirm-modal__desc">
                    将消耗 <strong>5 个 ${rarityLabel} 碎片</strong> 兑换「${this.escapeHtml(cardName)}」。
                </div>
                <div class="battle-s1-confirm-modal__actions">
                    <button class="battle-s1-btn battle-s1-btn--ghost" data-confirm-cancel>取消</button>
                    <button class="battle-s1-btn battle-s1-btn--primary" data-confirm-ok>确认兑换</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.fragmentConfirmOverlay = overlay;
        const close = () => this.closeFragmentConfirm();
        overlay.querySelector('.battle-s1-confirm-modal__close')?.addEventListener('click', close);
        overlay.querySelector('[data-confirm-cancel]')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        overlay.querySelector('[data-confirm-ok]')?.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            button.disabled = true;
            button.textContent = '兑换中...';
            this.closeFragmentConfirm();
            await this.handleFragmentExchange(cardId, fragmentRarity, source);
        });
    }

    openFragmentConvertConfirm(fromFragmentRarity, toFragmentRarity, source = 'page') {
        const fromLabel = this.rarityCodeToLabel(fromFragmentRarity);
        const toLabel = this.rarityCodeToLabel(toFragmentRarity);
        const isUpgrade = Number(toFragmentRarity) > Number(fromFragmentRarity);
        const cost = isUpgrade ? 20 : 1;
        this.closeFragmentConfirm();
        const overlay = document.createElement('div');
        overlay.className = 'battle-s1-confirm-overlay';
        overlay.innerHTML = `
            <div class="battle-s1-confirm-modal">
                <button class="battle-s1-confirm-modal__close" aria-label="关闭">&times;</button>
                <div class="battle-s1-confirm-modal__eyebrow">FRAGMENT CONVERT</div>
                <div class="battle-s1-confirm-modal__title">确认碎片转换</div>
                <div class="battle-s1-confirm-modal__desc">
                    将消耗 <strong>${cost} 个 ${fromLabel} 碎片</strong> 转换为 <strong>1 个 ${toLabel} 碎片</strong>。
                </div>
                <div class="battle-s1-confirm-modal__actions">
                    <button class="battle-s1-btn battle-s1-btn--ghost" data-confirm-cancel>取消</button>
                    <button class="battle-s1-btn battle-s1-btn--primary" data-confirm-ok>确认转换</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.fragmentConfirmOverlay = overlay;
        const close = () => this.closeFragmentConfirm();
        overlay.querySelector('.battle-s1-confirm-modal__close')?.addEventListener('click', close);
        overlay.querySelector('[data-confirm-cancel]')?.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        overlay.querySelector('[data-confirm-ok]')?.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            button.disabled = true;
            button.textContent = '转换中...';
            this.closeFragmentConfirm();
            await this.handleFragmentConvert(fromFragmentRarity, toFragmentRarity, source);
        });
    }

    closeFragmentConfirm() {
        if (this.fragmentConfirmOverlay) {
            this.fragmentConfirmOverlay.remove();
            this.fragmentConfirmOverlay = null;
        }
    }

    findCardForFragmentExchange(cardId) {
        const targetId = Number(cardId || 0);
        for (const detail of Object.values(this.albumDetailCache)) {
            const card = detail?.cards?.find(item => Number(item.cardId || 0) === targetId);
            if (card) return card;
        }
        return null;
    }

    async handleFragmentExchange(cardId, fragmentRarity, source = 'page') {
        try {
            const data = await this.api.trackerCardFragmentExchange(cardId, fragmentRarity);
            this.patchOverviewByFragmentExchangeResponse(data);
            await this.refreshAfterFragmentMutation(source);
        } catch (e) {
            alert(e && e.message ? e.message : '碎片兑换失败');
        }
    }

    async handleFragmentConvert(fromFragmentRarity, toFragmentRarity, source = 'page') {
        try {
            const data = await this.api.trackerCardFragmentConvert(fromFragmentRarity, toFragmentRarity);
            this.patchOverviewByFragmentExchangeResponse(data);
            await this.refreshAfterFragmentMutation(source);
        } catch (e) {
            alert(e && e.message ? e.message : '碎片转换失败');
        }
    }

    async refreshAfterFragmentMutation(source = 'page') {
        const albumCode = CURRENT_CARD_SHOP_ALBUM_CODE;
        if (albumCode) delete this.albumDetailCache[albumCode];
        if (source === 'overlay' && this.fragmentShopOverlay) {
            await this.openFragmentShop();
            return;
        }
        if (this.pageMode === 'detail' && albumCode) {
            await this.loadAlbumDetail(albumCode, true);
            return;
        }
        if (this.activeHomeTab === 'shop') {
            await this.ensureShopAlbumDetail();
            return;
        }
        this.renderCurrentView();
    }

    patchOverviewByDrawResponse(data) {
        if (!this.overviewData) return;
        const system = this.overviewData.system;
        system.tickets = Number(data.drawTicketCount || 0);
        system.pityTen = Number(data.pityTenProgress || 0);
        system.pityHundred = Number(data.pityHundredProgress || 0);
        system.fragments = {
            n: Number(data.fragments?.n || 0),
            r: Number(data.fragments?.r || 0),
            sr: Number(data.fragments?.sr || 0),
            ssr: Number(data.fragments?.ssr || 0),
            ur: Number(data.fragments?.ur || 0)
        };
    }

    patchOverviewByFragmentExchangeResponse(data) {
        if (!this.overviewData) return;
        const system = this.overviewData.system;
        system.fragments = {
            n: Number(data.fragments?.n || system.fragments?.n || 0),
            r: Number(data.fragments?.r || system.fragments?.r || 0),
            sr: Number(data.fragments?.sr || system.fragments?.sr || 0),
            ssr: Number(data.fragments?.ssr || system.fragments?.ssr || 0),
            ur: Number(data.fragments?.ur || system.fragments?.ur || 0)
        };
    }

    normalizeOverviewData(data) {
        const apiAlbums = Array.isArray(data.albums) ? data.albums
            .map(item => {
                const cfg = CARD_PRESENTATION_CONFIG.albums[item.albumCode] || CARD_PRESENTATION_CONFIG.albums.default;
                return {
                    code: item.albumCode,
                    name: item.albumName || cfg.name || item.albumCode,
                    subtitle: item.albumSubtitle || cfg.subtitle,
                    coverImage: item.coverImage || cfg.coverImage || './牛客娘/笑.png',
                    collected: Number(item.collectedCount || 0),
                    total: Math.max(Number(item.totalCount || 0), Number(cfg.expectedTotal || 0)),
                    maxed: Number(item.maxedCount || 0)
                };
            }) : [];
        const albums = apiAlbums.length ? apiAlbums : this.buildConfiguredAlbumPlaceholders();
        return {
            system: {
                name: CARD_PRESENTATION_CONFIG.defaultSystem.name,
                subtitle: CARD_PRESENTATION_CONFIG.defaultSystem.subtitle,
                tickets: Number(data.drawTicketCount || 0),
                pityTen: Number(data.pityTenProgress || 0),
                pityHundred: Number(data.pityHundredProgress || 0),
                fragments: {
                    n: Number(data.fragments?.n || 0),
                    r: Number(data.fragments?.r || 0),
                    sr: Number(data.fragments?.sr || 0),
                    ssr: Number(data.fragments?.ssr || 0),
                    ur: Number(data.fragments?.ur || 0)
                },
                collected: Number(data.totalCollectedCount || albums.reduce((sum, album) => sum + album.collected, 0)),
                total: Number(data.totalCardCount || albums.reduce((sum, album) => sum + album.total, 0)),
                maxed: Number(data.totalMaxedCount || albums.reduce((sum, album) => sum + album.maxed, 0))
            },
            albums
        };
    }

    normalizeAlbumDetail(data, albumCode) {
        const cfg = CARD_PRESENTATION_CONFIG.albums[albumCode] || CARD_PRESENTATION_CONFIG.albums.default;
        return {
            albumCode: data.albumCode || albumCode,
            albumName: cfg.name || data.albumName || albumCode,
            albumSubtitle: data.albumSubtitle || cfg.subtitle,
            rewardCollect: this.normalizeConfigText(data.rewardCollect || cfg.rewardCollect),
            rewardFullUr: this.normalizeConfigText(data.rewardFullUr || cfg.rewardFullUr),
            collectedCount: Number(data.collectedCount || 0),
            totalCount: Math.max(Number(data.totalCount || 0), Number(cfg.expectedTotal || 0)),
            maxedCount: Number(data.maxedCount || 0),
            cards: Array.isArray(data.cards) ? data.cards.map(item => ({
                ...item,
                isUnlocked: !!item.isUnlocked,
                isMaxed: !!item.isMaxed
            })) : []
        };
    }

    normalizeDrawResult(item) {
        return {
            cardId: item.cardId,
            cardName: item.cardName,
            imageUrl: item.imageUrl || './牛客娘/笑.png',
            rarity: this.rarityCodeToLabel(item.rarity),
            isNew: !!item.isNew,
            convertedToFragment: !!item.convertedToFragment,
            fragmentRarity: item.fragmentRarity || 0,
            fragmentCount: item.fragmentCount || 0
        };
    }

    rarityCodeToLabel(code) {
        switch (Number(code || 0)) {
            case 1: return 'N';
            case 2: return 'R';
            case 3: return 'SR';
            case 4: return 'SSR';
            case 5: return 'UR';
            default: return 'LOCKED';
        }
    }

    getCardLevelText(card) {
        const level = this.getCardLevel(card);
        if (card.isMaxed || level >= 625) {
            return `lv ${level} max`;
        }
        return `lv ${level}`;
    }

    getCardLevel(card) {
        const effectiveCopyCount = Math.max(0, Number(card.effectiveCopyCount || card.obtainedTotalCount || 0));
        const initialRarity = Math.max(1, Number(card.initialRarity || 1));
        const initialWeight = Math.pow(5, initialRarity - 1);
        return Math.min(625, effectiveCopyCount * initialWeight);
    }

    buildOverviewFromMock() {
        const albums = this.mockData.albums.map(album => ({
            code: album.code,
            name: album.name,
            subtitle: album.subtitle,
            coverImage: album.cards.find(card => card.unlocked)?.image || album.cards[0]?.image || './牛客娘/笑.png',
            collected: album.cards.filter(card => card.unlocked).length,
            total: album.cards.length,
            maxed: album.cards.filter(card => card.maxed).length
        }));
        const total = albums.reduce((sum, item) => sum + item.total, 0);
        const collected = albums.reduce((sum, item) => sum + item.collected, 0);
        const maxed = albums.reduce((sum, item) => sum + item.maxed, 0);
        return {
            system: {
                name: this.mockData.system.name,
                subtitle: this.mockData.system.subtitle,
                tickets: this.mockData.system.tickets,
                pityTen: this.mockData.system.pityTen,
                pityHundred: this.mockData.system.pityHundred,
                fragments: {
                    n: this.mockData.system.fragments.N,
                    r: this.mockData.system.fragments.R,
                    sr: this.mockData.system.fragments.SR,
                    ssr: this.mockData.system.fragments.SSR,
                    ur: this.mockData.system.fragments.UR
                },
                collected,
                total,
                maxed
            },
            albums
        };
    }

    getMockAlbumDetail(albumCode) {
        const album = this.mockData.albums.find(item => item.code === albumCode);
        if (!album) return null;
        return {
            albumCode: album.code,
            albumName: album.name,
            albumSubtitle: album.subtitle,
            rewardCollect: album.rewardCollect,
            rewardFullUr: album.rewardFullUr,
            collectedCount: album.cards.filter(card => card.unlocked).length,
            totalCount: album.cards.length,
            maxedCount: album.cards.filter(card => card.maxed).length,
            cards: album.cards.map(card => ({
                cardId: card.code,
                cardCode: card.code,
                cardName: card.name,
                albumCode: card.albumCode,
                albumName: album.name,
                initialRarity: this.labelToRarityCode(card.initialRarity),
                currentRarity: this.labelToRarityCode(card.currentRarity),
                imageUrl: card.image,
                isUnlocked: !!card.unlocked,
                isMaxed: !!card.maxed,
                progressCount: card.maxed ? 0 : card.owned,
                progressNeed: card.maxed ? 0 : card.required,
                effectiveCopyCount: card.owned,
                obtainedTotalCount: card.owned
            }))
        };
    }

    labelToRarityCode(label) {
        return { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 }[String(label || '').toUpperCase()] || 0;
    }

    buildConfiguredAlbumPlaceholders() {
        return Object.entries(CARD_PRESENTATION_CONFIG.albums)
            .filter(([code]) => code !== 'default')
            .map(([code, cfg]) => ({
                code,
                name: cfg.name || code,
                subtitle: cfg.subtitle || CARD_PRESENTATION_CONFIG.albums.default.subtitle,
                coverImage: cfg.coverImage || './牛客娘/笑.png',
                collected: 0,
                total: Number(cfg.expectedTotal || 0),
                maxed: 0
            }));
    }

    normalizeConfigText(value) {
        const text = String(value == null ? '' : value).trim();
        if (!text || text === '待配置') return '';
        return text;
    }

    escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    buildMockData() {
        const images = [
            './牛客娘/笑.png',
            './牛客娘/自信.png',
            './牛客娘/打气.png',
            './牛客娘/码字.png',
            './牛客娘/脸红.png',
            './牛客娘/哭.png',
            './牛客娘/面无表情.png'
        ];
        const makeCard = (albumCode, idx, name, initialRarity, currentRarity, owned, required, image, unlocked = true) => ({
            code: `${albumCode}_${idx}`,
            name,
            albumCode,
            image,
            initialRarity,
            currentRarity,
            owned,
            required,
            unlocked,
            maxed: currentRarity === 'UR' && owned >= required
        });
        return {
            system: {
                name: '牛客娘卡册',
                subtitle: '做题、对战、打卡，都会慢慢变成一张张会发光的收藏。',
                tickets: 128,
                pityTen: 7,
                pityHundred: 64,
                fragments: { N: 22, R: 11, SR: 4, SSR: 1, UR: 0 }
            },
            albums: [
                {
                    code: 'saichang_kuangxiangqu',
                    name: '赛场狂想曲',
                    subtitle: '灯牌亮起，倒计时归零。把那些解出题目的瞬间，收进这本热闹的赛场纪念册。',
                    rewardCollect: '',
                    rewardFullUr: '',
                    cards: [
                        makeCard('saichang_kuangxiangqu', 1, '微笑日报', 'N', 'R', 4, 5, images[0], true),
                        makeCard('saichang_kuangxiangqu', 2, '午后码字', 'N', 'N', 3, 5, images[3], true),
                        makeCard('saichang_kuangxiangqu', 3, '脸红鼓励', 'R', 'SR', 1, 5, images[4], true),
                        makeCard('saichang_kuangxiangqu', 4, '打气瞬间', 'R', 'R', 2, 5, images[2], true),
                        makeCard('saichang_kuangxiangqu', 5, '面无表情审题', 'SR', 'SR', 1, 5, images[6], true),
                        makeCard('saichang_kuangxiangqu', 6, '自信出击', 'SR', 'SSR', 3, 5, images[1], true),
                        makeCard('saichang_kuangxiangqu', 7, '夜读落泪', 'N', 'N', 0, 5, images[5], false),
                        makeCard('saichang_kuangxiangqu', 8, '清晨第一题', 'N', 'N', 1, 5, images[0], true),
                        makeCard('saichang_kuangxiangqu', 9, '满分反馈', 'SSR', 'SSR', 2, 5, images[1], true),
                        makeCard('saichang_kuangxiangqu', 10, '晨星祝福', 'UR', 'UR', 1, 1, images[2], true),
                        makeCard('saichang_kuangxiangqu', 11, '赛点回响', 'R', 'R', 1, 5, images[4], true),
                        makeCard('saichang_kuangxiangqu', 12, '终局宣言', 'SR', 'SR', 0, 5, images[6], false)
                    ]
                }
            ]
        };
    }

    hide() {
        this.closeDrawOverlay();
        this.closeFragmentShop();
        this.closeCardPreview();
        this.closeProbabilityOverlay();
        this.closeFragmentConfirm();
        const section = document.getElementById('cards');
        if (section) section.classList.remove('active');
    }
}
