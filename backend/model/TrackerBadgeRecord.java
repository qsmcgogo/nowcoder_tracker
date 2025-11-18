package com.wenyibi.futuremail.model.tracker;

import java.util.Date;

/**
 * 对应表：tracker_badge_record
 * @author qsmcgogo
 * @date 2025-10-27
 * 
 */
public class TrackerBadgeRecord {

  private Long id;
  private Long userId;
  private Long badgeId;
  private Integer badgeType;
  private Date createTime;
  private Date updateTime;

  public TrackerBadgeRecord() {
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public Long getBadgeId() {
    return badgeId;
  }

  public void setBadgeId(Long badgeId) {
    this.badgeId = badgeId;
  }

  public Integer getBadgeType() {
    return badgeType;
  }

  public void setBadgeType(Integer badgeType) {
    this.badgeType = badgeType;
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
    return "TrackerBadgeRecord{" +
        "id=" + id +
        ", userId=" + userId +
        ", badgeId=" + badgeId +
        ", badgeType=" + badgeType +
        ", createTime=" + createTime +
        ", updateTime=" + updateTime +
        '}';
  }
}


