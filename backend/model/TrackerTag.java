package com.wenyibi.futuremail.model.question;

import java.util.Date;

/**
 * 技能树知识点
 * 对应表：
 * tracker_tag
 * @author qsmcgogo
 * @date 2025-10-22
 */
public class TrackerTag {
    
    private Integer id;
    private Integer tagId;
    private String tagName;
    private String tagDesc;
    private String tagTutorials;
    private Date createTime;
    private Date updateTime;
    
    public TrackerTag() {
    }
    
    public TrackerTag(Integer id, Integer tagId, String tagName, String tagDesc, 
                     String tagTutorials, Date createTime, Date updateTime) {
        this.id = id;
        this.tagId = tagId;
        this.tagName = tagName;
        this.tagDesc = tagDesc;
        this.tagTutorials = tagTutorials;
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
    
    public String getTagName() {
        return tagName;
    }
    
    public void setTagName(String tagName) {
        this.tagName = tagName;
    }
    
    public String getTagDesc() {
        return tagDesc;
    }
    
    public void setTagDesc(String tagDesc) {
        this.tagDesc = tagDesc;
    }
    
    public String getTagTutorials() {
        return tagTutorials;
    }
    
    public void setTagTutorials(String tagTutorials) {
        this.tagTutorials = tagTutorials;
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
        return "TrackerTag{" +
                "id=" + id +
                ", tagId=" + tagId +
                ", tagName='" + tagName + '\'' +
                ", tagDesc='" + tagDesc + '\'' +
                ", tagTutorials='" + tagTutorials + '\'' +
                ", createTime=" + createTime +
                ", updateTime=" + updateTime +
                '}';
    }
}
