package com.wenyibi.futuremail.service.question;

import com.wenyibi.futuremail.dao.question.TrackerTagDAO;
import com.wenyibi.futuremail.model.question.TrackerTag;
import com.wenyibi.futuremail.model.question.TrackerTagQuestion;
import com.wenyibi.futuremail.model.question.TrackerTagUserRecord;

import org.apache.commons.collections4.CollectionUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * 技能树标签服务
 * @author qsmcgogo
 * @date 2025-10-22
 */
@Service
public class TrackerTagService {
    
    @Autowired
    private TrackerTagDAO trackerTagDAO;
    
    /**
     * 根据标签ID列表获取技能树进度
     * @param userId 用户ID
     * @param tagIds 标签ID列表
     * @return 返回技能树进度记录列表
     */
    public List<TrackerTagUserRecord> getSkillTreeProgress(long userId, List<Long> tagIds) {
        try {
            // 调用dao层获取技能树进度
            return trackerTagDAO.getSkillTreeProgress(userId, tagIds);
            
        } catch (Exception e) {
            // 记录日志并返回空列表
            System.err.println("获取技能树进度失败: " + e.getMessage());
            e.printStackTrace();
            return Collections.emptyList();
        }
    }
    
    /**
     * 根据标签ID获取标签信息
     * @param tagId 标签ID
     * @return 返回标签信息
     */
    public TrackerTag getTrackerTagById(Integer tagId) {
        try {
            // 调用dao层获取标签信息
            return trackerTagDAO.getTrackerTagInfoByTagId(tagId);
            
        } catch (Exception e) {
            // 记录日志并返回null
            System.err.println("获取标签信息失败: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * 根据知识点ID查询知识点基本信息
     * @param tagId 知识点ID
     * @return 返回知识点基本信息对象
     */
    public TrackerTag getTrackerTagInfo(Integer tagId) {
        try {
            return trackerTagDAO.getTrackerTagInfoByTagId(tagId);
        } catch (Exception e) {
            System.err.println("获取知识点信息失败: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * 根据知识点ID查询该知识点下的所有题目
     * @param tagId 知识点ID
     * @return 返回题目关联列表
     */
    public List<TrackerTagQuestion> getQuestionsByTagId(Integer tagId) {
        try {
            return trackerTagDAO.getQuestionsByTagId(tagId);
        } catch (Exception e) {
            System.err.println("获取知识点题目列表失败: " + e.getMessage());
            e.printStackTrace();
            return Collections.emptyList();
        }
    }
    
    /**
     * 根据问题ID查询关联的知识点和分数
     * @param problemId 问题ID
     * @return 返回知识点题目关联列表
     */
    public List<TrackerTagQuestion> getTagQuestionsByProblemId(long problemId) {
        try {
            return trackerTagDAO.getTagQuestionsByProblemId(problemId);
        } catch (Exception e) {
            System.err.println("根据problemId获取知识点关联失败: " + e.getMessage());
            e.printStackTrace();
            return Collections.emptyList();
        }
    }
    
    /**
     * 根据知识点ID查询该知识点的总分
     * @param tagId 知识点ID
     * @return 返回该知识点的总分，如果查询失败或为null则返回0
     */
    public int getTotalScoreByTagId(Integer tagId) {
        try {
            Integer totalScore = trackerTagDAO.getTotalScoreByTagId(tagId);
            return totalScore != null ? totalScore : 0;
        } catch (Exception e) {
            System.err.println("获取知识点总分失败: " + e.getMessage());
            e.printStackTrace();
            return 0;
        }
    }

    public void insertOrUpdateTagRecord(int tagId, long userId, float passRate) {
        trackerTagDAO.insertOrUpdateTagRecord(tagId, userId, passRate);
    }

    public List<Long> listAllProblemIds() {
        List<Long> problemIds= trackerTagDAO.listAllProblemIds();
        if(CollectionUtils.isEmpty(problemIds)) {
            return Collections.emptyList();
        }
        return problemIds;
    }

    public int insertTagQuestion(int tagId, long questionId, int score) {
        return trackerTagDAO.insertTagQuestion(tagId, questionId, score);
    }

    public int insertTagQuestionWithProblem(int tagId, long questionId, long problemId, int score) {
        return trackerTagDAO.insertTagQuestionWithProblem(tagId, questionId, problemId, score, null, 0);
    }

    public int insertTagQuestionWithProblem(int tagId, long questionId, long problemId, int score, String dependencies, int qindex) {
        return trackerTagDAO.insertTagQuestionWithProblem(tagId, questionId, problemId, score, dependencies, qindex);
    }

    public int deleteByTagId(int tagId) {
        return trackerTagDAO.deleteByTagId(tagId);
    }

    public int updateTagQuestionInfo(int tagId, int score, long questionId) {
        return trackerTagDAO.updateTagQuestionInfo(tagId, score, questionId);
    }

    public int deleteTagQuestion(long questionId) {
        return trackerTagDAO.deleteTagQuestion(questionId);
    }
    
}
