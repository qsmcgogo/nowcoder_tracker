package com.wenyibi.futuremail.service.acm.team;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.wenyibi.futuremail.dao.acm.team.ACMTeamInfoDAO;
import com.wenyibi.futuremail.model.acm.team.ACMTeamInfo;
import com.wenyibi.futuremail.model.acm.team.ACMTeamTypeInfoEnum;
import java.util.Collections;

/**
 * Created by Jianjie Wang on 2019/4/24.
 */
@Service
public class ACMTeamInfoServiceImpl implements ACMTeamInfoService {

  @Autowired
  private ACMTeamInfoDAO acmTeamInfoDAO;


  @Override
  public ACMTeamInfo getById(long id) {
    return acmTeamInfoDAO.getById(id);
  }


  @Override
  public List<ACMTeamInfo> getByIds(List<Long> ids, List<Integer> types) {
    return acmTeamInfoDAO.getByIds(ids, types);
  }

  

  @Override
  public Map<Long, ACMTeamInfo> getMapByIds(List<Long> ids, List<Integer> types) {
    return acmTeamInfoDAO.getByIds(ids, types).stream()
        .collect(Collectors.toMap(ACMTeamInfo::getId, Function.identity()));
  }

  @Override
  public long save(ACMTeamInfo acmTeamInfo) {
    return acmTeamInfoDAO.save(acmTeamInfo);
  }

  @Override
  public int update(ACMTeamInfo acmTeamInfo) {
    return acmTeamInfoDAO.update(acmTeamInfo);
  }

  @Override
  public int updateStatus(long id, int status) {
    return acmTeamInfoDAO.updateStatus(id, status);
  }

  @Override
  public int updateName(long id, String name) {
    return acmTeamInfoDAO.updateName(id, name);
  }

  @Override
  public int updatePersonCount(long id, int personCount) {
    return acmTeamInfoDAO.updatePersonCount(id, personCount);
  }

  @Override
  public int updateUid(long id, long uid) {
    return acmTeamInfoDAO.updateUid(id, uid);
  }

  @Override
  public ACMTeamInfo getByName(String name) {
    return acmTeamInfoDAO.getByName(name);
  }
  
  @Override
  public int updateDescription(long id, String description) {
    return acmTeamInfoDAO.updateDescription(id, description);
  }

}
