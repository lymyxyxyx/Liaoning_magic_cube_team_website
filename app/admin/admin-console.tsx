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

const storageKey = "liaoning-cube-admin-drafts";

const emptyDrafts: AdminDrafts = {
  people: [],
  competitions: [],
  achievements: [],
  relations: []
};

export function AdminConsole() {
  const [drafts, setDrafts] = useState<AdminDrafts>(emptyDrafts);
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
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(drafts));
  }, [drafts]);

  const totals = useMemo(
    () => ({
      people: people.length + drafts.people.length,
      competitions: competitions.length + drafts.competitions.length,
      achievements: drafts.achievements.length,
      relations: drafts.relations.length
    }),
    [drafts]
  );

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
