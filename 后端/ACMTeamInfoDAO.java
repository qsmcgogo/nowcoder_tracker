package com.wenyibi.futuremail.dao.acm.team;

import java.util.List;

import com.wenyibi.futuremail.model.acm.team.ACMTeamInfo;

import net.paoding.rose.jade.annotation.DAO;
import net.paoding.rose.jade.annotation.SQL;
import net.paoding.rose.jade.annotation.SQLParam;

/**
 * Created by Jianjie Wang on 2019/4/24.
 */
@DAO
public interface ACMTeamInfoDAO {

  String TABLE = " `acm_team_info` ";

  String ACMLimit = " and team_type = 0";

  String INSERT_FIELDS = " name, logo_url, description, personal, person_count, person_limit, uid, status, team_type, create_time";

  String SELECT_FIELDS = " id, " + INSERT_FIELDS;

  @SQL("SELECT " + SELECT_FIELDS + " FROM " + TABLE
      + " WHERE `id` = :id and status = 0 " )
  ACMTeamInfo getById(@SQLParam("id") long id);


  //返回某些类的团队信息
  @SQL("SELECT " + SELECT_FIELDS + " FROM " + TABLE
      + " WHERE `id` in (:1) and status = 0 and team_type in (:2)" )
  List<ACMTeamInfo> getByIds(List<Long> id,List<Integer> types);

  /**
   * 会自带id进行插入
   */
  @SQL("INSERT INTO " + TABLE + " (" + SELECT_FIELDS + ") " +
      " VALUES(:1.id, :1.name, :1.logoUrl, :1.description, :1.personal, :1.personCount,"
      + " :1.personLimit, :1.uid, :1.status, :1.teamType, :1.createTime )")
  long save(ACMTeamInfo acmTeamInfo);

  @SQL("UPDATE " + TABLE +
      " SET name=:1.name, logo_url=:1.logoUrl, description=:1.description, personal=:1.personal, "
      + " person_limit=:1.personLimit, uid=:1.uid "
      + " WHERE id = :1.id")
  int update(ACMTeamInfo acmTeamInfo);

  @SQL("UPDATE " + TABLE +
      " SET status=:2 "
      + " WHERE id = :1")
  int updateStatus(long id, int status);

  @SQL("UPDATE " + TABLE +
      " SET name=:2 "
      + " WHERE id = :1")
  int updateName(long id, String name);

  @SQL("UPDATE " + TABLE +
      " SET person_count=:2 "
      + " WHERE id = :1")
  int updatePersonCount(long id, int personCount);

  @SQL("UPDATE " + TABLE +
      " SET uid = :2 "
      + " WHERE id = :1")
  int updateUid(long id, long uid);

  @SQL("SELECT " + SELECT_FIELDS + " FROM " + TABLE
      + " WHERE `name` = :1 limit 1")
  ACMTeamInfo getByName(String name);
  
  @SQL("UPDATE " + TABLE +
      " SET description=:2 "
      + " WHERE id = :1")
  int updateDescription(long id, String description);


}
