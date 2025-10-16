// 卡片生成组件
import { APP_CONFIG } from '../config.js';
import { loadImage } from '../utils/helpers.js';

/**
 * 用户卡片生成器
 */
export class CardGenerator {
    constructor(channelPut = 'w251acm') {
        this.channelPut = channelPut;
    }

    /**
     * 生成单人卡片
     * @param {object} user - 用户数据
     * @returns {Promise<string>} 卡片图片的Data URL
     */
    async drawSingleCard(user) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        const width = 500;
        const height = 220;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        // Background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        // Gradient Header
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#283E51');
        gradient.addColorStop(1, '#4B79A1');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, 80);

        // Load and draw avatar
        const avatarSize = 90;
        const avatarUrl = user.headUrl.startsWith('http') 
            ? user.headUrl 
            : `${APP_CONFIG.NOWCODER_UI_BASE}${user.headUrl}`;
        const proxiedAvatarUrl = `/avatar-proxy?url=${encodeURIComponent(avatarUrl)}`;
        
        try {
            const avatarImg = await loadImage(proxiedAvatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarSize / 2 + 30, 80, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImg, 30, 80 - avatarSize / 2, avatarSize, avatarSize);
            ctx.restore();
        } catch (error) {
            console.error("Could not load avatar, using placeholder.", error);
            ctx.fillStyle = '#ccc';
            ctx.beginPath();
            ctx.arc(avatarSize / 2 + 30, 80, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.fill();
        }

        // User Name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText(user.name, avatarSize + 50, 55);

        // Stats
        const acCount = user.count || 0;
        const rank = user.place === 0 || String(user.place).includes('w') ? '1w+' : user.place;

        ctx.fillStyle = '#333333';
        ctx.font = '20px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('刷题数', 50, 160);
        ctx.fillText('全站排名', width / 2 + 40, 160);

        ctx.fillStyle = '#007BFF';
        ctx.font = 'bold 32px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText(acCount, 50, 195);
        ctx.fillText(rank, width / 2 + 40, 195);

        return canvas.toDataURL('image/png');
    }

    /**
     * 生成对比卡片
     * @param {object} user1 - 用户1数据
     * @param {object} user2 - 用户2数据
     * @returns {Promise<string>} 卡片图片的Data URL
     */
    async drawComparisonCard(user1, user2) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        const width = 700;
        const height = 330;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        // Background with rounded corners
        const cornerRadius = 30;
        ctx.beginPath();
        ctx.moveTo(cornerRadius, 0);
        ctx.lineTo(width - cornerRadius, 0);
        ctx.arcTo(width, 0, width, cornerRadius, cornerRadius);
        ctx.lineTo(width, height - cornerRadius);
        ctx.arcTo(width, height, width - cornerRadius, height, cornerRadius);
        ctx.lineTo(cornerRadius, height);
        ctx.arcTo(0, height, 0, height - cornerRadius, cornerRadius);
        ctx.lineTo(0, cornerRadius);
        ctx.arcTo(0, 0, cornerRadius, 0, cornerRadius);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#302b63');
        gradient.addColorStop(1, '#24243e');
        ctx.fillStyle = gradient;
        ctx.fill();

        // VS Text in the middle
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.font = "bold 60px 'Helvetica Neue', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("VS", width / 2, height / 2);
        
        // Draw User 1 (Left)
        await this.drawUserSegment(ctx, user1, 'left', width, height, user1, user2);

        // Draw User 2 (Right)
        await this.drawUserSegment(ctx, user2, 'right', width, height, user1, user2);

        return canvas.toDataURL('image/png');
    }

    /**
     * 绘制用户段（对比卡片中的单个用户）
     * @private
     */
    async drawUserSegment(ctx, user, position, cardWidth, cardHeight, user1, user2) {
        const isLeft = position === 'left';
        const xOffset = isLeft ? 0 : cardWidth / 2;
        const textAlign = isLeft ? 'left' : 'right';
        const avatarX = isLeft ? 30 : cardWidth - 30 - 80;

        // Avatar
        const avatarSize = 80;
        const avatarUrl = user.headUrl.startsWith('http') 
            ? user.headUrl 
            : `${APP_CONFIG.NOWCODER_UI_BASE}${user.headUrl}`;
        const proxiedAvatarUrl = `/avatar-proxy?url=${encodeURIComponent(avatarUrl)}`;
        
        try {
            const avatarImg = await loadImage(proxiedAvatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, 60, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.strokeStyle = "white";
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.clip();
            ctx.drawImage(avatarImg, avatarX, 60 - avatarSize / 2, avatarSize, avatarSize);
            ctx.restore();
        } catch (error) {
            ctx.fillStyle = '#ccc';
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, 60, avatarSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Name
        ctx.fillStyle = "white";
        ctx.font = 'bold 24px "Helvetica Neue", Arial, sans-serif';
        ctx.textAlign = textAlign;
        const nameX = isLeft ? 30 : cardWidth - 30;
        ctx.fillText(user.name, nameX, 140);
        
        // Stats
        const acCount = user.count || 0;
        const rank = user.place === 0 || String(user.place).includes('w') ? '1w+' : user.place;
        
        const statsY = 190;
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.font = '18px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('刷题数', nameX, statsY);
        ctx.fillText('全站排名', nameX, statsY + 50);

        ctx.font = 'bold 28px "Helvetica Neue", Arial, sans-serif';

        // 比较刷题数
        if (user === user1) {
            ctx.fillStyle = user1.count >= user2.count ? '#76FF03' : '#FF5252';
            ctx.fillText(acCount, nameX, statsY + 25);

            // 比较排名（排名越小越好）
            const user1Rank = parseInt(String(user1.place).replace('w+', '10001'), 10) || 10001;
            const user2Rank = parseInt(String(user2.place).replace('w+', '10001'), 10) || 10001;
            ctx.fillStyle = user1Rank <= user2Rank ? '#76FF03' : '#FF5252';
            if (user1.place === 0 && user2.place !== 0) ctx.fillStyle = '#FF5252';
            if (user2.place === 0 && user1.place !== 0) ctx.fillStyle = '#76FF03';

            ctx.fillText(rank, nameX, statsY + 75);
        } else {
            ctx.fillStyle = user2.count >= user1.count ? '#76FF03' : '#FF5252';
            ctx.fillText(acCount, nameX, statsY + 25);

            const user1Rank = parseInt(String(user1.place).replace('w+', '10001'), 10) || 10001;
            const user2Rank = parseInt(String(user2.place).replace('w+', '10001'), 10) || 10001;
            ctx.fillStyle = user2Rank <= user1Rank ? '#76FF03' : '#FF5252';
            if (user2.place === 0 && user1.place !== 0) ctx.fillStyle = '#FF5252';
            if (user1.place === 0 && user2.place !== 0) ctx.fillStyle = '#76FF03';

            ctx.fillText(rank, nameX, statsY + 75);
        }
    }
}

