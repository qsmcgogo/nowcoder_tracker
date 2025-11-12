package com.wenyibi.futuremail.controllers.problem.tracker;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Arrays;
import java.util.stream.Collectors;
import java.util.Date;
import org.apache.commons.lang3.time.DateUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.beans.factory.annotation.Autowired;
import java.text.ParseException;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.wenyibi.futuremail.anotation.AdminRoleRequire;
import com.wenyibi.futuremail.anotation.AdminType;
import com.wenyibi.futuremail.anotation.LoginRequired;
import com.wenyibi.futuremail.biz.questionrpc.QuestionTrackerBiz;
import com.wenyibi.futuremail.biz.questionrpc.dto.ContestTracker;
import com.wenyibi.futuremail.component.HostHolder;
import com.wenyibi.futuremail.model.CodingProblem;
import com.wenyibi.futuremail.model.User;
import com.wenyibi.futuremail.model.question.Question;
import com.wenyibi.futuremail.model.question.TrackerClockQuestion;
import com.wenyibi.futuremail.model.question.TrackerTag;
import com.wenyibi.futuremail.service.CodingProblemService;
import com.wenyibi.futuremail.service.question.QuestionService;
import com.wenyibi.futuremail.util.ConvertUtil;
import com.wenyibi.futuremail.util.InstructionUtils;
import com.wenyibi.futuremail.biz.tracker.TrackerBadgeBiz;

import net.paoding.rose.web.annotation.DefValue;
import net.paoding.rose.web.annotation.Param;
import net.paoding.rose.web.annotation.Path;
import net.paoding.rose.web.annotation.rest.Get;
import net.paoding.rose.web.annotation.rest.Post;

import javax.servlet.http.HttpServletResponse;

/**
 * @author:xiaoxiao
 * @date: 2025/9/23
 **/
@Path("")
public class TrackerController {
  @Autowired
  private HostHolder hostHolder;

  @Autowired
  private QuestionTrackerBiz questionTrackerBiz;

  @Autowired
  private TrackerBadgeBiz trackerBadgeBiz;

  @Autowired
  private CodingProblemService codingProblemService;


  @Autowired
  private QuestionService questionService;


  @Get("list")
  public JSONObject getQuestionBySubType(@Param("contestType") @DefValue("0") int subContestType, @Param("page") @DefValue("1") int page,
                                         @Param("limit") @DefValue("100") int limit) {
    limit = Math.min(100, limit);
    JSONObject result = new JSONObject();
    List<ContestTracker> paperList = questionTrackerBiz.getPaperBySubType(subContestType, page, limit);
    int totalCount = questionTrackerBiz.countPaperBySubType(subContestType);

    result.put("totalCount", totalCount);
    result.put("papers", paperList);
    return InstructionUtils.jsonOkData(result);
  }

  @Post("diff")
  public JSONObject diffTrackerData(@Param("userId1") long userId1, @Param("userId2") long userId2, @Param("qids") String qids) {
    Pair<List<Long>, List<Long>> questionList = questionTrackerBiz.diffTrackerData(userId1, userId2, qids);
    JSONObject result = new JSONObject();
    result.put("ac1Qids", questionList.getLeft());
    result.put("ac2Qids", questionList.getRight());
    return InstructionUtils.jsonOkData(result);
  }
  @Get("ranks")
  public JSONObject getRankData(@Param("userId") long userId, @Param("page") @DefValue("1") int page, @Param("limit") @DefValue("100") int limit) {
    limit = Math.min(100, limit);
    Pair<Integer, JSONArray> ranks = questionTrackerBiz.getTrackerRankBoard(userId, page, limit);
    JSONObject result = new JSONObject();
    result.put("totalCount", ranks.getLeft());
    result.put("ranks", ranks.getRight());
    return InstructionUtils.jsonOkData(result);
  }
  @Get("ranks/problem")
  public JSONObject getProblemRankData(@Param("userId") long userId, @Param("page") @DefValue("1") int page, @Param("limit") @DefValue("100") int limit) {
    limit = Math.min(100, limit);
    Pair<Integer, JSONArray> ranks = questionTrackerBiz.getTrackerRankBoard(userId, page, limit);
    JSONObject result = new JSONObject();
    result.put("totalCount", ranks.getLeft());
    result.put("ranks", ranks.getRight());
    return InstructionUtils.jsonOkData(result);
  }

  @Get("ranks/checkin")
  public JSONObject getCheckinRankData(@Param("userId") long userId, @Param("page") @DefValue("1") int page, @Param("limit") @DefValue("100") int limit) {
    limit = Math.min(100, limit);
    Pair<Integer, JSONArray> ranks = questionTrackerBiz.getTrackerCheckinRankBoard(userId, page, limit);
    JSONObject result = new JSONObject();
    result.put("totalCount", ranks.getLeft());
    result.put("ranks", ranks.getRight());
    return InstructionUtils.jsonOkData(result);
  }

  @Get("clock/daylink")
  public JSONObject getDayLink(@Param("date") String date) {
    try {
      Date dateObj = DateUtils.parseDate(date, "yyyy-MM-dd");
      TrackerClockQuestion trackerClockQuestion = questionTrackerBiz.getTrackerQuestionIdByDate(dateObj);
      JSONObject result = new JSONObject();
      result.put("shareLink", trackerClockQuestion == null ? "" : trackerClockQuestion.getShareLink());
      return InstructionUtils.jsonOkData(result);
    } catch (Exception e) {
      return InstructionUtils.jsonError("invalid date format, expect yyyy-MM-dd");
    }
  }

  @Get("clock/todayinfo")
  public JSONObject getClockInfo() {
    User user = hostHolder.getUser();
    long uid = user == null ? 0 : user.getId();

    TrackerClockQuestion trackerClockQuestion = questionTrackerBiz.getTrackerQuestionIdToday();

    int todayClockCount = questionTrackerBiz.getTodayClockCount();
    int todayClockRank = questionTrackerBiz.getTodayClockRank(uid);
    JSONObject result = new JSONObject();
    result.put("questionId", trackerClockQuestion.getQuestionId());
    result.put("problemId", trackerClockQuestion.getProblemId());
    result.put("shareLink", trackerClockQuestion.getShareLink());
    Question question = questionService.getQuestionById(trackerClockQuestion.getQuestionId());
    result.put("questionTitle", question.getTitle());
    result.put("questionUrl", String.format("/practice/%s", question.getUuid()));
    result.put("uid", uid);
    result.put("continueDay", questionTrackerBiz.getContinueDay(uid));
    result.put("countDay", questionTrackerBiz.getCountDay(uid));
    result.put("todayClockCount", todayClockCount);
    result.put("todayClockRank", todayClockRank);
    boolean isClockToday = questionTrackerBiz.getTrackerClockRecordByUserIdToday(uid) != null;
    result.put("isClockToday", isClockToday);
   result.put("yesterdayClockCount", questionTrackerBiz.getYesterdayClockCount(uid));

    //今天没打卡的话，看看之前有没有通过这个题
    boolean isAcBefore = false;
    if(uid > 0) {
      isAcBefore = isClockToday ? true : questionTrackerBiz.isAcceptWWWorACM(uid, trackerClockQuestion.getProblemId());
    }
    result.put("isAcBefore", isAcBefore);

    return InstructionUtils.jsonOkData(result);
  }

  @Get("clock/monthinfo")
  public JSONObject getMonthInfo(@Param("year") int year, @Param("month") int month) {
    List<TrackerClockQuestion> list = questionTrackerBiz.getTrackerQuestionIdMonth(year, month);
    
    // 收集所有的 questionId
    List<Long> questionIds = new ArrayList<>();
    for (TrackerClockQuestion tcq : list) {
      questionIds.add(tcq.getQuestionId());
    }
    
    // 批量查询 Question 信息
    Map<Long, Question> questionMap = new HashMap<>();
    if (!questionIds.isEmpty()) {
      List<Question> questions = questionService.getQuestionTagsAndDifficultyByLongIds(questionIds);
      for (Question q : questions) {
        questionMap.put(q.getId(), q);
      }
    }
    
    // 构建返回的 JSON 数组
    JSONArray resultArray = new JSONArray();
    for (TrackerClockQuestion tcq : list) {
      JSONObject item = new JSONObject();
      item.put("questionId", tcq.getQuestionId());
      item.put("problemId", tcq.getProblemId());
      item.put("createTime", tcq.getCreateTime());
      item.put("shareLink", tcq.getShareLink());
      
      // 添加 questionUrl
      Question question = questionMap.get(tcq.getQuestionId());
      if (question != null) {
        item.put("questionUrl", String.format("/practice/%s", question.getUuid()));
        item.put("questionTitle", question.getTitle());
      }
      
      resultArray.add(item);
    }
    
    return InstructionUtils.jsonOkData(resultArray);
  }

  //手动打卡
  @Post("clock/add")
  @LoginRequired
  public JSONObject addClockRecord() {
    long uid = hostHolder.getUser().getId();
    //后端再判断下是否真的做完了
    TrackerClockQuestion trackerClockQuestion = questionTrackerBiz.getTrackerQuestionIdToday();
    boolean isAcBefore = questionTrackerBiz.isAcceptWWWorACM(uid, trackerClockQuestion.getProblemId());
    if(!isAcBefore) {
      return InstructionUtils.jsonError("未通过本题");
    }
    questionTrackerBiz.addTrackerClockRecord(uid, trackerClockQuestion.getQuestionId());
    return InstructionUtils.jsonOk();
  }

  @Get("clock/list")
  @LoginRequired
  public JSONObject getClockList(@Param("year") int year, @Param("month") int month) {
    List<String> list = questionTrackerBiz.listTrackerClockRecordByUserIdAndMonth(hostHolder.getUser().getId(), year, month);
    return InstructionUtils.jsonOkData(list);
  }

  

  /**
   * 生成名片图片API
   * @param requestBody 包含用户数据的JSON请求体
   * @param response HTTP响应对象
   * @return 返回PNG格式的图片数据
   */
  @Post("generate-card")
  public void generateCard(@Param("requestBody") String requestBody, HttpServletResponse response) {
    try {
      // 调用业务逻辑生成名片
      byte[] imageData = questionTrackerBiz.generateCard(requestBody);
      
      // 设置响应头
      response.setContentType("image/png");
      response.setContentLength(imageData.length);
      response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      response.setHeader("Pragma", "no-cache");
      response.setDateHeader("Expires", 0);
      
      // 将imageData写入响应流
      response.getOutputStream().write(imageData);
      response.getOutputStream().flush();
      
    } catch (Exception e) {
      // 处理异常，返回错误状态
      try {
        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"error\":\"生成名片失败\"}");
      } catch (Exception ex) {
        // 如果连错误响应都无法发送，记录日志
        System.err.println("Failed to send error response: " + ex.getMessage());
      }
    }
  }

  /**
   * 获取技能树进度
   * 目标：一次性告诉前端，当前用户在新手技能树里所有知识点的进度是多少
   * @param tags 技能树标签ID列表，格式为逗号分隔的字符串，如 "1001,1002,1003"
   * @return 返回格式：{"nodeProgress": {"tag_id": pass_rate}}
   */
  @Get("skill-tree/progress")
  @LoginRequired
  public JSONObject getSkillTreeProgress(@Param("tags") String tags) {
    try {
      long userId = hostHolder.getUser().getId();
      
      // tag为空的时候，也返回错误
      if (tags == null || tags.trim().isEmpty()) {
        return InstructionUtils.jsonError("标签ID不能为空");
      }
      
      // 调用业务逻辑获取技能树进度
      List<Pair<String, Float>> progressList = questionTrackerBiz.getSkillTreeProgress(userId, tags);
      
      // 解析tags字符串，获取所有标签ID
      String[] tagArray = tags.split(",");
      Map<String, Double> nodeProgress = new HashMap<>();
      
      // 先将所有标签的进度设为0
      for (String tagStr : tagArray) {
        try {
          String tagId = tagStr.trim();
          nodeProgress.put(tagId, 0.0);
        } catch (NumberFormatException e) {
          // 忽略无效的标签ID
        }
      }
      
      // 更新有进度的标签（查不到该user对应进度的时候，应该返回进度是0）
      if (progressList != null) {
        for (Pair<String, Float> progress : progressList) {
          if (progress != null && progress.getLeft() != null && progress.getRight() != null) {
            nodeProgress.put(progress.getLeft(), progress.getRight().doubleValue());
          }
        }
      }
      
      // 按 {"nodeProgress": { ... }} 的格式返回JSON
      JSONObject result = new JSONObject();
      result.put("nodeProgress", nodeProgress);
      
      return InstructionUtils.jsonOkData(result);
      
    } catch (Exception e) {
      return InstructionUtils.jsonError("获取技能树进度失败: " + e.getMessage());
    }
  }

  /**
   * 根据知识点ID查询知识点详细信息
   * @param tagId 知识点ID
   * @return 返回知识点完整信息，包含描述、教程、题目详情等
   */
  @Get("skill-tree/tagInfo")
  public JSONObject getTrackerTagInfo(@Param("tagId") Integer tagId) {
    try {
      // 参数验证
      if (tagId == null || tagId <= 0) {
        return InstructionUtils.jsonError("知识点ID不能为空或小于等于0");
      }
      
      // 调用业务逻辑获取知识点完整信息（包含tag基本信息和questions题目详情）
      Map<String, Object> tagInfo = questionTrackerBiz.getTrackerTagInfoWithQuestions(tagId);
      
      if (tagInfo == null || tagInfo.isEmpty()) {
        return InstructionUtils.jsonError("未找到该知识点信息");
      }
      
      // 直接返回包含tag和questions的Map
      return InstructionUtils.jsonOkData(tagInfo);
      
    } catch (Exception e) {
      return InstructionUtils.jsonError("获取知识点信息失败: " + e.getMessage());
    }
  }

  /**
   * 更新指定用户在所有技能树知识点的进度
   * 遍历所有知识点，根据用户通过的题目计算进度并更新到数据库
   * @return 返回更新结果
   */
  @Post("skill-tree/update")
  @LoginRequired
  public JSONObject updateUserSkillTreeProgress(@Param("tagId") int tagId) {
    try {
      long userId = hostHolder.getUser().getId();

      // 调用业务逻辑更新用户所有技能树知识点的进度
      questionTrackerBiz.updateUserAllTagProgress(userId, tagId);
      
      // 返回成功结果
      JSONObject result = new JSONObject();
      result.put("userId", userId);
      result.put("message", "用户技能树进度更新成功");
      return InstructionUtils.jsonOkData(result);
      
    } catch (Exception e) {
      return InstructionUtils.jsonError("更新用户技能树进度失败: " + e.getMessage());
    }
  }


  @Get("badge/list")
  @LoginRequired
  public JSONObject listBadge(@Param("typeList") String types) {
    long userId = hostHolder.getUser().getId();
    List<Integer> typeList = ConvertUtil.fromStringToIntegerList(types, ",");
    return InstructionUtils.jsonOkData(trackerBadgeBiz.listBadgeByTypeList(userId,typeList));
  }

  @Get("badge/userInfo")
  @LoginRequired
  public JSONObject getUserBadgeInfo() {
    long userId = hostHolder.getUser().getId();
    JSONObject result = new JSONObject();
    result.put("userTotalScore", trackerBadgeBiz.getUserTotalScore(userId));
    result.put("userRecentBadge", trackerBadgeBiz.getUserRecentBadge(userId));
    return InstructionUtils.jsonOkData(result);
  }




  /*
   * 以下为管理员测试用API
   */

}
