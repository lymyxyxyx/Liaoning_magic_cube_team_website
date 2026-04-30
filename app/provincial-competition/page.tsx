import { PageHero } from "@/components/page-hero";

export default function ProvincialCompetitionPage() {
  return (
    <>
      <PageHero label="省赛专题" title="2026年辽宁省魔方运动公开赛">
        辽宁省体育总会、沈阳市浑南区体育局主办的省级公开赛事，汇集全省魔方爱好者展开竞技交流。
      </PageHero>

      <section className="container section">
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          {/* 基本信息 */}
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "24px", marginBottom: "20px", color: "#333" }}>📌 赛事基本信息</h2>
            <div
              style={{
                background: "#f5f5f5",
                padding: "24px",
                borderRadius: "8px",
                borderLeft: "4px solid #667eea"
              }}
            >
              <div style={{ marginBottom: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <strong style={{ display: "block", marginBottom: "4px", color: "#667eea" }}>比赛时间</strong>
                  <p style={{ margin: "0", fontSize: "16px" }}>2026年5月17日（周日）</p>
                </div>
                <div>
                  <strong style={{ display: "block", marginBottom: "4px", color: "#667eea" }}>比赛地点</strong>
                  <p style={{ margin: "0", fontSize: "16px" }}>沈阳市浑南区欧亚长青城</p>
                </div>
              </div>
              <div style={{ marginTop: "16px", borderTop: "1px solid #e0e0e0", paddingTop: "16px" }}>
                <strong style={{ display: "block", marginBottom: "8px", color: "#667eea" }}>报名时间</strong>
                <p style={{ margin: "0", fontSize: "16px" }}>2026年4月30日 - 2026年5月9日</p>
                <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#666" }}>报名方式：扫码报名</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#666" }}>报名联系人：张国强 15640445740</p>
              </div>
            </div>
          </div>

          {/* 比赛项目 */}
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "24px", marginBottom: "20px", color: "#333" }}>🏆 比赛项目与分组</h2>
            <div style={{ background: "#f5f5f5", padding: "24px", borderRadius: "8px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#333" }}>竞赛项目（7项）</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                {["二阶", "三阶", "金字塔", "枫叶魔方", "三阶镜面", "二阶盲拧", "三阶盲拧"].map((item) => (
                  <div
                    key={item}
                    style={{
                      background: "#fff",
                      padding: "12px",
                      borderRadius: "6px",
                      textAlign: "center",
                      border: "1px solid #e0e0e0"
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: "16px", marginTop: "24px", marginBottom: "12px", color: "#333" }}>竞赛分组</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {[
                  { name: "U6组", desc: "2020.5.18-2022.5.17出生" },
                  { name: "U8组", desc: "2018.5.18-2020.5.17出生" },
                  { name: "U10组", desc: "2016.5.18-2018.5.17出生" },
                  { name: "U12组", desc: "2014.5.18-2016.5.17出生" },
                  { name: "O12组", desc: "2014.5.17及之前出生" }
                ].map((group) => (
                  <div
                    key={group.name}
                    style={{
                      background: "#fff",
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0"
                    }}
                  >
                    <strong style={{ color: "#667eea" }}>{group.name}</strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#666" }}>{group.desc}</p>
                  </div>
                ))}
              </div>
              <p style={{ margin: "12px 0 0 0", fontSize: "14px", color: "#666" }}>
                注：所有组别均设置男、女组
              </p>
            </div>
          </div>

          {/* 赛程安排 */}
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "24px", marginBottom: "20px", color: "#333" }}>⏰ 赛程安排</h2>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                  background: "#fff",
                  borderRadius: "8px",
                  overflow: "hidden"
                }}
              >
                <thead>
                  <tr style={{ background: "#667eea", color: "#fff" }}>
                    <th style={{ padding: "12px", textAlign: "left" }}>开始时间</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>结束时间</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>项目</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { start: "10:00", end: "10:20", project: "报到入场", note: "-" },
                    { start: "10:20", end: "10:30", project: "开幕仪式", note: "-" },
                    { start: "10:30", end: "12:00", project: "三阶比赛", note: "200人限制" },
                    { start: "12:00", end: "12:30", project: "三阶盲拧比赛", note: "80人限制" },
                    { start: "12:30", end: "13:00", project: "颁奖、合影", note: "-" },
                    { start: "13:30", end: "14:00", project: "二阶盲拧比赛", note: "80人限制" },
                    { start: "14:00", end: "14:50", project: "金字塔比赛", note: "150人限制" },
                    { start: "14:50", end: "15:40", project: "二阶比赛", note: "150人限制" },
                    { start: "15:40", end: "16:20", project: "枫叶比赛", note: "150人限制" },
                    { start: "16:20", end: "17:00", project: "镜面比赛", note: "80人限制" },
                    { start: "16:20", end: "16:30", project: "抽奖", note: "-" },
                    { start: "16:30", end: "17:10", project: "颁奖、合影", note: "-" },
                    { start: "17:30", end: "17:30", project: "比赛结束", note: "-" }
                  ].map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid #e0e0e0",
                        background: idx % 2 === 0 ? "#fff" : "#fafafa"
                      }}
                    >
                      <td style={{ padding: "12px" }}>{item.start}</td>
                      <td style={{ padding: "12px" }}>{item.end}</td>
                      <td style={{ padding: "12px" }}>{item.project}</td>
                      <td style={{ padding: "12px" }}>{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 费用说明 */}
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "24px", marginBottom: "20px", color: "#333" }}>💰 费用说明</h2>
            <div style={{ background: "#f5f5f5", padding: "24px", borderRadius: "8px" }}>
              <div style={{ marginBottom: "16px" }}>
                <strong style={{ display: "block", marginBottom: "8px", color: "#667eea" }}>报名费</strong>
                <p style={{ margin: "0", fontSize: "16px" }}>
                  基础报名费 <strong>160元</strong>（含一项），每增加一项加 <strong>20元</strong>
                </p>
              </div>
              <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "16px" }}>
                <strong style={{ display: "block", marginBottom: "8px", color: "#667eea" }}>自理费用</strong>
                <ul style={{ margin: "0", paddingLeft: "20px", fontSize: "14px" }}>
                  <li>人身意外伤害保险（比赛期间及往返途中）</li>
                  <li>食宿费</li>
                  <li>交通费</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 奖励规则 */}
          <div style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "24px", marginBottom: "20px", color: "#333" }}>🎖️ 奖励规则</h2>
            <div style={{ background: "#f5f5f5", padding: "24px", borderRadius: "8px" }}>
              <ul style={{ margin: "0", paddingLeft: "20px", fontSize: "16px" }}>
                <li style={{ marginBottom: "8px" }}>每个项目一轮（复原三次），成绩选取三次最快成绩作为最终成绩</li>
                <li style={{ marginBottom: "8px" }}>各项目前三名发放奖牌、证书</li>
                <li>所有参赛选手统一发放完赛证书</li>
              </ul>
              <p style={{ margin: "16px 0 0 0", fontSize: "14px", color: "#666" }}>
                <strong>注：</strong>所有个人单项赛按成绩组别进行比赛颁奖，不合并分组。获奖选手必须出席颁奖，否则取消所获奖项。
              </p>
            </div>
          </div>

          {/* 主办方信息 */}
          <div>
            <h2 style={{ fontSize: "24px", marginBottom: "20px", color: "#333" }}>🏛️ 赛事组织</h2>
            <div style={{ background: "#f5f5f5", padding: "24px", borderRadius: "8px", fontSize: "14px" }}>
              <div style={{ marginBottom: "12px" }}>
                <strong style={{ color: "#667eea" }}>主办单位</strong>
                <p style={{ margin: "4px 0 0 0" }}>辽宁省体育总会、沈阳市浑南区体育局</p>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong style={{ color: "#667eea" }}>承办单位</strong>
                <p style={{ margin: "4px 0 0 0" }}>沈阳市魔方运动协会</p>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <strong style={{ color: "#667eea" }}>执行单位</strong>
                <p style={{ margin: "4px 0 0 0" }}>沈阳众弈教育信息咨询有限公司</p>
              </div>
              <div>
                <strong style={{ color: "#667eea" }}>协办单位</strong>
                <p style={{ margin: "4px 0 0 0" }}>
                  鞍山市魔方协会、抚顺市魔方运动协会、丹东市魔方协会、铁岭市魔方运动协会、葫芦岛市魔方协会、优尔教育集团
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
