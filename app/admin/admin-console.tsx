"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";

type LocalProfileDraft = {
  wcaId?: string;
  localId?: string;
  name?: string;
  province: string;
  city: string;
  visible: boolean;
  sourceCompetition?: string;
  createdAt?: string;
  createdBy?: string;
  checkedAt?: string;
  checkedBy?: string;
  country: string;
  existsInWca: boolean;
};

const defaultCreatedBy = "刘一鸣";
const liaoningCities = ["沈阳", "大连", "鞍山", "抚顺", "本溪", "丹东", "锦州", "营口", "阜新", "辽阳", "盘锦", "铁岭", "朝阳", "葫芦岛"];

export function AdminConsole() {
  const [localProfiles, setLocalProfiles] = useState<LocalProfileDraft[]>([]);
  const [entryMode, setEntryMode] = useState<"wca" | "local">("wca");
  const [localProfile, setLocalProfile] = useState({
    wcaId: "",
    name: "",
    province: "辽宁",
    city: "沈阳",
    sourceCompetition: ""
  });
  const [localProfilesStatus, setLocalProfilesStatus] = useState("读取中");
  const [localProfileNotice, setLocalProfileNotice] = useState("");
  const [localProfileSearch, setLocalProfileSearch] = useState("");

  useEffect(() => {
    fetch("/api/local-profiles")
      .then((response) => response.json())
      .then((payload) => {
        setLocalProfiles(payload.profiles || []);
        setLocalProfilesStatus("已读取");
      })
      .catch(() => setLocalProfilesStatus("读取失败"));
  }, []);

  const totals = useMemo(
    () => ({
      localProfiles: localProfiles.length,
      matchedProfiles: localProfiles.filter((profile) => profile.existsInWca).length,
      checkedProfiles: localProfiles.filter((profile) => profile.checkedAt).length
    }),
    [localProfiles]
  );

  const filteredLocalProfiles = useMemo(() => {
    const keyword = localProfileSearch.trim().toLowerCase();
    if (!keyword) return localProfiles;
    return localProfiles.filter((profile) =>
      [
        profile.wcaId,
        profile.localId,
        profile.name,
        profile.province,
        profile.city,
        profile.country,
        profile.sourceCompetition,
        profile.createdBy,
        profile.checkedBy
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [localProfileSearch, localProfiles]);

  function addLocalProfile() {
    const baseProfile = {
      province: localProfile.province,
      city: localProfile.city,
      visible: true,
      createdAt: new Date().toISOString(),
      createdBy: defaultCreatedBy,
      country: "",
      existsInWca: false
    };
    let nextProfile: LocalProfileDraft;
    if (entryMode === "wca") {
      const wcaId = localProfile.wcaId.trim().toUpperCase();
      if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) {
        setLocalProfileNotice("请输入正确的 WCA ID，例如 2018WUYU03。");
        return;
      }
      if (localProfiles.some((profile) => profile.wcaId === wcaId)) {
        setLocalProfileNotice("这个 WCA ID 已在辽宁选手库中。");
        return;
      }
      nextProfile = {
        ...baseProfile,
        wcaId,
        name: ""
      };
    } else {
      const name = localProfile.name.trim();
      const sourceCompetition = localProfile.sourceCompetition.trim();
      if (!name) {
        setLocalProfileNotice("请输入无 WCA ID 选手姓名。");
        return;
      }
      if (!sourceCompetition) {
        setLocalProfileNotice("请输入这个选手来自哪场比赛记录。");
        return;
      }
      const localId = createLocalProfileId(name, sourceCompetition);
      if (localProfiles.some((profile) => getProfileKey(profile) === localId)) {
        setLocalProfileNotice("这个无 WCA ID 选手记录已在辽宁选手库中。");
        return;
      }
      nextProfile = {
        ...baseProfile,
        localId,
        name,
        sourceCompetition
      };
    }
    const nextProfiles = [nextProfile, ...localProfiles];
    setLocalProfiles(nextProfiles);
    setLocalProfile((current) => ({ ...current, wcaId: "", name: "", sourceCompetition: "" }));
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
    const profile = localProfiles[index];
    if (!profile) return;
    if (!window.confirm(`确认从本地人员库移除 ${profile.wcaId || profile.name || "这条记录"}？`)) return;
    setLocalProfiles((current) => current.filter((_profile, profileIndex) => profileIndex !== index));
    setLocalProfilesStatus("有未保存修改");
  }

  function checkLocalProfile(index: number) {
    if (index < 0) return;
    const nextProfiles = localProfiles.map((profile, profileIndex) =>
      profileIndex === index
        ? {
            ...profile,
            checkedAt: new Date().toISOString(),
            checkedBy: defaultCreatedBy
          }
        : profile
    );
    setLocalProfiles(nextProfiles);
    saveLocalProfiles(nextProfiles, `${nextProfiles[index].wcaId || nextProfiles[index].name} 已记录核对信息。`);
  }

  function saveLocalProfiles(nextProfiles = localProfiles, successNotice = "选手库已保存。") {
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
        setLocalProfileNotice(successNotice);
      })
      .catch(() => {
        setLocalProfilesStatus("保存失败");
        setLocalProfileNotice("保存失败，请稍后重试。");
      });
  }

  return (
    <section className="container section admin-console-shell">
      <div className="admin-workspace-heading">
        <div>
          <h1>辽宁选手库</h1>
          <p>录入 WCA ID、省份、城市，并对历史选手做人工核对记录。</p>
        </div>
        <span className="status">{localProfilesStatus}</span>
      </div>

      <div className="stat-band admin-profile-stats">
        <div className="stat">
          <strong>{totals.localProfiles}</strong>
          <span>人员库总数</span>
        </div>
        <div className="stat">
          <strong>{filteredLocalProfiles.length}</strong>
          <span>当前显示</span>
        </div>
        <div className="stat">
          <strong>{totals.checkedProfiles}</strong>
          <span>已核对</span>
        </div>
        <div className="stat">
          <strong>{totals.matchedProfiles}</strong>
          <span>WCA 已匹配</span>
        </div>
      </div>

      <div className="admin-profile-workbench">
        <div className="admin-card admin-profile-library">
          <div className="admin-card-heading">
            <div>
              <h2>完整人员库</h2>
              <p>搜索、修改城市、核对历史数据都在这里完成。</p>
            </div>
            <span className="admin-local-count">
              {filteredLocalProfiles.length} / {localProfiles.length}
            </span>
          </div>

          <label className="field admin-profile-search">
            检索已录入选手
            <input
              placeholder="输入 WCA ID、姓名、省份、城市、来源赛事或核对人"
              value={localProfileSearch}
              onChange={(event) => setLocalProfileSearch(event.target.value)}
            />
          </label>

          <div className="result-table-wrap admin-local-table">
            <table className="result-table">
              <thead>
                <tr>
                  <th>身份</th>
                  <th>姓名</th>
                  <th>省份</th>
                  <th>城市</th>
                  <th>来源赛事</th>
                  <th>录入 / 核对</th>
                  <th>校验</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocalProfiles.map((profile) => {
                  const index = localProfiles.findIndex((item) => getProfileKey(item) === getProfileKey(profile));
                  return (
                    <tr key={getProfileKey(profile)}>
                      <td>{profile.wcaId || "无 WCA ID"}</td>
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
                      <td>{profile.sourceCompetition || "-"}</td>
                      <td>
                        <span className="admin-profile-meta">
                          <small>录入：{formatProfileMeta(profile.createdBy, profile.createdAt, "历史数据")}</small>
                          <small>核对：{formatProfileMeta(profile.checkedBy, profile.checkedAt, "未核对")}</small>
                        </span>
                      </td>
                      <td>
                        <span className={`status ${profile.existsInWca ? "status-高" : "status-低"}`}>
                          {profile.wcaId ? (profile.existsInWca ? "已匹配" : "未匹配") : "无 ID"}
                        </span>
                      </td>
                      <td>
                        <span className="admin-profile-actions">
                          <button className="button" type="button" onClick={() => checkLocalProfile(index)}>
                            已核对
                          </button>
                          <button className="button" type="button" onClick={() => removeLocalProfile(index)}>
                            移除
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredLocalProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={8}>没有找到匹配的已录入选手。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="admin-card admin-profile-entry">
          <div className="admin-card-heading">
            <div>
              <h2>录入选手</h2>
              <p>新增人员会自动记录录入人和录入时间。</p>
            </div>
          </div>

          <div className="segmented blue admin-entry-mode" aria-label="录入方式">
            <button className={entryMode === "wca" ? "active" : ""} type="button" onClick={() => setEntryMode("wca")}>
              有 WCA ID
            </button>
            <button className={entryMode === "local" ? "active" : ""} type="button" onClick={() => setEntryMode("local")}>
              无 WCA ID
            </button>
          </div>

          <div className="form-grid admin-entry-form">
            {entryMode === "wca" ? (
              <Field
                label="WCA ID"
                value={localProfile.wcaId}
                onChange={(value) => setLocalProfile({ ...localProfile, wcaId: value })}
              />
            ) : (
              <>
                <Field
                  label="选手姓名"
                  value={localProfile.name}
                  onChange={(value) => setLocalProfile({ ...localProfile, name: value })}
                />
                <Field
                  label="来源赛事"
                  value={localProfile.sourceCompetition}
                  onChange={(value) => setLocalProfile({ ...localProfile, sourceCompetition: value })}
                />
              </>
            )}
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

          <div className="city-quick-picks admin-city-picks" aria-label="辽宁城市快捷选择">
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

          <div className="admin-entry-actions">
            <button className="button primary" onClick={addLocalProfile} type="button">
              <Plus size={17} />
              新增并保存
            </button>
            <button className="button" onClick={() => saveLocalProfiles()} type="button">
              <Save size={17} />
              保存列表修改
            </button>
          </div>
          {localProfileNotice ? <p className="admin-inline-notice">{localProfileNotice}</p> : null}
        </aside>
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

function formatProfileMeta(name: string | undefined, dateTime: string | undefined, fallback: string) {
  if (!dateTime) return fallback;
  return `${name || defaultCreatedBy} ${formatDateTime(dateTime)}`;
}

function getProfileKey(profile: Pick<LocalProfileDraft, "wcaId" | "localId" | "name" | "sourceCompetition">) {
  return profile.wcaId || profile.localId || createLocalProfileId(profile.name || "", profile.sourceCompetition || "");
}

function createLocalProfileId(name: string, sourceCompetition: string) {
  const seed = `${name}-${sourceCompetition}`.trim() || String(Date.now());
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `LOCAL-${hash.toString(36).toUpperCase()}`;
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
