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

type ProfileViewFilter = "all" | "unchecked" | "unmatched" | "local" | "dirty";

const defaultCreatedBy = "刘一鸣";
const liaoningCities = ["沈阳", "大连", "鞍山", "抚顺", "本溪", "丹东", "锦州", "营口", "阜新", "辽阳", "盘锦", "铁岭", "朝阳", "葫芦岛"];

export function AdminConsole() {
  const [localProfiles, setLocalProfiles] = useState<LocalProfileDraft[]>([]);
  const [dirtyProfileKeys, setDirtyProfileKeys] = useState<string[]>([]);
  const [removedProfileKeys, setRemovedProfileKeys] = useState<string[]>([]);
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
  const [profileViewFilter, setProfileViewFilter] = useState<ProfileViewFilter>("all");
  const [batchWcaIds, setBatchWcaIds] = useState("");
  const [wcaLookupStatus, setWcaLookupStatus] = useState("");
  const [isSavingProfiles, setIsSavingProfiles] = useState(false);

  useEffect(() => {
    fetch("/api/local-profiles")
      .then((response) => response.json())
      .then((payload) => {
        setLocalProfiles(payload.profiles || []);
        setLocalProfilesStatus("已读取");
        setDirtyProfileKeys([]);
        setRemovedProfileKeys([]);
      })
      .catch(() => setLocalProfilesStatus("读取失败"));
  }, []);

  useEffect(() => {
    const wcaId = localProfile.wcaId.trim().toUpperCase();
    if (entryMode !== "wca" || !wcaId) {
      setWcaLookupStatus("");
      return;
    }
    if (!/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) {
      setWcaLookupStatus("输入完整 WCA ID 后会自动预查。");
      return;
    }
    if (localProfiles.some((profile) => profile.wcaId === wcaId)) {
      setWcaLookupStatus("这个 WCA ID 已在辽宁选手库中。");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setWcaLookupStatus("正在查询 WCA 人员库...");
      fetch(`/api/local-profiles?wcaId=${encodeURIComponent(wcaId)}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((payload) => {
          const profile = payload.profile as LocalProfileDraft | undefined;
          if (!profile) {
            setWcaLookupStatus("没有查询到这个 WCA ID。");
            return;
          }
          setWcaLookupStatus(
            profile.existsInWca
              ? `已找到：${profile.name || wcaId}${profile.country ? ` / ${profile.country}` : ""}`
              : "未在当前 WCA 数据库中匹配到，录入前请再核对。"
          );
        })
        .catch((error) => {
          if (error.name !== "AbortError") setWcaLookupStatus("查询失败，可以先保存后再核对。");
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [entryMode, localProfile.wcaId, localProfiles]);

  const totals = useMemo(
    () => ({
      localProfiles: localProfiles.length,
      matchedProfiles: localProfiles.filter((profile) => profile.existsInWca).length,
      checkedProfiles: localProfiles.filter((profile) => profile.checkedAt).length,
      uncheckedProfiles: localProfiles.filter((profile) => !profile.checkedAt).length,
      unmatchedProfiles: localProfiles.filter((profile) => profile.wcaId && !profile.existsInWca).length,
      localOnlyProfiles: localProfiles.filter((profile) => !profile.wcaId).length
    }),
    [localProfiles]
  );

  const unsavedCount = dirtyProfileKeys.length + removedProfileKeys.length;

  const filteredLocalProfiles = useMemo(() => {
    const keyword = localProfileSearch.trim().toLowerCase();
    return localProfiles.filter((profile) => {
      const key = getProfileKey(profile);
      const matchesFilter =
        profileViewFilter === "all" ||
        (profileViewFilter === "unchecked" && !profile.checkedAt) ||
        (profileViewFilter === "unmatched" && Boolean(profile.wcaId) && !profile.existsInWca) ||
        (profileViewFilter === "local" && !profile.wcaId) ||
        (profileViewFilter === "dirty" && dirtyProfileKeys.includes(key));
      if (!matchesFilter) return false;
      if (!keyword) return true;
      return [
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
        .some((value) => value.toLowerCase().includes(keyword));
    });
  }, [dirtyProfileKeys, localProfileSearch, localProfiles, profileViewFilter]);

  function markProfileDirty(profile: LocalProfileDraft) {
    const key = getProfileKey(profile);
    setDirtyProfileKeys((current) => (current.includes(key) ? current : [...current, key]));
    setRemovedProfileKeys((current) => current.filter((removedKey) => removedKey !== key));
  }

  function markProfileRemoved(profile: LocalProfileDraft) {
    const key = getProfileKey(profile);
    setDirtyProfileKeys((current) => current.filter((dirtyKey) => dirtyKey !== key));
    setRemovedProfileKeys((current) => (current.includes(key) ? current : [...current, key]));
  }

  function getChangedStatus(nextDirtyCount = dirtyProfileKeys.length, nextRemovedCount = removedProfileKeys.length) {
    const nextUnsavedCount = nextDirtyCount + nextRemovedCount;
    return nextUnsavedCount > 0 ? `${nextUnsavedCount} 条未保存修改` : "已读取";
  }

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
      const nextProfile = {
        ...baseProfile,
        wcaId,
        name: ""
      };
      const nextProfiles = [nextProfile, ...localProfiles];
      setLocalProfiles(nextProfiles);
      setLocalProfile((current) => ({ ...current, wcaId: "", name: "" }));
      setWcaLookupStatus("");
      setLocalProfileNotice("");
      saveLocalProfiles(nextProfiles);
    } else {
      const names = parseLocalProfileNames(localProfile.name);
      const sourceCompetition = localProfile.sourceCompetition.trim();
      if (names.length === 0) {
        setLocalProfileNotice("请输入无 WCA ID 选手姓名。");
        return;
      }
      if (!sourceCompetition) {
        setLocalProfileNotice("请输入这个选手来自哪场比赛记录。");
        return;
      }
      const existingKeys = new Set(localProfiles.map(getProfileKey));
      const nextProfilesToAdd = names
        .map((name) => ({
          ...baseProfile,
          localId: createLocalProfileId(name, sourceCompetition),
          name,
          sourceCompetition
        }))
        .filter((profile) => !existingKeys.has(getProfileKey(profile)));
      if (nextProfilesToAdd.length === 0) {
        setLocalProfileNotice("这些无 WCA ID 选手记录已在辽宁选手库中。");
        return;
      }
      const skippedCount = names.length - nextProfilesToAdd.length;
      const nextProfiles = [...nextProfilesToAdd, ...localProfiles];
      setLocalProfiles(nextProfiles);
      setLocalProfile((current) => ({ ...current, wcaId: "", name: "" }));
      setWcaLookupStatus("");
      setLocalProfileNotice("");
      saveLocalProfiles(
        nextProfiles,
        skippedCount > 0
          ? `已新增 ${nextProfilesToAdd.length} 位无 WCA ID 选手，跳过 ${skippedCount} 条已存在记录。`
          : `已新增 ${nextProfilesToAdd.length} 位无 WCA ID 选手。`
      );
    }
  }

  function addBatchWcaProfiles() {
    const candidates = batchWcaIds
      .split(/[\s,，、;；]+/)
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const uniqueCandidates = Array.from(new Set(candidates));
    const invalidIds = uniqueCandidates.filter((wcaId) => !/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId));
    if (invalidIds.length > 0) {
      setLocalProfileNotice(`这些 WCA ID 格式不正确：${invalidIds.slice(0, 6).join("、")}`);
      return;
    }
    const existingIds = new Set(localProfiles.map((profile) => profile.wcaId).filter(Boolean));
    const newIds = uniqueCandidates.filter((wcaId) => !existingIds.has(wcaId));
    if (newIds.length === 0) {
      setLocalProfileNotice("没有可新增的 WCA ID，可能都已经在库中。");
      return;
    }
    const createdAt = new Date().toISOString();
    const newProfiles = newIds.map((wcaId) => ({
      wcaId,
      province: localProfile.province,
      city: localProfile.city,
      visible: true,
      createdAt,
      createdBy: defaultCreatedBy,
      country: "",
      existsInWca: false
    }));
    const nextProfiles = [...newProfiles, ...localProfiles];
    setLocalProfiles(nextProfiles);
    setBatchWcaIds("");
    saveLocalProfiles(nextProfiles, `已新增 ${newProfiles.length} 位 WCA 选手。`);
  }

  function updateLocalProfile(index: number, next: Partial<LocalProfileDraft>) {
    const profile = localProfiles[index];
    if (!profile) return;
    markProfileDirty(profile);
    setLocalProfiles((current) =>
      current.map((profile, profileIndex) => (profileIndex === index ? { ...profile, ...next } : profile))
    );
    setLocalProfilesStatus(
      getChangedStatus(dirtyProfileKeys.includes(getProfileKey(profile)) ? dirtyProfileKeys.length : dirtyProfileKeys.length + 1)
    );
  }

  function removeLocalProfile(index: number) {
    const profile = localProfiles[index];
    if (!profile) return;
    if (!window.confirm(`确认从本地人员库移除 ${profile.wcaId || profile.name || "这条记录"}？`)) return;
    markProfileRemoved(profile);
    setLocalProfiles((current) => current.filter((_profile, profileIndex) => profileIndex !== index));
    setLocalProfilesStatus(
      getChangedStatus(
        Math.max(0, dirtyProfileKeys.length - (dirtyProfileKeys.includes(getProfileKey(profile)) ? 1 : 0)),
        removedProfileKeys.includes(getProfileKey(profile)) ? removedProfileKeys.length : removedProfileKeys.length + 1
      )
    );
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
    setIsSavingProfiles(true);
    fetch("/api/local-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profiles: nextProfiles.map((profile) => ({ ...profile, visible: true })) })
    })
      .then((response) => {
        if (!response.ok) throw new Error("保存失败");
        return response.json();
      })
      .then((payload) => {
        setLocalProfiles(payload.profiles || []);
        setDirtyProfileKeys([]);
        setRemovedProfileKeys([]);
        setLocalProfilesStatus("已保存");
        setLocalProfileNotice(successNotice);
      })
      .catch(() => {
        setLocalProfilesStatus("保存失败");
        setLocalProfileNotice("保存失败，请稍后重试。");
      })
      .finally(() => {
        setIsSavingProfiles(false);
      });
  }

  return (
    <section className="container section admin-console-shell">
      <div className="admin-workspace-heading">
        <div>
          <h1>辽宁选手库</h1>
          <p>录入 WCA ID、省份、城市，并对历史选手做人工核对记录。</p>
        </div>
        <span className={`status ${unsavedCount > 0 ? "status-低" : ""}`}>{localProfilesStatus}</span>
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
      <datalist id="liaoning-city-options">
        {liaoningCities.map((city) => (
          <option value={city} key={city} />
        ))}
      </datalist>

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

          <div className="admin-profile-filters" aria-label="选手列表筛选">
            <button
              className={profileViewFilter === "all" ? "active" : ""}
              type="button"
              onClick={() => setProfileViewFilter("all")}
            >
              全部
            </button>
            <button
              className={profileViewFilter === "unchecked" ? "active" : ""}
              type="button"
              onClick={() => setProfileViewFilter("unchecked")}
            >
              未核对 {totals.uncheckedProfiles}
            </button>
            <button
              className={profileViewFilter === "unmatched" ? "active" : ""}
              type="button"
              onClick={() => setProfileViewFilter("unmatched")}
            >
              未匹配 {totals.unmatchedProfiles}
            </button>
            <button
              className={profileViewFilter === "local" ? "active" : ""}
              type="button"
              onClick={() => setProfileViewFilter("local")}
            >
              无 WCA ID {totals.localOnlyProfiles}
            </button>
            <button
              className={profileViewFilter === "dirty" ? "active" : ""}
              type="button"
              onClick={() => setProfileViewFilter("dirty")}
            >
              已修改 {dirtyProfileKeys.length}
            </button>
          </div>

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
                          list="liaoning-city-options"
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
                            {profile.checkedAt ? "已核对" : "核对"}
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
                onChange={(value) => setLocalProfile({ ...localProfile, wcaId: value.toUpperCase() })}
              />
            ) : (
              <>
                <Field
                  label="选手姓名"
                  value={localProfile.name}
                  onChange={(value) => setLocalProfile({ ...localProfile, name: value })}
                  placeholder="可输入多个姓名，用空格、换行、逗号或顿号分隔"
                  textarea
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
              list="liaoning-city-options"
            />
          </div>
          {wcaLookupStatus ? <p className="admin-inline-notice">{wcaLookupStatus}</p> : null}

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
            <button className="button primary" disabled={isSavingProfiles} onClick={addLocalProfile} type="button">
              <Plus size={17} />
              新增并保存
            </button>
            <button
              className="button"
              disabled={isSavingProfiles || unsavedCount === 0}
              onClick={() => saveLocalProfiles()}
              type="button"
            >
              <Save size={17} />
              保存列表修改{unsavedCount > 0 ? `（${unsavedCount}）` : ""}
            </button>
          </div>
          <label className="field admin-batch-entry">
            批量 WCA ID
            <textarea
              placeholder="一行一个，或用空格、逗号分隔"
              value={batchWcaIds}
              onChange={(event) => setBatchWcaIds(event.target.value)}
            />
          </label>
          <button
            className="button admin-batch-button"
            disabled={isSavingProfiles || !batchWcaIds.trim()}
            onClick={addBatchWcaProfiles}
            type="button"
          >
            <Plus size={17} />
            批量新增并保存
          </button>
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

function parseLocalProfileNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,，、;；]+/)
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );
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
  type = "text",
  list,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
  textarea?: boolean;
  type?: string;
  list?: string;
  placeholder?: string;
}) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      {label}
      {textarea ? (
        <textarea placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input
          list={list}
          placeholder={placeholder}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
