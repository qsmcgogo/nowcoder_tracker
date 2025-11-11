package com.wenyibi.futuremail.controllers.problem.tracker;

import com.alibaba.fastjson.JSONObject;
import com.wenyibi.futuremail.anotation.AdminRoleRequire;
import com.wenyibi.futuremail.biz.tracker.TrackerBadgeBiz;
import com.wenyibi.futuremail.biz.tracker.TrackerTagAdminBiz;
import com.wenyibi.futuremail.biz.questionrpc.QuestionTrackerBiz;
import com.wenyibi.futuremail.service.question.TrackerTagService;
import com.wenyibi.futuremail.service.question.QuestionService;
import com.wenyibi.futuremail.util.InstructionUtils;
import java.util.Date;
import net.paoding.rose.web.annotation.DefValue;
import net.paoding.rose.web.annotation.Param;
import net.paoding.rose.web.annotation.Path;
import net.paoding.rose.web.annotation.rest.Get;
import net.paoding.rose.web.annotation.rest.Post;
import org.apache.commons.lang3.time.DateUtils;
import org.springframework.beans.factory.annotation.Autowired;

@Path("")
public class TrackerAdminController {

  @Autowired
  private QuestionTrackerBiz questionTrackerBiz;
  @Autowired
  private TrackerBadgeBiz trackerBadgeBiz;
  @Autowired
  private TrackerTagAdminBiz trackerTagAdminBiz;
  @Autowired
  private TrackerTagService trackerTagService;
  @Autowired
  private QuestionService questionService;
  @Autowired
  private com.wenyibi.futuremail.biz.tracker.TrackerTeamBiz trackerTeamBiz;

  @Post("skill-tree/add-question")
  @AdminRoleRequire
  public JSONObject addTagQuestion(@Param("tagId") int tagId, @Param("questionId") long questionId,
      @Param("score") int score) {
    if (tagId <= 0) {
      return InstructionUtils.jsonError("标签ID不合法");
    }
    if (questionId <= 0) {
      return InstructionUtils.jsonError("题目ID不合法");
    }
    if (score < 0) {
      return InstructionUtils.jsonError("分数必须为非负");
    }
    if (trackerTagService.getTrackerTagById(tagId) == null) {
      return InstructionUtils.jsonError("标签不存在");
    }
    if (questionService.getQuestionById(questionId) == null) {
      return InstructionUtils.jsonError("题目不存在");
    }
    int rowsAffected = trackerTagAdminBiz.addTagQuestion(tagId, questionId, score);
    JSONObject result = new JSONObject();
    result.put("rowsAffected", rowsAffected);
    result.put("tagId", tagId);
    result.put("questionId", questionId);
    result.put("score", score);
    return InstructionUtils.jsonOkData(result);
  }

  @Post("skill-tree/update-question")
  @AdminRoleRequire
  public JSONObject updateTagQuestion(@Param("tagId") int tagId, @Param("score") int score,
      @Param("questionId") long questionId) {
    if (tagId <= 0) {
      return InstructionUtils.jsonError("标签ID不合法");
    }
    if (questionId <= 0) {
      return InstructionUtils.jsonError("题目ID不合法");
    }
    if (score < 0) {
      return InstructionUtils.jsonError("分数必须为非负");
    }
    if (trackerTagService.getTrackerTagById(tagId) == null) {
      return InstructionUtils.jsonError("标签不存在");
    }
    if (questionService.getQuestionById(questionId) == null) {
      return InstructionUtils.jsonError("题目不存在");
    }
    int rowsAffected = trackerTagAdminBiz.updateTagQuestion(tagId, score, questionId);
    JSONObject result = new JSONObject();
    result.put("rowsAffected", rowsAffected);
    result.put("tagId", tagId);
    result.put("questionId", questionId);
    result.put("score", score);
    return InstructionUtils.jsonOkData(result);
  }

  @Post("skill-tree/delete-question")
  @AdminRoleRequire
  public JSONObject deleteTagQuestion(@Param("questionId") long questionId) {
    if (questionId <= 0) {
      return InstructionUtils.jsonError("题目ID不合法");
    }
    int rowsAffected = trackerTagAdminBiz.deleteTagQuestion(questionId);
    JSONObject result = new JSONObject();
    result.put("rowsAffected", rowsAffected);
    result.put("questionId", questionId);
    return InstructionUtils.jsonOkData(result);
  }

  @Get("problemlist")
  @AdminRoleRequire
  public JSONObject problemlist() {
    java.util.Set<Long> list = questionTrackerBiz.getAllProblemIds();
    return InstructionUtils.jsonOkData(list);
  }

  @Get("addcheckin")
  @AdminRoleRequire
  public JSONObject addCheckin(@Param("userId") long userId) {
    questionTrackerBiz.addTrackerClockRecordTest(userId);
    return InstructionUtils.jsonOk();
  }

  @Get("mock-checkin")
  @AdminRoleRequire
  public JSONObject mockCheckin(@Param("userId") long userId, @Param("questionId") long questionId) {
    questionTrackerBiz.addTrackerClockRecord(userId, questionId);
    return InstructionUtils.jsonOk();
  }

  // 管理员直接添加成员（绕过申请/邀请流程）
  @Post("team/member/add")
  @AdminRoleRequire
  public JSONObject adminAddMember(@Param("teamId") long teamId, @Param("userId") long userId) {
    trackerTeamBiz.addMember(teamId, userId);
    return InstructionUtils.jsonOk();
  }

  @Post("clock/add-share-link")
  @AdminRoleRequire
  public JSONObject addLink(@Param("date") String date, @Param("shareLink") String shareLink) {
    try {
      Date dateObj = DateUtils.parseDate(date, "yyyy-MM-dd");
      questionTrackerBiz.addShareLink(dateObj, shareLink);
      return InstructionUtils.jsonOkData(shareLink);
    } catch (Exception e) {
      return InstructionUtils.jsonError("invalid date format, expect yyyy-MM-dd");
    }
  }
  
// 更新用户过题数量
  @Post("rank/update-accept-count")
  @AdminRoleRequire
  public JSONObject updateAcceptCount(@Param("userId") long userId) {
    questionTrackerBiz.updateAcceptCount(userId);
    return InstructionUtils.jsonOk();
  }

  // 批量替换：重建某知识点下的全部题目（按顺序、分数、依赖）
  @Post("skill-tree/batch-replace")
  @AdminRoleRequire
  public JSONObject batchReplaceTagQuestions(@Param("tagId") int tagId,
                                             @Param("items") String itemsJson) {
    if (tagId <= 0) {
      return InstructionUtils.jsonError("标签ID不合法");
    }
    if (itemsJson == null) {
      itemsJson = "[]";
    }
    com.alibaba.fastjson.JSONArray items;
    try {
      items = com.alibaba.fastjson.JSONArray.parseArray(itemsJson);
    } catch (Exception e) {
      return InstructionUtils.jsonError("items 参数必须是 JSON 数组");
    }
    int replaced = trackerTagAdminBiz.batchReplaceTagQuestions(tagId, items);
    com.alibaba.fastjson.JSONObject res = new com.alibaba.fastjson.JSONObject();
    res.put("replaced", replaced);
    res.put("tagId", tagId);
    return InstructionUtils.jsonOkData(res);
  }

  // 更新用户提交总数（Redis）
  @Post("rank/update-submission-count")
  @AdminRoleRequire
  public JSONObject updateSubmissionCount(@Param("userId") long userId) {
    questionTrackerBiz.updateSubmissionCount(userId);
    return InstructionUtils.jsonOk();
  }



  @Get("badge/update")
  @AdminRoleRequire
  public JSONObject updateBadge(@Param("userId") long userId, @Param("acceptCount") int acceptCount,
      @Param("problemId") long problemId) {
    trackerBadgeBiz.updateProblemBadge(userId, acceptCount, problemId);
    return InstructionUtils.jsonOk();
  }
}
