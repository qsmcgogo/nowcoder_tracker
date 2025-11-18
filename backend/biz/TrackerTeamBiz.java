package com.wenyibi.futuremail.biz.tracker;

import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.wenyibi.futuremail.biz.AccountBiz;
import com.wenyibi.futuremail.biz.ml.SpamFilterJudgeService;
import com.wenyibi.futuremail.biz.questionrpc.QuestionTrackerBiz;
import com.wenyibi.futuremail.constants.ErrorCodeConstants;
import com.wenyibi.futuremail.model.User;
import com.wenyibi.futuremail.model.UserTypeEnum;
import com.wenyibi.futuremail.model.WenyibiException;
import com.wenyibi.futuremail.model.acm.team.ACMTeamInfo;
import com.wenyibi.futuremail.model.acm.team.ACMTeamInfoStatusEnum;
import com.wenyibi.futuremail.model.acm.team.ACMTeamMember;
import com.wenyibi.futuremail.model.acm.team.ACMTeamMemberTypeEnum;
import com.wenyibi.futuremail.model.acm.team.ACMTeamTypeInfoEnum;
import com.wenyibi.futuremail.model.acm.team.ACMTeamApply;
import com.wenyibi.futuremail.model.acm.team.ACMTeamApplyStatusEnum;
import com.wenyibi.futuremail.model.acm.team.ACMTeamApplyTypeEnum;
import com.wenyibi.futuremail.model.sns.EntityTypeEnum;
import com.wenyibi.futuremail.model.spam.SpamCheckActionEnum;
import com.wenyibi.futuremail.service.UserService;
import com.wenyibi.futuremail.service.acm.team.ACMTeamInfoService;
import com.wenyibi.futuremail.service.acm.team.ACMTeamMemberService;
import com.wenyibi.futuremail.service.acm.team.ACMTeamApplyService;
import com.wenyibi.futuremail.service.CodingSubmissionService;
import com.wenyibi.futuremail.service.acm.contest.ACMCodingSubmissionService;
import com.wenyibi.futuremail.util.DFASensitiveUtil;
import com.wenyibi.futuremail.util.PagingUtils;
import com.wenyibi.futuremail.model.common.Page;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import net.paoding.rose.web.Invocation;

import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.CompletableFuture;
import com.wenyibi.futuremail.util.NcDateUtils;
import com.wenyibi.futuremail.util.DateUtil;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import com.wenyibi.futuremail.cache.JedisAdapter;
import com.wenyibi.futuremail.util.RedisKeyUtil;
import com.wenyibi.futuremail.model.tracker.TrackerStageEnum;

@Component
public class TrackerTeamBiz {

  private static final Log logger = LogFactory.getLog(TrackerTeamBiz.class);

  @Autowired
  private ACMTeamInfoService acmTeamInfoService;
  @Autowired
  private ACMTeamMemberService acmTeamMemberService;
  @Autowired
  private UserService userService;
  @Autowired
  private CodingSubmissionService codingSubmissionService;
  @Autowired
  private AccountBiz accountBiz;
  @Autowired
  private ACMTeamApplyService acmTeamApplyService;
  @Autowired
  private QuestionTrackerBiz questionTrackerBiz;
  @Autowired
  private ACMCodingSubmissionService acmCodingSubmissionService;
  @Autowired
  private SpamFilterJudgeService spamFilterJudgeService;
  @Autowired
  private TrackerBadgeBiz trackerBadgeBiz;
  @Autowired
  private com.wenyibi.futuremail.service.question.TrackerClockRecordSerice trackerClockRecordSerice;
  // https://stackoverflow.com/questions/6198986/how-can-i-replace-non-printable-unicode-characters-in-java
  // 单引号、双引号、反斜杠（转义）和非可见unicode字符
  private static final String NAME_EMPTY_REGEX = "['\"\\\\\\p{Cc}\\p{Cf}\\p{Co}\\p{Cn}]";

  private static Pattern NAME_EMPTY_PATTERN = Pattern.compile(NAME_EMPTY_REGEX);

  /** 团队统计看板缓存（8小时） */
  private final LoadingCache<Long, JSONObject> teamSummaryCache = CacheBuilder
      .newBuilder()
      .expireAfterWrite(8, TimeUnit.HOURS)
      .initialCapacity(256)
      .concurrencyLevel(128)
      .build(new CacheLoader<Long, JSONObject>() {
        @Override
        public JSONObject load(Long teamId) {
          return computeTeamStatsSummary(teamId);
        }
      });

  // 用户指标缓存移动至 QuestionTrackerBiz，统一复用



  private static String filterBadWord(String content) throws WenyibiException {
    String filterContent = DFASensitiveUtil.filter(content, true);
    if (!StringUtils.equals(filterContent, content)) {
      throw new WenyibiException(ErrorCodeConstants.NICKNAME_FORBIDDEN_ERROR, "含有违禁词汇，请修改后输入");
    }
    return filterContent;
  }

  private static String filterEncodeHtml(String content) throws WenyibiException {
    return StringEscapeUtils.escapeHtml4(filterBadWord(content));
  }

  public List<Long> listMyTeamIds(long userId) {
    return acmTeamMemberService.getByUid(userId).stream()
        .map(ACMTeamMember::getTeamId)
        .collect(Collectors.toList());
  }

  public JSONArray listMyTeamsDetail(long userId) {
    List<ACMTeamMember> myMembers = acmTeamMemberService.getByUid(userId);
    List<Long> teamIds = myMembers.stream().map(ACMTeamMember::getTeamId).collect(Collectors.toList());
    if (teamIds.isEmpty()) {
      return new JSONArray();
    }
    // 展示所有团队类型（ACM + TRACKER）
    List<Integer> allTypes = Arrays.asList(
        ACMTeamTypeInfoEnum.ACM.getCode(),
        ACMTeamTypeInfoEnum.TRACKER.getCode()
    );
    Map<Long, ACMTeamInfo> teamMap = acmTeamInfoService.getMapByIds(teamIds, allTypes);
    Map<Long, Integer> myRoleMap = myMembers.stream().collect(Collectors.toMap(ACMTeamMember::getTeamId, m -> (int)m.getType()));
    JSONArray result = new JSONArray();
    for (Long teamId : teamIds) {
      ACMTeamInfo t = teamMap.get(teamId);
      if (t == null) {
        continue;
      }
      JSONObject o = new JSONObject();
      o.put("teamId", t.getId());
      o.put("name", t.getName());
      o.put("teamType", t.getTeamType());
      o.put("logoUrl", t.getLogoUrl());
      o.put("description", t.getDescription());
      o.put("personCount", t.getPersonCount());
      o.put("personLimit", t.getPersonLimit());
      o.put("ownerUserId", t.getUid());
      o.put("status", t.getStatus());
      o.put("createTime", t.getCreateTime());
      o.put("myRole", myRoleMap.getOrDefault(teamId, (int) ACMTeamMemberTypeEnum.NORMAL.getType()));
      result.add(o);
    }
    return result;
  }

  public long createTeam(Long ownerUserId, String name, String description) throws WenyibiException {
    if (ownerUserId == null || ownerUserId <= 0) {
      throw new WenyibiException("ownerUserId非法");
    }
    /**
     * 网易违禁词汇检测
     */
    String sensitiveWord = null;
    List<String> hitWords = null;
    Pair<SpamCheckActionEnum, List<String>> sensitiveResult = null;
    name = checkName(ownerUserId, name, 0);
    sensitiveResult = spamFilterJudgeService.judgeShortTextSensitive(name);
    if (sensitiveResult.getKey().getAction() == 2) {
      throw new WenyibiException("队名含有违禁词汇 ，用户不得添加");
    } else if (sensitiveResult.getKey().getAction() == 1) {
      sensitiveWord = name;
      hitWords = sensitiveResult.getValue();
    }
    description = checkDescription(ownerUserId, description, 0);
    sensitiveResult = spamFilterJudgeService.judgeShortTextSensitive(description);
    if (sensitiveResult.getKey().getAction() == 2) {
      throw new WenyibiException("描述含有违禁词汇 ，用户不得添加");
    } else if (sensitiveResult.getKey().getAction() == 1) {
      sensitiveWord = description;
      hitWords = sensitiveResult.getValue();
    }

    // 生成团队用户ID（与 ACM 创建方式保持一致）
    int teamId = accountBiz.createOauthUserAccount((Invocation) null,
        com.wenyibi.futuremail.model.login.ClientPlatformEnum.PC.getValue(),
        name, UserTypeEnum.ACM_TEAM, null, null);
    if (sensitiveResult.getKey().getAction() == 1) {
      spamFilterJudgeService
              .sendSensitiveReviewListEvent(sensitiveWord, EntityTypeEnum.ACM_TEAM, teamId, ownerUserId,
                      hitWords);
    }

    ACMTeamInfo teamInfo = new ACMTeamInfo();
    teamInfo.setId(teamId);
    teamInfo.setName(name);
    teamInfo.setLogoUrl("https://images.nowcoder.com/images/20220303/795430173_1646313501743/64188F08D61F98C9EE5212F58672A8F4");
    teamInfo.setDescription(description);
    // TRACKER 创建的队伍默认类型为 1（TRACKER）
    teamInfo.setTeamType(ACMTeamTypeInfoEnum.TRACKER.getCode());
    teamInfo.setPersonal(1); // 申请/邀请
    teamInfo.setPersonCount(1);
    teamInfo.setPersonLimit(500); // tracker 团队上限
    teamInfo.setUid(ownerUserId);
    teamInfo.setStatus(ACMTeamInfoStatusEnum.NORMAL.getType());
    teamInfo.setCreateTime(new Date());
    long ret = acmTeamInfoService.save(teamInfo);
    if (ret <= 0) {
      throw new WenyibiException("保存团队失败");
    }
    // 创建人加入为队长
    ACMTeamMember owner = ACMTeamMember.build(teamId, ownerUserId, ACMTeamMemberTypeEnum.OWNER);
    acmTeamMemberService.save(owner);
    return teamId;
  }

  public int updateTeamInfo(long uid, long teamId, String name, String description) throws WenyibiException {
    name = checkName(uid, name, teamId);
    description = checkDescription(uid, description, teamId);
    int affected = 0;
    if (name != null && name.trim().length() > 0) {
      affected += acmTeamInfoService.updateName(teamId, name);
    }
    if (description != null) {
      affected += acmTeamInfoService.updateDescription(teamId, description);
    }
    // 团队信息更新后异步刷新活动积分
    refreshTeamActivityScoreAsync(teamId);
    return affected;
  }

  public boolean isTeamAdmin(long teamId, long userId) {
    ACMTeamInfo team = acmTeamInfoService.getById(teamId);
    return team != null && team.getUid() == userId;
  }

  public long addMember(long teamId, long userId) {
    ACMTeamMember member = ACMTeamMember.build(teamId, userId, ACMTeamMemberTypeEnum.NORMAL);
    long id = acmTeamMemberService.save(member);
    // 同步更新团队人数
    int count = acmTeamMemberService.getCountByGroupId(teamId);
    acmTeamInfoService.updatePersonCount(teamId, count);
    // 异步刷新该用户的 Redis 指标（总过题 / 总提交）
    refreshUserTrackerMetricsAsync(userId);
    // 成员变更后异步刷新活动积分
    refreshTeamActivityScoreAsync(teamId);
    return id;
  }

  public int removeMember(long teamId, long userId) {
    ACMTeamMember member = acmTeamMemberService.getByGroupAndUid(teamId, userId);
    if (member == null) {
      return 0;
    }
    int ret = acmTeamMemberService.delete(member.getId());
    // 同步更新团队人数
    int count = acmTeamMemberService.getCountByGroupId(teamId);
    acmTeamInfoService.updatePersonCount(teamId, count);
    // 成员变更后异步刷新活动积分
    refreshTeamActivityScoreAsync(teamId);
    return ret;
  }

  public JSONArray listMembers(long teamId) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);
    // 批量从 QuestionTrackerBiz 的用户指标缓存获取（未命中则差量回源并回填）
    Map<Long, Pair<Integer, Integer>> metrics = questionTrackerBiz.getTrackerMetricsCached(uids);
    JSONArray arr = new JSONArray();
    for (ACMTeamMember m : members) {
      User u = userMap.get(m.getUid());
      JSONObject one = new JSONObject();
      one.put("userId", m.getUid());
      one.put("role", (int)m.getType());
      if (u != null) {
        one.put("name", u.getDisplayname());
        one.put("headUrl", u.getTinnyHeaderUrl());
      }
      one.put("joinTime", m.getCreateTime());
      // 刷题情况（仅 tracker 范围），优先用缓存
      Pair<Integer, Integer> p = metrics.get(m.getUid());
      int totalAc = p == null ? 0 : p.getLeft();
      int totalAll = p == null ? 0 : p.getRight();
      one.put("acceptCount", totalAc);
      one.put("submissionCount", totalAll);
      arr.add(one);
    }
    return arr;
  }

  /**
   * 分页版成员列表：仅对当前页成员做批量统计，降低单次负载
   */
  public JSONArray listMembers(long teamId, int page, int limit) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    // 角色优先级：OWNER(2) > ADMIN(1) > NORMAL(0)
    members.sort((a, b) -> Long.compare(b.getType(), a.getType()));
    int total = members.size();
    int safeLimit = Math.max(1, Math.min(100, limit));
    int safePage = Math.max(1, page);
    int start = (safePage - 1) * safeLimit;
    if (start >= total) {
      return new JSONArray();
    }
    int end = Math.min(total, start + safeLimit);
    List<ACMTeamMember> pageMembers = members.subList(start, end);

    List<Long> uids = pageMembers.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);
    Map<Long, Pair<Integer, Integer>> metrics = questionTrackerBiz.getTrackerMetricsCached(uids);

    // 批量查询今天是否打卡（仅本页）
    List<Long> pageUids = pageMembers.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    List<Long> checkedIds = trackerClockRecordSerice.listTodayCheckedUserIds(pageUids);
    Set<Long> checkedSet = new HashSet<>(checkedIds);

    JSONArray arr = new JSONArray();
    for (ACMTeamMember m : pageMembers) {
      User u = userMap.get(m.getUid());
      JSONObject one = new JSONObject();
      one.put("userId", m.getUid());
      one.put("role", (int)m.getType());
      if (u != null) {
        one.put("name", u.getDisplayname());
        one.put("headUrl", u.getTinnyHeaderUrl());
      }
      one.put("joinTime", m.getCreateTime());
      Pair<Integer, Integer> p = metrics.get(m.getUid());
      int totalAc = p == null ? 0 : p.getLeft();
      int totalAll = p == null ? 0 : p.getRight();
      one.put("acceptCount", totalAc);
      one.put("submissionCount", totalAll);
      one.put("checkedToday", checkedSet.contains(m.getUid()));
      arr.add(one);
    }
    return arr;
  }

  public int transferOwner(long teamId, long newOwnerUserId) {
    // 获取当前队长
    ACMTeamInfo team = acmTeamInfoService.getById(teamId);
    if (team == null) {
      return 0;
    }
    long oldOwnerUserId = team.getUid();
    if (oldOwnerUserId == newOwnerUserId) {
      return 1; // 无变更
    }

    // 旧队长降级为普通成员（如存在）
    ACMTeamMember oldOwnerMember = acmTeamMemberService.getByGroupAndUid(teamId, oldOwnerUserId);
    if (oldOwnerMember != null && oldOwnerMember.getType() != ACMTeamMemberTypeEnum.NORMAL.getType()) {
      acmTeamMemberService.updateType(oldOwnerMember.getId(), ACMTeamMemberTypeEnum.NORMAL.getType());
    }

    // 新队长加入团队（如未加入）
    ACMTeamMember newOwnerMember = acmTeamMemberService.getByGroupAndUid(teamId, newOwnerUserId);
    if (newOwnerMember == null) {
      acmTeamMemberService.save(ACMTeamMember.build(teamId, newOwnerUserId, ACMTeamMemberTypeEnum.NORMAL));
      int count = acmTeamMemberService.getCountByGroupId(teamId);
      acmTeamInfoService.updatePersonCount(teamId, count);
      newOwnerMember = acmTeamMemberService.getByGroupAndUid(teamId, newOwnerUserId);
      // 新增成员：异步刷新 Redis 指标
      refreshUserTrackerMetricsAsync(newOwnerUserId);
    }
    // 新队长设置为 OWNER
    if (newOwnerMember != null && newOwnerMember.getType() != ACMTeamMemberTypeEnum.OWNER.getType()) {
      acmTeamMemberService.updateType(newOwnerMember.getId(), ACMTeamMemberTypeEnum.OWNER.getType());
    }

    // 更新团队拥有者
    int ret = acmTeamInfoService.updateUid(teamId, newOwnerUserId);
    // 成员角色变更后异步刷新活动积分
    refreshTeamActivityScoreAsync(teamId);

    return ret;
  }

  /**
   * 成员主动退出团队（队长不可直接退出）
   */
  public int quitTeam(long teamId, long userId) throws WenyibiException {
    ACMTeamInfo team = acmTeamInfoService.getById(teamId);
    if (team == null || !team.isNormal()) {
      throw new WenyibiException("团队不存在或已解散");
    }
    if (team.getUid() == userId) {
      throw new WenyibiException("队长不能直接退出，请先转让或解散团队");
    }
    ACMTeamMember member = acmTeamMemberService.getByGroupAndUid(teamId, userId);
    if (member == null) {
      return 0;
    }
    int ret = acmTeamMemberService.delete(member.getId());
    int count = acmTeamMemberService.getCountByGroupId(teamId);
    acmTeamInfoService.updatePersonCount(teamId, count);
    // 成员变更后异步刷新活动积分
    refreshTeamActivityScoreAsync(teamId);
    return ret;
  }

  /**
   * 队长解散团队：设置状态为已解散并移除所有成员
   */
  public int disbandTeam(long teamId, long operatorUserId) throws WenyibiException {
    if (!isTeamAdmin(teamId, operatorUserId)) {
      throw new WenyibiException("不是队长，无权操作");
    }
    // 解散前将团队名加前缀“已解散”，避免后续重名冲突
    ACMTeamInfo teamInfo = acmTeamInfoService.getById(teamId);
    if (teamInfo != null) {
      String oldName = teamInfo.getName() == null ? "" : teamInfo.getName();
      String newName = oldName.startsWith("已解散") ? oldName : ("已解散" + oldName);
      try {
        acmTeamInfoService.updateName(teamId, newName);
      } catch (Exception ignore) {
      }
    }
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    for (ACMTeamMember m : members) {
      acmTeamMemberService.delete(m.getId());
    }
    acmTeamInfoService.updatePersonCount(teamId, 0);
    return acmTeamInfoService.updateStatus(teamId, ACMTeamInfoStatusEnum.DISSOLVE.getType());
  }

  public String createInviteLink(long teamId) {
    // 简单返回一个包含 teamId 的链接（后续可接入令牌/短链）
    return String.format("/tracker/team/join?teamId=%s", teamId);
  }

  public String getInviteLink(long teamId) {
    return createInviteLink(teamId);
  }

  /**
   * 查询某用户是否在指定团队中
   */
  public JSONObject checkMember(long teamId, long userId) {
    JSONObject res = new JSONObject();
    ACMTeamMember member = acmTeamMemberService.getByGroupAndUid(teamId, userId);
    boolean inTeam = member != null;
    res.put("inTeam", inTeam);
    if (inTeam) {
      res.put("role", (int)member.getType());
      res.put("joinTime", member.getCreateTime());
    }
    return res;
  }

  // ============== 申请 / 邀请 逻辑 ==============
  public long applyJoin(long teamId, long userId, String message) throws WenyibiException {
    ACMTeamInfo team = acmTeamInfoService.getById(teamId);
    if (team == null || !team.isNormal()) {
      throw new WenyibiException("团队不存在或已解散");
    }
    // 已在团队则禁止重复申请
    if (acmTeamMemberService.getByGroupAndUid(teamId, userId) != null) {
      throw new WenyibiException("已在团队中");
    }
    // 是否已有未处理记录
    if (!acmTeamApplyService.getByGroupIdAndApplyUid(teamId, userId, ACMTeamApplyStatusEnum.INIT.getType()).isEmpty()) {
      throw new WenyibiException("你已提交申请，请等待处理");
    }
    // 生成申请记录（APPLY）
    ACMTeamApply apply = new ACMTeamApply(teamId, ACMTeamApplyTypeEnum.APPLY, userId, userId,
        message == null ? "" : message, ACMTeamApplyStatusEnum.INIT, new Date());
    return acmTeamApplyService.save(apply);
  }

  public int approveApply(long applyId, long operatorUserId) throws WenyibiException {
    ACMTeamApply apply = acmTeamApplyService.getById(applyId);
    if (apply == null || apply.getStatus() != ACMTeamApplyStatusEnum.INIT.getType()) {
      throw new WenyibiException("申请不存在或已处理");
    }
    long teamId = apply.getTeamId();
    if (!isTeamAdmin(teamId, operatorUserId)) {
      throw new WenyibiException("不是队长，无权操作");
    }
    ACMTeamInfo team = acmTeamInfoService.getById(teamId);
    int current = acmTeamMemberService.getCountByGroupId(teamId);
    if (current + 1 > team.getPersonLimit()) {
      throw new WenyibiException("团队人数已满");
    }
    // 通过，加入成员
    acmTeamApplyService.updateStatus(applyId, ACMTeamApplyStatusEnum.ACCEPTED.getType(), operatorUserId);
    acmTeamMemberService.save(ACMTeamMember.build(teamId, apply.getApplyUid(), ACMTeamMemberTypeEnum.NORMAL));
    // 同步更新团队人数
    int countAfter = acmTeamMemberService.getCountByGroupId(teamId);
    acmTeamInfoService.updatePersonCount(teamId, countAfter);
    // 异步刷新该用户的 Redis 指标
    refreshUserTrackerMetricsAsync(apply.getApplyUid());
    // 成员变更后异步刷新活动积分
    refreshTeamActivityScoreAsync(teamId);
    return 1;
  }

  public int rejectApply(long applyId, long operatorUserId) throws WenyibiException {
    ACMTeamApply apply = acmTeamApplyService.getById(applyId);
    if (apply == null || apply.getStatus() != ACMTeamApplyStatusEnum.INIT.getType()) {
      throw new WenyibiException("申请不存在或已处理");
    }
    long teamId = apply.getTeamId();
    if (!isTeamAdmin(teamId, operatorUserId)) {
      throw new WenyibiException("不是队长，无权操作");
    }
    acmTeamApplyService.updateStatus(applyId, ACMTeamApplyStatusEnum.REJECT.getType(), operatorUserId);
    return 1;
  }

  /**
   * 批量通过待处理申请
   */
  public int approveAllApplies(long teamId, long operatorUserId, int limit) throws WenyibiException {
    if (!isTeamAdmin(teamId, operatorUserId)) {
      throw new WenyibiException("不是队长，无权操作");
    }
    int lim = Math.max(1, Math.min(500, limit));
    List<ACMTeamApply> list = acmTeamApplyService
        .getByGroupIdAndType(teamId, ACMTeamApplyTypeEnum.APPLY.getType(), ACMTeamApplyStatusEnum.INIT.getType(), lim);
    int processed = 0;
    for (ACMTeamApply a : list) {
      try {
        approveApply(a.getId(), operatorUserId);
        processed++;
      } catch (WenyibiException ignore) {
        // 单条失败不影响整体
      }
    }
    // 成员批量变更后异步刷新活动积分
    refreshTeamActivityScoreAsync(teamId);
    return processed;
  }

  /**
   * 批量拒绝待处理申请
   */
  public int rejectAllApplies(long teamId, long operatorUserId, int limit) throws WenyibiException {
    if (!isTeamAdmin(teamId, operatorUserId)) {
      throw new WenyibiException("不是队长，无权操作");
    }
    int lim = Math.max(1, Math.min(500, limit));
    List<ACMTeamApply> list = acmTeamApplyService
        .getByGroupIdAndType(teamId, ACMTeamApplyTypeEnum.APPLY.getType(), ACMTeamApplyStatusEnum.INIT.getType(), lim);
    int processed = 0;
    for (ACMTeamApply a : list) {
      try {
        rejectApply(a.getId(), operatorUserId);
        processed++;
      } catch (WenyibiException ignore) {
        // 单条失败不影响整体
      }
    }
    return processed;
  }

  public long inviteUser(long teamId, long operatorUserId, long targetUserId) throws WenyibiException {
    if (!isTeamAdmin(teamId, operatorUserId)) {
      throw new WenyibiException("不是队长，无权操作");
    }
    // 检查是否已是成员
    if (acmTeamMemberService.getByGroupAndUid(teamId, targetUserId) != null) {
      throw new WenyibiException("已在团队中");
    }
    // 未处理邀请是否存在
    if (!acmTeamApplyService.getByGroupIdAndApplyUid(teamId, targetUserId, ACMTeamApplyStatusEnum.INIT.getType()).isEmpty()) {
      throw new WenyibiException("对方已有待处理的申请/邀请");
    }
    ACMTeamApply apply = new ACMTeamApply(teamId, ACMTeamApplyTypeEnum.INVITE, targetUserId, operatorUserId,
        "", ACMTeamApplyStatusEnum.INIT, new Date());
    return acmTeamApplyService.save(apply);
  }

  public int acceptInvite(long applyId, long userId) throws WenyibiException {
    ACMTeamApply apply = acmTeamApplyService.getById(applyId);
    if (apply == null || apply.getStatus() != ACMTeamApplyStatusEnum.INIT.getType()) {
      throw new WenyibiException("邀请不存在或已处理");
    }
    if (apply.getType() != ACMTeamApplyTypeEnum.INVITE.getType() || apply.getApplyUid() != userId) {
      throw new WenyibiException("无权操作此邀请");
    }
    long teamId = apply.getTeamId();
    ACMTeamInfo team = acmTeamInfoService.getById(teamId);
    int current = acmTeamMemberService.getCountByGroupId(teamId);
    if (current + 1 > team.getPersonLimit()) {
      throw new WenyibiException("团队人数已满");
    }
    acmTeamApplyService.updateStatus(applyId, ACMTeamApplyStatusEnum.ACCEPTED.getType(), userId);
    acmTeamMemberService.save(ACMTeamMember.build(teamId, userId, ACMTeamMemberTypeEnum.NORMAL));
    // 同步更新团队人数
    int countAfter = acmTeamMemberService.getCountByGroupId(teamId);
    acmTeamInfoService.updatePersonCount(teamId, countAfter);
    // 异步刷新该用户的 Redis 指标
    refreshUserTrackerMetricsAsync(userId);
    // 成员变更后异步刷新活动积分
    refreshTeamActivityScoreAsync(teamId);
    return 1;
  }

  public int declineInvite(long applyId, long userId) throws WenyibiException {
    ACMTeamApply apply = acmTeamApplyService.getById(applyId);
    if (apply == null || apply.getStatus() != ACMTeamApplyStatusEnum.INIT.getType()) {
      throw new WenyibiException("邀请不存在或已处理");
    }
    if (apply.getType() != ACMTeamApplyTypeEnum.INVITE.getType() || apply.getApplyUid() != userId) {
      throw new WenyibiException("无权操作此邀请");
    }
    acmTeamApplyService.updateStatus(applyId, ACMTeamApplyStatusEnum.REJECT.getType(), userId);
    return 1;
  }

  /**
   * 队长撤销尚未处理的邀请
   */
  public int cancelInvite(long applyId, long operatorUserId) throws WenyibiException {
    ACMTeamApply apply = acmTeamApplyService.getById(applyId);
    if (apply == null || apply.getStatus() != ACMTeamApplyStatusEnum.INIT.getType()) {
      throw new WenyibiException("邀请不存在或已处理");
    }
    if (apply.getType() != ACMTeamApplyTypeEnum.INVITE.getType()) {
      throw new WenyibiException("该记录不是邀请类型");
    }
    long teamId = apply.getTeamId();
    if (!isTeamAdmin(teamId, operatorUserId)) {
      throw new WenyibiException("不是队长，无权操作");
    }
    acmTeamApplyService.updateStatus(applyId, ACMTeamApplyStatusEnum.REJECT.getType(), operatorUserId);
    return 1;
  }

  // ============== 申请/邀请 列表查询（用于管理页） ==============
  /**
   * 获取团队待审批申请列表（支持分页）
   * @param teamId 团队ID
   * @param page 页码，从1开始
   * @param limit 每页大小
   * @return 返回包含分页信息和数据列表的JSONObject
   */
  public JSONObject listTeamPendingApply(long teamId, int page, int limit) throws WenyibiException {
    // 先获取所有待审批的申请（限制最大1000条，避免一次性查询过多）
    int maxLimit = 1000;
    List<ACMTeamApply> allList = acmTeamApplyService
        .getByGroupIdAndType(teamId, ACMTeamApplyTypeEnum.APPLY.getType(), ACMTeamApplyStatusEnum.INIT.getType(), maxLimit);
    
    // 使用分页工具进行分页
    Page<ACMTeamApply> pageWithData = PagingUtils.getPageWithData(page, limit, allList);
    
    // 装饰当前页的数据
    JSONArray dataList = decorateApplyList(pageWithData.getData());
    
    // 构建返回结果
    JSONObject result = new JSONObject();
    result.put("dataList", dataList);
    JSONObject pageInfo = PagingUtils.getPageInfo(limit, pageWithData);
    result.put("pageInfo", pageInfo);
    
    return result;
  }
  
  /**
   * 获取团队待审批申请列表（兼容旧版本，不支持分页）
   * @deprecated 请使用 listTeamPendingApply(long teamId, int page, int limit)
   */
  @Deprecated
  public JSONArray listTeamPendingApply(long teamId, int limit) throws WenyibiException {
    List<ACMTeamApply> list = acmTeamApplyService
        .getByGroupIdAndType(teamId, ACMTeamApplyTypeEnum.APPLY.getType(), ACMTeamApplyStatusEnum.INIT.getType(), Math.max(1, Math.min(500, limit)));
    return decorateApplyList(list);
  }

  public JSONArray listTeamPendingInvite(long teamId, int limit) throws WenyibiException {
    List<ACMTeamApply> list = acmTeamApplyService
        .getByGroupIdAndType(teamId, ACMTeamApplyTypeEnum.INVITE.getType(), ACMTeamApplyStatusEnum.INIT.getType(), Math.max(1, Math.min(500, limit)));
    return decorateApplyList(list);
  }

  private JSONArray decorateApplyList(List<ACMTeamApply> list) {
    JSONArray arr = new JSONArray();
    if (list == null || list.isEmpty()) {
      return arr;
    }
    // 批量拉取用户信息
    List<Long> uids = list.stream().map(ACMTeamApply::getApplyUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);
    // 批量拉取团队信息
    List<Long> teamIds = list.stream().map(ACMTeamApply::getTeamId).collect(Collectors.toList());
    List<Integer> allTypes = Arrays.asList(
        ACMTeamTypeInfoEnum.ACM.getCode(), ACMTeamTypeInfoEnum.TRACKER.getCode());
    Map<Long, ACMTeamInfo> teamMap = acmTeamInfoService.getMapByIds(teamIds, allTypes);
    // 批量拉取队长信息
    Set<Long> ownerIds = teamMap.values().stream().map(ACMTeamInfo::getUid).collect(Collectors.toSet());
    Map<Long, User> ownerMap = ownerIds.isEmpty() ? Collections.emptyMap() : userService.getUserMapsByIds(new ArrayList<>(ownerIds));
    // 批量获取用户过题数（用于审批列表显示）
    Map<Long, Pair<Integer, Integer>> metrics = questionTrackerBiz.getTrackerMetricsCached(uids);
    for (ACMTeamApply a : list) {
      JSONObject o = new JSONObject();
      o.put("id", a.getId());
      o.put("teamId", a.getTeamId());
      o.put("type", a.getType());
      o.put("applyUid", a.getApplyUid());
      o.put("sender", a.getSender());
      o.put("message", a.getMessage());
      o.put("status", (int)a.getStatus());
      o.put("createTime", a.getCreateTime());
      ACMTeamInfo t = teamMap.get(a.getTeamId());
      if (t != null) {
        o.put("teamName", t.getName());
        o.put("ownerUserId", t.getUid());
        o.put("description", t.getDescription());
        User owner = ownerMap.get(t.getUid());
        if (owner != null) {
          o.put("ownerName", owner.getDisplayname());
          o.put("ownerHeadUrl", owner.getTinnyHeaderUrl());
        }
      }
      User u = userMap.get(a.getApplyUid());
      if (u != null) {
        o.put("applyUserName", u.getDisplayname());
        o.put("applyUserHeadUrl", u.getTinnyHeaderUrl());
      }
      // 添加过题数字段
      Pair<Integer, Integer> p = metrics.get(a.getApplyUid());
      int totalAc = p == null ? 0 : p.getLeft();
      o.put("acceptCount", totalAc);
      arr.add(o);
    }
    return arr;
  }

  /**
   * 我提交的申请 / 邀请列表装饰（含 teamName、statusText）
   */
  private JSONArray decorateMyApplyOrInviteList(List<ACMTeamApply> list) {
    JSONArray arr = new JSONArray();
    if (list == null || list.isEmpty()) {
      return arr;
    }
    List<Long> teamIds = list.stream().map(ACMTeamApply::getTeamId).collect(Collectors.toList());
    List<Integer> allTypes = Arrays.asList(
        ACMTeamTypeInfoEnum.ACM.getCode(), ACMTeamTypeInfoEnum.TRACKER.getCode());
    Map<Long, ACMTeamInfo> teamMap = acmTeamInfoService.getMapByIds(teamIds, allTypes);
    // 批量拉取队长信息
    Set<Long> ownerIds = teamMap.values().stream().map(ACMTeamInfo::getUid).collect(Collectors.toSet());
    Map<Long, User> ownerMap = ownerIds.isEmpty() ? Collections.emptyMap() : userService.getUserMapsByIds(new ArrayList<>(ownerIds));
    for (ACMTeamApply a : list) {
      JSONObject o = new JSONObject();
      o.put("id", a.getId());
      o.put("applyId", a.getId());
      o.put("teamId", a.getTeamId());
      ACMTeamInfo t = teamMap.get(a.getTeamId());
      if (t != null) {
        o.put("teamName", t.getName());
        o.put("ownerUserId", t.getUid());
        o.put("description", t.getDescription());
        User owner = ownerMap.get(t.getUid());
        if (owner != null) {
          o.put("ownerName", owner.getDisplayname());
          o.put("ownerHeadUrl", owner.getTinnyHeaderUrl());
        }
      }
      o.put("message", a.getMessage());
      o.put("status", (int)a.getStatus());
      o.put("statusText", statusText(a.getStatus()));
      o.put("createTime", a.getCreateTime());
      arr.add(o);
    }
    return arr;
  }

  private String statusText(int status) {
    ACMTeamApplyStatusEnum e = ACMTeamApplyStatusEnum.getByType(status);
    if (e == null) {
      return String.valueOf(status);
    }
    switch (e) {
      case INIT:
        return "INIT";
      case ACCEPTED:
        return "ACCEPTED";
      case REJECT:
        return "REJECT";
      default:
        return e.name();
    }
  }

  // 我提交的申请列表
  public JSONArray listMyApply(long userId, int limit) {
    int lim = Math.max(1, Math.min(500, limit));
    List<ACMTeamApply> list = acmTeamApplyService
        .getByApplyUidAndType(userId, ACMTeamApplyTypeEnum.APPLY.getType(), ACMTeamApplyStatusEnum.INIT.getType(), lim);
    return decorateMyApplyOrInviteList(list);
  }

  // 邀请我的列表（默认仅 INIT）
  public JSONArray listMyInvite(long userId, int limit) {
    int lim = Math.max(1, Math.min(500, limit));
    List<ACMTeamApply> list = acmTeamApplyService
        .getByApplyUidAndType(userId, ACMTeamApplyTypeEnum.INVITE.getType(), ACMTeamApplyStatusEnum.INIT.getType(), lim);
    return decorateMyApplyOrInviteList(list);
  }

  // ============== 看板与榜单 ==============
  public JSONObject getTeamStatsSummary(long teamId) {
    // 缓存内容
    JSONObject summary = teamSummaryCache.getUnchecked(teamId);
    if (summary == null) {
      summary = new JSONObject();
    }
    // 追加“团队今日打卡人数”（不缓存）
    try {
      List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
      List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
      int todayClock = trackerClockRecordSerice.countTodayClockByUserIds(uids);
      summary.put("todayClockCount", todayClock);
    } catch (Exception ignore) {
      // 忽略单字段异常
    }
    // 覆盖“团队人数”为实时值（不使用缓存）
    try {
      int realtimeMemberCount = acmTeamMemberService.getCountByGroupId(teamId);
      summary.put("memberCount", realtimeMemberCount);
    } catch (Exception ignore) {
    }
    return summary;
  }

  /** 实际统计计算，供缓存loader使用 */
  private JSONObject computeTeamStatsSummary(long teamId) {
    long allStart = System.currentTimeMillis();
    JSONObject summary = new JSONObject();
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    int memberCount = members.size();
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);
    // today / 7 days
    Date now = new Date();
    Date todayBegin = NcDateUtils.getDayBeginDate(now);
    Date sevenDaysBegin = DateUtil.getDateAfter(todayBegin, -6);
    Date yesterdayBegin = DateUtil.getDateAfter(todayBegin, -1);
    // 并行化子任务：总量 AC、总量提交、今日 AC、7日 AC、昨日 AC
    CompletableFuture<Map<Long, Integer>> totalAcceptFuture =
        CompletableFuture.supplyAsync(() -> {
          long s = System.currentTimeMillis();
          Map<Long, Integer> r = questionTrackerBiz.getTrackerAcceptCountByUserIds(uids);
          logger.error(String.format("[teamSummary] teamId=%d totalAccept cost=%dms size=%d",
              teamId, System.currentTimeMillis() - s, uids.size()));
          return r;
        });
    CompletableFuture<Map<Long, Integer>> totalSubmitFuture =
        CompletableFuture.supplyAsync(() -> {
          long s = System.currentTimeMillis();
          Map<Long, Integer> r = questionTrackerBiz.getTrackerSubmissionCountByUserIds(uids);
          logger.error(String.format("[teamSummary] teamId=%d totalSubmit cost=%dms size=%d",
              teamId, System.currentTimeMillis() - s, uids.size()));
          return r;
        });
    CompletableFuture<Map<Long, Integer>> todayMapFuture =
        CompletableFuture.supplyAsync(() -> {
          long s = System.currentTimeMillis();
          Map<Long, Integer> r = questionTrackerBiz.getTrackerAcceptCountByUserIdsBetweenDates(uids, todayBegin, now);
          logger.error(String.format("[teamSummary] teamId=%d todayAccept cost=%dms size=%d window=[%tF %<tT, %tF %<tT]",
              teamId, System.currentTimeMillis() - s, uids.size(), todayBegin, now));
          return r;
        });
    CompletableFuture<Map<Long, Integer>> sevenDaysMapFuture =
        CompletableFuture.supplyAsync(() -> {
          long s = System.currentTimeMillis();
          Map<Long, Integer> r = questionTrackerBiz.getTrackerAcceptCountByUserIdsBetweenDates(uids, sevenDaysBegin, now);
          logger.error(String.format("[teamSummary] teamId=%d sevenDaysAccept cost=%dms size=%d window=[%tF %<tT, %tF %<tT]",
              teamId, System.currentTimeMillis() - s, uids.size(), sevenDaysBegin, now));
          return r;
        });
    CompletableFuture<Map<Long, Integer>> yesterdayMapFuture =
        CompletableFuture.supplyAsync(() -> {
          long s = System.currentTimeMillis();
          Map<Long, Integer> r = questionTrackerBiz.getTrackerAcceptCountByUserIdsBetweenDates(uids, yesterdayBegin, todayBegin);
          logger.error(String.format("[teamSummary] teamId=%d yesterdayAccept cost=%dms size=%d window=[%tF %<tT, %tF %<tT]",
              teamId, System.currentTimeMillis() - s, uids.size(), yesterdayBegin, todayBegin));
          return r;
        });

    Map<Long, Integer> acceptCountMap = totalAcceptFuture.join();
    Map<Long, Integer> totalSubmitMap = totalSubmitFuture.join();
    Map<Long, Integer> todayMap = todayMapFuture.join();
    Map<Long, Integer> sevenDaysMap = sevenDaysMapFuture.join();
    Map<Long, Integer> yesterdayMap = yesterdayMapFuture.join();

    int totalAccept = 0;
    int totalSubmission = 0;
    for (ACMTeamMember m : members) {
      totalAccept += acceptCountMap.getOrDefault(m.getUid(), 0);
      totalSubmission += totalSubmitMap.getOrDefault(m.getUid(), 0);
    }
    ACMTeamInfo team = acmTeamInfoService.getById(teamId);
    summary.put("teamId", teamId);
    summary.put("memberCount", memberCount);
    summary.put("totalAcceptCount", totalAccept);
    summary.put("totalSubmissionCount", totalSubmission);
    // 聚合今日/7日过题（按成员汇总）
    int todayAccept = 0, sevenDaysAccept = 0;
    for (Long uid : uids) {
      todayAccept += todayMap.getOrDefault(uid, 0);
      sevenDaysAccept += sevenDaysMap.getOrDefault(uid, 0);
    }
    summary.put("todayAcceptCount", todayAccept);
    summary.put("sevenDaysAcceptCount", sevenDaysAccept);
    // 昨日卷王：按昨日AC最多，若并列，用昨日提交次数最多打破（提交数以WWW站统计为准）
    long topUid = 0L;
    int topAc = -1;
    List<Long> tieUids = new ArrayList<>();
    for (Long uid : uids) {
      int ac = yesterdayMap.getOrDefault(uid, 0);
      if (ac > topAc) {
        topAc = ac;
        tieUids.clear();
        tieUids.add(uid);
      } else if (ac == topAc) {
        tieUids.add(uid);
      }
    }
    // 特判：昨日AC最大为0，则不产生“昨日卷王”
    if (topAc <= 0) {
      summary.put("yesterdayKing", null);
    } else {
      int topSubmit = 0;
      if (!tieUids.isEmpty()) {
        if (tieUids.size() == 1) {
          topUid = tieUids.get(0);
          // 昨日提交次数（WWW + ACM）
          int www = codingSubmissionService.getSubmissonCountByUidBetweenDate(topUid, yesterdayBegin, todayBegin);
          int acm = acmCodingSubmissionService.getSubmissonCountByUidBetweenDate(topUid, yesterdayBegin, todayBegin);
          topSubmit = www + acm;
        } else {
          int maxSubmit = -1;
          long pick = 0L;
          for (Long uid : tieUids) {
            int www = codingSubmissionService.getSubmissonCountByUidBetweenDate(uid, yesterdayBegin, todayBegin);
            int acm = acmCodingSubmissionService.getSubmissonCountByUidBetweenDate(uid, yesterdayBegin, todayBegin);
            int sub = www + acm;
            if (sub > maxSubmit || (sub == maxSubmit && uid < pick)) {
              maxSubmit = sub;
              pick = uid;
            }
          }
          topUid = pick;
          topSubmit = Math.max(0, maxSubmit);
        }
      }
      JSONObject yesterdayKing = new JSONObject();
      yesterdayKing.put("userId", topUid);
      yesterdayKing.put("acceptCount", topAc);
      yesterdayKing.put("submissionCount", topSubmit);
      // 头像与个人页URL
      User king = userMap.get(topUid);
      if (king != null) {
        yesterdayKing.put("headUrl", king.getTinnyHeaderUrl());
        yesterdayKing.put("name", king.getDisplayname());
      }
      summary.put("yesterdayKing", yesterdayKing);
    }
    if (team != null) {
      summary.put("name", team.getName());
      summary.put("ownerUserId", team.getUid());
      summary.put("personLimit", team.getPersonLimit());
    }
    logger.error(String.format("[teamSummary] teamId=%d build done in %dms, members=%d",
        teamId, System.currentTimeMillis() - allStart, memberCount));
    return summary;
  }

  public JSONArray getTeamLeaderboard(long teamId, int limit) {
    return getTeamLeaderboard(teamId, limit, "total");
  }

  /**
   * 团队榜单：按总/今日/7日过题数排序
   * type 可为：total | today | 7days（忽略大小写）
   */
  public JSONArray getTeamLeaderboard(long teamId, int limit, String type) {
    return getTeamLeaderboard(teamId, limit, type, 1);
  }

  /**
   * 分页版榜单
   */
  public JSONArray getTeamLeaderboard(long teamId, int limit, String type, int page) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);
    List<JSONObject> rows = new ArrayList<>();

    Map<Long, Integer> acceptCountMap;
    String t = type == null ? "total" : type.toLowerCase();
    if ("today".equals(t) || "7days".equals(t)) {
      Date now = new Date();
      Date todayBegin = com.wenyibi.futuremail.util.NcDateUtils.getDayBeginDate(now);
      Date begin = todayBegin;
      if ("7days".equals(t)) {
        begin = com.wenyibi.futuremail.util.DateUtil.getDateAfter(todayBegin, -6);
      }
      acceptCountMap = questionTrackerBiz.getTrackerAcceptCountByUserIdsBetweenDates(uids, begin, now);
    } else {
      // 默认 total
      acceptCountMap = questionTrackerBiz.getTrackerAcceptCountByUserIds(uids);
    }

    for (ACMTeamMember m : members) {
      int ac = acceptCountMap.getOrDefault(m.getUid(), 0);
      JSONObject row = new JSONObject();
      row.put("userId", m.getUid());
      row.put("acceptCount", ac);
      User u = userMap.get(m.getUid());
      if (u != null) {
        row.put("name", u.getDisplayname());
        row.put("headUrl", u.getTinnyHeaderUrl());
      }
      rows.add(row);
    }
    rows.sort((a, b) -> Integer.compare(b.getIntValue("acceptCount"), a.getIntValue("acceptCount")));
    // 分页切片
    int safeLimit = Math.max(1, Math.min(100, limit));
    int safePage = Math.max(1, page);
    int start = (safePage - 1) * safeLimit;
    if (start >= rows.size()) {
      return new JSONArray();
    }
    int end = Math.min(rows.size(), start + safeLimit);
    JSONArray pageArr = new JSONArray();
    for (int i = start; i < end; i++) {
      JSONObject r = rows.get(i);
      // 全局排名
      r.put("rank", i + 1);
      pageArr.add(r);
    }
    return pageArr;
  }

  /**
   * 返回带 total 的分页榜单
   */
  public JSONObject getTeamLeaderboardWithTotal(long teamId, int limit, String type, int page) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);
    List<JSONObject> rows = new ArrayList<>();

    Map<Long, Integer> acceptCountMap;
    String t = type == null ? "total" : type.toLowerCase();
    if ("today".equals(t) || "7days".equals(t)) {
      Date now = new Date();
      Date todayBegin = com.wenyibi.futuremail.util.NcDateUtils.getDayBeginDate(now);
      Date begin = todayBegin;
      if ("7days".equals(t)) {
        begin = com.wenyibi.futuremail.util.DateUtil.getDateAfter(todayBegin, -6);
      }
      acceptCountMap = questionTrackerBiz.getTrackerAcceptCountByUserIdsBetweenDates(uids, begin, now);
    } else {
      // total：优先命中 QuestionTrackerBiz 的 per-user 缓存
      Map<Long, Pair<Integer, Integer>> metrics = questionTrackerBiz.getTrackerMetricsCached(uids);
      acceptCountMap = new HashMap<>();
      for (Long id : uids) {
        Pair<Integer, Integer> p = metrics.get(id);
        if (p != null) acceptCountMap.put(id, p.getLeft());
      }
    }

    for (ACMTeamMember m : members) {
      int ac = acceptCountMap.getOrDefault(m.getUid(), 0);
      JSONObject row = new JSONObject();
      row.put("userId", m.getUid());
      row.put("acceptCount", ac);
      User u = userMap.get(m.getUid());
      if (u != null) {
        row.put("name", u.getDisplayname());
        row.put("headUrl", u.getTinnyHeaderUrl());
      }
      rows.add(row);
    }
    rows.sort((a, b) -> Integer.compare(b.getIntValue("acceptCount"), a.getIntValue("acceptCount")));
    int total = rows.size();
    int safeLimit = Math.max(1, Math.min(100, limit));
    int safePage = Math.max(1, page);
    int start = (safePage - 1) * safeLimit;
    JSONArray list = new JSONArray();
    if (start < total) {
      int end = Math.min(total, start + safeLimit);
      for (int i = start; i < end; i++) {
        JSONObject r = rows.get(i);
        r.put("rank", i + 1);
        list.add(r);
      }
    }
    JSONObject res = new JSONObject();
    res.put("total", total);
    res.put("list", list);
    return res;
  }

  /**
   * 团队打卡排行榜（分页）
   * scope: total | today | 7days
   */
  public JSONObject getTeamClockLeaderboard(long teamId, String scope, int page, int limit) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);

    List<JSONObject> rows = new ArrayList<>();
    String s = scope == null ? "total" : scope.toLowerCase();
    if ("7days".equals(s)) {
      // 近7日打卡天数
      Map<Long, Integer> map = trackerClockRecordSerice.countSevenDaysClockByUserIds(uids);
      for (Long uid : uids) {
        int cnt = map.getOrDefault(uid, 0);
        JSONObject r = new JSONObject();
        r.put("userId", uid);
        r.put("count", cnt);
        rows.add(r);
      }
      rows.sort((a, b) -> Integer.compare(b.getIntValue("count"), a.getIntValue("count")));
    } else if ("today".equals(s)) {
      // 今日：count=是否打卡(0/1)
      List<Long> checkedIds = trackerClockRecordSerice.listTodayCheckedUserIds(uids);
      Set<Long> checkedSet = new HashSet<>(checkedIds);
      for (Long uid : uids) {
        int cnt = checkedSet.contains(uid) ? 1 : 0;
        JSONObject r = new JSONObject();
        r.put("userId", uid);
        r.put("count", cnt);
        rows.add(r);
      }
      rows.sort((a, b) -> Integer.compare(b.getIntValue("count"), a.getIntValue("count")));
    } else {
      // 累计：一次性从 DB 统计累计打卡天数，减少 Redis 循环调用
      Map<Long, Integer> totalMap = trackerClockRecordSerice.countAllClockDaysByUserIds(uids);
      for (Long uid : uids) {
        int totalDays = totalMap.getOrDefault(uid, 0);
        JSONObject r = new JSONObject();
        r.put("userId", uid);
        r.put("count", totalDays);
        rows.add(r);
      }
      rows.sort((a, b) -> Integer.compare(b.getIntValue("count"), a.getIntValue("count")));
    }

    int total = rows.size();
    int safeLimit = Math.max(1, Math.min(100, limit));
    int safePage = Math.max(1, page);
    int start = (safePage - 1) * safeLimit;
    JSONArray list = new JSONArray();
    if (start < total) {
      int end = Math.min(total, start + safeLimit);
      // 仅对当前页成员拼装最终 JSON，并补充 continueDays 与 checkedToday
      List<Long> pageUids = new ArrayList<>();
      for (int i = start; i < end; i++) {
        pageUids.add(rows.get(i).getLong("userId"));
      }
      // 批量获取今日是否打卡（仅本页）
      List<Long> checkedIds = trackerClockRecordSerice.listTodayCheckedUserIds(pageUids);
      Set<Long> checkedSet = new HashSet<>(checkedIds);
      for (int i = start; i < end; i++) {
        JSONObject base = rows.get(i);
        long uid = base.getLongValue("userId");
        int cnt = base.getIntValue("count");
        // 每页再取连续打卡天数（Redis）
        Double cont = JedisAdapter.zScore(RedisKeyUtil.getTrackerClockContinusboard(), String.valueOf(uid));
        JSONObject r = new JSONObject();
        r.put("userId", uid);
        r.put("count", cnt);
        r.put("continueDays", cont == null ? 0 : cont.intValue());
        User u = userMap.get(uid);
        if (u != null) {
          r.put("name", u.getDisplayname());
          r.put("headUrl", u.getTinnyHeaderUrl());
        }
        r.put("rank", i + 1);
        r.put("checkedToday", checkedSet.contains(uid));
        list.add(r);
      }
    }
    JSONObject res = new JSONObject();
    res.put("total", total);
    res.put("list", list);
    return res;
  }

  /** 兼容旧调用：默认 total */
  public JSONObject getTeamClockLeaderboard(long teamId, int page, int limit) {
    return getTeamClockLeaderboard(teamId, "total", page, limit);
  }

  /**
   * 团队技能树排行榜（分页）
   * scope: total | today
   * stage: 枚举 key（INTERLUDE_DAWN|CHAPTER1|CHAPTER2）或 "all"
   */
  public JSONObject getTeamSkillTreeLeaderboard(long teamId, String scope, String stageKey, int page, int limit) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);

    List<Long> problemIds;
    if (org.apache.commons.lang3.StringUtils.isBlank(stageKey) || "all".equalsIgnoreCase(stageKey)) {
      // all 表示“技能树全部题目”（而非 tracker 全部题目）
      TrackerStageEnum[] stages = new TrackerStageEnum[] {
          TrackerStageEnum.CHAPTER1,
          TrackerStageEnum.INTERLUDE_DAWN,
          TrackerStageEnum.CHAPTER2
      };
      Set<Long> pidSet = new LinkedHashSet<>();
      for (TrackerStageEnum st : stages) {
        pidSet.addAll(questionTrackerBiz.getSkillTreeProblemIdsByChapter(st));
      }
      problemIds = new ArrayList<>(pidSet);
    } else {
      TrackerStageEnum stage =
          TrackerStageEnum.fromKey(stageKey);
      problemIds = new ArrayList<>(questionTrackerBiz.getSkillTreeProblemIdsByChapter(stage));
    }

    Map<Long, Integer> acceptCountMap;
    String s = scope == null ? "total" : scope.toLowerCase();
    if ("today".equals(s)) {
      Date now = new Date();
      Date todayBegin = com.wenyibi.futuremail.util.NcDateUtils.getDayBeginDate(now);
      acceptCountMap = questionTrackerBiz.getAcceptCountInProblemSetByUserIdsBetweenDates(uids, problemIds, todayBegin, now);
    } else {
      acceptCountMap = questionTrackerBiz.getAcceptCountInProblemSetByUserIds(uids, problemIds);
    }

    // 仅保留排序所需的最小信息，避免未分页时大量拼接 JSON
    List<JSONObject> rows = new ArrayList<>();
    for (Long uid : uids) {
      int ac = acceptCountMap.getOrDefault(uid, 0);
      JSONObject row = new JSONObject();
      row.put("userId", uid);
      row.put("acceptCount", ac);
      rows.add(row);
    }
    rows.sort((a, b) -> Integer.compare(b.getIntValue("acceptCount"), a.getIntValue("acceptCount")));

    int total = rows.size();
    int safeLimit = Math.max(1, Math.min(100, limit));
    int safePage = Math.max(1, page);
    int start = (safePage - 1) * safeLimit;
    JSONArray list = new JSONArray();
    if (start < total) {
      int end = Math.min(total, start + safeLimit);
      for (int i = start; i < end; i++) {
        JSONObject base = rows.get(i);
        long uid = base.getLongValue("userId");
        int ac = base.getIntValue("acceptCount");
        JSONObject r = new JSONObject();
        r.put("userId", uid);
        r.put("acceptCount", ac);
        User u = userMap.get(uid);
        if (u != null) {
          r.put("name", u.getDisplayname());
          r.put("headUrl", u.getTinnyHeaderUrl());
        }
        r.put("rank", i + 1);
        list.add(r);
      }
    }
    JSONObject res = new JSONObject();
    res.put("total", total);
    // 返回当前题单的题目总数
    res.put("problemTotal", problemIds == null ? 0 : problemIds.size());
    res.put("list", list);
    return res;
  }

  /**
   * 团队题单排行榜（默认用于“新手130”）
   * 一次性返回该页用户的：累计(totalAccept)、7日(sevenDaysAccept)、今日(todayAccept)
   * 排序依据：累计 totalAccept
   * topicId: 默认使用 TrackerBadgeBiz.NEWBIE130_TOPIC_ID
   */
  public JSONObject getTeamTopicLeaderboard(long teamId, int topicId, int page, int limit) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);

    // 通过成就模块缓存获取题单的 problemIds
    List<Long> problemIds = trackerBadgeBiz.getProblemIdsByTopic(topicId);

    // 1) 全量计算累计，用于排序分页
    Map<Long, Integer> totalMap = questionTrackerBiz.getAcceptCountInProblemSetByUserIds(uids, problemIds);

    List<JSONObject> rows = new ArrayList<>();
    for (Long uid : uids) {
      int ac = totalMap.getOrDefault(uid, 0);
      JSONObject row = new JSONObject();
      row.put("userId", uid);
      row.put("totalAccept", ac);
      User u = userMap.get(uid);
      if (u != null) {
        row.put("name", u.getDisplayname());
        row.put("headUrl", u.getTinnyHeaderUrl());
      }
      rows.add(row);
    }
    rows.sort((a, b) -> Integer.compare(b.getIntValue("totalAccept"), a.getIntValue("totalAccept")));

    int total = rows.size();
    int safeLimit = Math.max(1, Math.min(100, limit));
    int safePage = Math.max(1, page);
    int start = (safePage - 1) * safeLimit;
    JSONArray list = new JSONArray();
    if (start < total) {
      int end = Math.min(total, start + safeLimit);
      // 2) 仅对当前页用户计算 今日/7日
      List<Long> pageUids = new ArrayList<>();
      for (int i = start; i < end; i++) {
        pageUids.add(rows.get(i).getLong("userId"));
      }
      Date now = new Date();
      Date todayBegin = com.wenyibi.futuremail.util.NcDateUtils.getDayBeginDate(now);
      Date sevenDaysBegin = com.wenyibi.futuremail.util.DateUtil.getDateAfter(todayBegin, -6);
      Map<Long, Integer> todayMap = questionTrackerBiz.getAcceptCountInProblemSetByUserIdsBetweenDates(pageUids, problemIds, todayBegin, now);
      Map<Long, Integer> sevenDaysMap = questionTrackerBiz.getAcceptCountInProblemSetByUserIdsBetweenDates(pageUids, problemIds, sevenDaysBegin, now);
      for (int i = start; i < end; i++) {
        JSONObject r = rows.get(i);
        r.put("rank", i + 1);
        long uid = r.getLongValue("userId");
        r.put("todayAccept", todayMap.getOrDefault(uid, 0));
        r.put("sevenDaysAccept", sevenDaysMap.getOrDefault(uid, 0));
        list.add(r);
      }
    }
    JSONObject res = new JSONObject();
    res.put("total", total);
    // 返回该题单的题目总数（仅本方法有 problemIds）
    res.put("problemTotal", problemIds == null ? 0 : problemIds.size());
    res.put("list", list);
    return res;
  }

  // ================== 团队活动：统计与榜单 ==================

  /**
   * 团队活动期间打卡总人次（不去重）
   */
  public JSONObject getTeamActivityClockTotal(long teamId, Date beginDate, Date endDate) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    // 采用“人次（人-天）”口径，避免同一用户同日多次打卡被重复计数
    int totalTimes = trackerClockRecordSerice.countClockPersonDaysByUserIdsBetweenDates(beginDate, endDate, uids);
    JSONObject res = new JSONObject();
    res.put("teamId", teamId);
    res.put("begin", beginDate);
    res.put("end", endDate);
    res.put("totalTimes", totalTimes);
    return res;
  }

  /**
   * 累计打卡天数达到阈值的用户列表（30/60/100）
   */
  public JSONObject getTeamClockDaysReachedUsers(long teamId) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, Integer> daysMap = trackerClockRecordSerice.countAllClockDaysByUserIds(uids);
    List<Long> ge30 = new ArrayList<>();
    List<Long> ge60 = new ArrayList<>();
    List<Long> ge100 = new ArrayList<>();
    for (Map.Entry<Long, Integer> e : daysMap.entrySet()) {
      int d = e.getValue() == null ? 0 : e.getValue();
      if (d >= 30) ge30.add(e.getKey());
      if (d >= 60) ge60.add(e.getKey());
      if (d >= 100) ge100.add(e.getKey());
    }
    JSONObject res = new JSONObject();
    res.put("ge30UserIds", ge30);
    res.put("ge30Count", ge30.size());
    res.put("ge60UserIds", ge60);
    res.put("ge60Count", ge60.size());
    res.put("ge100UserIds", ge100);
    res.put("ge100Count", ge100.size());
    return res;
  }

  /**
   * 题单刷完的同学名单（四类题单）
   */
  public JSONObject getTeamTopicFinishedUsers(long teamId) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    int[] topics = new int[] {
        TrackerBadgeBiz.NEWBIE130_TOPIC_ID,
        TrackerBadgeBiz.ALGORITHM_INTRO_TOPIC_ID,
        TrackerBadgeBiz.ALGORITHM_ADVANCED_TOPIC_ID,
        TrackerBadgeBiz.ALGORITHM_PEAK_TOPIC_ID
    };
    String[] keys = new String[] { "newbie130", "intro", "advanced", "peak" };
    JSONObject res = new JSONObject();
    for (int i = 0; i < topics.length; i++) {
      List<Long> problemIds = trackerBadgeBiz.getProblemIdsByTopic(topics[i]);
      int total = problemIds == null ? 0 : problemIds.size();
      List<Long> finished = new ArrayList<>();
      if (total > 0) {
        Map<Long, Integer> acceptMap = questionTrackerBiz.getAcceptCountInProblemSetByUserIds(uids, problemIds);
        for (Long uid : uids) {
          if (acceptMap.getOrDefault(uid, 0) >= total) {
            finished.add(uid);
          }
        }
      }
      JSONObject one = new JSONObject();
      one.put("userIds", finished);
      one.put("count", finished.size());
      one.put("problemTotal", total);
      res.put(keys[i], one);
    }
    return res;
  }

  /**
   * 技能树（第一章/间章/第二章）刷完名单
   */
  public JSONObject getTeamSkillFinishedUsers(long teamId) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    TrackerStageEnum[] stages = new TrackerStageEnum[] {
        TrackerStageEnum.CHAPTER1,
        TrackerStageEnum.INTERLUDE_DAWN,
        TrackerStageEnum.CHAPTER2
    };
    String[] keys = new String[] { "chapter1", "interlude", "chapter2" };
    JSONObject res = new JSONObject();
    for (int i = 0; i < stages.length; i++) {
      List<Long> problemIds = new ArrayList<>(questionTrackerBiz.getSkillTreeProblemIdsByChapter(stages[i]));
      int total = problemIds == null ? 0 : problemIds.size();
      List<Long> finished = new ArrayList<>();
      if (total > 0) {
        Map<Long, Integer> acceptMap = questionTrackerBiz.getAcceptCountInProblemSetByUserIds(uids, problemIds);
        for (Long uid : uids) {
          if (acceptMap.getOrDefault(uid, 0) >= total) {
            finished.add(uid);
          }
        }
      }
      JSONObject one = new JSONObject();
      one.put("userIds", finished);
      one.put("count", finished.size());
      one.put("problemTotal", total);
      res.put(keys[i], one);
    }
    return res;
  }


  /**
   * 团队活动：团队排行榜（分页）
   * 从 Redis 读取当前页 teamId 列表，然后为每个团队汇总活动参数返回
   */
  public JSONObject getTeamActivityTeamsLeaderboard(int page, int limit, Date beginDate, Date endDate) {
    int safeLimit = Math.max(1, Math.min(100, limit));
    int safePage = Math.max(1, page);
    int start = (safePage - 1) * safeLimit;
    // 从 Redis 取全部或分页团队id（这里尝试按 rank 分页）
    List<String> teamIdStrSet = JedisAdapter.zRevRange(
        RedisKeyUtil.getTeamActivityTeamsBoard(), start, start + safeLimit - 1);
    List<Long> teamIds = new ArrayList<>();
    if (teamIdStrSet != null) {
      for (String s : teamIdStrSet) {
        try { teamIds.add(Long.parseLong(s)); } catch (Exception ignore) {}
      }
    }
    // 如果 Redis 为空，返回空
    if (teamIds.isEmpty()) {
      JSONObject res = new JSONObject();
      res.put("total", 0);
      res.put("list", new JSONArray());
      return res;
    }
    // 统计总数（用于分页 total）
    List<String> allTeams = JedisAdapter.zRevRange(
        RedisKeyUtil.getTeamActivityTeamsBoard(), 0, -1);
    int total = allTeams == null ? teamIds.size() : allTeams.size();

    JSONArray list = new JSONArray();
    for (Long teamId : teamIds) {
      // 先读缓存（12h TTL）；key 按 teamId 粒度
      String cacheKey = RedisKeyUtil.getTeamActivityTeamDetail(teamId);
      JSONObject row = JedisAdapter.getObject(cacheKey, JSONObject.class);
      if (row == null) {
        row = new JSONObject();
        row.put("teamId", teamId);
        // 团队名称
        ACMTeamInfo team = acmTeamInfoService.getById(teamId);
        if (team != null) {
          row.put("teamName", team.getName());
          row.put("ownerUserId", team.getUid());
          row.put("memberCount", acmTeamMemberService.getCountByGroupId(teamId));
        }
        // 活动期间打卡总人次
        JSONObject clockTotal = getTeamActivityClockTotal(teamId, beginDate, endDate);
        row.put("clockTotalTimes", clockTotal.getIntValue("totalTimes"));
        // 累计打卡阈值
        JSONObject days = getTeamClockDaysReachedUsers(teamId);
        row.put("ge30Count", days.getIntValue("ge30Count"));
        row.put("ge60Count", days.getIntValue("ge60Count"));
        row.put("ge100Count", days.getIntValue("ge100Count"));
        // 题单刷完
        JSONObject topic = getTeamTopicFinishedUsers(teamId);
        row.put("topicFinished", topic);
        // 技能树刷完
        JSONObject skill = getTeamSkillFinishedUsers(teamId);
        row.put("skillFinished", skill);
        // 回填缓存（12 小时）
        JedisAdapter.setObjectEx(cacheKey, row, 12 * 60 * 60);
      }
      // 分数实时读取，避免排序与缓存分数不一致
      Double score = JedisAdapter.zScore(
          RedisKeyUtil.getTeamActivityTeamsBoard(), String.valueOf(teamId));
      row.put("score", score == null ? 0D : score.doubleValue());
      list.add(row);
    }
    // 按 score 排序
    list.sort((a, b) -> Double.compare(
        ((JSONObject)b).getDoubleValue("score"), ((JSONObject)a).getDoubleValue("score")));
    // 标 rank
    for (int i = 0; i < list.size(); i++) {
      ((JSONObject)list.get(i)).put("rank", start + i + 1);
    }
    JSONObject res = new JSONObject();
    res.put("total", total);
    res.put("list", list);
    return res;
  }

  // ============== 团队活动：积分计算与异步刷新 ==============
  private Date[] getDefaultActivityWindow() {
    Date begin = NcDateUtils.parseDate("2025-11-01", "yyyy-MM-dd");
    Date end = NcDateUtils.parseDate("2026-03-01", "yyyy-MM-dd");
    return new Date[] { begin, end };
  }

  /** 计算团队活动积分：活动期间打卡总人次 + (技能树/题单制霸人次总和 * 100) */
  public double computeTeamActivityScore(long teamId, Date beginDate, Date endDate) {
    // 1) 活动期间打卡总人次
    JSONObject clock = getTeamActivityClockTotal(teamId, beginDate, endDate);
    int totalClockTimes = clock.getIntValue("totalTimes");
    // 2) 题单制霸累计人次（四个题单）
    JSONObject topic = getTeamTopicFinishedUsers(teamId);
    int topicFinished =
        topic.getJSONObject("newbie130").getIntValue("count")
            + topic.getJSONObject("intro").getIntValue("count")
            + topic.getJSONObject("advanced").getIntValue("count")
            + topic.getJSONObject("peak").getIntValue("count");
    // 3) 技能树制霸累计人次（三个章节）
    JSONObject skill = getTeamSkillFinishedUsers(teamId);
    int skillFinished =
        skill.getJSONObject("chapter1").getIntValue("count")
            + skill.getJSONObject("interlude").getIntValue("count")
            + skill.getJSONObject("chapter2").getIntValue("count");
    // 4) 总积分
    return totalClockTimes + 100.0 * (topicFinished + skillFinished);
  }

  /** 刷新团队在活动榜的积分（覆盖式写入） */
  public void refreshTeamActivityScore(long teamId, Date beginDate, Date endDate) {
    try {
      double score = computeTeamActivityScore(teamId, beginDate, endDate);
      JedisAdapter.zAdd(RedisKeyUtil.getTeamActivityTeamsBoard(), score, String.valueOf(teamId));
    } catch (Exception e) {
      logger.error("refreshTeamActivityScore error, teamId=" + teamId, e);
    }
  }

  /** 使用默认活动窗口进行异步刷新 */
  private void refreshTeamActivityScoreAsync(long teamId) {
    try {
      Date[] win = getDefaultActivityWindow();
      CompletableFuture.runAsync(() -> refreshTeamActivityScore(teamId, win[0], win[1]));
    } catch (Exception e) {
      logger.error("refreshTeamActivityScoreAsync error, teamId=" + teamId, e);
    }
  }
  private String checkName(long userId, String oldName, long oldTeamId) throws WenyibiException {
    oldName = StringUtils.trim(oldName);
    final int maxLength = 30;
    if (StringUtils.length(oldName) > maxLength) {
      throw new WenyibiException(String.format("团队名最多允许%s字符", maxLength));
    }
    String name = filterBadWord(oldName);
    //牛客作为内部保留名称
    if (!StringUtils.equals(oldName, name) || StringUtils.contains(name, "牛客")) {
      throw new WenyibiException("团队名包含非法字符");
    }
    name = filterEncodeHtml(name);
    // 过滤不可见字符,空白字符
    name = NAME_EMPTY_PATTERN.matcher(name).replaceAll("");
    name = StringUtils.deleteWhitespace(name);
    if (StringUtils.isBlank(name)) {
      throw new WenyibiException("团队名不能都是空白字符");
    }
    ACMTeamInfo teamInfo = acmTeamInfoService.getByName(name);
    //重名不包括自己
    if (teamInfo != null && teamInfo.getId() != oldTeamId) {
      throw new WenyibiException(String.format("很抱歉，这个团队名字已被占用(%s)", name));
    }
    //通过网易过滤敏感词
    Pair<SpamCheckActionEnum, List<String>> sensitiveResult = Pair.of(
            SpamCheckActionEnum.PASS, new ArrayList<>());
    // 更新的情况进行检测
    if (oldTeamId != 0) {
      sensitiveResult = spamFilterJudgeService
              .judgeShortTextSensitive(name);
    }
    if (sensitiveResult.getKey().getAction() == 2) {
      throw new WenyibiException("队名含有违禁词汇 ，用户不得添加");
    } else if (sensitiveResult.getKey().getAction() == 1) {
      spamFilterJudgeService
              .sendSensitiveReviewListEvent(name, EntityTypeEnum.ACM_TEAM, oldTeamId, userId,
                      sensitiveResult.getValue());
    }

    return name;
  }

  private String checkDescription(long userId, String oldDescription, long oldTeamId) throws WenyibiException {
    oldDescription = StringUtils.trim(oldDescription);
    final int maxLength = 30;
    if (StringUtils.length(oldDescription) > maxLength) {
      throw new WenyibiException(String.format("描述最多允许%s字符", maxLength));
    }
    String description = filterBadWord(oldDescription);
    description = filterEncodeHtml(description);
    //通过网易过滤spam敏感词
    // 更新的情况进行检测
    Pair<SpamCheckActionEnum, List<String>> sensitiveResult = Pair.of(
            SpamCheckActionEnum.PASS, new ArrayList<>());
    if (oldTeamId != 0) {
      sensitiveResult = spamFilterJudgeService
              .judgeShortTextSensitive(description);
    }
    if (sensitiveResult.getKey().getAction() == 2) {
      throw new WenyibiException("描述含有违禁词汇 ，用户不得添加");
    } else if (sensitiveResult.getKey().getAction() == 1) {
      spamFilterJudgeService
              .sendSensitiveReviewListEvent(description, EntityTypeEnum.ACM_TEAM, oldTeamId,
                      userId, sensitiveResult.getValue());
    }
    return description;
  }

  /** 异步刷新某用户在 Redis 中的 tracker 指标（总过题 / 总提交） */
  private void refreshUserTrackerMetricsAsync(long userId) {
    try {
      CompletableFuture.runAsync(() -> {
        try {
          questionTrackerBiz.updateAcceptCount(userId);
        } catch (Exception e) {
          logger.error("refreshUserTrackerMetricsAsync updateAcceptCount error, uid=" + userId, e);
        }
        try {
          questionTrackerBiz.updateSubmissionCount(userId);
        } catch (Exception e) {
          logger.error("refreshUserTrackerMetricsAsync updateSubmissionCount error, uid=" + userId, e);
        }
      });
    } catch (Exception ignore) {
      // 忽略刷新异常，不影响主流程
    }
  }

  /**
   * 队长触发：异步重建团队成员的 Redis 指标（总过题 / 总提交）
   * 每个团队每天仅允许一次，使用 Redis 锁进行限制
   * 返回排队处理的成员数量
   */
  public int rebuildTeamMetrics(long teamId, long operatorUserId) throws WenyibiException {
    if (!isTeamAdmin(teamId, operatorUserId)) {
      throw new WenyibiException("不是队长，无权操作");
    }
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    // 每日一次：使用日期作为分片
    String day = com.wenyibi.futuremail.util.NcDateUtils.getTodayDateString();
    String lockKey = RedisKeyUtil.getTrackerMetricsRebuildLockKey(teamId, day);
    // 24小时窗口；如需更精确可计算当日剩余秒数
    boolean ok = JedisAdapter.setNxEx(lockKey, "1", 24 * 60 * 60);
    if (!ok) {
      throw new WenyibiException("今日已触发重建，请明日再试");
    }
    try {
      CompletableFuture.runAsync(() -> {
        try {
          questionTrackerBiz.rebuildTrackerMetricsForUserIds(uids);
        } catch (Exception e) {
          logger.error("rebuildTeamMetrics async error, teamId=" + teamId, e);
        }
      });
    } catch (Exception e) {
      logger.error("submit rebuild task error", e);
    }
    // 清空该团队的看板缓存，下一次访问触发重算
    try {
      teamSummaryCache.invalidate(teamId);
    } catch (Exception ignore) {
    }
    // 触发一次活动积分异步刷新，确保团队出现在活动榜
    try {
      refreshTeamActivityScoreAsync(teamId);
    } catch (Exception ignore) {
    }
    return uids.size();
  }
}


