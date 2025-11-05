package com.wenyibi.futuremail.biz.tracker;

import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.wenyibi.futuremail.biz.AccountBiz;
import com.wenyibi.futuremail.biz.questionrpc.QuestionTrackerBiz;
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
import com.wenyibi.futuremail.service.UserService;
import com.wenyibi.futuremail.service.acm.team.ACMTeamInfoService;
import com.wenyibi.futuremail.service.acm.team.ACMTeamMemberService;
import com.wenyibi.futuremail.service.acm.team.ACMTeamApplyService;
import com.wenyibi.futuremail.service.CodingSubmissionService;
import com.wenyibi.futuremail.service.acm.contest.ACMCodingSubmissionService;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import net.paoding.rose.web.Invocation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class TrackerTeamBiz {

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
    List<Integer> trackerType = java.util.Collections.singletonList(ACMTeamTypeInfoEnum.TRACKER.getCode());
    Map<Long, ACMTeamInfo> teamMap = acmTeamInfoService.getMapByIds(teamIds, trackerType);
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
      o.put("logoUrl", t.getLogoUrl());
      o.put("description", t.getDescription());
      o.put("personCount", t.getPersonCount());
      o.put("personLimit", t.getPersonLimit());
      o.put("ownerUserId", t.getUid());
      o.put("status", t.getStatus());
      o.put("createTime", t.getCreateTime());
      o.put("myRole", myRoleMap.getOrDefault(teamId, ACMTeamMemberTypeEnum.NORMAL.getType()));
      result.add(o);
    }
    return result;
  }

  public long createTeam(Long ownerUserId, String name, String description) throws WenyibiException {
    if (ownerUserId == null || ownerUserId <= 0) {
      throw new WenyibiException("ownerUserId非法");
    }
    // 生成团队用户ID（与 ACM 创建方式保持一致）
    int teamId = accountBiz.createOauthUserAccount((Invocation) null,
        com.wenyibi.futuremail.model.login.ClientPlatformEnum.PC.getValue(),
        name, UserTypeEnum.ACM_TEAM, null, null);
    ACMTeamInfo teamInfo = new ACMTeamInfo();
    teamInfo.setId(teamId);
    teamInfo.setName(name);
    teamInfo.setLogoUrl("https://images.nowcoder.com/images/20220303/795430173_1646313501743/64188F08D61F98C9EE5212F58672A8F4");
    teamInfo.setDescription(description);
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

  public int updateTeamInfo(long teamId, String name, String description) {
    ACMTeamInfo teamInfo = new ACMTeamInfo();
    teamInfo.setId(teamId);
    teamInfo.setName(name);
    teamInfo.setDescription(description);
    return acmTeamInfoService.update(teamInfo);
  }

  public boolean isTeamAdmin(long teamId, long userId) {
    ACMTeamInfo team = acmTeamInfoService.getById(teamId);
    return team != null && team.getUid() == userId;
  }

  public long addMember(long teamId, long userId) {
    ACMTeamMember member = ACMTeamMember.build(teamId, userId, ACMTeamMemberTypeEnum.NORMAL);
    return acmTeamMemberService.save(member);
  }

  public int removeMember(long teamId, long userId) {
    ACMTeamMember member = acmTeamMemberService.getByGroupAndUid(teamId, userId);
    if (member == null) {
      return 0;
    }
    return acmTeamMemberService.delete(member.getId());
  }

  public JSONArray listMembers(long teamId) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);
    // 批量获取 tracker 范围的 AC 数
    Map<Long, Integer> acceptCountMap = questionTrackerBiz.getTrackerAcceptCountByUserIds(uids);
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
      // 刷题情况（仅 tracker 范围）
      int totalAc = acceptCountMap.getOrDefault(m.getUid(), 0);
      int totalAll = codingSubmissionService.getAllCountByUserId(m.getUid());
      one.put("acceptCount", totalAc);
      one.put("submissionCount", totalAll);
      arr.add(one);
    }
    return arr;
  }

  public int transferOwner(long teamId, long newOwnerUserId) {
    return acmTeamInfoService.updateUid(teamId, newOwnerUserId);
  }

  public String createInviteLink(long teamId) {
    // 简单返回一个包含 teamId 的链接（后续可接入令牌/短链）
    return String.format("/tracker/team/join?teamId=%s", teamId);
  }

  public String getInviteLink(long teamId) {
    return createInviteLink(teamId);
  }

  // ============== 申请 / 邀请 逻辑 ==============
  public long applyJoin(long teamId, long userId, String message) throws WenyibiException {
    ACMTeamInfo team = acmTeamInfoService.getById(teamId);
    if (team == null || !team.isNormal()) {
      throw new WenyibiException("团队不存在或已解散");
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
    for (ACMTeamApply a : list) {
      JSONObject o = new JSONObject();
      o.put("id", a.getId());
      o.put("teamId", a.getTeamId());
      o.put("type", a.getType());
      o.put("applyUid", a.getApplyUid());
      o.put("sender", a.getSender());
      o.put("message", a.getMessage());
      o.put("status", a.getStatus());
      o.put("createTime", a.getCreateTime());
      User u = userMap.get(a.getApplyUid());
      if (u != null) {
        o.put("applyUserName", u.getDisplayname());
        o.put("applyUserHeadUrl", u.getTinnyHeaderUrl());
      }
      arr.add(o);
    }
    return arr;
  }

  // ============== 看板与榜单 ==============
  public JSONObject getTeamStatsSummary(long teamId) {
    JSONObject summary = new JSONObject();
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    int memberCount = members.size();
    int totalAccept = 0;
    int totalSubmission = 0;
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, Integer> acceptCountMap = questionTrackerBiz.getTrackerAcceptCountByUserIds(uids);
    // today / 7 days
    Date now = new Date();
    Date todayBegin = com.wenyibi.futuremail.util.NcDateUtils.getDayBeginDate(now);
    Date sevenDaysBegin = com.wenyibi.futuremail.util.DateUtil.getDateAfter(todayBegin, -6);
    Map<Long, Integer> todayMap = questionTrackerBiz.getTrackerAcceptCountByUserIdsBetweenDates(uids, todayBegin, now);
    Map<Long, Integer> sevenDaysMap = questionTrackerBiz.getTrackerAcceptCountByUserIdsBetweenDates(uids, sevenDaysBegin, now);
    for (ACMTeamMember m : members) {
      totalAccept += acceptCountMap.getOrDefault(m.getUid(), 0);
      totalSubmission += codingSubmissionService.getAllCountByUserId(m.getUid());
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
    if (team != null) {
      summary.put("name", team.getName());
      summary.put("ownerUserId", team.getUid());
      summary.put("personLimit", team.getPersonLimit());
    }
    return summary;
  }

  public JSONArray getTeamLeaderboard(long teamId, int limit) {
    List<ACMTeamMember> members = acmTeamMemberService.getByTeamId(teamId);
    List<Long> uids = members.stream().map(ACMTeamMember::getUid).collect(Collectors.toList());
    Map<Long, User> userMap = userService.getUserMapsByIds(uids);
    List<JSONObject> rows = new ArrayList<>();
    Map<Long, Integer> acceptCountMap = questionTrackerBiz.getTrackerAcceptCountByUserIds(uids);
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
    JSONArray top = new JSONArray();
    int n = Math.min(limit, rows.size());
    for (int i = 0; i < n; i++) {
      JSONObject r = rows.get(i);
      r.put("rank", i + 1);
      top.add(r);
    }
    return top;
  }
}


