package com.wenyibi.futuremail.model.tracker;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * 技能树章节阶段枚举
 * - 提供显示名与章节对应的 tagId 列表
 * - 提供 fromKey 便捷方法支持英文 key 与中文名映射
 */
public enum TrackerStageEnum {
  
  // 位于第一章与第二章之间的“间章”
  INTERLUDE_DAWN("间章（拂晓）", Arrays.asList(1020, 1021, 1022, 1023, 1024)),
  CHAPTER1("第一章（晨曦微光）", Arrays.asList(1001, 1002, 1003, 1004, 1005, 1006, 1007, 1009, 1011, 1012, 1013, 1014, 1015, 1016, 1019, 1017)),
  CHAPTER2("第二章（懵懂新芽）", Arrays.asList(1101, 1102, 1103, 1104, 1010, 1105, 1106, 1107, 1108, 1109, 1110, 1111, 1112));
  
  private final String displayName;
  private final List<Integer> tagIds;
  
  TrackerStageEnum(String displayName, List<Integer> tagIds) {
    this.displayName = displayName;
    this.tagIds = Collections.unmodifiableList(tagIds);
  }
  
  public String getDisplayName() {
    return displayName;
  }
  
  public List<Integer> getTagIds() {
    return tagIds;
  }
  
  /**
   * 兼容字符串 key（英文/中文）到枚举
   * 支持：dawn/chapter1/chapter2/ch1/ch2/first/second 以及中文显示名
   */
  public static TrackerStageEnum fromKey(String key) {
    if (key == null) {
      return null;
    }
    String k = key.trim().toLowerCase(Locale.ROOT);
    if ("间章（拂晓）".equals(key)) return INTERLUDE_DAWN;
    if ("第一章（晨曦微光）".equals(key)) return CHAPTER1;
    if ("第二章（懵懂新芽）".equals(key)) return CHAPTER2;
    
    switch (k) {
      // 兼容旧写法与通用别名
      case "dawn":
      case "interlude":
      case "ch1.5":
        return INTERLUDE_DAWN;
      case "chapter1":
      case "ch1":
      case "first":
        return CHAPTER1;
      case "chapter2":
      case "ch2":
      case "second":
        return CHAPTER2;
      default:
        return null;
    }
  }
}
