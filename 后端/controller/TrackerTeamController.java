package com.wenyibi.futuremail.controllers.problem.tracker;

import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.wenyibi.futuremail.anotation.LoginRequired;
import com.wenyibi.futuremail.biz.tracker.TrackerTeamBiz;
import com.wenyibi.futuremail.component.HostHolder;
import com.wenyibi.futuremail.model.WenyibiException;
import com.wenyibi.futuremail.util.InstructionUtils;
import net.paoding.rose.web.annotation.DefValue;
import net.paoding.rose.web.annotation.Param;
import net.paoding.rose.web.annotation.Path;
import net.paoding.rose.web.annotation.rest.Get;
import net.paoding.rose.web.annotation.rest.Post;
import org.springframework.beans.factory.annotation.Autowired;

@Path("team")
public class TrackerTeamController {

  @Autowired
  private TrackerTeamBiz trackerTeamBiz;
  @Autowired
  private HostHolder hostHolder;

  // 1) 我的团队ID列表
  @Get("my")
  @LoginRequired
  public JSONObject myTeams() {
    long uid = hostHolder.getUser().getId();
    JSONArray teams = trackerTeamBiz.listMyTeamsDetail(uid);
    return InstructionUtils.jsonOkData(teams);
  }

  // 2) 创建新团队
  @Post("create")
  @LoginRequired
  public JSONObject create(@Param("name") String name,
      @Param("description") @DefValue("") String description)
      throws WenyibiException {
    long ownerUserId = hostHolder.getUser().getId();
    long teamId = trackerTeamBiz.createTeam(ownerUserId, name, description);
    JSONObject data = new JSONObject();
    data.put("teamId", teamId);
    return InstructionUtils.jsonOkData(data);
  }

  // 3) 修改团队信息
  @Post("update")
  @LoginRequired
  public JSONObject update(@Param("teamId") long teamId, @Param("name") String name,
      @Param("description") @DefValue("") String description) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权操作");
    }
    trackerTeamBiz.updateTeamInfo(uid, teamId, name, description);
    return InstructionUtils.jsonOk();
  }

  // 4) 添加成员：已迁至 Admin Controller（仅管理员）

  // 5) 删除成员
  @Post("member/delete")
  @LoginRequired
  public JSONObject deleteMember(@Param("teamId") long teamId, @Param("userId") long userId) {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权操作");
    }
    trackerTeamBiz.removeMember(teamId, userId);
    return InstructionUtils.jsonOk();
  }

  // 6) 获取全部成员信息
  @Get("members")
  @LoginRequired
  public JSONObject listMembers(@Param("teamId") long teamId,
                                @Param("limit") @DefValue("10") int limit,
                                @Param("page") @DefValue("1") int page) {
    int safeLimit = Math.max(1, Math.min(100, limit));
    int safePage = Math.max(1, page);
    JSONArray members = trackerTeamBiz.listMembers(teamId, safePage, safeLimit);
    return InstructionUtils.jsonOkData(members);
  }

  // 6.1) 成员自查是否在团队中
  @Get("member/check")
  @LoginRequired
  public JSONObject checkMember(@Param("teamId") long teamId) {
    long uid = hostHolder.getUser().getId();
    JSONObject data = trackerTeamBiz.checkMember(teamId, uid);
    return InstructionUtils.jsonOkData(data);
  }

  // 6.2) 队长在邀请前检查指定用户是否在团队中
  @Get("member/check/uid")
  @LoginRequired
  public JSONObject checkMemberByUid(@Param("teamId") long teamId, @Param("userId") long userId) {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权查看");
    }
    JSONObject data = trackerTeamBiz.checkMember(teamId, userId);
    return InstructionUtils.jsonOkData(data);
  }

  // 7) 转让队长
  @Post("transfer")
  @LoginRequired
  public JSONObject transfer(@Param("teamId") long teamId, @Param("userId") long userId) {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权操作");
    }
    trackerTeamBiz.transferOwner(teamId, userId);
    return InstructionUtils.jsonOk();
  }

  // 8) 创建邀请链接
  @Post("invite/create")
  @LoginRequired
  public JSONObject createInvite(@Param("teamId") long teamId) {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权操作");
    }
    String link = trackerTeamBiz.createInviteLink(teamId);
    JSONObject data = new JSONObject();
    data.put("inviteLink", link);
    return InstructionUtils.jsonOkData(data);
  }

  // 9) 获取邀请链接
  @Get("invite")
  @LoginRequired
  public JSONObject getInvite(@Param("teamId") long teamId) {
    String link = trackerTeamBiz.getInviteLink(teamId);
    JSONObject data = new JSONObject();
    data.put("inviteLink", link);
    return InstructionUtils.jsonOkData(data);
  }

  // 团队统计看板
  @Get("stats/summary")
  @LoginRequired
  public JSONObject statsSummary(@Param("teamId") long teamId) {
    JSONObject summary = trackerTeamBiz.getTeamStatsSummary(teamId);
    return InstructionUtils.jsonOkData(summary);
  }

  // 队长触发：重建团队成员 Redis 指标（每日最多一次）
  @Post("rank/rebuild")
  @LoginRequired
  public JSONObject rebuildRank(@Param("teamId") long teamId) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权操作");
    }
    int queued = trackerTeamBiz.rebuildTeamMetrics(teamId, uid);
    com.alibaba.fastjson.JSONObject data = new com.alibaba.fastjson.JSONObject();
    data.put("queued", queued);
    return InstructionUtils.jsonOkData(data);
  }

  // 团队过题榜
  @Get("leaderboard")
  @LoginRequired
  public JSONObject leaderboard(@Param("teamId") long teamId,
                                @Param("limit") @DefValue("20") int limit,
                                @Param("type") @DefValue("total") String type,
                                @Param("page") @DefValue("1") int page) {
    com.alibaba.fastjson.JSONObject data = trackerTeamBiz.getTeamLeaderboardWithTotal(
        teamId, Math.min(100, Math.max(1, limit)), type, Math.max(1, page));
    return InstructionUtils.jsonOkData(data);
  }

  // 团队打卡排行榜（今日 / 7日 / 累计）
  @Get("leaderboard/clock")
  @LoginRequired
  public JSONObject leaderboardClock(@Param("teamId") long teamId,
                                     @Param("scope") @DefValue("total") String scope,
                                     @Param("page") @DefValue("1") int page,
                                     @Param("limit") @DefValue("20") int limit) {
    com.alibaba.fastjson.JSONObject data = trackerTeamBiz.getTeamClockLeaderboard(
        teamId, scope, Math.max(1, page), Math.min(100, Math.max(1, limit)));
    return InstructionUtils.jsonOkData(data);
  }

  // 团队技能树排行榜（今日 / 累计，按章节或全部）
  @Get("leaderboard/skill")
  @LoginRequired
  public JSONObject leaderboardSkill(@Param("teamId") long teamId,
                                     @Param("scope") @DefValue("total") String scope,
                                     @Param("stage") @DefValue("all") String stage,
                                     @Param("page") @DefValue("1") int page,
                                     @Param("limit") @DefValue("20") int limit) {
    com.alibaba.fastjson.JSONObject data = trackerTeamBiz.getTeamSkillTreeLeaderboard(
        teamId, scope, stage, Math.max(1, page), Math.min(100, Math.max(1, limit)));
    return InstructionUtils.jsonOkData(data);
  }

  // 团队题单排行榜：一次返回累计/7日/今日（默认新手130）
  @Get("leaderboard/topic")
  @LoginRequired
  public JSONObject leaderboardTopic(@Param("teamId") long teamId,
                                     @Param("topicId") @DefValue("383") int topicId, // 默认 NEWBIE130_TOPIC_ID
                                     @Param("page") @DefValue("1") int page,
                                     @Param("limit") @DefValue("20") int limit) {
    com.alibaba.fastjson.JSONObject data = trackerTeamBiz.getTeamTopicLeaderboard(
        teamId, topicId, Math.max(1, page), Math.min(100, Math.max(1, limit)));
    return InstructionUtils.jsonOkData(data);
  }

  // ============== 团队活动接口 ==============
  // 1) 活动期间打卡总人次（默认 11-01 ~ 02-28）
  @Get("activity/clock-total")
  @LoginRequired
  public JSONObject activityClockTotal(@Param("teamId") long teamId,
                                       @Param("beginTs") @DefValue("0") long beginTs,
                                       @Param("endTs") @DefValue("0") long endTs) {
    java.util.Calendar cal = java.util.Calendar.getInstance();
    java.util.Date begin, end;
    if (beginTs <= 0 || endTs <= 0) {
      cal.set(java.util.Calendar.YEAR, 2024);
      cal.set(java.util.Calendar.MONTH, java.util.Calendar.NOVEMBER);
      cal.set(java.util.Calendar.DAY_OF_MONTH, 1);
      cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
      cal.set(java.util.Calendar.MINUTE, 0);
      cal.set(java.util.Calendar.SECOND, 0);
      cal.set(java.util.Calendar.MILLISECOND, 0);
      begin = cal.getTime();
      cal.set(java.util.Calendar.YEAR, 2025);
      cal.set(java.util.Calendar.MONTH, java.util.Calendar.FEBRUARY);
      cal.set(java.util.Calendar.DAY_OF_MONTH, 28);
      cal.set(java.util.Calendar.HOUR_OF_DAY, 23);
      cal.set(java.util.Calendar.MINUTE, 59);
      cal.set(java.util.Calendar.SECOND, 59);
      cal.set(java.util.Calendar.MILLISECOND, 999);
      end = cal.getTime();
    } else {
      begin = new java.util.Date(beginTs);
      end = new java.util.Date(endTs);
    }
    com.alibaba.fastjson.JSONObject data = trackerTeamBiz.getTeamActivityClockTotal(teamId, begin, end);
    return InstructionUtils.jsonOkData(data);
  }

  // 2) 累计打卡达到 30/60/100 天的用户清单
  @Get("activity/clock-days-users")
  @LoginRequired
  public JSONObject activityClockDaysUsers(@Param("teamId") long teamId) {
    com.alibaba.fastjson.JSONObject data = trackerTeamBiz.getTeamClockDaysReachedUsers(teamId);
    return InstructionUtils.jsonOkData(data);
  }

  // 3) 题单（新手130/算法入门/算法进阶/算法登峰）刷完用户清单
  @Get("activity/topic-finished-users")
  @LoginRequired
  public JSONObject activityTopicFinishedUsers(@Param("teamId") long teamId) {
    com.alibaba.fastjson.JSONObject data = trackerTeamBiz.getTeamTopicFinishedUsers(teamId);
    return InstructionUtils.jsonOkData(data);
  }

  // 4) 技能树（第一章/间章/第二章）刷完用户清单
  @Get("activity/skill-finished-users")
  @LoginRequired
  public JSONObject activitySkillFinishedUsers(@Param("teamId") long teamId) {
    com.alibaba.fastjson.JSONObject data = trackerTeamBiz.getTeamSkillFinishedUsers(teamId);
    return InstructionUtils.jsonOkData(data);
  }

  // 5) 活动积分：加分
  // 已移除（不再需要团队内个人积分榜）

  // 5) 活动积分：排行榜
  // 已移除（不再需要团队内个人积分榜）

  // 团队活动：团队排行榜（从 Redis 取团队ID后汇总各项指标）
  @Get("activity/teams/leaderboard")
  @LoginRequired
  public JSONObject activityTeamsLeaderboard(@Param("page") @DefValue("1") int page,
                                             @Param("limit") @DefValue("20") int limit,
                                             @Param("beginTs") @DefValue("0") long beginTs,
                                             @Param("endTs") @DefValue("0") long endTs) {
    java.util.Date begin, end;
    if (beginTs <= 0 || endTs <= 0) {
      java.util.Calendar cal = java.util.Calendar.getInstance();
      cal.set(java.util.Calendar.YEAR, 2024);
      cal.set(java.util.Calendar.MONTH, java.util.Calendar.NOVEMBER);
      cal.set(java.util.Calendar.DAY_OF_MONTH, 1);
      cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
      cal.set(java.util.Calendar.MINUTE, 0);
      cal.set(java.util.Calendar.SECOND, 0);
      cal.set(java.util.Calendar.MILLISECOND, 0);
      begin = cal.getTime();
      cal.set(java.util.Calendar.YEAR, 2025);
      cal.set(java.util.Calendar.MONTH, java.util.Calendar.FEBRUARY);
      cal.set(java.util.Calendar.DAY_OF_MONTH, 28);
      cal.set(java.util.Calendar.HOUR_OF_DAY, 23);
      cal.set(java.util.Calendar.MINUTE, 59);
      cal.set(java.util.Calendar.SECOND, 59);
      cal.set(java.util.Calendar.MILLISECOND, 999);
      end = cal.getTime();
    } else {
      begin = new java.util.Date(beginTs);
      end = new java.util.Date(endTs);
    }
    com.alibaba.fastjson.JSONObject data = trackerTeamBiz.getTeamActivityTeamsLeaderboard(
        Math.max(1, page), Math.min(100, Math.max(1, limit)), begin, end);
    return InstructionUtils.jsonOkData(data);
  }

  // 成员退出团队（队长不可直接退出）
  @Post("quit")
  @LoginRequired
  public JSONObject quit(@Param("teamId") long teamId) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    trackerTeamBiz.quitTeam(teamId, uid);
    return InstructionUtils.jsonOk();
  }

  // 解散团队（队长专用）
  @Post("disband")
  @LoginRequired
  public JSONObject disband(@Param("teamId") long teamId) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权操作");
    }
    trackerTeamBiz.disbandTeam(teamId, uid);
    return InstructionUtils.jsonOk();
  }

  // ============== 申请 / 邀请 流程 ==============
  // 我提交的申请列表
  @Get("my/apply")
  @LoginRequired
  public JSONObject myApply(@Param("limit") @DefValue("100") int limit) {
    long uid = hostHolder.getUser().getId();
    JSONArray data = trackerTeamBiz.listMyApply(uid, limit);
    return InstructionUtils.jsonOkData(data);
  }

  // 邀请我的列表（默认仅 INIT）
  @Get("my/invite")
  @LoginRequired
  public JSONObject myInvite(@Param("limit") @DefValue("100") int limit) {
    long uid = hostHolder.getUser().getId();
    JSONArray data = trackerTeamBiz.listMyInvite(uid, limit);
    return InstructionUtils.jsonOkData(data);
  }

  // 申请加入
  @Post("apply")
  @LoginRequired
  public JSONObject apply(@Param("teamId") long teamId, @Param("message") @DefValue("") String message) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    long applyId = trackerTeamBiz.applyJoin(teamId, uid, message);
    JSONObject data = new JSONObject();
    data.put("applyId", applyId);
    return InstructionUtils.jsonOkData(data);
  }

  // 队长同意申请
  @Post("apply/approve")
  @LoginRequired
  public JSONObject approveApply(@Param("applyId") long applyId) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    trackerTeamBiz.approveApply(applyId, uid);
    return InstructionUtils.jsonOk();
  }

  // 队长拒绝申请
  @Post("apply/reject")
  @LoginRequired
  public JSONObject rejectApply(@Param("applyId") long applyId) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    trackerTeamBiz.rejectApply(applyId, uid);
    return InstructionUtils.jsonOk();
  }

  // 队长邀请成员
  @Post("invite/user")
  @LoginRequired
  public JSONObject inviteUser(@Param("teamId") long teamId, @Param("userId") long userId) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    long applyId = trackerTeamBiz.inviteUser(teamId, uid, userId);
    JSONObject data = new JSONObject();
    data.put("applyId", applyId);
    return InstructionUtils.jsonOkData(data);
  }

  // 被邀请者接受
  @Post("invite/accept")
  @LoginRequired
  public JSONObject acceptInvite(@Param("applyId") long applyId) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    trackerTeamBiz.acceptInvite(applyId, uid);
    return InstructionUtils.jsonOk();
  }

  // 被邀请者拒绝
  @Post("invite/decline")
  @LoginRequired
  public JSONObject declineInvite(@Param("applyId") long applyId) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    trackerTeamBiz.declineInvite(applyId, uid);
    return InstructionUtils.jsonOk();
  }

  // 队长撤销邀请
  @Post("invite/cancel")
  @LoginRequired
  public JSONObject cancelInvite(@Param("applyId") long applyId) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    trackerTeamBiz.cancelInvite(applyId, uid);
    return InstructionUtils.jsonOk();
  }

  // 申请列表（队长查看待审批）
  @Get("apply/list")
  @LoginRequired
  public JSONObject listApply(@Param("teamId") long teamId, @Param("limit") @DefValue("100") int limit) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权查看");
    }
    JSONArray data = trackerTeamBiz.listTeamPendingApply(teamId, limit);
    return InstructionUtils.jsonOkData(data);
  }

  // 批量同意全部待处理申请
  @Post("apply/approve-all")
  @LoginRequired
  public JSONObject approveAll(@Param("teamId") long teamId, @Param("limit") @DefValue("500") int limit) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权操作");
    }
    int processed = trackerTeamBiz.approveAllApplies(teamId, uid, limit);
    com.alibaba.fastjson.JSONObject res = new com.alibaba.fastjson.JSONObject();
    res.put("processed", processed);
    return InstructionUtils.jsonOkData(res);
  }

  // 批量拒绝全部待处理申请
  @Post("apply/reject-all")
  @LoginRequired
  public JSONObject rejectAll(@Param("teamId") long teamId, @Param("limit") @DefValue("500") int limit) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权操作");
    }
    int processed = trackerTeamBiz.rejectAllApplies(teamId, uid, limit);
    com.alibaba.fastjson.JSONObject res = new com.alibaba.fastjson.JSONObject();
    res.put("processed", processed);
    return InstructionUtils.jsonOkData(res);
  }

  // 邀请列表（队长查看待接受）
  @Get("invite/list")
  @LoginRequired
  public JSONObject listInvite(@Param("teamId") long teamId, @Param("limit") @DefValue("100") int limit) throws WenyibiException {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权查看");
    }
    JSONArray data = trackerTeamBiz.listTeamPendingInvite(teamId, limit);
    return InstructionUtils.jsonOkData(data);
  }
}

