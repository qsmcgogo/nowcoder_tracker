package com.wenyibi.futuremail.service.tracker.badge;


import com.wenyibi.futuremail.dao.tracker.TrackerBadgeDAO;
import com.wenyibi.futuremail.model.tracker.TrackerBadge;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
@Service
public class TrackerBadgeService {
    
    @Autowired
    private TrackerBadgeDAO trackerBadgeDAO;

    public List<TrackerBadge> listByTypeList(List<Integer> typeList) {
        return trackerBadgeDAO.listByTypeList(typeList);
    }

    public TrackerBadge getById(long id) {
        return trackerBadgeDAO.getById(id);
    }

    public Map<Long,TrackerBadge> listByIdList(List<Long> idList) {
        return trackerBadgeDAO.listByIdList(idList);
    }
    

}
