package com.wenyibi.futuremail.model.question;

import java.util.Date;

/**
 * 技能树标签用户记录
 * 对应表：
 * tracker_tag_user_record
 * @author qsmcgogo
 * @date 2025-10-22
 */
public class TrackerTagUserRecord {
    
    private Integer id;
    private Integer tagId;
    private Integer userId;
    private Float passRate;
    private Date createTime;
    private Date updateTime;
    
    public TrackerTagUserRecord() {
    }
    
    public TrackerTagUserRecord(Integer id, Integer tagId, Integer userId, Float passRate, Date createTime, Date updateTime) {
        this.id = id;
        this.tagId = tagId;
        this.userId = userId;
        this.passRate = passRate;
        this.createTime = createTime;
        this.updateTime = updateTime;
    }
    
    public Integer getId() {
        return id;
    }
    
    public void setId(Integer id) {
        this.id = id;
    }
    
    public Integer getTagId() {
        return tagId;
    }
    
    public void setTagId(Integer tagId) {
        this.tagId = tagId;
    }
    
    public Integer getUserId() {
        return userId;
    }
    
    public void setUserId(Integer userId) {
        this.userId = userId;
    }
    
    public Float getPassRate() {
        return passRate;
    }
    
    public void setPassRate(Float passRate) {
        this.passRate = passRate;
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
    
    @Override
    public String toString() {
        return "TrackerTagUserRecord{" +
                "id=" + id +
                ", tagId=" + tagId +
                ", userId=" + userId +
                ", passRate=" + passRate +
                ", createTime=" + createTime +
                ", updateTime=" + updateTime +
                '}';
    }
}
