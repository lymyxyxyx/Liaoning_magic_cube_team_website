"use client";

import { Pencil, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getWeeklyAgeGroup } from "@/lib/weekly-age-groups";
import {
  calculateResultByFormat,
  formatResult,
  getWeeklyResultFormat,
  parseResultInput,
  weeklyResultFormats,
  type ResultValue,
  type WeeklyResultFormat
} from "@/lib/weekly-result-utils";
import type { WCA_EVENTS } from "@/lib/wca-events";
import { matchesWeeklyPlayerQuery } from "@/lib/weekly-player-search";

type MeetOption = {
  id: string;
  slug: string;
  title: string;
  dateLabel: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

type WeeklyPlayer = {
  id: string;
  name: string;
  slug: string;
  wcaId: string;
  gender: "男" | "女";
  province: string;
  city: string;
  birthDate: string;
  ageGroup: string;
  ageGroupIsFuzzy?: boolean;
};

type EnteredResult = {
  id: number;
  rank: number;
  player: WeeklyPlayer;
  best: ResultValue;
  average: ResultValue;
  attempts: ResultValue[];
  detail: string;
};

type Props = {
  initialMeets: MeetOption[];
  initialPlayers?: WeeklyPlayer[];
  events: ReadonlyArray<(typeof WCA_EVENTS)[number]>;
  initialEventConfigs?: Array<{ eventId: string; format: WeeklyResultFormat; enabled: boolean }>;
  variant?: "full" | "workspace";
  mode?: "admin" | "public";
};

const emptyAttempts = ["", "", "", "", ""];
const testMeetId = "weekly-test-entry";

export function WeeklyResultEntryConsole({ initialMeets, initialPlayers = [], events, initialEventConfigs = [], variant = "full", mode = "admin" }: Props) {
  const defaultMeetId = mode === "public" ? initialMeets.find((meet) => meet.id !== testMeetId)?.id || initialMeets[0]?.id || "" : initialMeets[0]?.id || "";
  const [meets, setMeets] = useState(initialMeets);
  const [selectedMeetId, setSelectedMeetId] = useState(defaultMeetId);
  const [selectedEventId, setSelectedEventId] = useState("333");
  const [selectedFormat, setSelectedFormat] = useState<WeeklyResultFormat>("avg5");
  const [results, setResults] = useState<EnteredResult[]>([]);
  const [playerQuery, setPlayerQuery] = useState("");
  const [players, setPlayers] = useState<WeeklyPlayer[]>([]);
  const [knownPlayers, setKnownPlayers] = useState(initialPlayers);
  const [selectedPlayer, setSelectedPlayer] = useState<WeeklyPlayer | null>(null);
  const [attempts, setAttempts] = useState(emptyAttempts);
  const [editingResult, setEditingResult] = useState<EnteredResult | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const attemptRefs = useRef<Array<HTMLInputElement | null>>([]);
  const playerInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFormatConfig = getWeeklyResultFormat(selectedFormat);
  const isPublicMode = mode === "public";

  const calculated = useMemo(() => {
    try {
      if (attempts.some((attempt) => !attempt.trim())) return null;
      return calculateResultByFormat(attempts.map(parseResultInput), selectedFormat);
    } catch {
      return null;
    }
  }, [attempts, selectedFormat]);

  const searchPlayers = useCallback((query: string, signal?: AbortSignal) => {
    const q = query.trim();
    if (!q) {
      setPlayers([]);
      return Promise.resolve();
    }
    const searchParams = new URLSearchParams({ q });
    return fetch(`/api/players/search?${searchParams.toString()}`, { signal })
      .then((response) => {
        if (!response.ok) throw new Error("search");
        return response.json();
      })
      .then((payload: { players: WeeklyPlayer[] }) => {
        const nextPlayers = payload.players || [];
        setPlayers(nextPlayers);
        setKnownPlayers((prev) => mergePlayers(prev, nextPlayers));
      })
      .catch((error) => {
        if (error.name !== "AbortError") setPlayers([]);
      });
  }, []);

  const refreshResults = useCallback(() => {
    if (!selectedMeetId || !selectedEventId) {
      setResults([]);
      return;
    }

    setIsLoadingResults(true);
    fetch(
      `/api/weekly-competitions/${encodeURIComponent(selectedMeetId)}/results?eventId=${encodeURIComponent(selectedEventId)}&format=${encodeURIComponent(selectedFormat)}`
    )
      .then((response) => {
        if (!response.ok) throw new Error("results");
        return response.json();
      })
      .then((payload: { results: EnteredResult[] }) => setResults(payload.results || []))
      .catch(() => setNotice("读取成绩列表失败。"))
      .finally(() => setIsLoadingResults(false));
  }, [selectedEventId, selectedFormat, selectedMeetId]);

  useEffect(() => {
    refreshResults();
  }, [refreshResults]);

  useEffect(() => {
    setAttempts(Array.from({ length: selectedFormatConfig.attemptCount }, () => ""));
  }, [selectedFormatConfig.attemptCount]);

  useEffect(() => {
    if (!isPublicMode) return;
    const configured = initialEventConfigs.find((config) => config.eventId === selectedEventId && config.enabled);
    if (configured) setSelectedFormat(configured.format);
  }, [initialEventConfigs, isPublicMode, selectedEventId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!playerQuery.trim()) {
        setPlayers([]);
        return;
      }
      void searchPlayers(playerQuery, controller.signal);
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [playerQuery, searchPlayers]);

  function refreshMeets() {
    fetch("/api/weekly-competitions")
      .then((response) => {
        if (!response.ok) throw new Error("meets");
        return response.json();
      })
      .then((payload: { meets: MeetOption[] }) => {
        setMeets(payload.meets || []);
        if (!selectedMeetId && payload.meets?.[0]) {
          const nextMeetId = mode === "public" ? payload.meets.find((meet) => meet.id !== testMeetId)?.id || payload.meets[0].id : payload.meets[0].id;
          setSelectedMeetId(nextMeetId);
        }
      })
      .catch(() => setNotice("读取周赛列表失败。"));
  }

  function updateAttempt(index: number, value: string) {
    setAttempts((prev) => prev.map((attempt, attemptIndex) => (attemptIndex === index ? value : attempt)));
  }

  function updatePlayerQuery(value: string) {
    setPlayerQuery(value);
    const exactPlayer = findPlayerByWcaId(value, players) || findPlayerByWcaId(value, knownPlayers) || findPlayerByName(value, players) || findPlayerByName(value, knownPlayers);
    if (exactPlayer) {
      setSelectedPlayer(exactPlayer);
    } else if (selectedPlayer && value !== selectedPlayer.name) {
      setSelectedPlayer(null);
    }
  }

  function handleAttemptKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (index < attempts.length - 1) {
      attemptRefs.current[index + 1]?.focus();
      return;
    }
    saveResult();
  }

  function saveResult() {
    setNotice("");
    if (!selectedMeetId) {
      setNotice("请先选择周赛。");
      return;
    }
    const currentPlayerQuery = playerInputRef.current?.value || playerQuery;
    const playerForSave = selectedPlayer || findPlayerByName(currentPlayerQuery, players) || findPlayerByName(currentPlayerQuery, knownPlayers);
    if (!playerForSave) {
      setNotice("请先选择选手。");
      return;
    }

    let parsedAttempts: ResultValue[];
    try {
      parsedAttempts = attempts.map(parseResultInput);
      calculateResultByFormat(parsedAttempts, selectedFormat);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "成绩格式不正确。");
      return;
    }

    setIsSaving(true);
    if (mode === "admin" && editingResult) {
      if (!correctionReason.trim()) {
        setNotice("请填写修改原因。");
        setIsSaving(false);
        return;
      }

      fetch(`/api/admin/weekly-results/${editingResult.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempts, format: selectedFormat, reason: correctionReason })
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((payload) => {
              throw new Error(payload.message || "修改成绩失败。");
            });
          }
          return response.json();
        })
        .then(() => {
          setAttempts(Array.from({ length: selectedFormatConfig.attemptCount }, () => ""));
          setEditingResult(null);
          setCorrectionReason("");
          setNotice("成绩已纠正并重新排名。");
          refreshResults();
        })
        .catch((error) => setNotice(error instanceof Error ? error.message : "修改成绩失败。"))
        .finally(() => setIsSaving(false));
      return;
    }

    fetch(`/api/weekly-competitions/${encodeURIComponent(selectedMeetId)}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: selectedEventId, format: selectedFormat, player: playerForSave, attempts })
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((payload) => {
            throw new Error(payload.message || "保存成绩失败。");
          });
        }
        return response.json();
      })
      .then((payload: { results: EnteredResult[] }) => {
        setResults(payload.results || []);
        setAttempts(Array.from({ length: selectedFormatConfig.attemptCount }, () => ""));
        setNotice("成绩已保存。");
        attemptRefs.current[0]?.focus();
      })
      .catch((error) => {
        if (error instanceof Error && error.message.includes("无法录入")) {
          setNotice(error.message);
          return;
        }
        setResults((prev) => buildOptimisticResults(prev, playerForSave, parsedAttempts, selectedFormat));
        setAttempts(Array.from({ length: selectedFormatConfig.attemptCount }, () => ""));
        setNotice(error instanceof Error ? `本地已显示，数据库保存失败：${error.message}` : "本地已显示，数据库保存失败。");
        attemptRefs.current[0]?.focus();
      })
      .finally(() => setIsSaving(false));
  }

  function selectPlayer(player: WeeklyPlayer) {
    setSelectedPlayer(player);
    setPlayerQuery(player.name);
    if (playerInputRef.current) playerInputRef.current.value = player.name;
    setPlayers([player]);
  }

  function beginCorrection(result: EnteredResult) {
    selectPlayer(result.player);
    setAttempts(result.attempts.map(formatResult));
    setCorrectionReason("");
    setEditingResult(result);
    setNotice(`正在修改 ${result.player.name} 的成绩。`);
    window.setTimeout(() => attemptRefs.current[0]?.focus(), 0);
  }

  function cancelCorrection() {
    setEditingResult(null);
    setCorrectionReason("");
    setAttempts(Array.from({ length: selectedFormatConfig.attemptCount }, () => ""));
    setNotice("已取消成绩修改。");
  }

  function removeResult(result: EnteredResult) {
    const reason = window.prompt(`请输入删除 ${result.player.name} 成绩的原因：`);
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice("请填写删除原因。");
      return;
    }

    setIsSaving(true);
    fetch(`/api/admin/weekly-results/${result.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then((payload) => {
            throw new Error(payload.message || "删除成绩失败。");
          });
        }
      })
      .then(() => {
        if (editingResult?.id === result.id) cancelCorrection();
        setNotice(`${result.player.name} 的成绩已删除并重新排名。`);
        refreshResults();
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "删除成绩失败。"))
      .finally(() => setIsSaving(false));
  }

  const selectedMeet = meets.find((meet) => meet.id === selectedMeetId);
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const recordedCount = results.length;
  const playerCandidates = useMemo(() => {
    const query = playerQuery.trim();
    if (!query || selectedPlayer) return [];
    const mergedPlayers = mergePlayers(knownPlayers, players);
    const filteredPlayers = mergedPlayers.filter((player) => matchesWeeklyPlayerQuery(player, query));
    return filteredPlayers.slice(0, 8);
  }, [knownPlayers, playerQuery, players, selectedPlayer]);

  return (
    <section
      className={`${variant === "workspace" ? "" : "container section"} weekly-entry-shell weekly-entry-shell--${variant} weekly-entry-shell--${mode}`.trim()}
    >
      <div className="admin-card weekly-admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>{isPublicMode ? "当前周赛成绩" : "单人成绩录入"}</h2>
            <p>
              {isPublicMode
                ? selectedMeet
                  ? `${selectedMeet.dateLabel || selectedMeet.title} · ${formatMeetPeriod(selectedMeet)} · 选择项目和赛制`
                  : "默认录入当前周赛，请选择项目和赛制。"
                : "选择周赛和项目，检索选手后录入五次成绩，保存后右侧榜单立即刷新。"}
            </p>
          </div>
          {!isPublicMode ? (
            <button className="button" type="button" onClick={refreshMeets}>
              <RefreshCw size={16} />
              刷新周赛
            </button>
          ) : null}
        </div>

        <div className={`weekly-entry-controls weekly-entry-controls--compact ${isPublicMode ? "weekly-entry-controls--public" : ""}`.trim()}>
          {!isPublicMode ? (
            <label>
              周赛
              <select value={selectedMeetId} onChange={(event) => setSelectedMeetId(event.target.value)}>
                {meets.map((meet) => (
                  <option value={meet.id} key={meet.id}>
                    {meet.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            项目
            <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
              {events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.name} / {event.englishName}
                </option>
              ))}
            </select>
          </label>
          <label>
            赛制
            <select value={selectedFormat} disabled={isPublicMode} onChange={(event) => setSelectedFormat(event.target.value as WeeklyResultFormat)}>
              {weeklyResultFormats.map((format) => (
                <option value={format.id} key={format.id}>
                  {format.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {notice ? <p className="admin-inline-notice">{notice}</p> : null}
      </div>

      <div className="weekly-entry-grid">
        <div className="weekly-entry-results">
          <div className="section-header">
            <div>
              <span className="eyebrow">{selectedEvent?.name || selectedEventId}</span>
              <h2>当前成绩列表</h2>
              <p className="weekly-entry-progress">当前项目已录入 {recordedCount} 人</p>
            </div>
            <button className="button" type="button" onClick={refreshResults}>
              <RefreshCw size={16} />
              刷新
            </button>
          </div>
          <div className="result-table-wrap">
            <table className="result-table weekly-entry-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>WCA ID</th>
                  <th>姓名</th>
                  <th>省市</th>
                  <th>平均</th>
                  <th>最好</th>
                  <th>成绩</th>
                  {!isPublicMode ? <th>操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <td data-label="排名">{result.rank}</td>
                    <td data-label="WCA ID">{result.player.wcaId}</td>
                    <td data-label="姓名">{result.player.name}</td>
                    <td data-label="省市">{formatRegion(result.player)}</td>
                    <td data-label="平均" className="score-strong">{formatResult(result.average)}</td>
                    <td data-label="最好">{formatResult(result.best)}</td>
                    <td data-label="成绩">{result.detail}</td>
                    {!isPublicMode ? (
                      <td data-label="操作" className="weekly-result-actions">
                        <button className="button" type="button" title="修改成绩" aria-label={`修改 ${result.player.name} 的成绩`} onClick={() => beginCorrection(result)}>
                          <Pencil size={15} />
                        </button>
                        <button className="button" type="button" title="删除成绩" aria-label={`删除 ${result.player.name} 的成绩`} onClick={() => removeResult(result)}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={isPublicMode ? 7 : 8}>{isLoadingResults ? "正在读取成绩..." : "当前项目暂无成绩。"}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card weekly-entry-panel">
        <div className="admin-card-heading">
          <div>
            <h2>{editingResult ? "纠正成绩" : "输入板"}</h2>
            <p>
              {selectedMeet
                ? `${selectedMeet.dateLabel || selectedMeet.title} · ${selectedEvent?.name || selectedEventId} · ${selectedFormatConfig.name}`
                : "请先选择周赛"}
            </p>
          </div>
        </div>

          {selectedPlayer ? (
            <div className="weekly-selected-player">
              <span>当前选手</span>
              <strong>{selectedPlayer.name}</strong>
              <small>{formatPlayerMeta(selectedPlayer)}</small>
            </div>
          ) : null}

          <div className="weekly-player-picker">
            <label className="weekly-player-search">
              选手
              <span>
                <Search size={16} />
                <input
                  ref={playerInputRef}
                  value={playerQuery}
                  onChange={(event) => updatePlayerQuery(event.currentTarget.value)}
                  placeholder="输入姓名或 WCA ID"
                />
              </span>
            </label>

            <div className="weekly-player-results">
              {playerCandidates.map((player) => (
                <button type="button" key={player.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectPlayer(player)}>
                  <strong>{player.wcaId ? `${player.wcaId} · ` : ""}{player.name}</strong>
                  <small>{formatPlayerCandidateMeta(player)}</small>
                </button>
              ))}
              {playerQuery.trim() && !selectedPlayer && playerCandidates.length === 0 ? <p>没有找到选手，请联系管理员先加入周赛选手库。</p> : null}
            </div>
          </div>

          <div className="weekly-attempt-grid">
            {attempts.map((attempt, index) => (
              <label key={index}>
                <span>{index + 1}.</span>
                <input
                  ref={(node) => {
                    attemptRefs.current[index] = node;
                  }}
                  value={attempt}
                  onChange={(event) => updateAttempt(index, event.target.value)}
                  onKeyDown={(event) => handleAttemptKeyDown(event, index)}
                  placeholder="00:00.00"
                />
              </label>
            ))}
          </div>

          <div className="weekly-calculated">
            <div>
              <span>最好单次</span>
              <strong>{calculated ? formatResult(calculated.best) : "-"}</strong>
            </div>
            <div>
              <span>平均</span>
              <strong>{calculated ? formatResult(calculated.average) : "-"}</strong>
            </div>
          </div>

          {editingResult ? (
            <label className="weekly-correction-reason">
              修改原因
              <input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="例如：选手反馈录入错误" />
            </label>
          ) : null}

          <button className="button primary weekly-save-result" type="button" disabled={isSaving || !selectedMeetId} onClick={saveResult}>
            <Save size={17} />
            {isSaving ? "保存中" : editingResult ? "保存纠正" : "保存成绩"}
          </button>
          {editingResult ? (
            <button className="button weekly-cancel-correction" type="button" disabled={isSaving} onClick={cancelCorrection}>
              <X size={16} />
              取消修改
            </button>
          ) : null}
          {notice ? <p className="admin-inline-notice">{notice}</p> : null}
        </div>

      </div>
    </section>
  );
}

function buildOptimisticResults(prev: EnteredResult[], player: WeeklyPlayer, attempts: ResultValue[], format: WeeklyResultFormat): EnteredResult[] {
  const calculated = calculateResultByFormat(attempts, format);
  const nextResult: EnteredResult = {
    id: Math.max(0, ...prev.map((result) => result.id)) + 1,
    rank: 0,
    player,
    best: calculated.best,
    average: calculated.average,
    attempts,
    detail: attempts.map(formatResult).join(" / ")
  };
  const withoutSamePlayer = prev.filter((result) => result.player.name !== player.name);
  const sorted = [nextResult, ...withoutSamePlayer].sort(compareEnteredResults);
  return sorted.map((result, index) => ({ ...result, rank: index + 1 }));
}

function findPlayerByName(name: string, players: WeeklyPlayer[]) {
  const trimmedName = name.trim();
  if (!trimmedName) return null;
  return players.find((player) => player.name === trimmedName) || null;
}

function findPlayerByWcaId(wcaId: string, players: WeeklyPlayer[]) {
  const normalizedWcaId = wcaId.trim().toUpperCase();
  if (!normalizedWcaId) return null;
  return players.find((player) => player.wcaId.toUpperCase() === normalizedWcaId) || null;
}

function mergePlayers(currentPlayers: WeeklyPlayer[], nextPlayers: WeeklyPlayer[]) {
  const merged = new Map<string, WeeklyPlayer>();
  for (const player of currentPlayers) merged.set(player.id, player);
  for (const player of nextPlayers) merged.set(player.id, player);
  return Array.from(merged.values());
}

function compareEnteredResults(a: EnteredResult, b: EnteredResult) {
  const aAverage = typeof a.average === "number" ? a.average : Number.MAX_SAFE_INTEGER;
  const bAverage = typeof b.average === "number" ? b.average : Number.MAX_SAFE_INTEGER;
  if (aAverage !== bAverage) return aAverage - bAverage;
  const aBest = typeof a.best === "number" ? a.best : Number.MAX_SAFE_INTEGER;
  const bBest = typeof b.best === "number" ? b.best : Number.MAX_SAFE_INTEGER;
  if (aBest !== bBest) return aBest - bBest;
  return a.player.name.localeCompare(b.player.name, "zh-Hans-CN");
}

function formatPlayerMeta(player: WeeklyPlayer) {
  return [
    `WCA ID：${player.wcaId || "无"}`,
    `性别：${player.gender || "-"}`,
    `省：${player.province || "-"}`,
    `市：${player.city || "-"}`,
    `组别：${getPlayerDisplayAgeGroup(player) || "待补"}`
  ].join(" · ");
}

function formatMeetPeriod(meet: Pick<MeetOption, "startsAt" | "endsAt">) {
  const format = (value: Date) => `${value.getFullYear()}年${value.getMonth() + 1}月${value.getDate()}日`;
  if (meet.startsAt && meet.endsAt) return `${format(new Date(meet.startsAt))} 至 ${format(new Date(meet.endsAt))}`;

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${format(monday)} 至 ${format(sunday)}`;
}

function formatPlayerCandidateMeta(player: WeeklyPlayer) {
  return [player.gender || "-", player.province || "", player.city || "", getPlayerDisplayAgeGroup(player)].filter(Boolean).join(" · ");
}

function formatRegion(player: WeeklyPlayer) {
  return [player.province, player.city].filter(Boolean).join(" · ") || "-";
}

function getPlayerDisplayAgeGroup(player: Pick<WeeklyPlayer, "birthDate" | "ageGroup">) {
  return getWeeklyAgeGroup(player.birthDate) || player.ageGroup || "";
}
