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
      @Param("description") @DefValue("") String description) {
    long uid = hostHolder.getUser().getId();
    if (!trackerTeamBiz.isTeamAdmin(teamId, uid)) {
      return InstructionUtils.jsonError("不是队长，无权操作");
    }
    trackerTeamBiz.updateTeamInfo(teamId, name, description);
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
  public JSONObject listMembers(@Param("teamId") long teamId) {
    JSONArray members = trackerTeamBiz.listMembers(teamId);
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

  // 团队过题榜
  @Get("leaderboard")
  @LoginRequired
  public JSONObject leaderboard(@Param("teamId") long teamId,
                                @Param("limit") @DefValue("20") int limit,
                                @Param("type") @DefValue("total") String type) {
    JSONArray lb = trackerTeamBiz.getTeamLeaderboard(teamId, Math.min(100, Math.max(1, limit)), type);
    return InstructionUtils.jsonOkData(lb);
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

