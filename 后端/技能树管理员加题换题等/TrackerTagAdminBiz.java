package com.wenyibi.futuremail.biz.tracker;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.wenyibi.futuremail.service.question.TrackerTagService;
import com.wenyibi.futuremail.service.CodingProblemService;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;

@Component
public class TrackerTagAdminBiz {
    @Autowired
    private TrackerTagService trackerTagService;
    @Autowired
    private CodingProblemService codingProblemService;

    public int addTagQuestion(int tagId, long questionId, int score) {
        // 1) 通过 questionId 查询对应 problemId
        List<Long> qids = Collections.singletonList(questionId);
        Map<Long, Long> qid2Pid = codingProblemService.getCodingQuestionId2IdByQuestionIds(qids);
        Long problemId = qid2Pid == null ? null : qid2Pid.get(questionId);
        long pid = problemId == null ? 0L : problemId.longValue();
        // 2) 写入 tracker_tag_question（包含 problem_id）
        return trackerTagService.insertTagQuestionWithProblem(tagId, questionId, pid, score);
    }

    public int updateTagQuestion(int tagId, int score, long questionId) {
        return trackerTagService.updateTagQuestionInfo(tagId, score, questionId);
    }

    public int deleteTagQuestion(long questionId) {
        return trackerTagService.deleteTagQuestion(questionId);
    }

    /**
     * 全量替换：删除该 tagId 下所有题目，按 items 顺序重建
     * items: [{questionId, score, dependencies, order?}]
     */
    public int batchReplaceTagQuestions(int tagId, JSONArray items) {
        if (items == null || items.isEmpty()) {
            // 清空该 tagId 下所有题目
            trackerTagService.deleteByTagId(tagId);
            return 0;
        }
        // 组装 questionId 列表
        List<Long> qids = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            JSONObject it = items.getJSONObject(i);
            long qid = it.getLongValue("questionId");
            if (qid > 0) qids.add(qid);
        }
        // 批量映射 questionId -> problemId
        Map<Long, Long> qid2Pid = codingProblemService.getCodingQuestionId2IdByQuestionIds(qids);
        // 删除旧数据
        trackerTagService.deleteByTagId(tagId);
        int inserted = 0;
        for (int i = 0; i < items.size(); i++) {
            JSONObject it = items.getJSONObject(i);
            long qid = it.getLongValue("questionId");
            int score = Math.max(0, it.getIntValue("score"));
            String deps = it.getString("dependencies");
            int qindex = i + 1;
            Long pid = qid2Pid == null ? null : qid2Pid.get(qid);
            long problemId = pid == null ? 0L : pid.longValue();
            inserted += trackerTagService.insertTagQuestionWithProblem(tagId, qid, problemId, score, deps, qindex);
        }
        return inserted;
    }
}
