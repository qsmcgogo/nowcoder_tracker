package com.wenyibi.futuremail.service.tracker.badge;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

import com.wenyibi.futuremail.dao.tracker.TrackerBadgeRecordDAO;
import com.wenyibi.futuremail.model.tracker.TrackerBadgeRecord;


import org.springframework.beans.factory.annotation.Autowired;
@Service
public class TrackerBadgeRecordSevice {

    @Autowired
    private TrackerBadgeRecordDAO trackerBadgeRecordDAO;
    
    public void insert(long userId, long badgeId, int badgeType) {
        // 依赖表唯一键 (user_id, badge_id) 防重复，避免竞态
        // 优先尝试插入；如需更稳妥，可先查后插（当前简化为直接插入）
        try {
            trackerBadgeRecordDAO.insert(userId, badgeId, badgeType);
        } catch (Exception ignore) {
            // 插入失败（可能是唯一键冲突）时忽略
        }
    }

    public TrackerBadgeRecord getByUserIdAndBadgeId(long userId, long badgeId) {
        return trackerBadgeRecordDAO.getByUserIdAndBadgeId(userId, badgeId);
    }

    public int countByUserIdAndBadgeId(long userId, long badgeId) {
        return trackerBadgeRecordDAO.countByUserIdAndBadgeId(userId, badgeId);
    }

    public int countByUserIdAndBadgeType(long userId, int badgeType) {
        return trackerBadgeRecordDAO.countByUserIdAndBadgeType(userId, badgeType);
    }

    public int sumScoreByUserId(long userId) {
        Integer sum = trackerBadgeRecordDAO.sumScoreByUserId(userId);
        return sum == null ? 0 : sum;
    }

    public List<TrackerBadgeRecord> listByUserIdOrderByCreateTimeDesc(long userId) {
        return trackerBadgeRecordDAO.listByUserIdOrderByCreateTimeDesc(userId);
    }

    public Map<Integer, TrackerBadgeRecord> listByUserIdAndBadgeType(long userId, List<Integer> badgeTypes) {
        return trackerBadgeRecordDAO.listByUserIdAndBadgeType(userId, badgeTypes);
    }
}
