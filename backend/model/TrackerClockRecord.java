package com.wenyibi.futuremail.model.question;

import java.util.Date;

/**
 * 打卡题目
 * 对应表：tracker_clock_record
 */
public class TrackerClockRecord {

    private long id;
    private long userId;
    private long questionId;
    private Date createTime;        // 每日一题创建时间
    private Date updateTime;        // 用户打卡/补卡时间

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public long getUserId() {
        return userId;
    }

    public void setUserId(long userId) {
        this.userId = userId;
    }

    public long getQuestionId() {
        return questionId;
    }

    public void setQuestionId(long questionId) {
        this.questionId = questionId;
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
}
