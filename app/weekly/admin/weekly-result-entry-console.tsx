"use client";

import { RefreshCw, Save, Search } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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

type MeetOption = {
  id: string;
  slug: string;
  title: string;
  dateLabel: string;
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
  events: typeof WCA_EVENTS;
  variant?: "full" | "workspace";
};

const emptyAttempts = ["", "", "", "", ""];
const minSearchLength = 1;

export function WeeklyResultEntryConsole({ initialMeets, events, variant = "full" }: Props) {
  const [meets, setMeets] = useState(initialMeets);
  const [selectedMeetId, setSelectedMeetId] = useState(initialMeets[0]?.id || "");
  const [selectedEventId, setSelectedEventId] = useState("333");
  const [selectedFormat, setSelectedFormat] = useState<WeeklyResultFormat>("avg5");
  const [results, setResults] = useState<EnteredResult[]>([]);
  const [playerQuery, setPlayerQuery] = useState("");
  const [players, setPlayers] = useState<WeeklyPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<WeeklyPlayer | null>(null);
  const [attempts, setAttempts] = useState(emptyAttempts);
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const attemptRefs = useRef<Array<HTMLInputElement | null>>([]);
  const selectedFormatConfig = getWeeklyResultFormat(selectedFormat);

  const calculated = useMemo(() => {
    try {
      if (attempts.some((attempt) => !attempt.trim())) return null;
      return calculateResultByFormat(attempts.map(parseResultInput), selectedFormat);
    } catch {
      return null;
    }
  }, [attempts, selectedFormat]);

  useEffect(() => {
    refreshResults();
  }, [selectedMeetId, selectedEventId, selectedFormat]);

  useEffect(() => {
    setAttempts(Array.from({ length: selectedFormatConfig.attemptCount }, () => ""));
  }, [selectedFormatConfig.attemptCount]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!playerQuery.trim()) {
        setPlayers([]);
        return;
      }
      fetch(`/api/players/search?q=${encodeURIComponent(playerQuery)}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("search");
          return response.json();
        })
        .then((payload: { players: WeeklyPlayer[] }) => setPlayers(payload.players || []))
        .catch((error) => {
          if (error.name !== "AbortError") setPlayers([]);
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [playerQuery]);

  function refreshMeets() {
    fetch("/api/weekly-competitions")
      .then((response) => {
        if (!response.ok) throw new Error("meets");
        return response.json();
      })
      .then((payload: { meets: MeetOption[] }) => {
        setMeets(payload.meets || []);
        if (!selectedMeetId && payload.meets?.[0]) setSelectedMeetId(payload.meets[0].id);
      })
      .catch(() => setNotice("读取周赛列表失败。"));
  }

  function refreshResults() {
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
  }

  function updateAttempt(index: number, value: string) {
    setAttempts((prev) => prev.map((attempt, attemptIndex) => (attemptIndex === index ? value : attempt)));
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
    if (!selectedPlayer) {
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
    fetch(`/api/weekly-competitions/${encodeURIComponent(selectedMeetId)}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: selectedEventId, format: selectedFormat, player: selectedPlayer, attempts })
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
        setResults((prev) => buildOptimisticResults(prev, selectedPlayer, parsedAttempts, selectedFormat));
        setAttempts(Array.from({ length: selectedFormatConfig.attemptCount }, () => ""));
        setNotice(error instanceof Error ? `本地已显示，数据库保存失败：${error.message}` : "本地已显示，数据库保存失败。");
        attemptRefs.current[0]?.focus();
      })
      .finally(() => setIsSaving(false));
  }

  function selectPlayer(player: WeeklyPlayer) {
    setSelectedPlayer(player);
    setPlayerQuery(player.name);
    setPlayers([player]);
  }

  const selectedMeet = meets.find((meet) => meet.id === selectedMeetId);
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const recordedCount = results.length;
  const shouldShowPlayerResults = playerQuery.trim().length >= minSearchLength;

  return (
    <section className={`${variant === "workspace" ? "" : "container section"} weekly-entry-shell weekly-entry-shell--${variant}`.trim()}>
      <div className="admin-card weekly-admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>单人成绩录入</h2>
            <p>选择周赛和项目，检索选手后录入五次成绩，保存后右侧榜单立即刷新。</p>
          </div>
          <button className="button" type="button" onClick={refreshMeets}>
            <RefreshCw size={16} />
            刷新周赛
          </button>
        </div>

        <div className="weekly-entry-controls weekly-entry-controls--compact">
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
            <select value={selectedFormat} onChange={(event) => setSelectedFormat(event.target.value as WeeklyResultFormat)}>
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
              <p className="weekly-entry-progress">已录/未录/总数：{recordedCount} / - / {recordedCount}</p>
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
                  <th>No.</th>
                  <th>姓名</th>
                  <th>省市</th>
                  <th>平均</th>
                  <th>最好</th>
                  <th>成绩</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <td data-label="排名">{result.rank}</td>
                    <td data-label="No.">{result.id}</td>
                    <td data-label="姓名">{result.player.name}</td>
                    <td data-label="省市">{formatRegion(result.player)}</td>
                    <td data-label="平均" className="score-strong">{formatResult(result.average)}</td>
                    <td data-label="最好">{formatResult(result.best)}</td>
                    <td data-label="成绩">{result.detail}</td>
                  </tr>
                ))}
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={7}>{isLoadingResults ? "正在读取成绩..." : "当前项目暂无成绩。"}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card weekly-entry-panel">
        <div className="admin-card-heading">
          <div>
            <h2>输入板</h2>
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

          <label className="weekly-player-search">
            选手
            <span>
              <em>No.</em>
              <Search size={16} />
              <input value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} placeholder="输入中文名" />
            </span>
          </label>

          {shouldShowPlayerResults ? (
            <div className="weekly-player-results">
              {players.map((player) => (
                <button
                  className={selectedPlayer?.id === player.id ? "is-selected" : ""}
                  type="button"
                  key={`${player.id}-${player.name}`}
                  onClick={() => selectPlayer(player)}
                >
                  <strong>{player.name}</strong>
                  <small>{formatPlayerCandidateMeta(player)}</small>
                </button>
              ))}
              {players.length === 0 ? <p>没有找到选手，请联系管理员先加入周赛选手库。</p> : null}
            </div>
          ) : null}

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

          <button className="button primary weekly-save-result" type="button" disabled={isSaving || !selectedMeetId} onClick={saveResult}>
            <Save size={17} />
            {isSaving ? "保存中" : "保存成绩"}
          </button>
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
    `性别：${player.gender || "-"}`,
    `省：${player.province || "-"}`,
    `市：${player.city || "-"}`,
    `组别：${getPlayerAgeGroup(player.birthDate) || "待补"}`
  ].join(" · ");
}

function formatPlayerCandidateMeta(player: WeeklyPlayer) {
  return [player.gender || "-", player.province || "", player.city || "", getPlayerAgeGroup(player.birthDate)].filter(Boolean).join(" · ");
}

function formatRegion(player: WeeklyPlayer) {
  return [player.province, player.city].filter(Boolean).join(" · ") || "-";
}

function getPlayerAgeGroup(birthDate: string) {
  const age = getPlayerAge(birthDate);
  if (age === null) return "";
  if (age <= 6) return "U6";
  if (age <= 8) return "U8";
  if (age <= 10) return "U10";
  if (age <= 12) return "U12";
  if (age < 18) return "U18";
  if (age < 30) return "O18";
  if (age < 40) return "O30";
  return "O40";
}

function getPlayerAge(birthDate: string) {
  if (!birthDate) return null;
  const birthday = new Date(birthDate);
  if (Number.isNaN(birthday.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}
