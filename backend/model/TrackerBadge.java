package com.wenyibi.futuremail.model.tracker;

import java.util.Date;

/**
 * 对应表：tracker_badge
 * @author qsmcgogo
 * @date 2025-10-27
 *
 */
public class TrackerBadge {

  private Long id;
  private String name;
  private String colorUrl;
  private String grayUrl;
  private Integer score;
  private Integer acquirement;
  private String detail;
  private Integer type;
  private Integer status;
  private Date createTime;
  private Date updateTime;

  public TrackerBadge() {
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getColorUrl() {
    return colorUrl;
  }

  public void setColorUrl(String colorUrl) {
    this.colorUrl = colorUrl;
  }

  public String getGrayUrl() {
    return grayUrl;
  }

  public void setGrayUrl(String grayUrl) {
    this.grayUrl = grayUrl;
  }

  public Integer getScore() {
    return score;
  }

  public void setScore(Integer score) {
    this.score = score;
  }

  public Integer getAcquirement() {
    return acquirement;
  }

  public void setAcquirement(Integer acquirement) {
    this.acquirement = acquirement;
  }

  public String getDetail() {
    return detail;
  }

  public void setDetail(String detail) {
    this.detail = detail;
  }

  public Integer getType() {
    return type;
  }

  public void setType(Integer type) {
    this.type = type;
  }

  public Integer getStatus() {
    return status;
  }

  public void setStatus(Integer status) {
    this.status = status;
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
    return "TrackerBadge{" +
        "id=" + id +
        ", name='" + name + '\'' +
        ", colorUrl='" + colorUrl + '\'' +
        ", grayUrl='" + grayUrl + '\'' +
        ", score=" + score +
        ", acquirement=" + acquirement +
        ", detail='" + (detail == null ? "" : (detail.length() > 64 ? detail.substring(0, 64) + "..." : detail)) + '\'' +
        ", type=" + type +
        ", status=" + status +
        ", createTime=" + createTime +
        ", updateTime=" + updateTime +
        '}';
  }
}


