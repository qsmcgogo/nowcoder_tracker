package com.wenyibi.futuremail.dao.tracker;

import net.paoding.rose.jade.annotation.DAO;
import net.paoding.rose.jade.annotation.ReturnGeneratedKeys;
import net.paoding.rose.jade.annotation.SQL;
import net.paoding.rose.jade.annotation.SQLParam;

import java.util.Map;
import java.util.List;
import com.wenyibi.futuremail.model.tracker.TrackerBadgeRecord;

/**
 * 成就数据访问层
 * @author qsmcgogo
 * @date 2025-10-27
 */
@DAO
public interface TrackerBadgeRecordDAO {

    String BADGE_TABLE = " tracker_badge ";
    String BADGE_FIELDS = " id, name, color_url, gray_url, score, acquirement, detail, type, create_time, update_time ";
    String TABLE = " tracker_badge_record ";
    String INSERT_FIELDS = " user_id, badge_id, badge_type, create_time, update_time ";
    String SELECT_FIELDS = " id, user_id, badge_id, badge_type, create_time, update_time ";

    @SQL("INSERT INTO " + TABLE + " (" + INSERT_FIELDS + ") VALUES (:userId, :badgeId, :badgeType, NOW(), NOW())")
    @ReturnGeneratedKeys
    long insert(@SQLParam("userId") long userId, @SQLParam("badgeId") long badgeId, @SQLParam("badgeType") int badgeType);

    @SQL("SELECT " + SELECT_FIELDS + " FROM " + TABLE + " WHERE user_id = :userId AND badge_id = :badgeId LIMIT 1")
    TrackerBadgeRecord getByUserIdAndBadgeId(@SQLParam("userId") long userId, @SQLParam("badgeId") long badgeId);

    //查询用户是否拥有某成就
    @SQL("SELECT COUNT(1) FROM " + TABLE + " WHERE user_id = :userId AND badge_id = :badgeId")
    int countByUserIdAndBadgeId(@SQLParam("userId") long userId, @SQLParam("badgeId") long badgeId);

    //查询用户是否拥有某类成就
    @SQL("SELECT COUNT(1) FROM " + TABLE + " WHERE user_id = :userId AND badge_type = :badgeType")
    int countByUserIdAndBadgeType(@SQLParam("userId") long userId, @SQLParam("badgeType") int badgeType);

    //计算用户所有成就的分值之和
    @SQL("SELECT SUM(score) FROM " + BADGE_TABLE + " WHERE id IN (SELECT badge_id FROM " + TABLE + " WHERE user_id = :userId)")
    Integer sumScoreByUserId(@SQLParam("userId") long userId);

    //查询用户最近获得的5条成就
    @SQL("SELECT " + SELECT_FIELDS + " FROM " + TABLE + " WHERE user_id = :userId ORDER BY create_time DESC LIMIT 5")
    List<TrackerBadgeRecord> listByUserIdOrderByCreateTimeDesc(@SQLParam("userId") long userId);

    //查询用户达成的某些类的所有成就
    @SQL("SELECT badge_id," + SELECT_FIELDS + " FROM " + TABLE + " WHERE user_id = :userId AND badge_type IN (:badgeTypes) order by badge_id")
    Map<Integer, TrackerBadgeRecord> listByUserIdAndBadgeType(@SQLParam("userId") long userId, @SQLParam("badgeTypes") List<Integer> badgeTypes);


}
