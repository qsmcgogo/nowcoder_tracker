package com.wenyibi.futuremail.controllers.problem.tracker;

import com.alibaba.fastjson.JSONObject;
import com.wenyibi.futuremail.anotation.LoginRequired;
import com.wenyibi.futuremail.cache.JedisAdapter;
import com.wenyibi.futuremail.component.HostHolder;
import com.wenyibi.futuremail.util.InstructionUtils;
import com.wenyibi.futuremail.util.RedisKeyUtil;
import net.paoding.rose.web.annotation.DefValue;
import net.paoding.rose.web.annotation.Param;
import net.paoding.rose.web.annotation.Path;
import net.paoding.rose.web.annotation.rest.Get;
import net.paoding.rose.web.annotation.rest.Post;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

@Path("battle")
public class trackerBattleController {

  @Autowired
  private HostHolder hostHolder;

  /**
   * 发起匹配：优先在 ±100 段位内寻找对手；命中则立即成组并返回 roomId；否则加入等待队列
   */
  @Post("match")
  @LoginRequired
  public JSONObject match(@Param("rankScore") int rankScore,
                          @Param("mode") @DefValue("1v1") String mode) {
    long uid = hostHolder.getUser().getId();
    String queueKey = RedisKeyUtil.getBattleQueueKey(mode);
    // 1) 在 ±100 范围内查找候选（按分数升序）
    List<String> candidates = JedisAdapter.zRangeByScore(queueKey,
        Math.max(Integer.MIN_VALUE, rankScore - 100),
        Math.min(Integer.MAX_VALUE, rankScore + 100));
    if (candidates != null) {
      for (String candStr : candidates) {
        if (String.valueOf(uid).equals(candStr)) continue;
        // 尝试抢占对手（原子性不足但足够用于 MVP；并发下失败则继续）
        Long removed = JedisAdapter.zrem(queueKey, candStr);
        if (removed != null && removed > 0) {
          // 成功拿到对手，创建房间并写入双方匹配结果
          String roomId = UUID.randomUUID().toString().replace("-", "");
          JSONObject room = new JSONObject();
          room.put("roomId", roomId);
          room.put("mode", mode);
          room.put("userA", uid);
          room.put("userB", Long.parseLong(candStr));
          room.put("rankA", rankScore);
          room.put("createdAt", System.currentTimeMillis());
          JedisAdapter.setObjectEx(RedisKeyUtil.getBattleRoomKey(roomId), room, 60 * 60);
          // 写入双方匹配结果（轮询读取）；保留 5 分钟
          JedisAdapter.setex(RedisKeyUtil.getBattleMatchKey(uid), roomId, 5 * 60);
          JedisAdapter.setex(RedisKeyUtil.getBattleMatchKey(Long.parseLong(candStr)), roomId, 5 * 60);
          JSONObject data = new JSONObject();
          data.put("matched", true);
          data.put("roomId", roomId);
          data.put("opponentId", Long.parseLong(candStr));
          return InstructionUtils.jsonOkData(data);
        }
      }
    }
    // 2) 未命中则加入等待队列
    JedisAdapter.zAdd(queueKey, rankScore, String.valueOf(uid));
    JSONObject data = new JSONObject();
    data.put("matched", false);
    return InstructionUtils.jsonOkData(data);
  }

  /**
   * 轮询匹配结果：返回是否已匹配与 roomId
   */
  @Get("poll")
  @LoginRequired
  public JSONObject poll() {
    long uid = hostHolder.getUser().getId();
    String roomId = JedisAdapter.get(RedisKeyUtil.getBattleMatchKey(uid));
    JSONObject data = new JSONObject();
    data.put("matched", roomId != null && !roomId.isEmpty());
    if (roomId != null && !roomId.isEmpty()) {
      data.put("roomId", roomId);
    }
    return InstructionUtils.jsonOkData(data);
  }

  /**
   * 取消匹配：从队列移除自身
   */
  @Post("cancel")
  @LoginRequired
  public JSONObject cancel(@Param("mode") @DefValue("1v1") String mode) {
    long uid = hostHolder.getUser().getId();
    String queueKey = RedisKeyUtil.getBattleQueueKey(mode);
    JedisAdapter.zrem(queueKey, String.valueOf(uid));
    return InstructionUtils.jsonOk();
  }
}
