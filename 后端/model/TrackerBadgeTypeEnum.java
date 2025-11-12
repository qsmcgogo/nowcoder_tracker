package com.wenyibi.futuremail.model.tracker;

/**
 * Tracker 成就类型枚举（仅分类，不包含数据库细节）。
 * 1: 累计打卡
 * 2: 连续打卡
 * 3: 打卡其他成就
 * 4: 累计过题
 * 5: 牛客系列赛
 * 6: 技能树
 *
 * @author qsmcgogo
 * @date 2025-10-27
 */
public enum TrackerBadgeTypeEnum {

  CHECKIN_CUMULATIVE(1, "累计打卡"),
  CHECKIN_CONSECUTIVE(2, "连续打卡"),
  CHECKIN_SPECIAL(3, "打卡其他成就"),
  ACCEPT_CUMULATIVE(4, "累计过题"),
  NOWCODER_SERIES(5, "牛客系列赛"),
  SKILL_TREE(6, "技能树");

  private final int value;
  private final String name;

  TrackerBadgeTypeEnum(int value, String name) {
    this.value = value;
    this.name = name;
  }

  public int getValue() {
    return value;
  }

  public String getName() {
    return name;
  }

  public static TrackerBadgeTypeEnum findByValue(int value) {
    for (TrackerBadgeTypeEnum t : values()) {
      if (t.getValue() == value) {
        return t;
      }
    }
    return null;
  }
}


