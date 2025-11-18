package com.wenyibi.futuremail.biz.questionrpc;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;

import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.wenyibi.futuremail.biz.coin.ProductOrderBiz;
import com.wenyibi.futuremail.biz.questionrpc.dto.ContestTracker;
import com.wenyibi.futuremail.cache.JedisAdapter;
import com.wenyibi.futuremail.enums.CodingSubmissionStatusEnum;
import com.wenyibi.futuremail.enums.QuestionType;
import com.wenyibi.futuremail.model.CodingProblem;
import com.wenyibi.futuremail.model.CodingProblemExt;
import com.wenyibi.futuremail.model.CodingSubmission;
import com.wenyibi.futuremail.model.User;
import com.wenyibi.futuremail.model.ViewObject;
import com.wenyibi.futuremail.model.acm.contest.ACMContestInfo;
import com.wenyibi.futuremail.model.acm.contest.ACMContestProblem;
import com.wenyibi.futuremail.model.activity.PATSet;
import com.wenyibi.futuremail.model.coin.ProductOrderTypeEnum;
import com.wenyibi.futuremail.model.paper.Paper;
import com.wenyibi.futuremail.model.question.Question;
import com.wenyibi.futuremail.model.question.QuestionRelation;
import com.wenyibi.futuremail.model.question.TrackerClockQuestion;
import com.wenyibi.futuremail.model.question.TrackerClockRecord;
import com.wenyibi.futuremail.model.question.TrackerTag;
import com.wenyibi.futuremail.model.question.TrackerTagQuestion;
import com.wenyibi.futuremail.model.question.TrackerTagUserRecord;
import com.wenyibi.futuremail.model.ta.TaQuestion;
import com.wenyibi.futuremail.rank.RankBoardType;
import com.wenyibi.futuremail.rank.commonranking.RedisBaseCommonRankingBoard;
import com.wenyibi.futuremail.ranking.rankingboard.user.RankingData;
import com.wenyibi.futuremail.service.CodingProblemExtService;
import com.wenyibi.futuremail.service.CodingProblemService;
import com.wenyibi.futuremail.service.CodingSubmissionService;
import com.wenyibi.futuremail.service.UserService;
import com.wenyibi.futuremail.service.acm.contest.ACMCodingSubmissionService;
import com.wenyibi.futuremail.service.acm.contest.ACMContestInfoService;
import com.wenyibi.futuremail.service.acm.contest.ACMContestProblemService;
import com.wenyibi.futuremail.service.acm.problem.ACMProblemOpenService;
import com.wenyibi.futuremail.service.paper.PaperService;
import com.wenyibi.futuremail.service.question.QuestionRelationService;
import com.wenyibi.futuremail.service.question.QuestionService;
import com.wenyibi.futuremail.service.question.TrackerClockRecordSerice;
import com.wenyibi.futuremail.service.question.CardImageService;
import com.wenyibi.futuremail.service.question.TrackerTagService;
import com.wenyibi.futuremail.service.tracker.badge.TrackerBadgeRecordSevice;
import com.wenyibi.futuremail.ta.TaQuestionService;
import com.wenyibi.futuremail.util.ConvertUtil;
import com.wenyibi.futuremail.util.NcDateUtils;
import com.wenyibi.futuremail.util.PagingUtils;
import com.wenyibi.futuremail.util.RedisKeyUtil;
import com.wenyibi.futuremail.biz.tracker.TrackerBadgeBiz;
import com.wenyibi.futuremail.model.tracker.TrackerStageEnum;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.compress.utils.Lists;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.math.NumberUtils;
import org.apache.commons.lang3.time.DateFormatUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.wenyibi.futuremail.model.tracker.TrackerBadgeTypeEnum;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import redis.clients.jedis.Tuple;

/**
 * @author:xiaoxiao
 * @date: 2025/9/23
 */
@Component
public class QuestionTrackerBiz {

  private static final Log logger = LogFactory.getLog(QuestionTrackerBiz.class);

  @Autowired
  private ACMContestInfoService acmContestInfoService;
  @Autowired
  private ACMContestProblemService acmContestProblemService;
  @Autowired
  private ACMCodingSubmissionService acmCodingSubmissionService;
  @Autowired
  private PaperService paperService;
  @Autowired
  private QuestionRelationService questionRelationService;
  @Autowired
  private CodingProblemService codingProblemService;
  @Autowired
  private CodingProblemExtService codingProblemExtService;
  @Autowired
  private QuestionService questionService;
  @Autowired
  private CodingSubmissionService codingSubmissionService;
  @Autowired
  private ACMProblemOpenService acmProblemOpenService;
  @Autowired
  private RedisBaseCommonRankingBoard redisBaseCommonRankingBoard;
  @Autowired
  private UserService userService;
  @Autowired
  private TrackerClockRecordSerice trackerClockRecordSerice;
  @Autowired
  private TaQuestionService taQuestionService;
  @Autowired
  private ProductOrderBiz productOrderBiz;
  @Autowired
  private CardImageService cardImageService;
  @Autowired
  private TrackerTagService trackerTagService;
  @Autowired
  private TrackerBadgeBiz trackerBadgeBiz;

  @Autowired
  private TrackerBadgeRecordSevice trackerBadgeRecordSevice;

  private static final int CHECKIN_CUMULATIVE_BADGE_TYPE = TrackerBadgeTypeEnum.CHECKIN_CUMULATIVE.getValue();

  private final LoadingCache<Integer, List<ContestTracker>> branchCache = CacheBuilder
          .newBuilder()
          .expireAfterWrite(6, TimeUnit.HOURS)
          .initialCapacity(10).concurrencyLevel(128)
          .build(new CacheLoader<Integer, List<ContestTracker>>() {
            @Override
            public List<ContestTracker> load(Integer contestType) {
              return detailList();
            }
          });

  //缓存"练习部分"包括：算法四部曲等的codingProblemId，目前这部分数据是固定在前端
  private final LoadingCache<Integer, List<Long>> exerciseQuestionCache = CacheBuilder
          .newBuilder()
          .expireAfterWrite(6, TimeUnit.HOURS)
          .initialCapacity(10).concurrencyLevel(128)
          .build(new CacheLoader<Integer, List<Long>>() {
            @Override
            public List<Long> load(Integer contestType) {
              return exerciseCodingProblemList();
            }
          });

  /** 用户指标缓存（1小时）：userId -> (acceptCount, submissionCount) */
  private final LoadingCache<Long, Pair<Integer, Integer>> trackerUserMetricsCache =
      CacheBuilder.newBuilder()
          .expireAfterWrite(1, TimeUnit.HOURS)
          .initialCapacity(2048)
          .concurrencyLevel(128)
          .maximumSize(100_000)
          .build(new CacheLoader<Long, Pair<Integer, Integer>>() {
            @Override
            public Pair<Integer, Integer> load(Long uid) {
              List<Long> ids = Collections.singletonList(uid);
              Map<Long, Integer> ac = getTrackerAcceptCountByUserIds(ids);
              Map<Long, Integer> sub = getTrackerSubmissionCountByUserIds(ids);
              return Pair.of(ac.getOrDefault(uid, 0), sub.getOrDefault(uid, 0));
            }

            @Override
            public Map<Long, Pair<Integer, Integer>> loadAll(Iterable<? extends Long> keys) {
              List<Long> ids = new ArrayList<>();
              for (Long k : keys) ids.add(k);
              if (ids.isEmpty()) return Collections.emptyMap();
              Map<Long, Integer> ac = getTrackerAcceptCountByUserIds(ids);
              Map<Long, Integer> sub = getTrackerSubmissionCountByUserIds(ids);
              Map<Long, Pair<Integer, Integer>> res = new HashMap<>();
              for (Long id : ids) {
                res.put(id, Pair.of(ac.getOrDefault(id, 0), sub.getOrDefault(id, 0)));
              }
              return res;
            }
          });

  private List<ContestTracker> getAllQuestion() {
    return branchCache.getUnchecked(0);
  }
  
  /**
   * 清除比赛列表缓存
   */
  public void clearContestCache() {
    branchCache.invalidateAll();
  }

  private List<Long> exerciseCodingProblemList() {
    List<Long> exerciseTaIds = Arrays.asList(383L,385L,386L,388L,389L,372L,196L,295L);
    return taQuestionService.getCodingProblemIdsByTaIds(exerciseTaIds);
  }

  public List<ContestTracker> getPaperBySubType(Integer subContestType, int page, int limit) {
    List<ContestTracker> all = getAllQuestion();
    if (subContestType == 100) {
      all = all.stream().filter(c -> c.getSubContestType() > 100).collect(Collectors.toList());
    } else if (subContestType != 0) {
      all = all.stream().filter(c -> c.getSubContestType() == subContestType).collect(Collectors.toList());
    }
    else {
      all = all.stream().filter(c -> c.getSubContestType() < 100).collect(Collectors.toList());
    }
    int from = (page - 1) * limit;
    if (from >= all.size()) {
      return Collections.emptyList();
    }
    int to = Math.min(all.size(), from + limit);
    return all.subList(from, to);
  }

  public int countPaperBySubType(Integer subContestType) {
    List<ContestTracker> all = getAllQuestion();
    if (subContestType == 100) {
      all = all.stream().filter(c -> c.getSubContestType() > 100).collect(Collectors.toList());
    } else if (subContestType != 0) {
      all = all.stream().filter(c -> c.getSubContestType() == subContestType).collect(Collectors.toList());
    }
    return CollectionUtils.size(all);
  }

  public Set<Long> getAllProblemIds() {
    //获取比赛题目
    List<ContestTracker> allContests = getAllQuestion();
    //获取练习题目
    List<Long> exerciseCodingProblemIds = exerciseQuestionCache.getUnchecked(0);
    //获取技能树题目
    List<Long> skillTreeProblemIds = trackerTagService.listAllProblemIds();
    // 返回HashSet
    Set<Long> problemIds = allContests.stream()
            .flatMap(c -> c.getQuestions().stream().map(ContestTracker.Question::getProblemId))
            .collect(Collectors.toCollection(HashSet::new));
    problemIds.addAll(exerciseCodingProblemIds);
    problemIds.addAll(skillTreeProblemIds);

    return problemIds;
  }

  private List<ContestTracker> detailList() {
    Map<Long, ContestTracker> contestMap = new LinkedHashMap<>();

    // 4.1 获取ACM比赛，具体见ACMCategoryTypeEnum
    List<ACMContestInfo> contestInfos = acmContestInfoService.getNameByCategoryIds(13, Arrays.asList(6, 9, 19, 2, 22,20,21));
    if (CollectionUtils.isNotEmpty(contestInfos)) {
      List<Long> contestIds = contestInfos.stream().map(ACMContestInfo::getId).collect(Collectors.toList());
      List<ACMContestProblem> contestProblems = acmContestProblemService.getListByContestIds(contestIds);
      Map<Long, List<ACMContestProblem>> contestId2Problems = contestProblems.stream()
              .collect(Collectors.groupingBy(ACMContestProblem::getContestId));
      for (ACMContestInfo info : contestInfos) {
        if(info.getCategoryId()==20 || info.getCategoryId()==21) {
          //如果settingInfoJson中needCharge为true，则不展示
          if(info.getSettingInfoJson() != null && info.getSettingInfoJson().getBooleanValue("needCharge")) {
            continue;
          }
        }
        ContestTracker ct = new ContestTracker();
        ct.setId(info.getId());
        ct.setContestName(info.getName());
        ct.setContestType(0);
        ct.setSubContestType(info.getCategoryId());
        ct.setBeginTime(info.getStartTime());
        ct.setContestUrl("https://ac.nowcoder.com/acm/contest/" + info.getId());
        List<ACMContestProblem> problems = contestId2Problems.getOrDefault(info.getId(), Collections.emptyList());
        fillQuestionsForContest(ct, problems, 0);
        contestMap.put(ct.getId(), ct);
      }
    }

    // 4.2 获取笔试真题试卷
    List<Paper> papers = paperService.getAllTrackerPaperList();
    if (CollectionUtils.isNotEmpty(papers)) {
      Map<Long, Integer> paperId2SubType = new HashMap<>();
      for (Paper p : papers) {
        int subType = parseSubContestTypeFromTags(p.getTags());
        if (subType > 0) {
          paperId2SubType.put(p.getId(), subType);
        }
      }
      List<Long> paperIds = new ArrayList<>(paperId2SubType.keySet());
      if (CollectionUtils.isNotEmpty(paperIds)) {
        // 先获取每个paperId对应的QuestionRelation列表
        Map<Long, List<QuestionRelation>> paperId2Relations =
                questionRelationService.getRelationsByPaperIdAndQuestionType(paperIds, QuestionType.CODE.getValue())
                        .stream().collect(Collectors.groupingBy(QuestionRelation::getPaperId));

        // 收集所有questionId
        List<Long> questionIds = paperId2Relations.values().stream()
                .flatMap(list -> list.stream().map(QuestionRelation::getQuestionId))
                .collect(Collectors.toList());

        // 获取questionId到problemId的映射
        Map<Long, Long> questionId2ProblemId = codingProblemService.getCodingQuestionId2IdByQuestionIds(questionIds);

        for (Paper p : papers) {
          if(!paperId2Relations.containsKey(p.getId())) {
            //不含有编程题
            continue;
          }
          Integer subType = paperId2SubType.getOrDefault(p.getId(), 0);
          ContestTracker ct = new ContestTracker();
          ct.setId(p.getId());
          ct.setContestName(p.getPaperName());
          ct.setContestType(1);
          ct.setSubContestType(subType);
          ct.setBeginTime(p.getBeginTime());
          ct.setContestUrl("https://www.nowcoder.com/exam/test/" + p.getId() + "/summary");

          List<Long> perPaperQuestionIds = paperId2Relations.get(p.getId()).stream().map(QuestionRelation::getQuestionId).collect(Collectors.toList());
          List<ACMContestProblem> perPaperProblems = perPaperQuestionIds.stream().map(qid -> {
            ACMContestProblem tmp = new ACMContestProblem();
            tmp.setQuestionId(qid);
            Long pid = questionId2ProblemId.get(qid);
            if (pid != null) tmp.setProblemId(pid);
            return tmp;
          }).collect(Collectors.toList());
          fillQuestionsForContest(ct, perPaperProblems, 1);
          contestMap.put(ct.getId(), ct);
        }
      }
    }

    //最后结果按照beginTime降序排序，然后返回
    List<ContestTracker> result = new ArrayList<>(contestMap.values());
    result.sort((a, b) -> b.getBeginTime().compareTo(a.getBeginTime()));
    return result;
  }

  private static final Map<Integer, String> SUB_CONTEST_TYPE_MAPPING = new HashMap<>();
  static {
    SUB_CONTEST_TYPE_MAPPING.put(179, "美团");
    SUB_CONTEST_TYPE_MAPPING.put(239, "华为");
    SUB_CONTEST_TYPE_MAPPING.put(665, "字节");
    SUB_CONTEST_TYPE_MAPPING.put(134, "阿里");
    SUB_CONTEST_TYPE_MAPPING.put(139, "百度");
    SUB_CONTEST_TYPE_MAPPING.put(151, "京东");
    SUB_CONTEST_TYPE_MAPPING.put(153, "携程");
    SUB_CONTEST_TYPE_MAPPING.put(931, "蚂蚁");
    SUB_CONTEST_TYPE_MAPPING.put(715, "小红书");
  }

  private int parseSubContestTypeFromTags(String tags) {
    if (StringUtils.isBlank(tags)) return 0;
    // tags are comma-separated chinese names with ids, e.g., "美团 179, 华为 239"
    List<Integer> tagIds = ConvertUtil.fromStringToList(tags);
    for (Integer tagId : tagIds) {
      if (SUB_CONTEST_TYPE_MAPPING.containsKey(tagId)) {
        return tagId;
      }
    }
    return 0;
  }

  private void fillQuestionsForContest(ContestTracker ct, List<ACMContestProblem> problems, int contestType) {
    if (CollectionUtils.isEmpty(problems)) {
      return;
    }
    List<Long> problemIds = problems.stream().map(ACMContestProblem::getProblemId).filter(id -> id > 0).collect(Collectors.toList());
    Map<Long, CodingProblemExt> problemId2Ext = Collections.emptyMap();
    Map<Long, Integer> acmDifficultyMaps = Collections.emptyMap();
    if (CollectionUtils.isNotEmpty(problemIds)) {
      List<CodingProblemExt> exts = codingProblemExtService.getExtByProblemIds(problemIds);
      problemId2Ext = exts.stream().collect(Collectors.toMap(CodingProblemExt::getProblemId, e -> e));
      if(contestType == 0) {
        //只有ac站的题目才查找acm表里的难度
        acmDifficultyMaps = acmProblemOpenService.getDifficultyMapByProblemIds(problemIds);
      }
    }

    List<Long> qIds = problems.stream().map(ACMContestProblem::getQuestionId).collect(Collectors.toList());
    List<Question> qList = questionService.getQuestionTagsAndDifficultyByLongIds(qIds);
    Map<Long, Question> qId2Q = qList.stream().collect(Collectors.toMap(Question::getId, q -> q));

    List<ContestTracker.Question> questionViews = new ArrayList<>();
    for (ACMContestProblem p : problems) {
      Question q = qId2Q.get(p.getQuestionId());
      if (q == null) continue;
      ContestTracker.Question v = new ContestTracker.Question();
      v.setId(q.getId());
      v.setProblemId(p.getProblemId());
      v.setTitle(q.getTitle());
      //题单id
      String tpId = contestType == 0 ? "391" : "182";
      v.setQuestionUrl("https://www.nowcoder.com/practice/" + q.getUuid() + "?tpId=" + tpId);
      v.setDifficulty(acmDifficultyMaps.containsKey(p.getProblemId()) ? acmDifficultyMaps.get(p.getProblemId()) : q.getDifficulty());
      CodingProblemExt ext = problemId2Ext.get(p.getProblemId());
      if (ext != null) {
        v.setSubmissionCount(ext.getSubmissionCount());
        v.setAcCount(ext.getAcceptCount());
      }
      questionViews.add(v);
    }
    ct.setQuestions(questionViews);
  }

  public int getAcceptCount(long userId, List<Long> problemIds) {
    List<Long> acmAcceptProblemIds = acmCodingSubmissionService.getAllAccept(userId, problemIds);
    List<Long> webAcceptProblemIds = codingSubmissionService.getAllAccept(userId, problemIds);
    Set<Long> userAcceptProblemIds = new HashSet<>();
    userAcceptProblemIds.addAll(acmAcceptProblemIds);
    userAcceptProblemIds.addAll(webAcceptProblemIds);
    return userAcceptProblemIds.size();
  }

  /**
   * 批量获取一批用户在 tracker 范围内的通过题目数量（WWW+ACM 并集去重）
   */
  public Map<Long, Integer> getTrackerAcceptCountByUserIds(List<Long> userIds) {
    Map<Long, Integer> result = new HashMap<>();
    if (org.apache.commons.collections4.CollectionUtils.isEmpty(userIds)) {
      return result;
    }
    // 直接从 Redis 排行榜读取总过题数（ZSET score）
    final String key = RedisKeyUtil.getTrackerRankboard();
    for (Long uid : userIds) {
      Double score = JedisAdapter.zScore(key, String.valueOf(uid));
      result.put(uid, score == null ? 0 : score.intValue());
    }
    return result;
  }

  /**
   * 缓存版：获取一批用户的总通过数与总提交数（tracker范围）。返回 userId -> (acceptCount, submissionCount)
   */
  public Map<Long, Pair<Integer, Integer>> getTrackerMetricsCached(List<Long> userIds) {
    Map<Long, Pair<Integer, Integer>> present = trackerUserMetricsCache.getAllPresent(userIds);
    Map<Long, Pair<Integer, Integer>> result = new HashMap<>(present);
    List<Long> missing = new ArrayList<>();
    for (Long id : userIds) {
      if (!present.containsKey(id)) {
        missing.add(id);
      }
    }
    if (!missing.isEmpty()) {
      Map<Long, Integer> ac = getTrackerAcceptCountByUserIds(missing);
      Map<Long, Integer> sub = getTrackerSubmissionCountByUserIds(missing);
      for (Long id : missing) {
        Pair<Integer, Integer> p =
            Pair.of(ac.getOrDefault(id, 0), sub.getOrDefault(id, 0));
        trackerUserMetricsCache.put(id, p);
        result.put(id, p);
      }
    }
    return result;
  }

  /**
   * 批量获取一批用户在时间范围内（[begin,end]）在 tracker 范围内的通过题目数量（WWW+ACM 并集去重）
   */
  public Map<Long, Integer> getTrackerAcceptCountByUserIdsBetweenDates(List<Long> userIds, Date beginDate, Date endDate) {
    Map<Long, Integer> result = new HashMap<>();
    if (org.apache.commons.collections4.CollectionUtils.isEmpty(userIds)) {
      return result;
    }
    List<Long> trackerProblemIds = new ArrayList<>(getAllProblemIds());
    Map<Long, List<Long>> wwwMap = codingSubmissionService
        .getAcceptedProblemIdsByUserIdsAndProblemIdsBetweenDates(userIds, trackerProblemIds, beginDate, endDate);
    Map<Long, List<Long>> acmMap = acmCodingSubmissionService
        .getAcceptedProblemIdsByUserIdsAndProblemIdsBetweenDates(userIds, trackerProblemIds, beginDate, endDate);
    for (Long uid : userIds) {
      Set<Long> union = new HashSet<>();
      union.addAll(wwwMap.getOrDefault(uid, Collections.emptyList()));
      union.addAll(acmMap.getOrDefault(uid, Collections.emptyList()));
      result.put(uid, union.size());
    }
    return result;
  }

  /**
   * 批量获取一批用户在 tracker 范围内的提交题目数量（WWW+ACM 总和，按题目范围限制，不区分状态）
   */
  public Map<Long, Integer> getTrackerSubmissionCountByUserIds(List<Long> userIds) {
    Map<Long, Integer> result = new HashMap<>();
    if (CollectionUtils.isEmpty(userIds)) {
      return result;
    }
    // 从 Redis 读取“总提交数”ZSET 分数（新key）
    final String submissionKey = RedisKeyUtil.getTrackerSubmissionTotalboard();
    for (Long uid : userIds) {
      Double score = JedisAdapter.zScore(submissionKey, String.valueOf(uid));
      result.put(uid, score == null ? 0 : score.intValue());
    }
    return result;
  }
  
  /**
   * 原始计算（不走缓存）：返回 userId -> Pair(acceptCount, submissionCount)
   */
  private Map<Long, Pair<Integer, Integer>> computeTrackerMetricsRaw(List<Long> userIds) {
    Map<Long, Pair<Integer, Integer>> result = new HashMap<>();
    if (CollectionUtils.isEmpty(userIds)) {
      return result;
    }
    List<Long> trackerProblemIds = new ArrayList<>(getAllProblemIds());
    // 接受题目并集去重计数（WWW+ACM）
    Map<Long, List<Long>> wwwMap = codingSubmissionService
        .getAcceptedProblemIdsByUserIdsAndProblemIds(userIds, trackerProblemIds);
    Map<Long, List<Long>> acmMap = acmCodingSubmissionService
        .getAcceptedProblemIdsByUserIdsAndProblemIds(userIds, trackerProblemIds);
    // 提交总数（WWW+ACM）
    Map<Long, Integer> wwwSubmit = codingSubmissionService.countAllSubmissionByUserIdsAndProblemIds(userIds, trackerProblemIds);
    Map<Long, Integer> acmSubmit = acmCodingSubmissionService.countAllSubmissionByUserIdsAndProblemIds(userIds, trackerProblemIds);
    for (Long uid : userIds) {
      Set<Long> union = new HashSet<>();
      union.addAll(wwwMap.getOrDefault(uid, Collections.emptyList()));
      union.addAll(acmMap.getOrDefault(uid, Collections.emptyList()));
      int accept = union.size();
      int submit = wwwSubmit.getOrDefault(uid, 0) + acmSubmit.getOrDefault(uid, 0);
      result.put(uid, Pair.of(accept, submit));
    }
    return result;
  }
  
  public void updateAcceptCount(long userId) {
    // 计算用户在 tracker 范围内的 AC 题目数量（按 problemId 去重）
    Set<Long> allProblemIds = getAllProblemIds();
    List<Long> problemIds = new ArrayList<>(allProblemIds);
    
    int acceptCount = getAcceptCount(userId, problemIds);

    // 将排行榜分数“设置”为 acceptCount（而不是累计增加）

    JedisAdapter.zAdd(RedisKeyUtil.getTrackerRankboard(), acceptCount, String.valueOf(userId));
 
  }

  /**
   * 重新计算并回写用户在 Tracker 范围内的“总提交数”（WWW+ACM）
   * 写入 Redis ZSET：tracker:submission:total
   */
  public void updateSubmissionCount(long userId) {
    Set<Long> allProblemIds = getAllProblemIds();
    List<Long> problemIds = new ArrayList<>(allProblemIds);
    List<Long> uids = java.util.Collections.singletonList(userId);
    // 统计 WWW + ACM 总提交数（按 tracker 问题范围）
    Map<Long, Integer> wwwSubmit = codingSubmissionService.countAllSubmissionByUserIdsAndProblemIds(uids, problemIds);
    Map<Long, Integer> acmSubmit = acmCodingSubmissionService.countAllSubmissionByUserIdsAndProblemIds(uids, problemIds);
    int total = wwwSubmit.getOrDefault(userId, 0) + acmSubmit.getOrDefault(userId, 0);
    // 回写 Redis
    JedisAdapter.zAdd(RedisKeyUtil.getTrackerSubmissionTotalboard(), total, String.valueOf(userId));
  }

  /**
   * 批量重建一批用户的 Tracker 指标（总过题 / 总提交），并回写 Redis。
   * 返回处理的用户数量。
   */
  public int rebuildTrackerMetricsForUserIds(List<Long> userIds) {
    if (CollectionUtils.isEmpty(userIds)) {
      return 0;
    }
    Map<Long, Pair<Integer, Integer>> computed = computeTrackerMetricsRaw(userIds);
    final String acceptKey = RedisKeyUtil.getTrackerRankboard();
    final String submissionKey = RedisKeyUtil.getTrackerSubmissionTotalboard();
    for (Map.Entry<Long, Pair<Integer, Integer>> e : computed.entrySet()) {
      Long uid = e.getKey();
      Pair<Integer, Integer> p = e.getValue();
      JedisAdapter.zAdd(acceptKey, p.getLeft(), String.valueOf(uid));
      JedisAdapter.zAdd(submissionKey, p.getRight(), String.valueOf(uid));
    }
    return computed.size();
  }

  public Pair<List<Long>, List<Long>> diffTrackerData(long userId1, long userId2, String qids){
    List<Long> problemIds = ConvertUtil.fromStringToLongList(qids, ",");
    //如果超过500的话，则只取前面的500个
    int maxDiffData = 500;
    if(problemIds.size() > maxDiffData){
      problemIds = problemIds.subList(0, maxDiffData);
    }

    //1.先获取用户1的提交记录
    List<Long> acmuser1AcceptProblemIds = acmCodingSubmissionService.getAllAccept(userId1, problemIds);
    List<Long> webuser1AcceptProblemIds = codingSubmissionService.getAllAccept(userId1, problemIds);
    Set<Long> user1AcceptProblemIds = new HashSet<>();
    user1AcceptProblemIds.addAll(acmuser1AcceptProblemIds);
    user1AcceptProblemIds.addAll(webuser1AcceptProblemIds);

    //2.再获取用户2的提交记录
    List<Long> acmuser2AcceptProblemIds = acmCodingSubmissionService.getAllAccept(userId2, problemIds);
    List<Long> webuser2AcceptProblemIds = codingSubmissionService.getAllAccept(userId2, problemIds);
    Set<Long> user2AcceptProblemIds = new HashSet<>();
    user2AcceptProblemIds.addAll(acmuser2AcceptProblemIds);
    user2AcceptProblemIds.addAll(webuser2AcceptProblemIds);

    return Pair.of(new ArrayList(user1AcceptProblemIds), new ArrayList(user2AcceptProblemIds));
  }

  //通过题的情况下增加排行榜
  public int addTrackerRankScore(long userId) {
    return (int)redisBaseCommonRankingBoard.increaseScore(RedisKeyUtil.getTrackerRankboard(), String.valueOf(userId), 1);
  }

  //分页获取排行榜，获得分数、用户id、用户头像。如果传入userId的话，则只获取这个用户的分数和用户信息。
  public Pair<Integer, JSONArray> getTrackerRankBoard(long userId, int page, int limit) {
    JSONArray array = new JSONArray();
    Set<Tuple> rangeWithScore = new HashSet<>();
    int offset = 0;
    int totalCount = 0;
    if(userId > 0) {
      //查询单个人
      offset = (int)JedisAdapter.zRevRank(RedisKeyUtil.getTrackerRankboard(), String.valueOf(userId));
      double userScore = JedisAdapter.zScore(RedisKeyUtil.getTrackerRankboard(), String.valueOf(userId));
      rangeWithScore.add(new Tuple(String.valueOf(userId), userScore));
      totalCount = 1;
    } else {
      //查询所有的，最多只展示1000个
      offset = PagingUtils.getOffset(page, limit);
      totalCount = 1000;
      rangeWithScore = redisBaseCommonRankingBoard.getRangeWithScore(RedisKeyUtil.getTrackerRankboard(), offset, Math.min(totalCount - 1, limit - 1 + offset));
    }

    //渲染用户信息
    List<Long> userIds = Lists.newArrayList();
    for (Tuple tuple : rangeWithScore) {
      userIds.add(NumberUtils.toLong(tuple.getElement()));
    }
    Map<Long, User> userMap = userService.getUserMapsByIds(userIds);
    int index = 1;
    for (Tuple tuple : rangeWithScore) {
      User user = userMap.get(NumberUtils.toLong(tuple.getElement()));
      if(user == null) {
        continue;
      }
      JSONObject json = new JSONObject();
      json.put("headUrl", user.getTinnyHeaderUrl());
      json.put("uid", user.getId());
      json.put("name", user.getDisplayname());
      json.put("count", Double.valueOf(tuple.getScore()).intValue());
      json.put("place", index + offset > 10000 ? "1w+" : index + offset);
      index++;
      array.add(json);
    }
    return Pair.of(totalCount, array);
  }
  //分页获取打卡排行榜，获得分数、用户id、用户头像。如果传入userId的话，则只获取这个用户的分数和用户信息。
  public Pair<Integer, JSONArray> getTrackerCheckinRankBoard(long userId, int page, int limit) {
    JSONArray array = new JSONArray();
    Set<Tuple> rangeWithScore = new HashSet<>();
    int offset = 0;
    int totalCount = 0;
    if(userId > 0) {
      //查询单个人
      offset = (int)JedisAdapter.zRevRank(RedisKeyUtil.getTrackerClockTotalboard(), String.valueOf(userId));
      double userScore = JedisAdapter.zScore(RedisKeyUtil.getTrackerClockTotalboard(), String.valueOf(userId));
      rangeWithScore.add(new Tuple(String.valueOf(userId), userScore));
      totalCount = 1;
    } else {
      //查询所有的，最多只展示1000个
      offset = PagingUtils.getOffset(page, limit);
      totalCount = 1000;
      rangeWithScore = redisBaseCommonRankingBoard.getRangeWithScore(RedisKeyUtil.getTrackerClockTotalboard(), offset, Math.min(totalCount - 1, limit - 1 + offset));
    }

    //渲染用户信息
    List<Long> userIds = Lists.newArrayList();
    for (Tuple tuple : rangeWithScore) {
      userIds.add(NumberUtils.toLong(tuple.getElement()));
    }
    Map<Long, User> userMap = userService.getUserMapsByIds(userIds);
    int index = 1;
    for (Tuple tuple : rangeWithScore) {
      User user = userMap.get(NumberUtils.toLong(tuple.getElement()));
      if(user == null) {
        continue;
      }
      //获取连续打卡天数
      Double continueScore = JedisAdapter.zScore(RedisKeyUtil.getTrackerClockContinusboard(), String.valueOf(user.getId()));
      int continueDays = continueScore != null ? continueScore.intValue() : 0;
      
      JSONObject json = new JSONObject();
      json.put("headUrl", user.getTinnyHeaderUrl());
      json.put("uid", user.getId());
      json.put("name", user.getDisplayname());
      json.put("count", Double.valueOf(tuple.getScore()).intValue());
      json.put("continueDays", continueDays);
      json.put("place", index + offset > 10000 ? "1w+" : index + offset);
      index++;
      array.add(json);
    }
    return Pair.of(totalCount, array);
  }

  public void addTrackerClockRecord(long userId, long questionId) {
    TrackerClockRecord todayRecord = trackerClockRecordSerice.getByUserIdToday(userId);
    if(todayRecord != null) {
      return;
    }
    //插入数据库
    trackerClockRecordSerice.insert(userId, questionId);
    Date checkinTime = new Date();
    //每次打卡成功送2牛币
    productOrderBiz.manualOrder(userId, 2, ProductOrderTypeEnum.QUESTION_TRACKER_EVERYDAY_CLOCK, String.format("每日一题打卡%s", NcDateUtils.getTodayDateString()), 0, String.format("{\"questionId\":%d}", questionId));
    //累计打卡总天数 +1

    double totalScore = JedisAdapter.zIncrBy(RedisKeyUtil.getTrackerClockTotalboard(), 1, String.valueOf(userId));
    TrackerClockRecord beforeRecord = trackerClockRecordSerice.getByUserIdBeforeToday(userId);
    int continueDays = 0;
    int totalDays = (int)totalScore;
    if(beforeRecord != null && NcDateUtils.getDiffDay(beforeRecord.getCreateTime(), new Date()) == 1) {
      //每连续打卡7天（连续第7、14、21天等），额外获得20牛币
      continueDays = (int)JedisAdapter.zIncrBy(RedisKeyUtil.getTrackerClockContinusboard(), 1, String.valueOf(userId));
      if(continueDays > 0 &&  continueDays % 7 == 0) {
        productOrderBiz.manualOrder(userId, 20, ProductOrderTypeEnum.QUESTION_TRACKER_EVERYDAY_CONTINUOUS_CLOCK, String.format("连续打卡%d天", continueDays), 0, "");
      }
    } else {
      //没有连续，重新开始计数
      continueDays = 1;
      JedisAdapter.zAdd(RedisKeyUtil.getTrackerClockContinusboard(), 1, String.valueOf(userId));
    }
    
    //判断是否是今日一血
    int rank = trackerClockRecordSerice.getTodayClockRank(userId);
    if(rank == 1) {
      trackerBadgeBiz.insertFirstCheckinBadgeRecord(userId);
    }
    //如果用户累计打卡成就为空（即没有“第一次打卡”成就），则插入所有打卡成就记录
    if(trackerBadgeRecordSevice.countByUserIdAndBadgeType(userId, CHECKIN_CUMULATIVE_BADGE_TYPE) == 0) {
      trackerBadgeBiz.insertAllCheckinBadgeRecord(userId, totalDays, continueDays, checkinTime);
      return;
    }
    
    trackerBadgeBiz.checkClockBadgeTotalCondition(userId, totalDays, continueDays);
    trackerBadgeBiz.checkClockBadgeContinueCondition(userId, totalDays, continueDays);
    trackerBadgeBiz.checkClockBadgeSpecialCondition(userId, checkinTime);
  }

  public int getContinueDay(long userId){
    // 获取该用户的分数（即连续打卡天数）
    Double score = JedisAdapter.zScore(
      RedisKeyUtil.getTrackerClockContinusboard(), 
      String.valueOf(userId)
    );
    return score == null ? 0 : score.intValue();
  }

  public int getCountDay(long userId){
    // 获取该用户的累计打卡总天数
    Double totalDays = JedisAdapter.zScore(
        RedisKeyUtil.getTrackerClockTotalboard(), 
        String.valueOf(userId)
    );
    return totalDays == null ? 0 : totalDays.intValue();
  }

  public int getYesterdayClockCount(long userId) {
    return trackerClockRecordSerice.getYesterdayClockCount(userId);
  }

  public TrackerClockQuestion getTrackerQuestionIdToday() {
    TrackerClockQuestion trackerClockQuestion = trackerClockRecordSerice.getTrackerQuestionIdToday();
    return trackerClockQuestion;
  }

  public TrackerClockQuestion getTrackerQuestionIdByDate(Date date) {
    return trackerClockRecordSerice.getTrackerQuestionIdByDate(date);
  }

  public int getTodayClockCount() {
    return trackerClockRecordSerice.getTodayClockCount();
  }

  public int getTodayClockRank(long userId) {
    return trackerClockRecordSerice.getTodayClockRank(userId);
  }

  public List<TrackerClockQuestion> getTrackerQuestionIdMonth(int year, int month) {
    return trackerClockRecordSerice.getTrackerQuestionIdMonth(NcDateUtils.getMonthLastMonthEndDate(year, month), NcDateUtils.getMonthEndDate(year, month));
  }

  public TrackerClockRecord getTrackerClockRecordByUserIdToday(long userId) {
    return trackerClockRecordSerice.getByUserIdToday(userId);
  }

  public List<String> listTrackerClockRecordByUserIdAndMonth(long userId, int year, int month) {
    List<Date> list = trackerClockRecordSerice.listByUserIdAndMonth(userId, NcDateUtils.getMonthLastMonthEndDate(year, month), NcDateUtils.getMonthEndDate(year, month));
    //将list转换为yyyy-MM-dd格式,相同的日期去重，然后按照升序返回
    Set<String> set = new HashSet<>();
    for (Date date : list) {
      set.add(DateFormatUtils.format(date, "yyyy-MM-dd"));
    }
    return new ArrayList<>(set).stream().sorted().collect(Collectors.toList());
  }

  public boolean isAcceptWWWorACM(long userId, long problemId) {
    if (userId <= 0 || problemId <= 0) {
      return false;
    }
    return hasAcceptWWW(userId, problemId, 0) || hasAcceptACM(userId, problemId, 0);
  }

  private boolean hasAcceptWWW(long userId, long problemId, long submissionId) {
    CodingSubmission firstSubmission = codingSubmissionService.getFirstCodingSubmission(userId, problemId, CodingSubmissionStatusEnum.ACCEPTED.getValue());
    //更早就AC过了
    return firstSubmission != null && firstSubmission.getId() != submissionId;
  }

  private boolean hasAcceptACM(long userId, long problemId, long submissionId) {
    CodingSubmission firstSubmission = acmCodingSubmissionService.getFirstSubmission(userId, problemId, CodingSubmissionStatusEnum.ACCEPTED.getValue());
    //更早就AC过了
    return firstSubmission != null && firstSubmission.getId() != submissionId;
  }

  //测试排行榜功能用，给某人打卡数加1
  public void addTrackerClockRecordTest(long userId) {
    JedisAdapter.zIncrBy(RedisKeyUtil.getTrackerClockTotalboard(), 1, String.valueOf(userId));
  }

  /**
   * 生成名片图片
   * @param requestBody JSON请求体，包含用户数据
   * @return PNG格式的图片字节数组
   */
  public byte[] generateCard(String requestBody) {
    return cardImageService.generateCard(requestBody);
  }

  /**
   * 获取技能树进度
   * @param userId 用户ID
   * @param tags 标签ID列表，逗号分隔的字符串
   * @return 返回标签ID和进度的配对列表
   */
  public List<Pair<String,Float>> getSkillTreeProgress(long userId, String tags) {
    try {
      // 解析标签ID列表
      List<Long> tagIds = ConvertUtil.fromStringToLongList(tags, ",");
      
      if (CollectionUtils.isEmpty(tagIds)) {
        return Collections.emptyList();
      }
      
      // 调用service层获取技能树进度
      List<TrackerTagUserRecord> recordList = trackerTagService.getSkillTreeProgress(userId, tagIds);
      
      // 将TrackerTagUserRecord列表转换为Pair列表
      List<Pair<String,Float>> result = new ArrayList<>();
      for (TrackerTagUserRecord record : recordList) {
        if (record != null && record.getTagId() != null && record.getPassRate() != null) {
          String tagId = record.getTagId().toString();
          Float passRate = record.getPassRate();
          result.add(Pair.of(tagId, passRate));
        }
      }
      
      return result;
      
    } catch (Exception e) {
      // 记录日志并返回空列表
      logger.error("getSkillTreeProgress error", e);
      return Collections.emptyList();
    }
  }
  
  /**
   * 根据知识点ID查询知识点完整信息（包含基本信息和题目详情）
   * @param tagId 知识点ID
   * @return 返回包含tag基本信息和questions题目列表的Map
   */
  public Map<String, Object> getTrackerTagInfoWithQuestions(Integer tagId) {
    try {
      if (tagId == null || tagId <= 0) {
        return Collections.emptyMap();
      }
      
      Map<String, Object> result = new HashMap<>();
      
      // 1. 调用TrackerTagService获取知识点基本信息
      TrackerTag tag = trackerTagService.getTrackerTagInfo(tagId);
      if (tag == null) {
        return Collections.emptyMap();
      }
      result.put("tag", tag);
      
      // 2. 调用TrackerTagService获取该知识点下的所有题目
      List<TrackerTagQuestion> tagQuestions = trackerTagService.getQuestionsByTagId(tagId);
      if (CollectionUtils.isEmpty(tagQuestions)) {
        result.put("questions", Collections.emptyList());
        return result;
      }
      
      // 3. 提取questionId列表
      List<Long> questionIds = tagQuestions.stream()
              .map(TrackerTagQuestion::getQuestionId)
              .filter(Objects::nonNull)
              .collect(Collectors.toList());
      
      if (CollectionUtils.isEmpty(questionIds)) {
        result.put("questions", Collections.emptyList());
        return result;
      }
      
      // 4. 调用QuestionService批量查询题目的标题和UUID，并转换为Map<Long, Question>
      List<Question> questionInfos = questionService.getQuestionTagsAndDifficultyByLongIds(questionIds);
      //获取每个题的problemId
      Map<Long, Question> questionInfoMap = questionInfos.stream().collect(Collectors.toMap(Question::getId, q -> q));
      // 正确收集 problemId 列表（不能用 questionId）
      List<Long> problemIds = tagQuestions.stream()
              .map(TrackerTagQuestion::getProblemId)
              .filter(Objects::nonNull)
              .distinct()
              .collect(Collectors.toList());
      // 获取每道题的通过人数（problemId -> 去重通过用户数）
      Map<Long, Integer> passTotalMap = codingSubmissionService.getAcceptedSubmissionUserCountMap(problemIds);
      // 5. 组装完整的题目信息
      List<Map<String, Object>> questionDetailList = new ArrayList<>();
      for (TrackerTagQuestion tq : tagQuestions) {
        if (!questionInfoMap.containsKey(tq.getQuestionId())) {
          continue;
        }

        Question questionInfo = questionInfoMap.get(tq.getQuestionId());
        Map<String, Object> questionDetail = new HashMap<>();
        
        questionDetail.put("questionId", tq.getQuestionId());
        questionDetail.put("problemId", tq.getProblemId());
        questionDetail.put("score", tq.getScore());
        questionDetail.put("dependencies", tq.getDependencies());
        questionDetail.put("title", questionInfo.getTitle());
        questionDetail.put("uuid", questionInfo.getUuid());
        questionDetail.put("passTotal", passTotalMap.getOrDefault(tq.getProblemId(), 0));
        
        questionDetailList.add(questionDetail);
      }
      
      result.put("questions", questionDetailList);
      return result;
      
    } catch (Exception e) {
      // 记录日志并返回空Map
      logger.error("getTrackerTagInfoWithQuestions error", e);
      return Collections.emptyMap();
    }
  }
   // 已从数据库 tracker_tag_question 表中查询，不再需要写死的数据
  
  /**
   * 根据problemId查询该题目在技能树中的信息
   * @param problemId 题目ID
   * @return 返回该题目所属知识点的tagId和题目score的配对，如果不存在则返回null
   */
  public Pair<Integer, Integer> getSkillTreeProblemInfo(long problemId) {
    try {
      if (problemId <= 0) {
        return null;
      }
      
      // 1. 先尝试通过 problemId 直接查询（如果 tracker_tag_question 表已填充 problem_id）
      List<TrackerTagQuestion> tagQuestions = trackerTagService.getTagQuestionsByProblemId(problemId);
      if (CollectionUtils.isEmpty(tagQuestions)) {
        return null;
      }
      
      // 取第一条记录（一个题目只属于一个主知识点）
      TrackerTagQuestion tq = tagQuestions.get(0);
      if (tq.getTagId() != null && tq.getScore() != null) {
        return Pair.of(tq.getTagId().intValue(), tq.getScore());
      }
      
      return null;
      
    } catch (Exception e) {
      logger.error("getSkillTreeProblemInfo error", e);
      return null;
    }
  }
  /**
   * 只有第一次AC才要调用这个方法
   * @param userId
   * @param problemId
   */
  public void updateTrackerTagProcessWhenFirstAc(long userId, long problemId){
    try {
      if (userId <= 0 || problemId <= 0) {
        return;
      }
      
      // 获取题目的技能树信息
      Pair<Integer, Integer> problemInfo = getSkillTreeProblemInfo(problemId);
      if (problemInfo == null) {
        return; // 如果problem不在技能树里，直接剪枝
      }
      
      int tagId = problemInfo.getLeft();
      int problemScore = problemInfo.getRight();
      
      // 获取知识点的总分
      int totalScore = getTagTotalScore(tagId);
      if (totalScore <= 0) {
        return;
      }
      
      // 获取用户在该技能树节点的当前进度
      float currentPassRate = getTrackerTagProcess(userId, tagId);
      
      // 计算当前已获得的分数
      float currentScore = currentPassRate * totalScore;
      
      // 计算新的分数（当前分数 + 题目分数）
      float newScore = currentScore + problemScore;
      
      // 计算新的进度（新分数 / 总分，最大不超过1.0）
      float newPassRate = Math.min(1.0f, newScore / totalScore);
      
      // 更新用户在技能树的进度
      trackerTagService.insertOrUpdateTagRecord(tagId, userId, newPassRate);
      
    } catch (Exception e) {
      logger.error("updateTrackerTagProcess error", e);
    }
  }
  
  /**
   * 获取用户在指定技能树节点的进度
   * @param userId 用户ID
   * @param tagId 技能树节点ID
   * @return 返回用户在该节点的进度（0.0-1.0）
   */
  private float getTrackerTagProcess(long userId, int tagId) {
    try {
      // 调用service层获取用户技能树进度
      List<Long> tagIds = Collections.singletonList((long) tagId);
      List<TrackerTagUserRecord> records = trackerTagService.getSkillTreeProgress(userId, tagIds);
      
      // 查找指定tagId的记录
      for (TrackerTagUserRecord record : records) {
        if (record.getTagId() != null && record.getTagId().equals(tagId)) {
          return record.getPassRate() != null ? record.getPassRate() : 0.0f;
        }
      }
      
      // 如果没有找到记录，返回0.0
      return 0.0f;
      
    } catch (Exception e) {
      logger.error("getTrackerTagProcess error", e);
      return 0.0f;
    }
  }
  
  /**
   * 获取知识点的总分（直接查询数据库SUM）
   * @param tagId 知识点ID
   * @return 返回该知识点的总分
   */
  private int getTagTotalScore(int tagId) {
    try {
      return trackerTagService.getTotalScoreByTagId(tagId);
    } catch (Exception e) {
      logger.error("getTagTotalScore error", e);
      return 0;
    }
  }
  
  /**
   * 更新单个用户在所有技能树知识点的进度
   * 遍历所有知识点，计算用户已通过题目的分数，更新进度百分比
   * @param userId 用户ID
   */
  public void updateUserAllTagProgress(long userId, int tagId) {
    try {
      if (userId <= 0) {
        logger.warn("updateUserAllTagProgress: invalid userId " + userId);
        return;
      }

      try {
        // 1. 获取该知识点下的所有题目
        List<TrackerTagQuestion> tagQuestions = trackerTagService.getQuestionsByTagId(tagId);
        if (CollectionUtils.isEmpty(tagQuestions)) {
          logger.info("updateUserAllTagProgress: tagId " + tagId + " has no questions");
          return;
        }

        // 2. 提取所有题目的 problemId
        List<Long> problemIds = new ArrayList<>();
        Map<Long, Integer> problemIdToScore = new HashMap<>();
        for (TrackerTagQuestion tq : tagQuestions) {
          Long problemId = tq.getProblemId();
          problemIds.add(problemId);
          problemIdToScore.put(problemId, tq.getScore());
        }

        if (problemIds.isEmpty()) {
          logger.info("updateUserAllTagProgress: tagId " + tagId + " has no valid problemIds");
          return;
        }

        // 3. 使用 diffTrackerData 查询用户通过的题目
        // diffTrackerData 需要传入逗号分隔的字符串
        String problemIdsStr = problemIds.stream()
                .map(String::valueOf)
                .collect(Collectors.joining(","));

        // 调用 diffTrackerData，userId1 是目标用户，userId2 设为 0（不需要比较）
        Pair<List<Long>, List<Long>> diffResult = diffTrackerData(userId, 0, problemIdsStr);
        List<Long> userAcceptedProblemIds = diffResult.getLeft();

        // 4. 计算用户已通过的总分
        int userScore = 0;
        for (Long acceptedProblemId : userAcceptedProblemIds) {
          Integer score = problemIdToScore.get(acceptedProblemId);
          if (score != null) {
            userScore += score;
          }
        }

        // 5. 获取该知识点的总分
        int totalScore = getTagTotalScore(tagId);
        if (totalScore <= 0) {
          logger.warn("updateUserAllTagProgress: tagId " + tagId + " has totalScore <= 0");
          return;
        }

        // 6. 计算进度百分比
        float passRate = Math.min(1.0f, (float) userScore / totalScore);

        // 7. 调用 insertOrUpdateTagRecord 更新进度
        trackerTagService.insertOrUpdateTagRecord(tagId, userId, passRate);

        logger.info("updateUserAllTagProgress: userId=" + userId + ", tagId=" + tagId + ", userScore=" + userScore +
                ", totalScore=" + totalScore + ", passRate=" + passRate);

      } catch (Exception e) {
        logger.error("updateUserAllTagProgress: failed to update tagId " + tagId + " for userId " + userId, e);
        // 继续处理下一个知识点
      }

      logger.info("updateUserAllTagProgress: completed for userId " + userId);

    } catch (Exception e) {
      logger.error("updateUserAllTagProgress: error for userId " + userId, e);
    }
  }

  public void addShareLink(Date date, String shareLink) {
    trackerClockRecordSerice.updateShareLink(shareLink, date);
  }

  // ======================= 技能树章节（枚举版） =======================
  public List<Integer> getSkillTreeTagIdsByChapter(TrackerStageEnum stage) {
    if (stage == null) return Collections.emptyList();
    return stage.getTagIds();
  }
  // 兼容字符串 key 调用
  public List<Integer> getSkillTreeTagIdsByChapter(String chapterKey) {
    return getSkillTreeTagIdsByChapter(TrackerStageEnum.fromKey(chapterKey));
  }

  /**
   * 聚合获取某章节下的全部 problemId（去重）。
   * 依赖 trackerTagService.getQuestionsByTagId(tagId) 获取题目清单。
   */
  public Set<Long> getSkillTreeProblemIdsByChapter(TrackerStageEnum stage) {
    List<Integer> tagIds = getSkillTreeTagIdsByChapter(stage);
    if (tagIds == null || tagIds.isEmpty()) {
      return Collections.emptySet();
    }
    Set<Long> problemIds = new HashSet<>();
    for (Integer tagId : tagIds) {
      List<TrackerTagQuestion> list = trackerTagService.getQuestionsByTagId(tagId);
      if (list == null || list.isEmpty()) {
        continue;
      }
      for (TrackerTagQuestion q : list) {
        Long pid = q.getProblemId();
        if (pid != null && pid > 0) {
          problemIds.add(pid);
        }
      }
    }
    return problemIds;
  }
  // 兼容字符串 key 调用
  public Set<Long> getSkillTreeProblemIdsByChapter(String chapterKey) {
    return getSkillTreeProblemIdsByChapter(TrackerStageEnum.fromKey(chapterKey));
  }

  /**
   * 统计：给定题目集合，按用户统计累计 AC 去重数量（WWW+ACM 并集）。
   */
  public Map<Long, Integer> getAcceptCountInProblemSetByUserIds(List<Long> userIds, List<Long> problemIds) {
    Map<Long, Integer> result = new HashMap<>();
    if (CollectionUtils.isEmpty(userIds) || CollectionUtils.isEmpty(problemIds)) {
      return result;
    }
    Map<Long, List<Long>> wwwMap = codingSubmissionService
        .getAcceptedProblemIdsByUserIdsAndProblemIds(userIds, problemIds);
    Map<Long, List<Long>> acmMap = acmCodingSubmissionService
        .getAcceptedProblemIdsByUserIdsAndProblemIds(userIds, problemIds);
    for (Long uid : userIds) {
      Set<Long> union = new HashSet<>();
      union.addAll(wwwMap.getOrDefault(uid, Collections.emptyList()));
      union.addAll(acmMap.getOrDefault(uid, Collections.emptyList()));
      result.put(uid, union.size());
    }
    return result;
  }

  /**
   * 统计：给定题目集合，按用户统计时间窗口内 AC 去重数量（[begin,end]，WWW+ACM 并集）。
   */
  public Map<Long, Integer> getAcceptCountInProblemSetByUserIdsBetweenDates(
      List<Long> userIds, List<Long> problemIds, Date beginDate, Date endDate) {
    Map<Long, Integer> result = new HashMap<>();
    if (CollectionUtils.isEmpty(userIds) || CollectionUtils.isEmpty(problemIds)) {
      return result;
    }
    Map<Long, List<Long>> wwwMap = codingSubmissionService
        .getAcceptedProblemIdsByUserIdsAndProblemIdsBetweenDates(userIds, problemIds, beginDate, endDate);
    Map<Long, List<Long>> acmMap = acmCodingSubmissionService
        .getAcceptedProblemIdsByUserIdsAndProblemIdsBetweenDates(userIds, problemIds, beginDate, endDate);
    for (Long uid : userIds) {
      Set<Long> union = new HashSet<>();
      union.addAll(wwwMap.getOrDefault(uid, Collections.emptyList()));
      union.addAll(acmMap.getOrDefault(uid, Collections.emptyList()));
      result.put(uid, union.size());
    }
    return result;
  }
}
