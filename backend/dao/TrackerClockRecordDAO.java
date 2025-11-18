package com.wenyibi.futuremail.dao.question;

import com.wenyibi.futuremail.model.question.TrackerClockQuestion;
import com.wenyibi.futuremail.model.question.TrackerClockRecord;

import net.paoding.rose.jade.annotation.DAO;
import net.paoding.rose.jade.annotation.ReturnGeneratedKeys;
import net.paoding.rose.jade.annotation.SQL;
import net.paoding.rose.jade.annotation.SQLParam;

import java.util.Date;
import java.util.List;

@DAO
public interface TrackerClockRecordDAO {

  String name = " tracker_clock_record ";
  String insert_field = " user_id, question_id, create_time, update_time ";
  String select_field = " id, " + insert_field;

  @SQL("INSERT INTO " + name + " (user_id, question_id, create_time, update_time) VALUES (:userId, :questionId, NOW(), NOW())")
  @ReturnGeneratedKeys
  long insert(@SQLParam("userId") long userId, @SQLParam("questionId") long questionId);

  @SQL("SELECT " + select_field + " FROM " + name + " WHERE user_id = :1 AND DATE(create_time) = CURDATE() ORDER BY id DESC LIMIT 1")
  TrackerClockRecord getByUserIdToday(long userId);

  @SQL("SELECT create_time FROM " + name + " WHERE user_id = :1 AND create_time BETWEEN :2 AND :3 ORDER BY create_time")
  List<Date> listByUserIdAndMonth(long userId, Date beginTime, Date endTime);

  // 新增方法：访问track_clock_question表，获取当天的question_id
  @SQL("SELECT question_id, problem_id ,share_link FROM track_clock_question WHERE DATE(create_time) = CURDATE() LIMIT 1")
  TrackerClockQuestion getTrackerQuestionIdToday();

  @SQL("SELECT question_id, problem_id ,share_link FROM track_clock_question WHERE create_time >= :1 AND create_time < DATE_ADD(:1, INTERVAL 1 DAY) LIMIT 1")
  TrackerClockQuestion getTrackerQuestionIdByDate(Date date);

  @SQL("SELECT " + select_field + " FROM " + name + " WHERE user_id = :1 AND DATE(create_time) < CURDATE() ORDER BY id DESC LIMIT 1")
  TrackerClockRecord getByUserIdBeforeToday(long userId);

  // 新增方法：访问track_clock_question表，获取某个月的question_id
  @SQL("SELECT question_id, problem_id,create_time,share_link FROM track_clock_question WHERE create_time BETWEEN :1 AND :2 and create_time <= CURDATE() ORDER BY create_time")
  List<TrackerClockQuestion> getTrackerQuestionIdMonth(Date beginTime, Date endTime);

  // 查询当天打卡人数
  @SQL("SELECT COUNT(DISTINCT user_id) FROM " + name + " WHERE DATE(create_time) = CURDATE()")
  int getTodayClockCount();

  // 查询用户今天第几个打卡
  @SQL("SELECT COUNT(1) FROM " + name + " " +
     "WHERE DATE(create_time) = CURDATE() " +
     "AND create_time <= (" +
     "  SELECT MIN(create_time) FROM " + name + " " +
     "  WHERE user_id = :1 AND DATE(create_time) = CURDATE()" +
     ")")
  int getTodayClockRank(long userId);

  // 查询用户昨天是否打卡
  @SQL("SELECT COUNT(1) FROM " + name + " WHERE user_id = :1 AND DATE(create_time) = CURDATE() - INTERVAL 1 DAY")
  int getYesterdayClockCount(long userId);

  // 批量：返回今天已打卡的用户ID（去重）
  @SQL("SELECT DISTINCT user_id FROM " + name + " WHERE DATE(create_time) = CURDATE() AND user_id IN (:1)")
  List<Long> listTodayCheckedUserIds(List<Long> userIds);

  // 批量：统计今天已打卡人数（限定在给定的用户ID集合）
  @SQL("SELECT COUNT(DISTINCT user_id) FROM " + name + " WHERE DATE(create_time) = CURDATE() AND user_id IN (:1)")
  int countTodayClockByUserIds(List<Long> userIds);

  /**
   * 批量统计近7日（含今日，窗口为 [今日0点-6天, 今日24点)）每个用户的打卡天数
   * 返回 Map<user_id, days>
   */
  @SQL("SELECT user_id, COUNT(DISTINCT DATE(create_time)) FROM " + name +
      " WHERE create_time >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) " +
      " AND create_time < DATE_ADD(CURDATE(), INTERVAL 1 DAY) " +
      " AND user_id IN (:1) GROUP BY user_id")
  java.util.Map<Long, Integer> countSevenDaysClockByUserIds(List<Long> userIds);


  @SQL("UPDATE track_clock_question SET share_link = :1 WHERE create_time >= :2 AND create_time < DATE_ADD(:2, INTERVAL 1 DAY)")
  int updateShareLink(String shareLink, Date date);
}
