package com.wenyibi.futuremail.biz.tracker;

import java.util.Map;
import java.util.Date;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.google.common.collect.Maps;
import com.google.common.cache.LoadingCache;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.gson.JsonObject;
import com.wenyibi.futuremail.model.question.TrackerClockRecord;
import com.wenyibi.futuremail.service.question.TrackerClockRecordSerice;
import com.wenyibi.futuremail.service.tracker.badge.TrackerBadgeRecordSevice;
import com.wenyibi.futuremail.util.NcDateUtils;
import com.wenyibi.futuremail.model.tracker.TrackerBadgeTypeEnum;
import com.wenyibi.futuremail.service.tracker.badge.TrackerBadgeService;
import com.wenyibi.futuremail.model.tracker.TrackerBadge;
import com.alibaba.fastjson.JSONObject;
import com.wenyibi.futuremail.model.tracker.TrackerBadgeRecord;
import com.wenyibi.futuremail.ta.TaQuestionService;
import com.wenyibi.futuremail.service.CodingSubmissionService;
import com.wenyibi.futuremail.model.ta.TaQuestion;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import com.wenyibi.futuremail.service.acm.contest.ACMCodingSubmissionService;
import java.util.Collections;
import java.util.ArrayList;
import java.util.concurrent.TimeUnit;
@Component
public class TrackerBadgeBiz {
    
  @Autowired
  private TrackerBadgeRecordSevice trackerBadgeRecordSevice;
  @Autowired
  private TrackerBadgeService trackerBadgeService;
  @Autowired
  private TaQuestionService taQuestionService;
  @Autowired
  private CodingSubmissionService codingSubmissionService;

  // 阈值/规则占位：后续由 DB 配置驱动
  // 将映射方向调整为：天数(阈值) -> badgeId，便于在达到某个天数时 O(1) 判断是否存在成就
  private static final Map<Integer, Long> CUMULATIVE_DAY_TO_BADGE_ID = Maps.newHashMap();
  private static final Map<Integer, Long> CONSECUTIVE_DAY_TO_BADGE_ID = Maps.newHashMap();

  // 特殊成就规则
  private static final Map<Long, String> SPECIAL_RULES = Maps.newHashMap();

  // 打卡成就类型
  private static final int CHECKIN_CUMULATIVE_BADGE_TYPE = TrackerBadgeTypeEnum.CHECKIN_CUMULATIVE.getValue();
  private static final int CHECKIN_CONSECUTIVE_BADGE_TYPE = TrackerBadgeTypeEnum.CHECKIN_CONSECUTIVE.getValue();
  private static final int CHECKIN_SPECIAL_BADGE_TYPE = TrackerBadgeTypeEnum.CHECKIN_SPECIAL.getValue();
  
  static {
    // 累计：天数 -> badgeId
    CUMULATIVE_DAY_TO_BADGE_ID.put(1, 101L);
    CUMULATIVE_DAY_TO_BADGE_ID.put(3, 102L);
    CUMULATIVE_DAY_TO_BADGE_ID.put(10, 103L);
    CUMULATIVE_DAY_TO_BADGE_ID.put(20, 104L);
    CUMULATIVE_DAY_TO_BADGE_ID.put(50, 105L);
    CUMULATIVE_DAY_TO_BADGE_ID.put(100, 106L);
    CUMULATIVE_DAY_TO_BADGE_ID.put(200, 107L);
    CUMULATIVE_DAY_TO_BADGE_ID.put(500, 108L);
    CUMULATIVE_DAY_TO_BADGE_ID.put(1000, 109L);

    // 连续：天数 -> badgeId
    CONSECUTIVE_DAY_TO_BADGE_ID.put(3, 201L);
    CONSECUTIVE_DAY_TO_BADGE_ID.put(7, 202L);
    CONSECUTIVE_DAY_TO_BADGE_ID.put(30, 203L);
    CONSECUTIVE_DAY_TO_BADGE_ID.put(60, 204L);
    CONSECUTIVE_DAY_TO_BADGE_ID.put(180, 205L);
    CONSECUTIVE_DAY_TO_BADGE_ID.put(365, 206L);

    // 特殊
    SPECIAL_RULES.put(301L, "NIGHT_OWL");
    SPECIAL_RULES.put(302L, "EARLY_BIRD");
    SPECIAL_RULES.put(303L, "EFFICIENCY_MASTER");
    SPECIAL_RULES.put(304L, "FISRT_BLOOD");
  }

  @Autowired
  private TrackerClockRecordSerice trackerClockRecordSerice;
  @Autowired
  private ACMCodingSubmissionService acmCodingSubmissionService;
  /**
   * 插入所有打卡成就记录
   * @param userId
   * @param totalDays
   * @param continueDays
   * @param createTime
   */
  public void insertAllCheckinBadgeRecord(long userId,int totalDays,int continueDays,Date createTime) {
    for(int day : CUMULATIVE_DAY_TO_BADGE_ID.keySet()) {
      if(totalDays >= day) {
        Long badgeId = CUMULATIVE_DAY_TO_BADGE_ID.get(day);
        trackerBadgeRecordSevice.insert(userId, badgeId, CHECKIN_CUMULATIVE_BADGE_TYPE);
      }
    }
    for(int day : CONSECUTIVE_DAY_TO_BADGE_ID.keySet()) {
      if(continueDays >= day) {
        Long badgeId = CONSECUTIVE_DAY_TO_BADGE_ID.get(day);
        trackerBadgeRecordSevice.insert(userId, badgeId, CHECKIN_CONSECUTIVE_BADGE_TYPE);
      }
    }
    checkClockBadgeSpecialCondition(userId,createTime);

  }


  /**
   * 在累计天数达成时触发判定：天数 -> badgeId，命中则尝试写入记录
   */

  public void checkClockBadgeTotalCondition(long userId, int totalDays,int continueDays) {
    Long badgeId = CUMULATIVE_DAY_TO_BADGE_ID.get(totalDays);
    if (badgeId == null) {
      return;
    }
    // 判断 (user_id, badge_id) 是否已存在，若不存在则插入 tracker_badge_record
    trackerBadgeRecordSevice.insert(userId, badgeId, CHECKIN_CUMULATIVE_BADGE_TYPE);
    // type 可使用 TrackerBadgeTypeEnum.CHECKIN_CUMULATIVE.getValue()
  }

  /**
   * 在连续天数达成时触发判定：天数 -> badgeId，命中则尝试写入记录
   */
  public void checkClockBadgeContinueCondition(long userId,int totalDays, int continueDays) {
    Long badgeId = CONSECUTIVE_DAY_TO_BADGE_ID.get(continueDays);
    if (badgeId == null) {
      return;
    }
    // 判断 (user_id, badge_id) 是否已存在，若不存在则插入 tracker_badge_record
    
    trackerBadgeRecordSevice.insert(userId, badgeId, CHECKIN_CONSECUTIVE_BADGE_TYPE);
    // type 可使用 TrackerBadgeTypeEnum.CHECKIN_CONSECUTIVE.getValue()
  }

  public void checkClockBadgeSpecialCondition(long userId,Date createTime) {
    ZoneId zoneId = ZoneId.of("Asia/Shanghai");
    LocalDateTime ct = createTime.toInstant().atZone(zoneId).toLocalDateTime();
    int hour = ct.getHour();
    int minute = ct.getMinute();

    if(hour >= 23 || hour <= 3) {
      // 夜猫子成就
      trackerBadgeRecordSevice.insert(userId, 301L, CHECKIN_SPECIAL_BADGE_TYPE);
    }
    if(hour >= 5 && hour <= 9) {
      // 早鸟成就
      trackerBadgeRecordSevice.insert(userId, 302L, CHECKIN_SPECIAL_BADGE_TYPE);
    }
    if(hour == 0 && minute < 15) {
        TrackerClockRecord yesterdayRecord = trackerClockRecordSerice.getByUserIdBeforeToday(userId);
        if(yesterdayRecord != null) {
          Date yesterdayCreateTime = yesterdayRecord.getCreateTime();
          LocalDateTime yct = yesterdayCreateTime.toInstant().atZone(zoneId).toLocalDateTime();
          if(NcDateUtils.getDiffDay(yesterdayCreateTime, createTime) == 1 && yct.getHour() == 23 && yct.getMinute() >= 45) {
          // 效率为王成就
          trackerBadgeRecordSevice.insert(userId, 303L, CHECKIN_SPECIAL_BADGE_TYPE);
          }
        }
      
    }
  }

  //今日一血成就
  public void insertFirstCheckinBadgeRecord(long userId) {
    trackerBadgeRecordSevice.insert(userId, 304L, CHECKIN_SPECIAL_BADGE_TYPE);
  }

  /**
   * 根据类型列表查询所有成就信息
   * @param typeList
   * @return
  */
  
    public JSONObject listBadgeByTypeList(long userId, List<Integer> typeList) {
      if(typeList.isEmpty()) {
        return new JSONObject();
      }
      List<TrackerBadge> badgeList = trackerBadgeService.listByTypeList(typeList);
      //获得用户达成的这批list里的所有成就，并放入map中
      Map<Integer, TrackerBadgeRecord> badgeRecordMap = trackerBadgeRecordSevice.listByUserIdAndBadgeType(userId, typeList);

      
      JSONObject jsonObject = new JSONObject();
      for(TrackerBadge badge : badgeList) {
        JSONObject badgeInfo = new JSONObject();
        int status = badgeRecordMap.containsKey(badge.getId().intValue()) ? 1 : 0;
        badgeInfo.put("id", badge.getId());
        badgeInfo.put("name", badge.getName());
        badgeInfo.put("score", badge.getScore());
        // 现在图太丑了，暂时不放图片，以后有了图再说
        // badgeInfo.put("colorUrl", badge.getColorUrl());
        // badgeInfo.put("grayUrl", badge.getGrayUrl());
        badgeInfo.put("acquirement", badge.getAcquirement());
        badgeInfo.put("detail", badge.getDetail());
        badgeInfo.put("type", badge.getType());
        badgeInfo.put("status", status);
        if(status == 1) {
          TrackerBadgeRecord badgeRecord = badgeRecordMap.get(badge.getId().intValue());
          badgeInfo.put("finishedTime", badgeRecord.getCreateTime().getTime());
        }
        jsonObject.put(badge.getId().toString(), badgeInfo);
      }
      return jsonObject;
      
  }

  public JSONObject getUserTotalScore(long userId) {
    int totalScore = trackerBadgeRecordSevice.sumScoreByUserId(userId);
    JSONObject jsonObject = new JSONObject();
    jsonObject.put("totalScore", totalScore);
    return jsonObject;
  }

  public JSONObject getUserRecentBadge(long userId) {
    List<TrackerBadgeRecord> badgeRecordList = trackerBadgeRecordSevice.listByUserIdOrderByCreateTimeDesc(userId);
    List<Long> badgeIdList = badgeRecordList.stream().map(TrackerBadgeRecord::getBadgeId).collect(Collectors.toList());
    Map<Long,TrackerBadge> badgeMap = trackerBadgeService.listByIdList(badgeIdList);
    JSONObject jsonObject = new JSONObject();
    for(TrackerBadgeRecord badgeRecord : badgeRecordList) {
      JSONObject badgeInfo = new JSONObject();
      TrackerBadge trackerBadge = badgeMap.get(badgeRecord.getBadgeId());
      badgeInfo.put("id", trackerBadge.getId());
      badgeInfo.put("name", trackerBadge.getName());
      badgeInfo.put("score", trackerBadge.getScore());
      // 现在图太丑了，方神又不帮忙，暂时不放图片，以后有了图再说
      // badgeInfo.put("colorUrl", trackerBadge.getColorUrl());
      // badgeInfo.put("grayUrl", trackerBadge.getGrayUrl());
      badgeInfo.put("acquirement", trackerBadge.getAcquirement());
      badgeInfo.put("detail", trackerBadge.getDetail());
      badgeInfo.put("type", trackerBadge.getType());
      badgeInfo.put("status", badgeRecord.getBadgeType());
      badgeInfo.put("createTime", badgeRecord.getCreateTime());
      jsonObject.put(badgeRecord.getBadgeId().toString(), badgeInfo);

    }
    return jsonObject;
  }

  /*
   * 以下是牛客题目成就的实现
   */

   //通过题目哈希表
   private static final Map<Integer, Long> ACCEPT_CUMULATIVE_BADGE_ID = Maps.newHashMap();
   static {
    ACCEPT_CUMULATIVE_BADGE_ID.put(1, 401L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(5, 402L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(10, 403L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(20, 404L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(30, 405L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(50, 406L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(100, 407L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(150, 408L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(200, 409L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(300, 410L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(500, 411L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(1000, 412L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(2000, 413L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(3000, 414L);
    ACCEPT_CUMULATIVE_BADGE_ID.put(5000, 415L);
   }

   //通过题目成就类型
   public static final int ACCEPT_CUMULATIVE_BADGE_TYPE = TrackerBadgeTypeEnum.ACCEPT_CUMULATIVE.getValue();

  //新手130、算法入门、算法进阶、算法登峰的topicId
  public static final int NEWBIE130_TOPIC_ID = 383;
  public static final int ALGORITHM_INTRO_TOPIC_ID = 385;
  public static final int ALGORITHM_ADVANCED_TOPIC_ID = 386;
  public static final int ALGORITHM_PEAK_TOPIC_ID = 388;
  // 题单制霸对应的 badgeId 映射
  public static final long NEWBIE130_TOPIC_BADGE_ID = 451L;
  public static final long ALGORITHM_INTRO_TOPIC_BADGE_ID = 452L;
  public static final long ALGORITHM_ADVANCED_TOPIC_BADGE_ID = 453L;
  public static final long ALGORITHM_PEAK_TOPIC_BADGE_ID = 454L;
  // 题单ID -> badgeId 映射
  private static final Map<Integer, Long> TOPIC_TO_BADGE_ID = Maps.newHashMap();
  static {
    TOPIC_TO_BADGE_ID.put(NEWBIE130_TOPIC_ID, NEWBIE130_TOPIC_BADGE_ID);
    TOPIC_TO_BADGE_ID.put(ALGORITHM_INTRO_TOPIC_ID, ALGORITHM_INTRO_TOPIC_BADGE_ID);
    TOPIC_TO_BADGE_ID.put(ALGORITHM_ADVANCED_TOPIC_ID, ALGORITHM_ADVANCED_TOPIC_BADGE_ID);
    TOPIC_TO_BADGE_ID.put(ALGORITHM_PEAK_TOPIC_ID, ALGORITHM_PEAK_TOPIC_BADGE_ID);
  }

  // 题单 -> problemIdSet 缓存，减少 DB 调用
  private LoadingCache<Integer, Set<Long>> topicProblemIdCache;

  private Set<Long> getProblemIdSetByTopic(int topicId) {
    if (topicProblemIdCache == null) {
      topicProblemIdCache = CacheBuilder.newBuilder()
          .expireAfterWrite(6, TimeUnit.HOURS)
          .maximumSize(32)
          .build(new CacheLoader<Integer, Set<Long>>() {
            @Override
            public Set<Long> load(Integer key) {
              List<TaQuestion> questionList = taQuestionService.getQuestionsByTaId(key);
              if (questionList == null) {
                return Collections.emptySet();
              }
              return questionList.stream().map(TaQuestion::getCodingProblemId).collect(Collectors.toSet());
            }
          });
    }
    return topicProblemIdCache.getUnchecked(topicId);
  }

  //获取用户在该题单的主站submission和竞赛站submission的过题数量
  public int getUserAcceptCountByTopic(long userId, int topicId) {
    Set<Long> problemIdSet = getProblemIdSetByTopic(topicId);
    List<Long> problemIds = new ArrayList<>(problemIdSet);
    List<Long> acmAcceptProblemIds = acmCodingSubmissionService.getAllAccept(userId, problemIds);
    List<Long> webAcceptProblemIds = codingSubmissionService.getAllAccept(userId, problemIds);
    Set<Long> userAcceptProblemIds = new HashSet<>();
    userAcceptProblemIds.addAll(acmAcceptProblemIds);
    userAcceptProblemIds.addAll(webAcceptProblemIds);
    return userAcceptProblemIds.size();
  }

   //如果用户全部通过某题单，授予该题单制霸成就
  public void updateTopicBadge(long userId, long problemId, int topicId) {
    // 通过缓存获取题单的所有 problemId
    Set<Long> problemIdSet = getProblemIdSetByTopic(topicId);
    if (!problemIdSet.contains(problemId)) {
      return;
    }


    int count = getUserAcceptCountByTopic(userId, topicId);
    if (count != problemIdSet.size()) {
      return;
    }
    // 映射题单 -> 对应的 badgeId
    Long badgeIdObj = TOPIC_TO_BADGE_ID.get(topicId);
    if (badgeIdObj == null) {
      return;
    }
    long badgeId = badgeIdObj;
    trackerBadgeRecordSevice.insert(userId, badgeId, ACCEPT_CUMULATIVE_BADGE_TYPE);
  }

   //更新题目数量成就
   public void updateProblemBadge(long userId, int acceptCount,long problemId) {
    //先查询用户是否曾经拥有累计过题成就
    
    int count = trackerBadgeRecordSevice.countByUserIdAndBadgeType(userId, ACCEPT_CUMULATIVE_BADGE_TYPE);
    if(count == 0) {
      //一次性授予用户全部已达成成就
      for(int cnt : ACCEPT_CUMULATIVE_BADGE_ID.keySet()) {
        if(cnt < acceptCount) {
          trackerBadgeRecordSevice.insert(userId, ACCEPT_CUMULATIVE_BADGE_ID.get(cnt), ACCEPT_CUMULATIVE_BADGE_TYPE);
        }
      }
    }
    if(ACCEPT_CUMULATIVE_BADGE_ID.containsKey(acceptCount)) {
      trackerBadgeRecordSevice.insert(userId, ACCEPT_CUMULATIVE_BADGE_ID.get(acceptCount), ACCEPT_CUMULATIVE_BADGE_TYPE);
    }
    for (int topicId : TOPIC_TO_BADGE_ID.keySet()) {
      updateTopicBadge(userId, problemId, topicId);
    }


   }
}

