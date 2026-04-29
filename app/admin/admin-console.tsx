"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";
import { competitions, people, type RelationType } from "@/lib/data";

type DraftPerson = {
  name: string;
  roles: string;
  city: string;
  mainEvent: string;
  bio: string;
  visible: boolean;
};

type DraftCompetition = {
  name: string;
  date: string;
  city: string;
  venue: string;
  tags: string;
  status: string;
  completeness: string;
};

type DraftAchievement = {
  person: string;
  type: string;
  title: string;
  description: string;
  featured: boolean;
};

type DraftRelation = {
  person: string;
  competition: string;
  type: RelationType;
  note: string;
};

type AdminDrafts = {
  people: DraftPerson[];
  competitions: DraftCompetition[];
  achievements: DraftAchievement[];
  relations: DraftRelation[];
};

type LocalProfileDraft = {
  wcaId: string;
  province: string;
  city: string;
  visible: boolean;
  createdAt?: string;
  createdBy?: string;
  name: string;
  country: string;
  existsInWca: boolean;
};

const storageKey = "liaoning-cube-admin-drafts";
const defaultCreatedBy = "刘一鸣";
const liaoningCities = ["沈阳", "大连", "鞍山", "抚顺", "本溪", "丹东", "锦州", "营口", "阜新", "辽阳", "盘锦", "铁岭", "朝阳", "葫芦岛"];

const emptyDrafts: AdminDrafts = {
  people: [],
  competitions: [],
  achievements: [],
  relations: []
};

export function AdminConsole() {
  const [drafts, setDrafts] = useState<AdminDrafts>(emptyDrafts);
  const [localProfiles, setLocalProfiles] = useState<LocalProfileDraft[]>([]);
  const [localProfile, setLocalProfile] = useState({
    wcaId: "",
    province: "辽宁",
    city: "沈阳"
  });
  const [localProfilesStatus, setLocalProfilesStatus] = useState("读取中");
  const [localProfileNotice, setLocalProfileNotice] = useState("");
  const [localProfileSearch, setLocalProfileSearch] = useState("");
  const [person, setPerson] = useState<DraftPerson>({
    name: "",
    roles: "运动员",
    city: "",
    mainEvent: "",
    bio: "",
    visible: true
  });
  const [competition, setCompetition] = useState<DraftCompetition>({
    name: "",
    date: "",
    city: "",
    venue: "",
    tags: "",
    status: "待补充",
    completeness: "低"
  });
  const [achievement, setAchievement] = useState<DraftAchievement>({
    person: people[0]?.name || "",
    type: "赛事冠军",
    title: "",
    description: "",
    featured: true
  });
  const [relation, setRelation] = useState<DraftRelation>({
    person: people[0]?.name || "",
    competition: competitions[0]?.name || "",
    type: "参赛",
    note: ""
  });

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      setDrafts(JSON.parse(saved) as AdminDrafts);
    }

    fetch("/api/local-profiles")
      .then((response) => response.json())
      .then((payload) => {
        setLocalProfiles(payload.profiles || []);
        setLocalProfilesStatus("已读取");
      })
      .catch(() => setLocalProfilesStatus("读取失败"));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(drafts));
  }, [drafts]);

  const totals = useMemo(
    () => ({
      people: people.length + drafts.people.length,
      competitions: competitions.length + drafts.competitions.length,
      achievements: drafts.achievements.length,
      relations: drafts.relations.length,
      localProfiles: localProfiles.length
    }),
    [drafts, localProfiles.length]
  );

  const filteredLocalProfiles = useMemo(() => {
    const keyword = localProfileSearch.trim().toLowerCase();
    if (!keyword) return localProfiles;
    return localProfiles.filter((profile) =>
      [profile.wcaId, profile.name, profile.province, profile.city, profile.country, profile.createdBy]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [localProfileSearch, localProfiles]);

  function addPerson() {
    if (!person.name.trim()) return;
    setDrafts((current) => ({ ...current, people: [person, ...current.people] }));
    setPerson({ name: "", roles: "运动员", city: "", mainEvent: "", bio: "", visible: true });
  }

  function addCompetition() {
    if (!competition.name.trim()) return;
    setDrafts((current) => ({ ...current, competitions: [competition, ...current.competitions] }));
    setCompetition({ name: "", date: "", city: "", venue: "", tags: "", status: "待补充", completeness: "低" });
  }

  function addAchievement() {
    if (!achievement.title.trim()) return;
    setDrafts((current) => ({ ...current, achievements: [achievement, ...current.achievements] }));
    setAchievement({ person: people[0]?.name || "", type: "赛事冠军", title: "", description: "", featured: true });
  }

  function addRelation() {
    setDrafts((current) => ({ ...current, relations: [relation, ...current.relations] }));
    setRelation({ person: people[0]?.name || "", competition: competitions[0]?.name || "", type: "参赛", note: "" });
  }

  function addLocalProfile() {
    const wcaId = localProfile.wcaId.trim().toUpperCase();
    if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) {
      setLocalProfileNotice("请输入正确的 WCA ID，例如 2018WUYU03。");
      return;
    }
    if (localProfiles.some((profile) => profile.wcaId === wcaId)) {
      setLocalProfileNotice("这个 WCA ID 已在辽宁选手库中。");
      return;
    }
    const nextProfiles = [
      {
        ...localProfile,
        wcaId,
        visible: true,
        createdAt: new Date().toISOString(),
        createdBy: defaultCreatedBy,
        name: "",
        country: "",
        existsInWca: false
      },
      ...localProfiles
    ];
    setLocalProfiles(nextProfiles);
    setLocalProfile((current) => ({ ...current, wcaId: "" }));
    setLocalProfileNotice("");
    saveLocalProfiles(nextProfiles);
  }

  function updateLocalProfile(index: number, next: Partial<LocalProfileDraft>) {
    setLocalProfiles((current) =>
      current.map((profile, profileIndex) => (profileIndex === index ? { ...profile, ...next } : profile))
    );
    setLocalProfilesStatus("有未保存修改");
  }

  function removeLocalProfile(index: number) {
    setLocalProfiles((current) => current.filter((_profile, profileIndex) => profileIndex !== index));
    setLocalProfilesStatus("有未保存修改");
  }

  function saveLocalProfiles(nextProfiles = localProfiles) {
    setLocalProfilesStatus("保存中");
    fetch("/api/local-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profiles: nextProfiles.map((profile) => ({ ...profile, visible: true })) })
    })
      .then((response) => response.json())
      .then((payload) => {
        setLocalProfiles(payload.profiles || []);
        setLocalProfilesStatus("已保存");
        setLocalProfileNotice("选手库已保存。");
      })
      .catch(() => {
        setLocalProfilesStatus("保存失败");
        setLocalProfileNotice("保存失败，请稍后重试。");
      });
  }

  return (
    <section className="container section">
      <div className="stat-band" style={{ width: "100%", paddingTop: 0 }}>
        <div className="stat">
          <strong>{totals.people}</strong>
          <span>人员记录</span>
        </div>
        <div className="stat">
          <strong>{totals.competitions}</strong>
          <span>赛事记录</span>
        </div>
        <div className="stat">
          <strong>{totals.achievements}</strong>
          <span>本地荣誉草稿</span>
        </div>
        <div className="stat">
          <strong>{totals.relations}</strong>
          <span>本地关联草稿</span>
        </div>
        <div className="stat">
          <strong>{totals.localProfiles}</strong>
          <span>辽宁选手库</span>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <div className="admin-card-heading">
          <div>
            <h2>辽宁选手库</h2>
            <p>维护 WCA ID、省份、城市和是否参与本地排名。保存后会写入 data/local-profiles.json。</p>
          </div>
          <span className="status">{localProfilesStatus}</span>
        </div>

        <div className="form-grid">
          <Field
            label="WCA ID"
            value={localProfile.wcaId}
            onChange={(value) => setLocalProfile({ ...localProfile, wcaId: value })}
          />
          <Field
            label="省份"
            value={localProfile.province}
            onChange={(value) => setLocalProfile({ ...localProfile, province: value })}
          />
          <Field
            label="城市"
            value={localProfile.city}
            onChange={(value) => setLocalProfile({ ...localProfile, city: value })}
          />
        </div>

        <div className="city-quick-picks" aria-label="辽宁城市快捷选择">
          {liaoningCities.map((city) => (
            <button
              className={localProfile.city === city ? "active" : ""}
              type="button"
              onClick={() => setLocalProfile({ ...localProfile, province: "辽宁", city })}
              key={city}
            >
              {city}
            </button>
          ))}
        </div>

        <div className="hero-actions" style={{ marginTop: 14 }}>
          <button className="button primary" onClick={addLocalProfile} type="button">
            <Plus size={17} />
            新增并保存
          </button>
          <button className="button" onClick={() => saveLocalProfiles()} type="button">
            <Save size={17} />
            保存当前修改
          </button>
        </div>
        {localProfileNotice ? <p className="admin-inline-notice">{localProfileNotice}</p> : null}

        <div className="admin-local-tools">
          <label className="field">
            <span>检索已录入选手</span>
            <input
              placeholder="输入 WCA ID、姓名、省份或城市"
              value={localProfileSearch}
              onChange={(event) => setLocalProfileSearch(event.target.value)}
            />
          </label>
          <span className="admin-local-count">
            {filteredLocalProfiles.length} / {localProfiles.length}
          </span>
        </div>

        <div className="result-table-wrap admin-local-table">
          <table className="result-table">
            <thead>
              <tr>
                <th>WCA ID</th>
                <th>官方姓名</th>
                <th>省份</th>
                <th>城市</th>
                <th>录入信息</th>
                <th>校验</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocalProfiles.map((profile) => {
                const index = localProfiles.findIndex((item) => item.wcaId === profile.wcaId);
                return (
                  <tr key={profile.wcaId}>
                    <td>{profile.wcaId}</td>
                    <td>{profile.name || "-"}</td>
                    <td>
                      <input
                        value={profile.province}
                        onChange={(event) => updateLocalProfile(index, { province: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        value={profile.city}
                        onChange={(event) => updateLocalProfile(index, { city: event.target.value })}
                      />
                    </td>
                    <td>
                      <span className="admin-profile-meta">
                        <strong>{profile.createdBy || defaultCreatedBy}</strong>
                        <small>{formatDateTime(profile.createdAt)}</small>
                      </span>
                    </td>
                    <td>
                      <span className={`status ${profile.existsInWca ? "status-高" : "status-低"}`}>
                        {profile.existsInWca ? "已匹配" : "未匹配"}
                      </span>
                    </td>
                    <td>
                      <button className="button" type="button" onClick={() => removeLocalProfile(index)}>
                        移除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredLocalProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7}>没有找到匹配的已录入选手。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid two">
        <div className="admin-card">
          <h2>人员管理</h2>
          <div className="form-grid">
            <Field label="姓名" value={person.name} onChange={(value) => setPerson({ ...person, name: value })} />
            <Field label="身份标签" value={person.roles} onChange={(value) => setPerson({ ...person, roles: value })} />
            <Field label="城市 / 地区" value={person.city} onChange={(value) => setPerson({ ...person, city: value })} />
            <Field label="主项 / 方向" value={person.mainEvent} onChange={(value) => setPerson({ ...person, mainEvent: value })} />
            <Field label="简介" textarea full value={person.bio} onChange={(value) => setPerson({ ...person, bio: value })} />
          </div>
          <button className="button primary" style={{ marginTop: 14 }} onClick={addPerson} type="button">
            <Plus size={17} />
            新增人员草稿
          </button>
        </div>

        <div className="admin-card">
          <h2>赛事管理</h2>
          <div className="form-grid">
            <Field label="赛事名称" value={competition.name} onChange={(value) => setCompetition({ ...competition, name: value })} />
            <Field label="举办时间" type="date" value={competition.date} onChange={(value) => setCompetition({ ...competition, date: value })} />
            <Field label="城市" value={competition.city} onChange={(value) => setCompetition({ ...competition, city: value })} />
            <Field label="场馆" value={competition.venue} onChange={(value) => setCompetition({ ...competition, venue: value })} />
            <Field label="赛事标签" full value={competition.tags} onChange={(value) => setCompetition({ ...competition, tags: value })} />
            <SelectField
              label="资料状态"
              options={["待补充", "部分整理", "已整理"]}
              value={competition.status}
              onChange={(value) => setCompetition({ ...competition, status: value })}
            />
            <SelectField
              label="完整度"
              options={["低", "中", "高"]}
              value={competition.completeness}
              onChange={(value) => setCompetition({ ...competition, completeness: value })}
            />
          </div>
          <button className="button primary" style={{ marginTop: 14 }} onClick={addCompetition} type="button">
            <Plus size={17} />
            新增赛事草稿
          </button>
        </div>

        <div className="admin-card">
          <h2>荣誉管理</h2>
          <div className="form-grid">
            <SelectField
              label="关联人员"
              options={people.map((item) => item.name)}
              value={achievement.person}
              onChange={(value) => setAchievement({ ...achievement, person: value })}
            />
            <Field label="荣誉类型" value={achievement.type} onChange={(value) => setAchievement({ ...achievement, type: value })} />
            <Field label="荣誉标题" full value={achievement.title} onChange={(value) => setAchievement({ ...achievement, title: value })} />
            <Field
              label="荣誉说明"
              textarea
              full
              value={achievement.description}
              onChange={(value) => setAchievement({ ...achievement, description: value })}
            />
          </div>
          <button className="button primary" style={{ marginTop: 14 }} onClick={addAchievement} type="button">
            <Save size={17} />
            保存荣誉草稿
          </button>
        </div>

        <div className="admin-card">
          <h2>人员赛事关联</h2>
          <div className="form-grid">
            <SelectField
              label="人员"
              options={people.map((item) => item.name)}
              value={relation.person}
              onChange={(value) => setRelation({ ...relation, person: value })}
            />
            <SelectField
              label="赛事"
              options={competitions.map((item) => item.name)}
              value={relation.competition}
              onChange={(value) => setRelation({ ...relation, competition: value })}
            />
            <SelectField
              label="关联类型"
              options={["参赛", "执裁", "教练", "主办", "工作人员", "嘉宾", "外出交流"]}
              value={relation.type}
              onChange={(value) => setRelation({ ...relation, type: value as RelationType })}
            />
            <Field label="备注" value={relation.note} onChange={(value) => setRelation({ ...relation, note: value })} />
          </div>
          <button className="button primary" style={{ marginTop: 14 }} onClick={addRelation} type="button">
            <Save size={17} />
            保存关联草稿
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <h2>本地草稿记录</h2>
        <div className="admin-list">
          {[...drafts.people.map((item) => `人员：${item.name} · ${item.roles}`), ...drafts.competitions.map((item) => `赛事：${item.name} · ${item.status}`), ...drafts.achievements.map((item) => `荣誉：${item.person} · ${item.title}`), ...drafts.relations.map((item) => `关联：${item.person} ${item.type} ${item.competition}`)].map((item, index) => (
            <div className="admin-list-item" key={`${item}-${index}`}>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "历史数据";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "历史数据";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function Field({
  label,
  value,
  onChange,
  full,
  textarea,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      {label}
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
