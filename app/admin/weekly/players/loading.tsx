export default function AdminWeeklyPlayersLoading() {
  return (
    <section className="container section" aria-live="polite" aria-busy="true">
      <div className="admin-card weekly-players-loading">
        <strong>正在打开周赛选手库…</strong>
        <span>正在读取选手档案，请稍候。</span>
      </div>
    </section>
  );
}
