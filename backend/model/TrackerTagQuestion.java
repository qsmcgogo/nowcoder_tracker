package com.wenyibi.futuremail.model.question;

import java.util.Date;

/**
 * 技能树知识点题目关联
 * 对应表：tracker_tag_question
 * @author qsmcgogo
 * @date 2025-10-23
 */
public class TrackerTagQuestion {
    
    private Long id;
    private Long questionId;
    private Long tagId;
    private Long problemId;
    private Integer score;
    /*
     * 依赖的知识点ID列表，用逗号分隔
     * 例如 1007,1008,1009
     */
    private String dependencies;

    private Integer qindex;
    private Date createTime;
    private Date updateTime;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getQuestionId() {
        return questionId;
    }

    public void setQuestionId(Long questionId) {
        this.questionId = questionId;
    }

    public Long getTagId() {
        return tagId;
    }

    public void setTagId(Long tagId) {
        this.tagId = tagId;
    }

    public Long getProblemId() {
        return problemId;
    }

    public void setProblemId(Long problemId) {
        this.problemId = problemId;
    }

    public void setQindex(Integer qindex) {
        this.qindex = qindex;
    }

    public Integer getScore() {
        return score;
    }
    
    public void setScore(Integer score) {
        this.score = score;
    }
    
    public String getDependencies() {
        return dependencies;
    }
    
    public void setDependencies(String dependencies) {
        this.dependencies = dependencies;
    }
    
    public Date getCreateTime() {
        return createTime;
    }
    
    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }
    
    public Date getUpdateTime() {
        return updateTime;
    }
    
    public void setUpdateTime(Date updateTime) {
        this.updateTime = updateTime;
    }

    public int getQindex() {
        return qindex;
    }

    public void setQindex(int qindex) {
        this.qindex = qindex;
    }

    @Override
    public String toString() {
        return "TrackerTagQuestion{" +
                "id=" + id +
                ", questionId=" + questionId +
                ", tagId=" + tagId +
                ", problemId=" + problemId +
                ", score=" + score +
                ", dependencies='" + dependencies + '\'' +
                ", createTime=" + createTime +
                ", updateTime=" + updateTime +
                '}';
    }
}

