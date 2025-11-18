package com.wenyibi.futuremail.dao.tracker;

import net.paoding.rose.jade.annotation.DAO;
import net.paoding.rose.jade.annotation.ReturnGeneratedKeys;
import net.paoding.rose.jade.annotation.SQL;
import net.paoding.rose.jade.annotation.SQLParam;

import java.util.Map;
import com.wenyibi.futuremail.model.tracker.TrackerBadge;

import java.util.List;

/**
 * 
 * 成就数据访问层
 * @author qsmcgogo
 * @date 2025-10-27
 */
@DAO
public interface TrackerBadgeDAO {
    String TABLE = " tracker_badge ";
    String fields= " id, name, color_url, gray_url, score, acquirement, detail, type, create_time, update_time ";

    //查询一些类型的所有成就信息
    @SQL("SELECT " + fields + " FROM " + TABLE + " WHERE type in (:1)")
    List<TrackerBadge> listByTypeList(List<Integer> typeList);

    //查询成就信息
    @SQL("SELECT " + fields + " FROM " + TABLE + " WHERE id = :1")
    TrackerBadge getById(long id);

    //查询成就信息列表
    @SQL("SELECT id," + fields + " FROM " + TABLE + " WHERE id in (:1)")
    Map<Long,TrackerBadge> listByIdList(List<Long> idList);
}
