package com.wenyibi.futuremail.service.question;

import com.wenyibi.futuremail.dao.question.TrackerClockRecordDAO;
import com.wenyibi.futuremail.model.question.TrackerClockQuestion;
import com.wenyibi.futuremail.model.question.TrackerClockRecord;

import org.apache.log4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Date;
import java.util.List;

/**
 * TrackerClockRecord 的服务类
 */
@Service
public class TrackerClockRecordSerice {

  private static final Logger logger = Logger.getLogger(TrackerClockRecordSerice.class);

  @Autowired
  private TrackerClockRecordDAO trackerClockRecordDAO;

  /**
   * 新增一条打卡记录
   */
  public long insert(long userId, long questionId) {
    if (userId <= 0 || questionId <= 0) {
      return 0L;
    }
    try {
      return trackerClockRecordDAO.insert(userId, questionId);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#insert error, userId=" + userId + ", questionId=" + questionId, e);
      return 0L;
    }
  }

  /**
   * 获取用户当天最新的打卡记录
   */
  public TrackerClockRecord getByUserIdToday(long userId) {
    if (userId <= 0) {
      return null;
    }
    try {
      return trackerClockRecordDAO.getByUserIdToday(userId);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#getByUserIdToday error, userId=" + userId, e);
      return null;
    }
  }

  public TrackerClockQuestion getTrackerQuestionIdByDate(Date date) {
    try {
    return trackerClockRecordDAO.getTrackerQuestionIdByDate(date);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#getTrackerQuestionIdByDate error, date=" + date, e);
      return null;
    }
  }
  /**
   * 获取某用户在指定月份区间内的打卡时间列表 
   */
  public List<Date> listByUserIdAndMonth(long userId, Date beginTime, Date endTime) {
    if (userId <= 0 || beginTime == null || endTime == null) {
      return Collections.emptyList();
    }
    try {
      return trackerClockRecordDAO.listByUserIdAndMonth(userId, beginTime, endTime);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#listByUserIdAndMonth error, userId=" + userId
          + ", beginTime=" + beginTime + ", endTime=" + endTime, e);
      return Collections.emptyList();
    }
  }

  /**
   * 获取当天的打卡题目 questionId（来自 track_clock_question 表）
   */
  public TrackerClockQuestion getTrackerQuestionIdToday() {
    try{
      TrackerClockQuestion trackerClockQuestion = trackerClockRecordDAO.getTrackerQuestionIdToday();
      return trackerClockQuestion;
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#getTrackerQuestionIdToday error", e);
      return null;
    }
  }
  /*
   * 获取指定月份的打卡题目
   */
  public List<TrackerClockQuestion> getTrackerQuestionIdMonth(Date beginTime, Date endTime) {
    try{
      List<TrackerClockQuestion> trackerClockQuestions = trackerClockRecordDAO.getTrackerQuestionIdMonth(beginTime, endTime);
      return trackerClockQuestions;
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#getTrackerQuestionIdMonth error, beginTime=" + beginTime + ", endTime=" + endTime, e);
      return Collections.emptyList();
    }
  }
// /**
//    * 获取某一天的打卡题目 questionId（来自 track_clock_question 表）
//    */
//   public TrackerClockQuestion getTrackerQuestionIdDay() {
//     try{
//       TrackerClockQuestion trackerClockQuestion = trackerClockRecordDAO.getTrackerQuestionIdToday();
//       return trackerClockQuestion;
//     } catch (Exception e) {
//       logger.error("TrackerClockRecordSerice#getTrackerQuestionIdToday error", e);
//       return null;
//     }
//   }


  public TrackerClockRecord getByUserIdBeforeToday(long userId) {
    if (userId <= 0) {
      return null;
    }
    try {
      return trackerClockRecordDAO.getByUserIdBeforeToday(userId);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#getByUserIdBeforeToday error, userId=" + userId, e);
      return null;
    }
  }

  public int getTodayClockCount() {
    try {
      return trackerClockRecordDAO.getTodayClockCount();
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#getTodayClockCount error", e);
      return 0;
    }
  }

  public int getTodayClockRank(long userId) {
    try {
      return trackerClockRecordDAO.getTodayClockRank(userId);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#getTodayClockRank error, userId=" + userId, e);
      return 0;
    }
  }

  public int getYesterdayClockCount(long userId) {
    try {
      return trackerClockRecordDAO.getYesterdayClockCount(userId);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#getYesterdayClockCount error, userId=" + userId, e);
      return 0;
    }
  }

  /**
   * 批量查询：给定用户ID集合，返回今天已打卡的用户ID列表（去重）
   */
  public List<Long> listTodayCheckedUserIds(List<Long> userIds) {
    if (userIds == null || userIds.isEmpty()) {
      return Collections.emptyList();
    }
    try {
      return trackerClockRecordDAO.listTodayCheckedUserIds(userIds);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#listTodayCheckedUserIds error, userIds size=" + userIds.size(), e);
      return Collections.emptyList();
    }
  }

  /**
   * 批量统计：给定用户ID集合，统计今天已打卡人数（去重）
   */
  public int countTodayClockByUserIds(List<Long> userIds) {
    if (userIds == null || userIds.isEmpty()) {
      return 0;
    }
    try {
      return trackerClockRecordDAO.countTodayClockByUserIds(userIds);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#countTodayClockByUserIds error, userIds size=" + userIds.size(), e);
      return 0;
    }
  }

  /**
   * 批量统计：给定用户ID集合，统计近7日（含今日）的打卡天数
   */
  public java.util.Map<Long, Integer> countSevenDaysClockByUserIds(List<Long> userIds) {
    if (userIds == null || userIds.isEmpty()) {
      return java.util.Collections.emptyMap();
    }
    try {
      return trackerClockRecordDAO.countSevenDaysClockByUserIds(userIds);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#countSevenDaysClockByUserIds error, userIds size=" + userIds.size(), e);
      return java.util.Collections.emptyMap();
    }
  }

  public int updateShareLink(String shareLink, Date date) {
    try {
      return trackerClockRecordDAO.updateShareLink(shareLink, date);
    } catch (Exception e) {
      logger.error("TrackerClockRecordSerice#updateShareLink error, shareLink=" + shareLink + ", date=" + date, e);
      return 0;
    }
  }
}