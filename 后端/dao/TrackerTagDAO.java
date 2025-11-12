package com.wenyibi.futuremail.dao.question;

import com.wenyibi.futuremail.model.question.TrackerTag;
import com.wenyibi.futuremail.model.question.TrackerTagQuestion;
import com.wenyibi.futuremail.model.question.TrackerTagUserRecord;
import net.paoding.rose.jade.annotation.DAO;
import net.paoding.rose.jade.annotation.SQL;
import net.paoding.rose.jade.annotation.SQLParam;

import java.util.List;
import java.util.Map;

/**
 * 技能树标签数据访问层
 * @author qsmcgogo
 * @date 2025-10-22
 */
@DAO
public interface TrackerTagDAO {

    String insert_field = " tag_id, tag_name, tag_desc, tag_tutorials, create_time, update_time ";
    String select_field = " id, " + insert_field;
    
    String question_select_field = " id, question_id, tag_id, problem_id, score, dependencies, qindex, create_time, update_time ";

    String record_table = "tracker_tag_user_record";
    String record_insert_field = "tag_id, user_id, pass_rate";
    
    /**
     * 根据知识点ID和用户ID查询用户知识点进度
     * @param userId 用户ID
     * @param tagIds 知识点ID列表
     * @return 返回知识点ID和进度的映射
     */
    @SQL("SELECT user_id, tag_id, pass_rate FROM tracker_tag_user_record WHERE user_id = :1 AND tag_id IN (:2)")
    List<TrackerTagUserRecord> getSkillTreeProgress(Long userId, List<Long> tagIds);
    
    /**
     * 根据知识点ID查询知识点详细信息
     * @param tagId 知识点ID
     * @return 返回知识点完整信息，包含描述、教程等
     */
    @SQL("SELECT " + select_field + " FROM tracker_tag WHERE tag_id = :1")
    TrackerTag getTrackerTagInfoByTagId(Integer tagId);
    
    /**
     * 根据知识点ID查询该知识点下的所有题目
     * @param tagId 知识点ID
     * @return 返回题目列表
     */
    @SQL("SELECT " + question_select_field + " FROM tracker_tag_question WHERE tag_id = :1 ORDER BY qindex")
    List<TrackerTagQuestion> getQuestionsByTagId(Integer tagId);
    
    /**
     * 根据问题ID查询关联的知识点和分数
     * @param problemId 问题ID
     * @return 返回知识点题目关联列表
     */
    @SQL("SELECT " + question_select_field + " FROM tracker_tag_question WHERE problem_id = :1")
    List<TrackerTagQuestion> getTagQuestionsByProblemId(long problemId);
    
    

    /**
     * 根据知识点ID查询该知识点的总分
     * @param tagId 知识点ID
     * @return 返回该知识点的总分
     */
    @SQL("SELECT SUM(score) FROM tracker_tag_question WHERE tag_id = :1")
    Integer getTotalScoreByTagId(Integer tagId);

    @SQL("INSERT INTO "
            + record_table
            + " ("
            + record_insert_field
            + ") "
            + " VALUES(:1, :2, :3) ON DUPLICATE KEY UPDATE pass_rate = :3, update_time = NOW()")
    void insertOrUpdateTagRecord(int tagId, long userId, float passRate);

    @SQL("SELECT problem_id FROM tracker_tag_question")
    List<Long> listAllProblemIds();

    //给定qid、tagid、score，新增一道题目
    @SQL("INSERT INTO tracker_tag_question (tag_id, question_id, score, create_time, update_time) VALUES (:1, :2, :3, NOW(), NOW())")
    int insertTagQuestion(int tagId, long questionId, int score);

    //给定qid、pid、score、依赖与序号，新增一道题目（包含 problem_id / dependencies / qindex）
    @SQL("INSERT INTO tracker_tag_question (tag_id, question_id, problem_id, score, dependencies, qindex, create_time, update_time) VALUES (:1, :2, :3, :4, :5, :6, NOW(), NOW())")
    int insertTagQuestionWithProblem(int tagId, long questionId, long problemId, int score, String dependencies, int qindex);

    //修改一个题目的tagid、score信息
    @SQL("UPDATE tracker_tag_question SET tag_id = :1, score = :2, update_time = NOW() WHERE question_id = :3")
    int updateTagQuestionInfo(int tagId, int score, long questionId);

    //删除一个题目
    @SQL("DELETE FROM tracker_tag_question WHERE question_id = :1")
    int deleteTagQuestion(long questionId);

    //按 tagId 删除全部题目
    @SQL("DELETE FROM tracker_tag_question WHERE tag_id = :1")
    int deleteByTagId(int tagId);
}
